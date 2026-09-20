
import { Job, Worker } from 'bullmq';
import dotenv from 'dotenv';
import { LAWSUIT_SYNC_QUEUE, LawsuitSyncJobData } from '../queues/lawsuitSync.queue';
import { fetchTribunalMovements } from './tribunalApi.simulator';
import { DeadLetterJob, Lawsuit } from '../models';
import { redisConnection } from '../config/redis';

dotenv.config();


/*

O `WORKER_CONCURRENCY` define **quantos jobs esse Worker consegue processar ao mesmo tempo (em paralelo)**.

Vamos detalhar a linha de código:

```typescript
const WORKER_CONCURRENCY = Number(process.env.LAWSUIT_SYNC_CONCURRENCY);

```

1. **`process.env.LAWSUIT_SYNC_CONCURRENCY`**:
Ele busca essa variável de ambiente lá no seu arquivo `.env` (ex: `LAWSUIT_SYNC_CONCURRENCY=5`).
2. **`Number(...)`**:
Como tudo que vem de `process.env` é lido pelo Node.js como uma **string** (texto), o `Number()` converte esse texto (ex: `"5"`) para um número de verdade (`5`), permitindo que o BullMQ entenda o valor matematicamente.

### Como isso funciona na prática?

* Se o `concurrency` estiver configurado como **`1`**, o worker vai pegar um job da fila, rodar ele inteiro (consultar o tribunal simulado e salvar no banco), e só depois de terminar é que vai olhar para a fila e pegar o próximo job (fila estritamente sequencial).
* Se o `concurrency` estiver configurado como **`5`**, o worker pode puxar e processar **até 5 jobs simultaneamente** em paralelo. Isso acelera bastante a importação em massa se você tiver centenas ou milhares de processos na fila!


*/

const WORKER_CONCURRENCY = Number(process.env.LAWSUIT_SYNC_CONCURRENCY);

/**
 * Processa um job de sincronização:
 *  1. Consulta a fonte externa (simulada) por novas movimentações.
 *  2. Grava as movimentações E atualiza o status do processo, num
 *     único write atômico no MongoDB.
 *
 * Qualquer erro lançado aqui é interpretado pelo BullMQ como falha do
 * job, disparando o retry com backoff exponencial (passo 17).
 */


async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<{movementsSaved: number}> {
    const {lawsuitId, cnjNumber} = job.data;
    console.log(
        `[worker:lawsuit-sync] job=${job.id} tentativa=${job.attemptsMade + 1} lawsuit=${lawsuitId} cnj=${cnjNumber}`
    );

    const capturedMovements = await fetchTribunalMovements(cnjNumber);

    // Diferente da V2 (que precisava de uma transação Sequelize
    // explícita para garantir que "salvar movimentações" e "atualizar
    // status" acontecessem juntos, ou nenhum dos dois) — aqui as duas
    // mudanças são um ÚNICO write num ÚNICO documento. O MongoDB garante
    // atomicidade por documento nativamente, sem precisar de nenhuma
    // transação explícita: é um efeito colateral direto de termos
    // embutido "movements" dentro de "lawsuits" no passo 15.

    /*
    No MongoDB (e consequentemente no Mongoose), o cifrão ($) é o prefixo
    utilizado para identificar os operadores de atualização e consulta nativos do banco de dados.
    Eles servem para dizer ao MongoDB que você não está apenas substituindo o documento inteiro, 
    mas sim realizando uma operação especial nos campos dele.
    */
    await Lawsuit.findByIdAndUpdate(lawsuitId, {
        $push: { movements: { $each: capturedMovements } },
        $set: { status: 'UPDATED' },
    });

    console.log(
        `[worker:lawsuit-sync] job=${job.id} concluído — ${capturedMovements.length} movimentação(ões) salva(s).`
    );


    return { movementsSaved: capturedMovements.length }; 
}

export const lawsuitSyncWorker = new Worker<LawsuitSyncJobData>(LAWSUIT_SYNC_QUEUE, processLawsuitSync, {
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY,
});

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

lawsuitSyncWorker.on('completed', (job) => {
    console.log(`[worker:lawsuit-sync] job=${job.id} finalizado com sucesso.`);
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