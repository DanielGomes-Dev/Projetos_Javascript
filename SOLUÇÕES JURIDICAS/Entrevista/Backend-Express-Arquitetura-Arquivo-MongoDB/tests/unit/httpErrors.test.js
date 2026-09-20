const { AppError, badRequest, notFound, conflict, unprocessable } = require('../../src/utils/httpErrors');

describe('AppError', () => {
  it('carrega status, name e message', () => {
    const error = new AppError(400, 'ValidationError', 'campo obrigatorio');

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('campo obrigatorio');
  });
});

describe('fábricas de erro', () => {
  it('badRequest -> 400 ValidationError', () => {
    const error = badRequest('mensagem');
    expect(error.status).toBe(400);
    expect(error.name).toBe('ValidationError');
  });

  it('notFound -> 404 NotFound', () => {
    expect(notFound('mensagem').status).toBe(404);
    expect(notFound('mensagem').name).toBe('NotFound');
  });

  it('conflict -> 409 Conflict', () => {
    expect(conflict('mensagem').status).toBe(409);
    expect(conflict('mensagem').name).toBe('Conflict');
  });

  it('unprocessable -> 422 UnprocessableEntity', () => {
    expect(unprocessable('mensagem').status).toBe(422);
    expect(unprocessable('mensagem').name).toBe('UnprocessableEntity');
  });
});