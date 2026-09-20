/**
 * Erro de aplicação com status HTTP explícito.
 * Lançar este erro dentro de um controller resulta numa resposta
 * JSON padronizada pelo errorHandler, com o statusCode definido aqui.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, AppError);
  }
}