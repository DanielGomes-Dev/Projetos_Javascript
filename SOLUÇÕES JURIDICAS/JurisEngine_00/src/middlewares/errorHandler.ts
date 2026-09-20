import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from './AppError.js';

interface ErrorResponseBody {
  error: {
    message: string;
    details?: string[];
  };
}

interface MongoServerErrorLike extends Error {
  code?: number;
}


export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ErrorResponseBody>,
  next: NextFunction
): void {
  // Erros de negócio conhecidos (lançados propositalmente pelos controllers)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  // Violação de índice único (ex.: documento duplicado). O driver do
  // MongoDB sinaliza isso com o código de erro 11000 — não existe um
  // tipo de exceção dedicado como o UniqueConstraintError do Sequelize.
  const mongoErr = err as MongoServerErrorLike;
  if (mongoErr?.code === 11000) {
    res.status(409).json({ error: { message: 'Registro duplicado.' } });
    return;
  }

  // Erros de validação do Mongoose (campos "required", etc.)
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(422).json({
      error: { message: 'Falha de validação.', details: Object.values(err.errors).map((e) => e.message) },
    });
    return;
  }

  // Um :id na URL que não tem o formato de ObjectId (24 caracteres
  // hexadecimais) faz o Mongoose lançar CastError — não "não
  // encontrado". Sem tratar isso aqui, um id mal formado (por exemplo,
  // um UUID copiado de outro projeto) resultaria num 500 genérico em
  // vez de um 404 claro. Esta é uma armadilha real e fácil de esquecer
  // ao migrar de um banco relacional para o MongoDB.
  if (err instanceof mongoose.Error.CastError && err.kind === 'ObjectId') {
    res.status(404).json({ error: { message: 'Registro não encontrado (id com formato inválido).' } });
    return;
  }

  console.error('[errorHandler] Erro não tratado:', err);
  res.status(500).json({ error: { message: 'Erro interno do servidor.' } });
}

export function notFoundHandler(req: Request, res: Response<ErrorResponseBody>): void {
  res.status(404).json({ error: { message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}