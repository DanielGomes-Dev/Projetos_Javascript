import type { NextFunction, Request, Response } from 'express';
import { UniqueConstraintError, ValidationError as SequelizeValidationError } from 'sequelize';
import { AppError } from './AppError.js';

interface ErrorResponseBody {
  error: {
    message: string;
    details?: string[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Violação de constraint UNIQUE (ex.: CPF/CNPJ ou número CNJ duplicado)
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({
      error: {
        message: 'Registro duplicado.',
        details: err.errors.map((e) => e.message),
      },
    });
    return;
  }

  // Erros de validação do Sequelize (campos obrigatórios, formato, etc.)
  if (err instanceof SequelizeValidationError) {
    res.status(422).json({
      error: {
        message: 'Falha de validação.',
        details: err.errors.map((e) => e.message),
      },
    });
    return;
  }

  console.error('[errorHandler] Erro não tratado:', err);
  res.status(500).json({ error: { message: 'Erro interno do servidor.' } });
}

export function notFoundHandler(req: Request, res: Response<ErrorResponseBody>): void {
  res.status(404).json({ error: { message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}