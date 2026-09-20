# 17 — Redis e a Fila BullMQ

## 🎯 Objetivo

Introduzir a peça central do processamento assíncrono: uma fila. Ainda sem nada consumindo ela (isso vem no passo 20) — este passo é sobre a fila existir e aceitar jobs.

## Por que uma fila, e por que BullMQ

Consultar um tribunal é lento e não confiável. Se a API fizesse essa consulta na hora que o cliente pede, importar vários processos deixaria o usuário esperando, e qualquer instabilidade de rede quebraria a resposta inteira. A solução é desacoplar: a API só grava a intenção numa fila e responde imediatamente; um processo separado (o Worker, passo 20) consome essa fila no seu próprio ritmo, com retry automático.

Escolhemos **BullMQ sobre Redis** — o padrão de mercado no ecossistema Node para filas de job, com retry/backoff/observabilidade prontos.

## 📦 Instalar

```bash
npm install bullmq ioredis
```

## 📝 Código

Adicione as variáveis de Redis a `.env`/`.env.example` (a primeira vez que este projeto precisa delas):

```dotenv
REDIS_HOST=redis
REDIS_PORT=6379
```

> Mesma lógica de `MONGODB_URI` (passo 08): `redis` como hostname só funciona dentro da rede do Docker Compose.

Crie `src/config/redis.ts` — a conexão compartilhada entre quem produz jobs (a fila, usada pela API) e quem consome (o Worker, mais adiante):

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

> ⚠️ **`maxRetriesPerRequest: null` não é um detalhe — é obrigatório.** O BullMQ usa comandos Redis "bloqueantes" para o Worker saber, quase instantaneamente, quando um novo job chega. Sem essa opção, você recebe `ReplyError: max retries per request limit reached` assim que o Worker tentar escutar a fila.

Adicione o serviço `redis` ao `docker-compose.yml` (editando o arquivo do passo 08):

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

E adicione `redis_data` na seção `volumes:` no final do arquivo, junto de `mongo_data`.

Crie `src/queues/lawsuitSync.queue.ts` — o lado que **produz** jobs (a API vai usar isso a partir do passo 19):

```typescript
// src/queues/lawsuitSync.queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const LAWSUIT_SYNC_QUEUE = 'lawsuit-sync';

export interface LawsuitSyncJobData {
  lawsuitId: string;
  cnjNumber: string;
}

export const lawsuitSyncQueue = new Queue<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s, 16s, 32s entre tentativas
    },
    removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
    removeOnFail: false,
  },
});

/**
 * Enfileira um job de sincronização para um processo já persistido.
 */
export async function enqueueLawsuitSync(data: LawsuitSyncJobData) {
  return lawsuitSyncQueue.add('sync-lawsuit', data, {
    // jobId FIXO e determinístico: o BullMQ recusa automaticamente um
    // job duplicado para o MESMO processo enquanto o anterior não
    // terminou — protege contra cliques duplos/reenvios acidentais.
    jobId: `lawsuit-sync-${data.lawsuitId}`,
  });
}
```

## ✅ Como confirmar que funcionou

```bash
docker compose up -d redis
docker exec -it jurisengine_redis redis-cli ping
```

Deve responder `PONG`. Ainda não há nenhum endpoint chamando `enqueueLawsuitSync` (isso chega no passo 19) — este passo confirma só que a infraestrutura está pronta.

## 🔧 Commit sugerido

```bash
git add .env.example docker-compose.yml package.json package-lock.json src/config/redis.ts src/queues/lawsuitSync.queue.ts
git commit -m "feat: configurar redis e fila bullmq"
```

## 📚 Documentação Oficial

- **BullMQ — documentação geral**: https://docs.bullmq.io/
- **BullMQ — Queues**: https://docs.bullmq.io/guide/queues/
- **BullMQ — Conexões (`maxRetriesPerRequest`)**: https://docs.bullmq.io/guide/connections
- **ioredis — repositório e documentação**: https://github.com/redis/ioredis
- **Redis — documentação geral**: https://redis.io/docs/latest/
- **Imagem oficial `redis` no Docker Hub**: https://hub.docker.com/_/redis
