# 08 — Middlewares de Erros

## 🎯 Objetivo

Antes de escrever a primeira regra de negócio de verdade (capítulo 09 em diante), montar a infraestrutura de erros: uma forma padronizada de dizer "isso deu errado, com este status HTTP e este motivo", sem `try/catch` repetido em cada controller ou service.

## 🔴 Teste (Red)

Duas peças pequenas e isoladas, perfeitas para TDD unitário (sem HTTP, sem banco — testáveis em milissegundos).

Crie `tests/unit/httpErrors.test.js`:

```javascript
// tests/unit/httpErrors.test.js
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
```

Crie `tests/unit/asyncHandler.test.js`:

```javascript
// tests/unit/asyncHandler.test.js
const asyncHandler = require('../../src/utils/asyncHandler');

describe('asyncHandler', () => {
  it('chama a função original com (req, res, next)', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = {};
    const res = {};
    const next = jest.fn();

    await asyncHandler(fn)(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('encaminha uma rejeição para next(err), sem lançar', async () => {
    const error = new Error('falhou');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    await asyncHandler(fn)({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
```

Rode `npm test`: os dois arquivos falham — `src/utils/httpErrors.js` e `src/utils/asyncHandler.js` ainda não existem (`Cannot find module`).

> Estes dois arquivos de teste vão além do mínimo exigido por um desafio técnico — eles existem para exercitar, isoladamente, a infraestrutura de erros que os próximos capítulos (services de alunos e matrículas) vão usar sem testar de novo. Isolar a lógica genérica aqui evita repetir a mesma cobertura em cada camada que a utiliza.

## 🟢 Código (Green)

Crie `src/utils/httpErrors.js`:

```javascript
// src/utils/httpErrors.js
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
```

Crie `src/utils/asyncHandler.js`:

```javascript
// src/utils/asyncHandler.js
// Evita repetir try/catch em cada controller: encaminha qualquer rejeição
// da função assíncrona para o middleware global de erros (next(err)).
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
```

> 💡 **Por que `Promise.resolve(fn(...))`, e não só `fn(...).catch(next)`?** Se `fn` for uma função síncrona que lança uma exceção (em vez de retornar uma Promise rejeitada), chamar `.catch` diretamente no retorno quebraria antes mesmo de chegar lá. `Promise.resolve(...)` normaliza os dois casos — função síncrona que lança, ou função assíncrona que rejeita — para o mesmo caminho de tratamento.

Agora conecte o middleware global de erros a `src/app.js`, por último, depois do handler de 404 (capítulo 05):

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());

app.use(express.json());

app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isReady = dbState === 1;

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown'
  });
});

app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  return res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Ocorreu um erro interno no servidor'
  });
});

module.exports = app;
```

> 💡 **Por que este middleware tem 4 parâmetros (`err, req, res, next`), mesmo `next` nunca sendo chamado dentro dele?** É uma convenção **exigida** pelo Express: ele identifica um middleware como "tratador de erros" contando a quantidade de parâmetros na função (exatamente 4) — não existe outra forma de sinalizar isso. Precisa continuar com essa assinatura mesmo que `next` não seja usado.
>
> 💡 **Por que `err.status || 500` e `err.name || 'InternalServerError'`, em vez de assumir que todo erro é um `AppError`?** Porque nem todo erro que pode chegar aqui foi lançado de propósito — um bug real, um erro do driver do Mongo, qualquer coisa inesperada também cai neste middleware (é o "pega tudo" de erros do Express). Um `AppError` sempre tem `status`/`name` definidos: para qualquer outro tipo de erro, o *fallback* garante uma resposta `500` genérica em vez de a aplicação quebrar tentando ler uma propriedade que não existe.
>
> ⚠️ **Este middleware ainda não é exercitado por nenhum teste de integração — de propósito.** Nenhuma rota deste projeto lança um `AppError` ainda (isso começa no capítulo 09, e vale a pena de verdade a partir do capítulo 11, com a duplicidade de CPF/e-mail). A confirmação deste capítulo é só pelos testes unitários acima; a confirmação de ponta a ponta (`curl`/Supertest recebendo o JSON de erro certo) vem naturalmente quando o primeiro `AppError` for lançado por um controller de verdade.

## ✅ Como confirmar que funcionou

```bash
npm test
```

Os quatro novos testes (`httpErrors.test.js` e `asyncHandler.test.js`) devem passar, junto com os de `health.test.js`.

## 🔧 Commit sugerido

```bash
git add tests/unit/httpErrors.test.js tests/unit/asyncHandler.test.js
git commit -m "test: adicionar testes unitarios de erros e asyncHandler"

git add src/utils/httpErrors.js src/utils/asyncHandler.js src/app.js
git commit -m "feat: adicionar middlewares de tratamento de erros"
```

## 📚 Documentação Oficial

- **Express — tratamento de erros**: https://expressjs.com/en/guide/error-handling.html
- **Jest — mock functions (`jest.fn`)**: https://jestjs.io/docs/mock-function-api
- **MDN — `class`/`extends` (subclasses de `Error`)**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends
