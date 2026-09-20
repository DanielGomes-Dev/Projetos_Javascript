import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";


export const LAWSUIT_SYNC_QUEUE = 'lawsuit-sync';

export interface LawsuitSyncJobData{
    lawsuitId: string;
    cnjNumber: string;
}

export const lawsuitSyncQueue = new Queue<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, {
    connection: redisConnection,
    defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 2000, // 2s, 4s, 8s...
            },
            removeOnComplete: {
                age: 60 * 60 * 24, count: 1000,
            },
            removeOnFail: false,
        }

    }

)


/**
 * Enfileira um job de sincronização para um processo já persistido.
 */

export async function enqueueLawsuitSync(data: LawsuitSyncJobData) {
    return lawsuitSyncQueue.add('sync-lawsuit', data, {
        // jobId FIXO e determinístico: o BullMQ recusa automaticamente um
        // job duplicado para o MESMO processo enquanto o anterior não
        // terminou — protege contra cliques duplos/reenvios acidentais.
        jobId: `lawsuit-sync-${data.lawsuitId}`
    })
}