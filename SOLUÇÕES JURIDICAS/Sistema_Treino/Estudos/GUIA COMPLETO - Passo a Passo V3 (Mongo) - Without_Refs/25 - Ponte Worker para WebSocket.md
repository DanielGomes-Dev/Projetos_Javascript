# 25 — Ponte Worker → WebSocket

## 🎯 Objetivo

Notificar, em tempo real, o cliente conectado na sala de um processo assim que o Worker terminar de sincronizá-lo — o pedaço que efetivamente conecta as duas peças dos passos 20 e 24.

## O problema a resolver

O Worker (passo 20) e a API (que hospeda o Socket.IO, passo 24) rodam como **processos separados**. O Worker não tem — e não pode ter — uma referência direta ao objeto `io` que vive dentro do processo da API. Chamar `getIO()` de dentro do Worker simplesmente não funcionaria: seria um objeto `io` diferente, de outro processo, sem nenhuma conexão de cliente real.

A ponte é feita pelo próprio Redis, que os dois processos já compartilham: o BullMQ oferece uma classe `QueueEvents`, que **escuta** eventos da fila (como `completed`) de qualquer processo que se inscreva nela — inclusive o processo da API, que é exatamente onde o `io` vive.

## 📝 Código

Crie `src/websocket/lawsuitSyncEvents.ts`:

```typescript
// src/websocket/lawsuitSyncEvents.ts
import { QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE } from '../queues/lawsuitSync.queue.js';
import { getIO } from './socket.js';

/**
 * Escuta o evento "completed" da fila lawsuit-sync (via Redis) e
 * repassa para a sala certa do Socket.IO — a ponte entre o processo do
 * Worker (que produz o evento) e o processo da API (que hospeda o
 * Socket.IO e tem clientes conectados).
 */
export function initLawsuitSyncEvents(): QueueEvents {
  const queueEvents = new QueueEvents(LAWSUIT_SYNC_QUEUE, { connection: redisConnection });

  queueEvents.on('completed', ({ returnvalue }) => {
    // `returnvalue` é o que processLawsuitSync (Worker, passo 20)
    // retornou — mas o BullMQ serializa isso como STRING via Redis, daí
    // o JSON.parse.
    const result = JSON.parse(returnvalue as unknown as string) as {
      cnjNumber: string;
      movementsSaved: number;
      movements: Array<{ description: string; date: string }>;
    };

    console.log(`[websocket-bridge] Notificando sala "${result.cnjNumber}" — ${result.movementsSaved} movimentação(ões)`);

    getIO().to(result.cnjNumber).emit('lawsuit:updated', result);
  });

  return queueEvents;
}
```

Para o `returnvalue` acima carregar o `cnjNumber` e as `movements` (não só a contagem), atualize `processLawsuitSync` em `src/workers/lawsuitSync.worker.ts` (editando o arquivo do passo 22):

```typescript
// src/workers/lawsuitSync.worker.ts — só a assinatura e o retorno de processLawsuitSync mudam
interface LawsuitSyncResult {
  cnjNumber: string;
  movementsSaved: number;
  movements: Array<{ description: string; date: Date }>;
}

async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<LawsuitSyncResult> {
  const { lawsuitId, cnjNumber } = job.data;

  console.log(/* ...igual ao passo 20... */);

  const capturedMovements = await fetchTribunalMovements(cnjNumber);

  await Lawsuit.findByIdAndUpdate(lawsuitId, {
    $push: { movements: { $each: capturedMovements } },
    $set: { status: 'UPDATED' },
  });

  console.log(/* ...igual ao passo 20... */);

  // cnjNumber e as movimentações capturadas já estão em memória — ao
  // contrário da V2 (que, em alguns cenários, precisaria reler o banco
  // para saber valores gerados pelo Postgres na hora do insert), aqui
  // não existe nenhum valor "gerado pelo banco" que precisemos reler.
  return { cnjNumber, movementsSaved: capturedMovements.length, movements: capturedMovements };
}
```

Ligue tudo em `src/server.ts` (editando o arquivo do passo 24):

```typescript
// src/server.ts
import http from 'node:http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './websocket/socket.js';
import { initLawsuitSyncEvents } from './websocket/lawsuitSyncEvents.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

initSocket(httpServer);
const lawsuitSyncEvents = initLawsuitSyncEvents();

httpServer.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[Server] Recebido ${signal}, encerrando...`);
  await lawsuitSyncEvents.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

## ✅ Como confirmar que funcionou

Veja o passo 26 — um script de teste dedicado deixa essa confirmação muito mais clara do que tentar fazer isso manualmente com `curl`.

## 🔧 Commit sugerido

```bash
git add src/websocket/lawsuitSyncEvents.ts src/workers/lawsuitSync.worker.ts src/server.ts
git commit -m "feat: notificar cliente em tempo real ao concluir sincronizacao"
```
