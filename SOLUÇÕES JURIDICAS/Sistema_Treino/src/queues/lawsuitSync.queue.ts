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
    removeOnComplete: {
      age: 60 * 60 * 24, // mantém jobs concluídos por 24h (útil para auditoria)
      count: 1000,
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
    jobId: `lawsuit-sync-${data.lawsuitId}`, // evita duplicar job para o mesmo processo
  });
  return response;
}