import type { Request, Response } from 'express';
import { Client } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';

interface CreateClientBody {
  name?: string;
  document?: string;
  email?: string | null;
}

export async function createClient(req: Request<unknown, unknown, CreateClientBody>, res: Response) {
  const { name, document, email } = req.body;

  if (!name || !document) {
    throw new AppError('Os campos "name" e "document" são obrigatórios.', 422);
  }

  const client = await Client.create({ name, document, email: email ?? null });

  return res.status(201).json(client);
}

export async function listClients(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const { rows, count } = await Client.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  return res.status(200).json({
    data: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  });
}

export async function getClientById(req: Request<{ id: string }>, res: Response) {
  const client = await Client.findByPk(req.params.id);

  if (!client) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  return res.status(200).json(client);
}