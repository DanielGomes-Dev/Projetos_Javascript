import { Worker, type Job } from 'bullmq';
import type { Transaction } from 'sequelize';
import dotenv from 'dotenv';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE, type LawsuitSyncJobData } from '../queues/lawsuitSync.queue.js';
import { fetchTribunalMovements } from './tribunalApi.simulator.js';
import { sequelize, Lawsuit, Movement, DeadLetterJob } from '../models/index.js';

dotenv.config();

const WORKER_CONCURRENCY = Number(process.env.LAWSUIT_SYNC_CONCURRENCY) || 5;

// Formato do valor de retorno do processador. Além de `movementsSaved`
// (já existia desde a Fase 4), agora também devolvemos `cnjNumber` e a
// lista de `movements` capturadas — é ESTE retorno que o BullMQ grava
// no Redis como `returnvalue` do job, e é dele que
// `src/websocket/lawsuitSyncEvents.ts` (Fase 5) lê os dados para
// notificar os clientes conectados em tempo real. O worker continua
// SEM SABER que o WebSocket existe — ele só devolve dados; quem decide
// o que fazer com eles é a camada de eventos, na API.
interface LawsuitSyncResult {
  cnjNumber: string;
  movementsSaved: number;
  movements: Array<{ description: string; date: Date }>;
}

/**
 * Processa um job de sincronização:
 *  1. Consulta a fonte externa (simulada) por novas movimentações do CNJ.
 *  2. Persiste as movimentações capturadas.
 *  3. Atualiza o status do processo para 'UPDATED'.
 *
 * Qualquer erro lançado aqui é interpretado pelo BullMQ como falha do job,
 * disparando o retry com backoff exponencial configurado na Queue.
 */
async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<LawsuitSyncResult> {
  const { lawsuitId, cnjNumber } = job.data;

  console.log(
    `[worker:lawsuit-sync] job=${job.id} tentativa=${job.attemptsMade + 1} lawsuit=${lawsuitId} cnj=${cnjNumber}`
  );

  const capturedMovements = await fetchTribunalMovements(cnjNumber);

  const result = await sequelize.transaction(async (transaction: Transaction) => {
    await Movement.bulkCreate(
      capturedMovements.map((m) => ({
        lawsuitId,
        description: m.description,
        date: m.date,
      })),
      { transaction }
    );

    await Lawsuit.update({ status: 'UPDATED' }, { where: { id: lawsuitId }, transaction });

    return { movementsSaved: capturedMovements.length };
  });

  console.log(`[worker:lawsuit-sync] job=${job.id} concluído — ${result.movementsSaved} movimentação(ões) salva(s).`);

  // Devolvemos cnjNumber + as movimentações capturadas junto do total —
  // o BullMQ serializa este objeto inteiro para JSON e guarda como o
  // "returnvalue" do job no Redis, disponível para quem escuta o evento
  // "completed" da fila (a API, via QueueEvents — Fase 5.3).
  return { cnjNumber, movementsSaved: result.movementsSaved, movements: capturedMovements };
}

export const lawsuitSyncWorker = new Worker<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, processLawsuitSync, {
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY,
});

lawsuitSyncWorker.on('failed', async (job, err) => {
  if (!job) return;

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
        payload: { ...job.data },
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

// Encerramento gracioso: espera os jobs em andamento terminarem antes de sair.
async function shutdown(signal: string) {
  console.log(`[worker:lawsuit-sync] Recebido ${signal}, encerrando...`);
  await lawsuitSyncWorker.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));