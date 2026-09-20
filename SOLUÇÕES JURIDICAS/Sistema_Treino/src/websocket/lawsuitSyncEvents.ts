// src/websocket/lawsuitSyncEvents.ts
//
// A PONTE entre o Worker (processo separado, sem acesso direto aos
// clientes WebSocket) e a API (processo que hospeda o Socket.IO).
//
// Ver a explicação completa no guia (Fase 5.3) sobre por que o Worker
// NÃO PODE emitir eventos de Socket.IO diretamente — em resumo: são
// dois processos Node distintos, e nenhum objeto JavaScript "vive" nos
// dois ao mesmo tempo. A ponte entre eles é o Redis, que os dois já
// compartilham por causa do BullMQ.

import { QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE } from '../queues/lawsuitSync.queue.js';
import { getIO } from './socket.js';

// Formato do valor retornado por `processLawsuitSync`, no Worker
// (src/workers/lawsuitSync.worker.ts). Como esse valor atravessa o
// Redis (é serializado para JSON e depois desserializado aqui), as
// datas chegam como STRING (ISO 8601), não como objetos `Date`.
export interface LawsuitSyncCompletedPayload {
  cnjNumber: string;
  movementsSaved: number;
  movements: Array<{ description: string; date: string }>;
}

/**
 * Assina os eventos de ciclo de vida da fila `lawsuit-sync` via
 * `QueueEvents` do BullMQ — um recurso que já escuta um stream de
 * eventos no Redis, sem precisarmos criar um canal de Pub/Sub manual.
 *
 * Deve ser chamada UMA VEZ, em server.ts, junto com initSocket().
 */
export function initLawsuitSyncEvents(): QueueEvents {
  const queueEvents = new QueueEvents(LAWSUIT_SYNC_QUEUE, { connection: redisConnection });

  // Disparado sempre que UM job da fila `lawsuit-sync` termina com
  // sucesso — em QUALQUER processo Worker que o tenha processado
  // (mesmo que você rode várias réplicas do worker, isso funciona igual,
  // porque o evento vem do Redis, não de uma referência direta ao worker).
  queueEvents.on('completed', ({ returnvalue }) => {
    if (!returnvalue) return;

    let payload: LawsuitSyncCompletedPayload;
    try {
      // O BullMQ entrega `returnvalue` como STRING JSON (é assim que
      // ele trafega pelo Redis) — por isso o parse manual aqui.
      payload = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
    } catch (parseError) {
      console.error('[socket] Não foi possível interpretar o retorno do job lawsuit-sync:', parseError);
      return;
    }

    const { cnjNumber, movementsSaved, movements } = payload;
    if (!cnjNumber) return;

    // Emite SÓ para quem entrou na sala deste CNJ específico (via
    // `join-lawsuit`, em socket.ts) — clientes acompanhando outros
    // processos não recebem este evento. Isso é o que faz a "sala" valer a pena:
    // sem ela, teríamos que fazer um broadcast global e filtrar no front-end.
    getIO().to(cnjNumber).emit('lawsuit:updated', {
      cnjNumber,
      movementsSaved,
      movements,
    });

    console.log(
      `[socket] evento "lawsuit:updated" emitido para a sala ${cnjNumber} (${movementsSaved} nova(s) movimentação(ões))`
    );
  });

  queueEvents.on('error', (err) => {
    console.error('[socket] erro no QueueEvents de lawsuit-sync:', err);
  });

  return queueEvents;
}
