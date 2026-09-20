import type { NextFunction, Request, Response } from 'express';

/**
 * Envolve um handler assíncrono e encaminha qualquer erro para o
 * middleware de tratamento de erros global, evitando try/catch repetido
 * em cada controller.
 *
 * Genérico (P, ResBody, ReqBody, ReqQuery) para preservar a tipagem forte
 * de cada rota — ex.: `Request<{ id: string }>` continua com `req.params.id`
 * tipado como string em vez de cair para `ParamsDictionary`.
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
  };
};