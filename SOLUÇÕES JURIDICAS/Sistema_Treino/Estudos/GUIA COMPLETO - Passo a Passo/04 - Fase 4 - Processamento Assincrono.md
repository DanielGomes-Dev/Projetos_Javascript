# Fase 4 — Processamento Assíncrono, Jobs e Workers

> Objetivo desta fase: a peça que dá nome ao projeto ("Motor Jurídico **Assíncrono**"). Vamos criar a fila que recebe pedidos de sincronização de processos, o Worker que consome essa fila em segundo plano, a simulação de uma API externa de tribunal (com falhas propositais), e o sistema de retry + Dead Letter Queue para quando tudo dá errado mesmo assim.

---

## 4.1. Arquitetura da Fila/Worker

### Duas abordagens possíveis (e por que escolhemos BullMQ + Redis)

O TODO original lista duas opções: **BullMQ/Redis** ou uma **tabela de Jobs no próprio banco** com uma rotina que varre pendências (*polling*). Vale entender o trade-off antes de seguir:

| | Tabela de Jobs no Postgres | BullMQ + Redis |
|---|---|---|
| Infraestrutura extra | Nenhuma (usa o banco que já existe) | Precisa de um serviço Redis rodando |
| Como descobre novos jobs | *Polling* — uma rotina pergunta "tem algo pra fazer?" de tempos em tempos (delay até o job ser pego) | *Push* — o Worker é notificado quase instantaneamente quando um job é adicionado |
| Retry com backoff exponencial | Você implementa na unha | Nativo, configurável em poucas linhas |
| Dashboard de observação | Você constrói do zero | Pronto (Bull Board) |
| Concorrência controlada | Você implementa na unha (locks, `SELECT ... FOR UPDATE SKIP LOCKED`) | Nativo (`concurrency`) |

Para este projeto, escolhemos **BullMQ sobre Redis**: é o padrão de mercado no ecossistema Node para filas de job, com retry/backoff/observabilidade prontos — evita reinventar uma engenharia que já é um problema resolvido, e deixa o foco no domínio (a lógica jurídica), não na infraestrutura de filas.

### Passo a passo

**1.** Instale as dependências:

```bash
npm install bullmq ioredis
```

> - **`bullmq`** — a biblioteca de filas em si (produção de jobs, consumo, retry, eventos).
> - **`ioredis`** — o cliente Redis que o BullMQ usa por baixo dos panos para se conectar ao servidor Redis.

**2.** Acrescente o serviço `redis` ao `docker-compose.yml` (editando o arquivo criado na Fase 1) — adicione este bloco dentro de `services:`, junto de `api` e `db`:

```yaml
  redis:
    image: redis:7-alpine
    container_name: jurisengine_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

E adicione `redis_data` na seção `volumes:` no final do arquivo (junto de `juris_db_data`):

```yaml
volumes:
  juris_db_data:
  redis_data:
