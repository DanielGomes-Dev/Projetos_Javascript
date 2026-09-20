# 22 — Dead Letter Queue (DLQ)

## 🎯 Objetivo

Garantir que um job que falha **todas** as tentativas (não só uma falha intermediária) não desapareça silenciosamente — ele vai parar numa tabela dedicada, para investigação manual.

## Passo a passo

**1.** Gere e edite a migration:

```bash
npx sequelize-cli migration:generate --name create-dead-letter-jobs
```

```javascript
// src/database/migrations/<timestamp>-create-dead-letter-jobs.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dead_letter_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      queue_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      job_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Nula-vel de propósito, e com onDelete: SET NULL (não CASCADE,
      // diferente de "movements" no passo 15): se o processo original
      // for apagado, o registro da DLQ continua existindo para
      // investigação — só perde a referência ao processo.
      lawsuit_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'lawsuits', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      attempts_made: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('dead_letter_jobs', ['lawsuit_id']);
    await queryInterface.addIndex('dead_letter_jobs', ['queue_name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('dead_letter_jobs');
  },
};
```

> ⚠️ **Atenção especial a este arquivo.** Ele existe justamente por ser fácil de errar: no projeto original que deu origem a este guia, este arquivo específico acabou sendo salvo, por engano, com o conteúdo do `lawsuitSync.worker.ts` colado nele (um "colar no arquivo errado"). O sintoma é um erro de sintaxe (`Cannot use import statement outside a module`) ao rodar `npm run db:migrate`. Se isso acontecer com você, confira se este arquivo tem exatamente o conteúdo acima — nada de `import`, só `module.exports`.

**2.** Rode a migration:

```bash
npm run db:migrate
```

**3.** Crie `src/models/deadLetterJob.model.ts`:

```typescript
// src/models/deadLetterJob.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface DeadLetterJobAttributes {
  id: string;
  queueName: string;
  jobId: string;
  lawsuitId: string | null;
  payload: Record<string, unknown>;
  errorMessage: string;
  attemptsMade: number;
  failedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type DeadLetterJobCreationAttributes = Optional<DeadLetterJobAttributes, 'id' | 'lawsuitId' | 'failedAt'>;

class DeadLetterJob
  extends Model<DeadLetterJobAttributes, DeadLetterJobCreationAttributes>
  implements DeadLetterJobAttributes
{
  declare id: string;
  declare queueName: string;
  declare jobId: string;
  declare lawsuitId: string | null;
  declare payload: Record<string, unknown>;
  declare errorMessage: string;
  declare attemptsMade: number;
  declare failedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

DeadLetterJob.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    queueName: { type: DataTypes.STRING, allowNull: false, field: 'queue_name' },
    jobId: { type: DataTypes.STRING, allowNull: false, field: 'job_id' },
    lawsuitId: { type: DataTypes.UUID, allowNull: true, field: 'lawsuit_id' },
    payload: { type: DataTypes.JSONB, allowNull: false },
    errorMessage: { type: DataTypes.TEXT, allowNull: false, field: 'error_message' },
    attemptsMade: { type: DataTypes.INTEGER, allowNull: false, field: 'attempts_made' },
    failedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'failed_at' },
  },
  { sequelize, modelName: 'DeadLetterJob', tableName: 'dead_letter_jobs', underscored: true }
);

export default DeadLetterJob;
```

**4.** Atualize `src/models/index.ts` (editando o arquivo do passo 15):

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import Movement from './movement.model.js';
import DeadLetterJob from './deadLetterJob.model.js';

Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

Lawsuit.hasMany(Movement, { foreignKey: 'lawsuitId', as: 'movements' });
Movement.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

Lawsuit.hasMany(DeadLetterJob, { foreignKey: 'lawsuitId', as: 'deadLetterJobs' });
DeadLetterJob.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

export { sequelize, Client, Lawsuit, Movement, DeadLetterJob };
```

**5.** Atualize `src/workers/lawsuitSync.worker.ts` (editando o arquivo do passo 20), gravando na DLQ quando todas as tentativas se esgotarem:

```typescript
// src/workers/lawsuitSync.worker.ts — só o handler 'failed' muda
import { sequelize, Lawsuit, Movement, DeadLetterJob } from '../models/index.js';

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
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT job_id, error_message, attempts_made FROM dead_letter_jobs;"
```

Depois, **volte** `SIMULATED_FAILURE_RATE` para `0.25`.

## 🔧 Commit sugerido

```bash
git add src/database/migrations src/models/deadLetterJob.model.ts src/models/index.ts src/workers/lawsuitSync.worker.ts
git commit -m "feat: adicionar dead letter queue para jobs definitivamente falhos"
```
