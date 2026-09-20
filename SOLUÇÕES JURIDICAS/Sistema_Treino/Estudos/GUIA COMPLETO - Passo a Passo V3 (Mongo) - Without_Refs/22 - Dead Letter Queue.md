# 22 — Dead Letter Queue (DLQ)

## 🎯 Objetivo

Garantir que um job que falha **todas** as tentativas (não só uma falha intermediária) não desapareça silenciosamente — ele vai parar numa coleção dedicada, para investigação manual.

## 📝 Código

Crie `src/models/deadLetterJob.model.ts`:

```typescript
// src/models/deadLetterJob.model.ts
import { Schema, model } from 'mongoose';

const deadLetterJobSchema = new Schema(
  {
    queueName: { type: String, required: true },
    jobId: { type: String, required: true },

    // Nula-vel de propósito — mas repare que, diferente do
    // onDelete: 'SET NULL' da V2 (que era GARANTIDO pelo Postgres se um
    // dia o processo original fosse apagado), aqui não existe nenhum
    // mecanismo do banco cuidando disso. Se um Lawsuit for apagado, um
    // lawsuitId antigo aqui simplesmente continua apontando para um id
    // que não existe mais — o MongoDB não vai limpar isso sozinho.
    // É uma troca real de robustez por simplicidade que vale conhecer:
    // bancos relacionais garantem esse tipo de coisa por baixo; bancos
    // de documento deixam a cargo da aplicação (ou você simplesmente
    // aceita o risco, como fazemos aqui, por ser só um log de erros).
    lawsuitId: { type: Schema.Types.ObjectId, ref: 'Lawsuit', default: null },

    payload: { type: Schema.Types.Mixed, required: true },
    errorMessage: { type: String, required: true },
    attemptsMade: { type: Number, required: true },
    failedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

deadLetterJobSchema.index({ lawsuitId: 1 });
deadLetterJobSchema.index({ queueName: 1 });

const DeadLetterJob = model('DeadLetterJob', deadLetterJobSchema);

export default DeadLetterJob;
```

> 💡 **`Schema.Types.Mixed`, para `payload`.** É o "escape hatch" do Mongoose para "qualquer estrutura de objeto, sem validar o formato" — usado aqui porque o payload de um job pode, em tese, ter um formato ligeiramente diferente dependendo da fila (mesmo este projeto só tendo uma fila hoje). É o equivalente ao `JSONB` que a V2 usava no Postgres para o mesmo campo.

Atualize `src/models/index.ts` (editando o arquivo do passo 15):

```typescript
// src/models/index.ts
import mongoose from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import DeadLetterJob from './deadLetterJob.model.js';

export { mongoose, Client, Lawsuit, DeadLetterJob };
```

Atualize `src/workers/lawsuitSync.worker.ts` (editando o arquivo do passo 20), gravando na DLQ quando todas as tentativas se esgotarem:

```typescript
// src/workers/lawsuitSync.worker.ts — só o import e o handler 'failed' mudam
import { Lawsuit, DeadLetterJob } from '../models/index.js';

// ...processLawsuitSync continua igual ao passo 20...

lawsuitSyncWorker.on('failed', async (job, err) => {
  if (!job) return;

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;

  console.error(`[worker:lawsuit-sync] job=${job.id} falhou na tentativa ${attemptsMade}/${maxAttempts}: ${err.message}`);

  // Só vai para a DLQ quando TODAS as tentativas se esgotaram — falhas
  // intermediárias são esperadas e tratadas pelo retry/backoff.
  if (attemptsMade >= maxAttempts) {
    try {
      await DeadLetterJob.create({
        queueName: LAWSUIT_SYNC_QUEUE,
        jobId: String(job.id),
        lawsuitId: job.data.lawsuitId,
        payload: { ...job.data },
        errorMessage: err.message,
        attemptsMade,
      });
      console.error(`[worker:lawsuit-sync] job=${job.id} movido para a DLQ (dead_letter_jobs).`);
    } catch (dlqError) {
      console.error(`[worker:lawsuit-sync] FALHA CRÍTICA ao gravar DLQ do job=${job.id}:`, dlqError);
    }
  }
});
```

## ✅ Como confirmar que funcionou

Como a falha é simulada com 25% de chance **por tentativa**, esgotar as 5 tentativas é raro (0.25⁵ ≈ 0,1%). Para forçar isso, aumente temporariamente `SIMULATED_FAILURE_RATE` em `tribunalApi.simulator.ts` (passo 18) para `0.95`, dispare uma importação, espere as 5 tentativas (alguns segundos, por causa do backoff), e confirme:

```bash
docker exec -it jurisengine_mongo mongosh juris_db --eval "db.deadletterjobs.find().pretty()"
```

> Repare no nome da coleção: `deadletterjobs` — o Mongoose pluraliza e coloca em minúsculas o nome do model (`DeadLetterJob`) automaticamente para decidir o nome da coleção no banco, a menos que você diga o contrário explicitamente.

Depois, **volte** `SIMULATED_FAILURE_RATE` para `0.25`.

## 🔧 Commit sugerido

```bash
git add src/models/deadLetterJob.model.ts src/models/index.ts src/workers/lawsuitSync.worker.ts
git commit -m "feat: adicionar dead letter queue para jobs definitivamente falhos"
```