```

> 💡 Por que persistir o Redis com um volume, se ele é "só uma fila"? Porque, sem persistência, um `docker compose down` apagaria jobs que ainda não terminaram de processar (ex.: uma importação em lote grande, no meio do processamento). Com o volume, o Redis salva seu estado em disco (RDB/AOF) e recupera ao reiniciar.

**3.** Crie `src/config/redis.ts` — a conexão Redis **compartilhada** entre quem produz jobs (a Queue, usada pela API) e quem consome (o Worker):

```typescript
// src/config/redis.ts
//
// Import nomeado em vez de default: sob moduleResolution "NodeNext" o
// interop do export default do ioredis é inconsistente entre versões,
// e o import nomeado evita o erro "This expression is not constructable".
import { Redis as IORedis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Conexão Redis compartilhada entre Queue (producer) e Worker (consumer).
 *
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ: sem isso, o cliente
 * ioredis desiste de comandos bloqueantes internos (usados pelo BullMQ para
 * esperar por novos jobs) depois de poucas tentativas, e a lib lança erro.
 */
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err: Error) => {
  console.error('[redis] Erro de conexão:', err.message);
});
```

> ⚠️ **A opção `maxRetriesPerRequest: null` não é só um detalhe — é obrigatória para o BullMQ funcionar.** O BullMQ usa comandos Redis "bloqueantes" (que ficam esperando, em vez de responder na hora) para o Worker saber, quase instantaneamente, quando um novo job chega na fila. O `ioredis`, por padrão, tem um limite de quantas vezes tenta reenviar um comando antes de desistir — e para comandos bloqueantes esse limite não faz sentido (eles ficam esperando de propósito). Sem `maxRetriesPerRequest: null`, você recebe o erro clássico `ReplyError: max retries per request limit reached`.

**4.** Adicione as variáveis de Redis ao seu `.env` (e ao `.env.example`, como documentação):

```dotenv
REDIS_HOST=redis
REDIS_PORT=6379
```

> Assim como `DB_HOST`, use `redis` (o nome do serviço no Compose) quando a aplicação roda **dentro** do Docker, ou `localhost` se estiver rodando fora do Docker enquanto o Redis está containerizado (com a porta exposta).

### Como confirmar que deu certo

```bash
docker compose up -d redis
docker exec -it jurisengine_redis redis-cli ping
```

Deve responder `PONG`.

---

## 4.2. Implementação do Worker Jurídico

Esta seção tem 4 partes: a **fila** (onde os jobs entram), o **simulador** da API externa (para termos algo "de verdade" para consumir sem depender de uma integração real), o **worker** (quem processa) e a **ligação com o controller** da Fase 3.

### 4.2.a — A fila (`src/queues/lawsuitSync.queue.ts`)

#### O que vamos construir e por quê

A `Queue` do BullMQ é o objeto que **produz** jobs — é o lado usado pela API (dentro do controller `batchImportLawsuits`, criado na Fase 3) para dizer "existe trabalho a fazer". Ela não processa nada sozinha; só grava o job no Redis.

```typescript
// src/queues/lawsuitSync.queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

// Nome da fila — usado tanto aqui (produtor) quanto no Worker
// (consumidor) e no Bull Board (dashboard). Uma constante evita
// erros de digitação entre os três lugares.
export const LAWSUIT_SYNC_QUEUE = 'lawsuit-sync';

// Formato tipado do "payload" de cada job desta fila — o BullMQ é
// genérico (`Queue<T>`), então TUDO que entra/sai da fila é checado
// pelo TypeScript.
export interface LawsuitSyncJobData {
  lawsuitId: string;
  cnjNumber: string;
}

export const lawsuitSyncQueue = new Queue<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,   // até 5 tentativas totais antes de considerar o job definitivamente falho
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s, 16s, 32s entre tentativas
    },
    removeOnComplete: {
      age: 60 * 60 * 24, // mantém jobs concluídos por 24h (útil para auditoria)
      count: 1000,          // OU no máximo 1000 jobs concluídos guardados — o que vier primeiro
    },
    removeOnFail: false, // jobs falhos ficam retidos; a DLQ trata o "definitivamente falhou"
  },
});

/**
 * Enfileira um job de sincronização para um processo já persistido.
 * Usado pelo endpoint POST /api/lawsuits/batch-import.
 */
export async function enqueueLawsuitSync(data: LawsuitSyncJobData) {
  const response = lawsuitSyncQueue.add('sync-lawsuit', data, {
    // Um jobId FIXO e determinístico (baseado no lawsuitId) faz o
    // BullMQ recusar automaticamente adicionar um job duplicado para o
    // MESMO processo enquanto o anterior ainda não terminou — protege
    // contra cliques duplos / reenvios acidentais do mesmo lote.
    jobId: `lawsuit-sync-${data.lawsuitId}`,
  });
  return response;
}
```

> 💡 **Backoff exponencial, na prática**: se a primeira tentativa falha, o BullMQ espera 2s antes de tentar de novo. Se a segunda falhar, espera 4s. Depois 8s, 16s, 32s. Isso evita "martelar" uma fonte externa instável logo em seguida de uma falha (o que só pioraria a instabilidade) — cada nova tentativa dá mais tempo para o problema (rede, indisponibilidade momentânea) se resolver sozinho.

### 4.2.b — O simulador da API do tribunal (`src/workers/tribunalApi.simulator.ts`)

#### O que vamos construir e por quê

Como não há, neste projeto de estudo, uma integração real com um tribunal, criamos um **simulador**: uma função que se comporta como uma chamada de rede de verdade — com latência (delay) e uma chance de falhar aleatoriamente. Isso deixa o sistema de retry e a DLQ **testáveis de verdade**, sem depender de um serviço externo instável.

```typescript
// src/workers/tribunalApi.simulator.ts

