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