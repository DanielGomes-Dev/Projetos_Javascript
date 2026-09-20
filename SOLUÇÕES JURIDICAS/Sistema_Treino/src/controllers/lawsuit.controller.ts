import type { Request, Response } from 'express';
import { Client, Lawsuit, Movement } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';
import { enqueueLawsuitSync } from '../queues/lawsuitSync.queue.js';

interface CreateLawsuitBody {
  cnjNumber?: string;
  clientId?: string;
  status?: string;
}

/**
 * POST /api/lawsuits
 * Vincula um número CNJ a um cliente existente.
 */
export async function createLawsuit(req: Request<unknown, unknown, CreateLawsuitBody>, res: Response) {
  const { cnjNumber, clientId, status } = req.body;

  if (!cnjNumber || !clientId) {
    throw new AppError('Os campos "cnjNumber" e "clientId" são obrigatórios.', 422);
  }

  const client = await Client.findByPk(clientId);
  if (!client) {
    throw new AppError('Cliente informado não existe.', 404);
  }

  const lawsuit = await Lawsuit.create({ cnjNumber, clientId, status });

  return res.status(201).json(lawsuit);
}

/**
 * GET /api/lawsuits/:id
 * Retorna o processo, o cliente vinculado e o histórico de movimentações.
 */
export async function getLawsuitById(req: Request<{ id: string }>, res: Response) {
  const lawsuit = await Lawsuit.findByPk(req.params.id, {
    include: [
      { model: Client, as: 'client' },
      { model: Movement, as: 'movements', separate: true, order: [['date', 'ASC']] },
    ],
  });

  if (!lawsuit) {
    throw new AppError('Processo não encontrado.', 404);
  }

  return res.status(200).json(lawsuit);
}

interface BatchImportItem {
  cnjNumber?: string;
  clientId?: string;
}

interface BatchImportBody {
  items?: BatchImportItem[];
}

interface BatchImportResultItem {
  cnjNumber: string;
  lawsuitId: string;
  wasNew: boolean;
  enqueued: boolean;
}

/**
 * POST /api/lawsuits/batch-import
 *
 * Para cada item: garante que o processo exista (findOrCreate por cnjNumber)
 * e enfileira um job de sincronização na fila `lawsuit-sync` (BullMQ/Redis).
 * O processamento em si — consulta ao tribunal, gravação de movimentações e
 * atualização de status — acontece no worker (`src/workers/lawsuitSync.worker.ts`).
 */
export async function batchImportLawsuits(req: Request<unknown, unknown, BatchImportBody>, res: Response) {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('O campo "items" deve ser uma lista não vazia de { cnjNumber, clientId }.', 422);
  }

  const invalidIndex = items.findIndex((item) => !item.cnjNumber || !item.clientId);
  if (invalidIndex !== -1) {
    throw new AppError(
      `Item inválido no índice ${invalidIndex}: "cnjNumber" e "clientId" são obrigatórios.`,
      422
    );
  }

  const results: BatchImportResultItem[] = [];

  for (const item of items) {
    const cnjNumber = item.cnjNumber as string;
    const clientId = item.clientId as string;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new AppError(`Cliente "${clientId}" (item cnjNumber=${cnjNumber}) não existe.`, 404);
    }

    const [lawsuit, wasNew] = await Lawsuit.findOrCreate({
      where: { cnjNumber },
      defaults: { cnjNumber, clientId },
    });

    await enqueueLawsuitSync({ lawsuitId: lawsuit.id, cnjNumber: lawsuit.cnjNumber });

    results.push({ cnjNumber, lawsuitId: lawsuit.id, wasNew, enqueued: true });
  }

  return res.status(202).json({
    message: 'Importação em lote aceita — jobs de sincronização enfileirados.',
    itemsReceived: items.length,
    results,
  });
}