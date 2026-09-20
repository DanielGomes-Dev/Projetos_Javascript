# 11 — Middlewares de Tratamento de Erros

## 🎯 Objetivo

Antes de escrever o primeiro endpoint real (próximo passo), montar a infraestrutura de erros: uma forma padronizada de dizer "isso deu errado, com este status HTTP", sem `try/catch` repetido em cada controller.

## 📝 Código

Crie `src/middlewares/AppError.ts` — uma classe de erro "de negócio", carregando o status HTTP junto:

```typescript
// src/middlewares/AppError.ts

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
```

Crie `src/middlewares/asyncHandler.ts` — elimina o `try/catch` repetido: envolve um handler `async` e encaminha qualquer erro lançado (inclusive um `AppError`) para o middleware de erro global:

```typescript
// src/middlewares/asyncHandler.ts
import type { NextFunction, Request, Response } from 'express';

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
  };
};
```

> 💡 **Por que isso é necessário?** O Express, por padrão, **não** captura automaticamente uma `Promise` rejeitada dentro de um handler assíncrono — se você escrever `async (req, res) => { throw new AppError(...) }` sem esse wrapper, o erro simplesmente "some" (a requisição fica pendurada, sem resposta, e o erro só aparece como um `UnhandledPromiseRejection` no console). `asyncHandler` resolve isso de uma vez, para todas as rotas, sem precisar lembrar de um `try/catch` em cada controller.

Crie `src/middlewares/errorHandler.ts` — converte qualquer erro capturado (o seu `AppError`, ou erros que o próprio Sequelize lança) numa resposta JSON padronizada:

```typescript
// src/middlewares/errorHandler.ts
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

  // Violação de constraint UNIQUE (ex.: documento duplicado)
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({
      error: { message: 'Registro duplicado.', details: err.errors.map((e) => e.message) },
    });
    return;
  }

  // Erros de validação do Sequelize (campos obrigatórios, formato, etc.)
  if (err instanceof SequelizeValidationError) {
    res.status(422).json({
      error: { message: 'Falha de validação.', details: err.errors.map((e) => e.message) },
    });
    return;
  }

  console.error('[errorHandler] Erro não tratado:', err);
  res.status(500).json({ error: { message: 'Erro interno do servidor.' } });
}

export function notFoundHandler(req: Request, res: Response<ErrorResponseBody>): void {
  res.status(404).json({ error: { message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}
```

> 💡 **Por que `errorHandler` tem 4 parâmetros (`err, req, res, next`), mesmo `next` nunca sendo chamado dentro dele?** É uma convenção **exigida** pelo Express: ele identifica um middleware como "tratador de erros" contando a **quantidade** de parâmetros na função (exatamente 4) — não existe outra forma de sinalizar isso. Por isso o `eslint-disable-next-line` acima do `req`/`next` não usados: sabemos que não são usados, mas precisam continuar ali para o Express reconhecer a assinatura certa.

Conecte os dois ao `src/app.ts` (edite o arquivo do passo 05, adicionando o `notFoundHandler`/`errorHandler` **por último**, depois de todas as rotas):

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

// Deve vir por último: 404 para rotas não mapeadas, depois o handler de erros global.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

## ✅ Como confirmar que funcionou

```bash
npm run dev
curl http://localhost:3000/rota-que-nao-existe
```

Deve responder `404`, com corpo `{"error":{"message":"Rota não encontrada: GET /rota-que-nao-existe"}}`.

## 🔧 Commit sugerido

```bash
git add src/middlewares src/app.ts
git commit -m "feat: adicionar middlewares de tratamento de erros"
```
