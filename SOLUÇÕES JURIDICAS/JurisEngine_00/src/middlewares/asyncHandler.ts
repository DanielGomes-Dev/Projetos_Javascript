// ToDo: Crie src/middlewares/asyncHandler.ts — elimina o try/catch repetido: envolve um handler async e encaminha qualquer erro lançado (inclusive um AppError) para o middleware de erro global:

import type { NextFunction, Request, Response } from "express";

/**
 * Envolve um handler assíncrono e encaminha qualquer erro para o
 * middleware de tratamento de erros global, evitando try/catch repetido
 * em cada controller.
 */

export const asyncHandler = <P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(
    handler: (
        req: Request<P, ResBody, ReqBody, ReqQuery>,
        res: Response<ResBody>,
        next: NextFunction
    ) => Promise<unknown>
) => {
  return (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction): void => {
        handler(req, res, next).catch(next);
    }
}