import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { lawsuitSyncQueue } from '../queues/lawsuitSync.queue.js';

const BASE_PATH = '/admin/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BASE_PATH);

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
  challenge: true,
});

export const bullBoardRouter = serverAdapter.getRouter();
export const bullBoardBasePath = BASE_PATH;