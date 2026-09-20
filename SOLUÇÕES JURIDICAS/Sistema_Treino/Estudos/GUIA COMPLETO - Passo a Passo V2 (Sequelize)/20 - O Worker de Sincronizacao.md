# 20 — O Worker de Sincronização

## 🎯 Objetivo

Criar o processo que efetivamente consome a fila: consulta o "tribunal" (simulado), grava as movimentações e atualiza o status do processo — o outro lado da fila criada no passo 17.

## 📝 Código

Crie `src/workers/lawsuitSync.worker.ts`:

```typescript
// src/workers/lawsuitSync.worker.ts
import { Worker, type Job } from 'bullmq';
import type { Transaction } from 'sequelize';
import dotenv from 'dotenv';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE, type LawsuitSyncJobData } from '../queues/lawsuitSync.queue.js';
import { fetchTribunalMovements } from './tribunalApi.simulator.js';
import { sequelize, Lawsuit, Movement } from '../models/index.js';

dotenv.config();

const WORKER_CONCURRENCY = Number(process.env.LAWSUIT_SYNC_CONCURRENCY) || 5;

/**
 * Processa um job de sincronização:
 *  1. Consulta a fonte externa (simulada) por novas movimentações.
 *  2. Persiste as movimentações capturadas.
 *  3. Atualiza o status do processo para 'UPDATED'.
 *
 * Qualquer erro lançado aqui é interpretado pelo BullMQ como falha do
 * job, disparando o retry com backoff exponencial (passo 17).
 */
async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<{ movementsSaved: number }> {
  const { lawsuitId, cnjNumber } = job.data;

  console.log(
    `[worker:lawsuit-sync] job=${job.id} tentativa=${job.attemptsMade + 1} lawsuit=${lawsuitId} cnj=${cnjNumber}`
  );

  const capturedMovements = await fetchTribunalMovements(cnjNumber);

  // sequelize.transaction: ou TODAS as mudanças abaixo são salvas, ou
  // NENHUMA é — nunca ficamos com movimentações salvas mas o status
  // desatualizado, ou vice-versa.
  const result = await sequelize.transaction(async (transaction: Transaction) => {
    await Movement.bulkCreate(
      capturedMovements.map((m) => ({ lawsuitId, description: m.description, date: m.date })),
      { transaction }
    );

    await Lawsuit.update({ status: 'UPDATED' }, { where: { id: lawsuitId }, transaction });

    return { movementsSaved: capturedMovements.length };
  });

  console.log(`[worker:lawsuit-sync] job=${job.id} concluído — ${result.movementsSaved} movimentação(ões) salva(s).`);

  return result;
}

export const lawsuitSyncWorker = new Worker<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, processLawsuitSync, {
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY,
});

lawsuitSyncWorker.on('failed', (job, err) => {
  if (!job) return;
  console.error(
    `[worker:lawsuit-sync] job=${job.id} falhou na tentativa ${job.attemptsMade}/${job.opts.attempts ?? 1}: ${err.message}`
  );
});

lawsuitSyncWorker.on('completed', (job) => {
  console.log(`[worker:lawsuit-sync] job=${job.id} finalizado com sucesso.`);
});

lawsuitSyncWorker.on('error', (err) => {
  console.error('[worker:lawsuit-sync] Erro no worker:', err);
});

console.log(`[worker:lawsuit-sync] Worker iniciado (concurrency=${WORKER_CONCURRENCY}). Aguardando jobs...`);

// Encerramento gracioso: espera os jobs em andamento terminarem antes
// de sair, em vez de matar o processo no meio de uma escrita.
async function shutdown(signal: string) {
  console.log(`[worker:lawsuit-sync] Recebido ${signal}, encerrando...`);
  await lawsuitSyncWorker.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

> 💡 **Por que o Worker é um arquivo separado, executado com um comando diferente da API?** São dois processos Node completamente independentes. A API responde requisições HTTP rapidamente e não deve ficar presa esperando uma consulta lenta ao tribunal; o Worker pode (e deve) demorar o quanto precisar, sem impactar a API. Isso também permite escalar cada um independentemente (você vai ver isso de verdade no PM2, passo 27).

Adicione o script `worker` ao `package.json`:

```json
{
  "scripts": {
    "worker": "tsx watch src/workers/lawsuitSync.worker.ts"
  }
}
```

## ✅ Como confirmar que funcionou

Em um terminal, com a API já rodando (`npm run dev`, ou dentro do Docker):

```bash
npm run worker
```

Em outro terminal, dispare uma importação (reaproveitando o passo 19):

```bash
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0007777-33.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

No terminal do worker, você deve ver o job sendo processado (e, com ~25% de chance, uma falha simulada seguida de retry automático). Depois, confirme no banco:

```bash
curl http://localhost:3000/api/lawsuits/<ID_DO_PROCESSO>
```

O `status` deve ter mudado para `UPDATED`, com movimentações no array `movements`.

## 🔧 Commit sugerido

```bash
git add src/workers/lawsuitSync.worker.ts package.json
git commit -m "feat: adicionar worker de sincronizacao de processos"
```