/**
 * Simula uma chamada a uma API externa de Tribunais/Diário Oficial.
 *
 * Enquanto a integração real não existe, este módulo:
 *  - introduz um delay artificial (latência de rede real da fonte externa);
 *  - falha aleatoriamente uma fração das vezes, para exercitar o retry/backoff
 *    do BullMQ e, eventualmente, a DLQ.
 *
 * Basta trocar o corpo desta função por uma chamada HTTP real quando a
 * integração verdadeira for implementada — o worker não precisa mudar.
 */

export interface TribunalMovementResult {
  description: string;
  date: Date;
}

const ARTIFICIAL_DELAY_MS_MIN = 500;
const ARTIFICIAL_DELAY_MS_MAX = 2500;
const SIMULATED_FAILURE_RATE = 0.25; // 25% das chamadas "falham" de propósito

function randomDelay(): Promise<void> {
  const ms = ARTIFICIAL_DELAY_MS_MIN + Math.random() * (ARTIFICIAL_DELAY_MS_MAX - ARTIFICIAL_DELAY_MS_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SAMPLE_MOVEMENT_DESCRIPTIONS = [
  'Publicação de despacho no Diário Oficial.',
  'Juntada de petição da parte autora.',
  'Audiência de conciliação designada.',
  'Decisão interlocutória proferida.',
  'Expedição de ofício.',
];

export async function fetchTribunalMovements(cnjNumber: string): Promise<TribunalMovementResult[]> {
  await randomDelay();

  if (Math.random() < SIMULATED_FAILURE_RATE) {
    throw new Error(`Falha simulada ao consultar o tribunal para o processo ${cnjNumber} (timeout/instabilidade).`);
  }

  // Simula 1 a 3 novas movimentações capturadas na varredura.
  const count = 1 + Math.floor(Math.random() * 3);
  const movements: TribunalMovementResult[] = [];

  for (let i = 0; i < count; i += 1) {
    const description =
      SAMPLE_MOVEMENT_DESCRIPTIONS[Math.floor(Math.random() * SAMPLE_MOVEMENT_DESCRIPTIONS.length)];
    movements.push({ description, date: new Date() });
  }

  return movements;
}
```

> 📝 **Nota do professor:** repare no comentário do topo — "*basta trocar o corpo desta função por uma chamada HTTP real... o worker não precisa mudar*". Isso é um exemplo de **inversão de dependência** na prática: o Worker (próxima seção) depende apenas da **assinatura** desta função (`cnjNumber` entra, uma lista de movimentações sai), não de **como** ela é implementada por dentro. Trocar a simulação por uma chamada `fetch()`/`axios` real, no futuro, é uma mudança isolada neste único arquivo.

### 4.2.c — Os models que faltam: `DeadLetterJob` e a atualização de `models/index.ts`

Antes do worker em si, precisamos da tabela que vai guardar jobs definitivamente falhos.

**1.** Gere e edite a migration da tabela `dead_letter_jobs`:

```bash
npx sequelize-cli migration:generate --name create-dead-letter-jobs
```

```javascript
// src/database/migrations/20260101000004-create-dead-letter-jobs.cjs
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
        // de qual fila este job veio (útil se, no futuro, existirem outras filas além de lawsuit-sync)
        type: Sequelize.STRING,
        allowNull: false,
      },
      job_id: {
        // o ID do job dentro do BullMQ/Redis (ex.: "lawsuit-sync-<uuid>") — permite cruzar com o Bull Board
        type: Sequelize.STRING,
        allowNull: false,
      },
      lawsuit_id: {
        // NULA-vel de propósito: se o processo (lawsuit) for apagado depois,
        // não queremos apagar (nem impedir de apagar) o registro histórico da DLQ.
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'lawsuits',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',   // ao apagar o processo, apenas desvincula (não apaga) o registro da DLQ
      },
      payload: {
        // guarda o payload ORIGINAL do job (lawsuitId, cnjNumber) — essencial
        // para reprocessar manualmente depois de investigar a causa da falha.
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

> ⚠️ **Atenção — correção de um erro real encontrado no projeto original**: ao ler o código-fonte para escrever este guia, o arquivo `20260101000004-create-dead-letter-jobs.cjs` do projeto continha, por engano, uma cópia do conteúdo de `lawsuitSync.worker.ts` (código TypeScript com `import`, sintaxe inválida dentro de um `.cjs`). Provavelmente um "colar no arquivo errado" durante o desenvolvimento desta fase. O bloco acima é o conteúdo **correto**, reconstruído a partir da tabela usada de fato pelo model `DeadLetterJob` abaixo.
>
> **Atualização (Fase 7):** esse bug não ficou só documentado aqui — ele voltou a aparecer na prática ao rodar `npm run db:migrate:test` pela primeira vez (o comando falhava com `Cannot use import statement outside a module`), o que confirmou que o arquivo real do projeto ainda estava com o conteúdo errado. O arquivo `src/database/migrations/20260101000004-create-dead-letter-jobs.cjs` já foi sobrescrito no seu projeto com o conteúdo correto acima — se você seguiu o guia do zero, seu arquivo já nasce certo e nunca vai esbarrar nisso.

**2.** Crie `src/models/deadLetterJob.model.ts`:

```typescript
// src/models/deadLetterJob.model.ts
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface DeadLetterJobAttributes {
  id: string;
  queueName: string;
  jobId: string;
  lawsuitId: string | null;
  payload: Record<string, unknown>;   // JSON livre — o "formato exato do job" pode variar entre filas diferentes no futuro
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
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    queueName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'queue_name',
    },
    jobId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'job_id',
    },
    lawsuitId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'lawsuit_id',
    },
    payload: {
      type: DataTypes.JSONB,   // tipo nativo do Postgres para JSON indexável/consultável
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'error_message',
    },
    attemptsMade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'attempts_made',
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'failed_at',
    },
  },
  {
    sequelize,
    modelName: 'DeadLetterJob',
    tableName: 'dead_letter_jobs',
    underscored: true,
  }
);

export default DeadLetterJob;
```

**3.** Atualize `src/models/index.ts` (o arquivo criado na Fase 2) para incluir o novo model e seu relacionamento:

```typescript
// src/models/index.ts
import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import Movement from './movement.model.js';
import DeadLetterJob from './deadLetterJob.model.js';

// Client 1:N Lawsuit
Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Lawsuit 1:N Movement
Lawsuit.hasMany(Movement, { foreignKey: 'lawsuitId', as: 'movements' });
Movement.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

// Lawsuit 1:N DeadLetterJob (nullable — a FK vira NULL se o processo for removido)
Lawsuit.hasMany(DeadLetterJob, { foreignKey: 'lawsuitId', as: 'deadLetterJobs' });
DeadLetterJob.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

export { sequelize, Client, Lawsuit, Movement, DeadLetterJob };
```

**4.** Rode a nova migration:

```bash
npm run db:migrate
```

### 4.2.d — O Worker (`src/workers/lawsuitSync.worker.ts`)

#### O que vamos construir e por quê

O `Worker` do BullMQ é o lado **consumidor**: um processo que fica escutando a fila `lawsuit-sync` e, para cada job que chega, executa a lógica de negócio — consultar o "tribunal" (simulado), gravar as movimentações e atualizar o status do processo, tudo dentro de uma **transação de banco** (ou tudo é salvo, ou nada é — nunca uma gravação "pela metade").

```typescript
// src/workers/lawsuitSync.worker.ts
import { Worker, type Job } from 'bullmq';
import type { Transaction } from 'sequelize';
import dotenv from 'dotenv';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE, type LawsuitSyncJobData } from '../queues/lawsuitSync.queue.js';
import { fetchTribunalMovements } from './tribunalApi.simulator.js';
import { sequelize, Lawsuit, Movement, DeadLetterJob } from '../models/index.js';

dotenv.config();

// Quantos jobs este worker processa AO MESMO TEMPO (em paralelo, dentro
// do mesmo processo Node). Configurável via variável de ambiente, com
// 5 como padrão razoável para não sobrecarregar a fonte externa nem o banco.
const WORKER_CONCURRENCY = Number(process.env.LAWSUIT_SYNC_CONCURRENCY) || 5;

/**
 * Processa um job de sincronização:
 *  1. Consulta a fonte externa (simulada) por novas movimentações do CNJ.
 *  2. Persiste as movimentações capturadas.
 *  3. Atualiza o status do processo para 'UPDATED'.
 *
 * Qualquer erro lançado aqui é interpretado pelo BullMQ como falha do job,
 * disparando o retry com backoff exponencial configurado na Queue.
 */
async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<{ movementsSaved: number }> {
  const { lawsuitId, cnjNumber } = job.data;

  console.log(
    `[worker:lawsuit-sync] job=${job.id} tentativa=${job.attemptsMade + 1} lawsuit=${lawsuitId} cnj=${cnjNumber}`
  );

  // Se isto lançar um erro (25% de chance, no simulador), a função para
  // AQUI — o código abaixo (a transação) nunca roda, e o BullMQ marca o
  // job como falho, agendando a próxima tentativa automaticamente.
  const capturedMovements = await fetchTribunalMovements(cnjNumber);

  // sequelize.transaction: agrupa múltiplas operações de escrita numa
  // única unidade atômica. Se QUALQUER coisa dentro do callback lançar
  // um erro, TODAS as mudanças são desfeitas (rollback) — nunca ficamos
  // com movimentações salvas mas o status do processo desatualizado, ou vice-versa.
  const result = await sequelize.transaction(async (transaction: Transaction) => {
    await Movement.bulkCreate(
      capturedMovements.map((m) => ({
        lawsuitId,
        description: m.description,
        date: m.date,
      })),
      { transaction }   // toda query dentro do callback PRECISA receber esta mesma transação
    );

    await Lawsuit.update({ status: 'UPDATED' }, { where: { id: lawsuitId }, transaction });

    return { movementsSaved: capturedMovements.length };
  });

  console.log(`[worker:lawsuit-sync] job=${job.id} concluído — ${result.movementsSaved} movimentação(ões) salva(s).`);

  return result;
}

// Cria o Worker: conecta na mesma fila (pelo nome) e no mesmo Redis
// (conexão compartilhada) usados pela Queue — é assim que os dois lados
// (produtor na API, consumidor aqui) se encontram.
export const lawsuitSyncWorker = new Worker<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, processLawsuitSync, {
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY,
});

// Evento disparado toda vez que um job falha (inclusive em tentativas
// intermediárias — não só na última).
lawsuitSyncWorker.on('failed', async (job, err) => {
  if (!job) return;   // guarda de tipo: `job` pode ser undefined em cenários raros do BullMQ

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts ?? 1;

  console.error(
    `[worker:lawsuit-sync] job=${job.id} falhou na tentativa ${attemptsMade}/${maxAttempts}: ${err.message}`
  );

  // Só vai para a DLQ quando TODAS as tentativas se esgotaram — falhas
  // intermediárias são esperadas e tratadas pelo retry/backoff do BullMQ.
  if (attemptsMade >= maxAttempts) {
    try {
      await DeadLetterJob.create({
        queueName: LAWSUIT_SYNC_QUEUE,
        jobId: String(job.id),
        lawsuitId: job.data.lawsuitId,
        payload: { ...job.data },   // guarda uma cópia do payload original, útil para reprocessar manualmente depois
        errorMessage: err.message,
        attemptsMade,
      });
      console.error(`[worker:lawsuit-sync] job=${job.id} movido para a DLQ (dead_letter_jobs).`);
    } catch (dlqError) {
      // Se nem gravar na DLQ for possível, loga com prioridade máxima —
      // isso indica um problema mais sério (banco fora do ar, etc).
      console.error(`[worker:lawsuit-sync] FALHA CRÍTICA ao gravar DLQ do job=${job.id}:`, dlqError);
    }
  }
});

lawsuitSyncWorker.on('completed', (job) => {
  console.log(`[worker:lawsuit-sync] job=${job.id} finalizado com sucesso.`);
});

lawsuitSyncWorker.on('error', (err) => {
  // Erros do próprio worker (ex.: conexão com Redis caiu), não de um job específico.
  console.error('[worker:lawsuit-sync] Erro no worker:', err);
});

console.log(`[worker:lawsuit-sync] Worker iniciado (concurrency=${WORKER_CONCURRENCY}). Aguardando jobs...`);

// Encerramento gracioso: quando o processo recebe um sinal de
// interrupção (Ctrl+C no terminal = SIGINT, ou o Docker parando o
// container = SIGTERM), esperamos os jobs EM ANDAMENTO terminarem antes
// de sair — evita matar um job "no meio" e deixar dado inconsistente.
async function shutdown(signal: string) {
  console.log(`[worker:lawsuit-sync] Recebido ${signal}, encerrando...`);
  await lawsuitSyncWorker.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

> 💡 **Por que o Worker é um arquivo separado, executado com um comando diferente da API (`npm run worker` em vez de `npm run dev`)?** Porque são dois **processos Node completamente independentes**. A API responde requisições HTTP rapidamente e não deve ficar "presa" esperando uma consulta lenta a um tribunal. O Worker, por outro lado, pode (e deve) demorar o quanto precisar processando cada job, sem impactar a capacidade de resposta da API. Rodá-los como processos separados também permite **escalar cada um independentemente** — por exemplo, rodar 3 réplicas do Worker em produção para dar conta de picos de importação, mantendo só 1 réplica da API.

**Adicione o script `worker` ao `package.json`:**

```json
{
  "scripts": {
    "worker": "tsx watch src/workers/lawsuitSync.worker.ts"
  }
}
```

### 4.2.e — Ligando a fila ao controller da Fase 3

Volte ao `src/controllers/lawsuit.controller.ts` (criado na Fase 3) — o `import { enqueueLawsuitSync } from '../queues/lawsuitSync.queue.js';` que já estava lá agora resolve de verdade, e a chamada dentro de `batchImportLawsuits` (`await enqueueLawsuitSync({ lawsuitId: lawsuit.id, cnjNumber: lawsuit.cnjNumber });`) passa a **realmente** colocar um job na fila.

### 4.2.f — Acrescente o serviço `worker` ao `docker-compose.yml`

Edite o `docker-compose.yml` (adicionando este bloco em `services:`, junto de `api`, `db` e `redis`):

```yaml
  worker:
    build: .
    container_name: jurisengine_worker
    command: npm run worker
    restart: unless-stopped
    depends_on:
      - db
      - redis
    env_file:
      - .env
    environment:
      - REDIS_HOST=redis
    volumes:
      - .:/app
      - /app/node_modules
```

Explicando as diferenças em relação ao serviço `api`:
- **`command: npm run worker`** — sobrescreve o `CMD` do Dockerfile (que roda `npm run dev`, o servidor HTTP) para rodar o worker no lugar, usando a **mesma imagem**.
- **`env_file: - .env`** — carrega TODAS as variáveis do `.env` de uma vez (em vez de listar uma a uma em `environment:`, como fizemos no serviço `api`) — uma forma alternativa e igualmente válida de passar configuração a um container.
- **`volumes: - .:/app` e `- /app/node_modules`** — monta o projeto inteiro (não só `src/`) dentro do container, e o segundo volume (um "volume anônimo" apontando só para `node_modules`) evita que o `node_modules` da sua máquina local (que pode ter binários compilados para outro sistema operacional) sobrescreva o `node_modules` já instalado **dentro** do container linux.

### Como confirmar que deu certo

Suba tudo:

```bash
docker compose up --build
```

Em outro terminal, dispare uma importação em lote (troque `<ID_DO_CLIENTE>` por um id real):

```bash
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0007777-33.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

Acompanhe os logs do worker (`docker compose logs -f worker`) — você deve ver linhas como:

```
[worker:lawsuit-sync] job=lawsuit-sync-<uuid> tentativa=1 lawsuit=<uuid> cnj=0007777-33.2024.8.19.0001
[worker:lawsuit-sync] job=lawsuit-sync-<uuid> concluído — 2 movimentação(ões) salva(s).
```

(ou, com ~25% de chance, uma falha simulada seguida de retry automático — rode o teste algumas vezes para observar os dois caminhos). Depois, confirme no banco:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT status FROM lawsuits WHERE cnj_number = '0007777-33.2024.8.19.0001';"
```

Deve mostrar `UPDATED`.

---

## 4.3. Tratamento de Erros e Falhas em Workers

### O que vamos construir e por quê

Você já viu a mecânica de retry e DLQ implementada dentro do próprio `lawsuitSync.worker.ts` (seção anterior). Esta seção é sobre **observar** esse comportamento — o Bull Board, um painel visual (o equivalente, no mundo BullMQ, ao Flower do Celery em Python) que mostra os jobs em tempo real, sem precisar ficar lendo logs no terminal.

### Passo a passo

**1.** Instale as dependências do dashboard:

```bash
npm install @bull-board/api @bull-board/express express-basic-auth
```

> - **`@bull-board/api`** / **`@bull-board/express`** — o dashboard em si e o adaptador para se plugar numa aplicação Express existente.
> - **`express-basic-auth`** — protege o dashboard com usuário/senha (HTTP Basic Auth). O Bull Board expõe payloads de jobs e permite retry/remoção manual — nunca deve ficar público sem autenticação.

**2.** Crie `src/admin/bullBoard.ts`:

```typescript
// src/admin/bullBoard.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { lawsuitSyncQueue } from '../queues/lawsuitSync.queue.js';

const BASE_PATH = '/admin/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BASE_PATH);

// Registra CADA fila que você quer visualizar. Hoje só existe uma
// (lawsuitSyncQueue) — se o projeto crescer e ganhar outras filas, basta
// adicionar mais um `new BullMQAdapter(...)` a este array.
createBullBoard({
  queues: [new BullMQAdapter(lawsuitSyncQueue)],
  serverAdapter,
});

/**
 * O Bull Board expõe payloads de job e permite retry/remoção manual —
 * nunca deixe isso público. Protegido com HTTP Basic Auth via variáveis
 * de ambiente; troque ADMIN_USER/ADMIN_PASS no .env antes de subir em
 * qualquer ambiente que não seja localhost.
 */
export const bullBoardAuth = basicAuth({
  users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASS || 'admin' },
  challenge: true,   // faz o navegador mostrar o popup nativo de usuário/senha, em vez de retornar 401 "seco"
});

export const bullBoardRouter = serverAdapter.getRouter();
export const bullBoardBasePath = BASE_PATH;
```

**3.** Conecte o dashboard ao `src/app.ts` (edite o arquivo criado na Fase 3, acrescentando o import e a linha `app.use(bullBoardBasePath, ...)` **antes** de `app.use('/api', apiRoutes)`):

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { bullBoardAuth, bullBoardBasePath, bullBoardRouter } from './admin/bullBoard.js';

const app: Application = express();

app.use(express.json());

interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

app.get('/health', (req: Request, res: Response<HealthCheckResponse>) => {
  return res.status(200).json({
    status: 'ONLINE',
    service: 'JurisEngine API (TypeScript)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Dashboard de monitoramento das filas (equivalente ao Flower do Celery).
// http://localhost:3000/admin/queues — protegido por Basic Auth.
app.use(bullBoardBasePath, bullBoardAuth, bullBoardRouter);

app.use('/api', apiRoutes);

// Deve vir por último: 404 para rotas não mapeadas, depois o handler de erros global.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

**4.** Adicione as credenciais do dashboard ao `.env` (e documente no `.env.example`):

```dotenv
ADMIN_USER=admin
ADMIN_PASS=troque_essa_senha
LAWSUIT_SYNC_CONCURRENCY=5
```

### Como confirmar que deu certo (o teste final da Fase 4)

**1.** Suba tudo:

```bash
docker compose up --build
```

**2.** Abra `http://localhost:3000/admin/queues` no navegador. Entre com o usuário/senha definidos em `ADMIN_USER`/`ADMIN_PASS`.

**3.** Dispare um job de teste:

```bash
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0007777-33.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

**4.** Acompanhe **em tempo real** no dashboard: o job aparece em **Active**, e depois vai para **Completed** (sucesso) ou volta para a fila em retry (se a falha simulada ocorrer). Clique nele para ver o `payload` exato (`lawsuitId`, `cnjNumber`). Se um job cair em **Failed** depois de esgotar as 5 tentativas, você pode confirmar que ele foi parar na DLQ:

```bash
docker exec -it jurisengine_db psql -U postgres -d juris_db -c "SELECT job_id, error_message, attempts_made, failed_at FROM dead_letter_jobs;"
```

> 💡 Como a falha é simulada com 25% de chance **por tentativa**, a probabilidade de um job esgotar as 5 tentativas e cair na DLQ é baixa (0.25⁵ ≈ 0,1%) — é proposital: o sistema é resiliente o bastante para se recuperar sozinho na maioria dos casos, e a DLQ existe justamente para os casos raros em que isso não acontece. Se quiser **forçar** um job a cair na DLQ para testar, aumente temporariamente `SIMULATED_FAILURE_RATE` em `tribunalApi.simulator.ts` para algo como `0.95`, teste, e depois volte para `0.25`.

---

✅ **Fim da Fase 4 — e do projeto.** Você agora tem uma API que recebe processos, uma fila que desacopla o trabalho pesado, um worker resiliente com retry automático, e uma Dead Letter Queue para os casos em que tudo falha mesmo assim — com um dashboard visual para acompanhar tudo isso ao vivo. Siga para `05 - Checklist Final e Como Rodar Tudo.md` para o roteiro completo de "do zero ao ar".
