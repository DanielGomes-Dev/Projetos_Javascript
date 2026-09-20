/**
 * Erros de negócio tipados. Carregam o status HTTP e um "name" que o
 * middleware global de erros (src/app.js) já sabe transformar em
 * { error: name, message } — não é preciso try/catch repetido em cada
 * controller: os services lançam AppError e o asyncHandler encaminha
 * para o middleware de erro via next(err).
 */
class AppError extends Error {
  constructor(status, name, message) {
    super(message);
    this.name = name;
    this.status = status;
  }
}

const badRequest = (message) => new AppError(400, 'ValidationError', message);
const notFound = (message) => new AppError(404, 'NotFound', message);
const conflict = (message) => new AppError(409, 'Conflict', message);
const unprocessable = (message) => new AppError(422, 'UnprocessableEntity', message);

module.exports = { AppError, badRequest, notFound, conflict, unprocessable };
