# Fase 3 — API REST e Camada de Controladores

> Objetivo desta fase: expor os dados (já modelados na Fase 2) para o mundo externo via HTTP — criar, listar e buscar clientes e processos, com tratamento de erros consistente e um endpoint que prepara o terreno para a Fase 4 (importação em lote, que vai disparar jobs assíncronos).

---

## 3.1. Estruturação do Express

### O que vamos construir e por quê

O **Express** é o framework HTTP que recebe as requisições, roteia para a função certa (o *controller*) e devolve a resposta. Vamos separar responsabilidades desde o início:

- `app.ts` — **monta** a aplicação (middlewares, rotas), mas **não** escuta nenhuma porta.
- `server.ts` — o **ponto de entrada real**: importa o `app` e chama `.listen()`.

Essa separação existe por um motivo prático: em testes automatizados, você quer poder importar o `app` e simular requisições **sem** precisar abrir uma porta de rede de verdade. Também facilita reaproveitar o `app` em outros contextos (ex.: rodá-lo como uma *serverless function*).

Vamos também criar, desde já, uma estrutura de **tratamento de erros centralizado** — em vez de cada controller ter seu próprio `try/catch` espalhado, erros "sobem" automaticamente até um único middleware que decide o formato da resposta.

### Passo a passo

**1.** Instale o Express e seus tipos:

```bash
npm install express
npm install -D @types/express
```

**2.** Crie `src/middlewares/AppError.ts` — uma classe de erro customizada, usada para erros de **negócio** (ex.: "cliente não encontrado"), sempre com um código HTTP explícito:

```typescript
// src/middlewares/AppError.ts

/**
 * Erro de aplicação com status HTTP explícito.
 * Lançar este erro dentro de um controller resulta numa resposta
 * JSON padronizada pelo errorHandler, com o statusCode definido aqui.
 */
export class AppError extends Error {
  // `readonly`: uma vez definido no construtor, não pode ser reatribuído depois.
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);              // chama o construtor da classe `Error` nativa, define `this.message`
    this.name = 'AppError';       // sobrescreve o "name" padrão ("Error") — ajuda a identificar a origem em logs
    this.statusCode = statusCode;
    // Remove esta própria chamada de construtor do stack trace, deixando
    // o rastreamento de erro mais limpo (aponta direto para onde o
    // `throw new AppError(...)` foi de fato chamado).
    Error.captureStackTrace(this, AppError);
  }
}
```

> 💡 Por que criar uma classe de erro customizada em vez de só `throw new Error('mensagem')`? Porque `Error` puro não carrega a informação "qual status HTTP isso deveria virar" (404? 422? 400?). Ao lançar `AppError`, o controller decide semanticamente o que aconteceu, e o `errorHandler` (que veremos já já) sabe automaticamente como traduzir isso numa resposta.

**3.** Crie `src/middlewares/asyncHandler.ts` — um "envelope" para eliminar `try/catch` repetido:

```typescript
// src/middlewares/asyncHandler.ts
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
  // Retorna uma NOVA função, com a assinatura que o Express espera de
  // qualquer handler de rota — é essa função que é de fato registrada
  // em `router.get(...)`, `router.post(...)`, etc.
  return (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction): void => {
    // Chama o handler real; se a Promise retornada for rejeitada (um
    // `throw` dentro de uma função async vira uma Promise rejeitada),
    // `.catch(next)` empurra o erro para o Express, que o entrega ao
    // middleware de erro — SEM precisar de try/catch manual aqui.
    handler(req, res, next).catch(next);
  };
};
```

> 💡 **Por que isso é necessário?** No Express, se uma função `async` de rota lança um erro (`throw`), o Express **não** captura isso automaticamente (diferente de um erro síncrono) — a requisição simplesmente trava, sem resposta, até dar timeout. O `asyncHandler` resolve isso de uma vez, encapsulando **todo** controller assíncrono do projeto.

**4.** Crie `src/middlewares/errorHandler.ts` — o middleware final, que decide o formato de **toda** resposta de erro da API:

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

// Um middleware de erro no Express SEMPRE tem 4 parâmetros — é assim que
// o Express reconhece "isto é um error handler" e não um middleware normal.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ErrorResponseBody>,
  next: NextFunction
): void {
  // 1) Erros de negócio conhecidos (lançados propositalmente pelos controllers, ex.: AppError('Cliente não encontrado', 404))
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  // 2) Violação de constraint UNIQUE no banco (ex.: CPF/CNPJ ou número CNJ duplicado)
  if (err instanceof UniqueConstraintError) {
    res.status(409).json({    // 409 Conflict — o recurso já existe
      error: {
        message: 'Registro duplicado.',
        details: err.errors.map((e) => e.message),
      },
    });
    return;
  }

  // 3) Erros de validação do Sequelize (campos obrigatórios ausentes, formato errado, etc.)
  if (err instanceof SequelizeValidationError) {
    res.status(422).json({    // 422 Unprocessable Entity — a requisição está bem formada, mas os dados são inválidos
      error: {
        message: 'Falha de validação.',
        details: err.errors.map((e) => e.message),
      },
    });
    return;
  }

  // 4) Qualquer outro erro não previsto — nunca vaza detalhes internos
  // (stack trace, mensagens de driver do banco, etc.) para quem chamou a API.
  console.error('[errorHandler] Erro não tratado:', err);
  res.status(500).json({ error: { message: 'Erro interno do servidor.' } });
}

// Handler específico para rotas que não existem (nenhuma rota do Express bateu com o caminho pedido).
export function notFoundHandler(req: Request, res: Response<ErrorResponseBody>): void {
  res.status(404).json({ error: { message: `Rota não encontrada: ${req.method} ${req.originalUrl}` } });
}
```

> 💡 **A ordem dos `if`s importa**: verificamos `AppError` primeiro (erros que nós mesmos lançamos, com intenção clara), depois erros específicos do Sequelize (com informação estruturada de "o que" falhou), e só por último caímos no genérico "500 — algo deu errado" — que nunca expõe detalhes internos por segurança.

**5.** Finalmente, monte `src/app.ts`:

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app: Application = express();

// Middleware embutido do Express: faz o parse do corpo (body) de
// requisições com Content-Type: application/json, populando `req.body`.
app.use(express.json());

interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

// Rota Health-Check com tipagem forte — usada por ferramentas de
// monitoramento/orquestração (ex.: Docker healthcheck, Kubernetes
// liveness probe) para saber "a API está de pé?".
app.get('/health', (req: Request, res: Response<HealthCheckResponse>) => {
  return res.status(200).json({
    status: 'ONLINE',
    service: 'JurisEngine API (TypeScript)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),   // segundos desde que o processo Node iniciou
  });
});

app.use('/api', apiRoutes);

// A ORDEM AQUI IMPORTA: notFoundHandler deve vir DEPOIS de todas as
// rotas reais (senão ele "capturaria" tudo antes delas), e errorHandler
// deve ser o ÚLTIMO app.use() do arquivo — o Express só reconhece um
// middleware como "tratador de erro" pela sua posição (por último) e
// assinatura (4 parâmetros).
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

**6.** Crie/atualize `src/server.ts` (substituindo o arquivo provisório da Fase 1):

```typescript
// src/server.ts
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT} em modo ${process.env.NODE_ENV || 'development'}`);
});
```

### Como confirmar que deu certo

Com o Docker Compose rodando (`docker compose up`) ou localmente (`npm run dev`):

```bash
curl http://localhost:3000/health
```

Deve responder algo como:

```json
{"status":"ONLINE","service":"JurisEngine API (TypeScript)","timestamp":"...","uptime":12.3}
```

---

## 3.2. Endpoints de Clientes

### O que vamos construir e por quê

O primeiro recurso REST completo: cadastrar e listar clientes, incluindo **paginação** (nunca devolva "todos os registros" de uma vez numa API de verdade — a tabela pode crescer para milhões de linhas).

### Passo a passo

**1.** Crie `src/controllers/client.controller.ts`:

```typescript
// src/controllers/client.controller.ts
import type { Request, Response } from 'express';
import { Client } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';

// Formato esperado no corpo (body) da requisição de criação.
// Os campos são opcionais NO TIPO porque, em tempo de execução, um
// cliente HTTP mal-intencionado (ou com bug) pode mandar o campo faltando —
// TypeScript sozinho não impede isso, por isso validamos manualmente abaixo.
interface CreateClientBody {
  name?: string;
  document?: string;
  email?: string | null;
}

// POST /api/clients
export async function createClient(req: Request<unknown, unknown, CreateClientBody>, res: Response) {
  const { name, document, email } = req.body;

  // Validação manual e explícita — simples e direta o suficiente para
  // não precisar de uma biblioteca de schema (ex.: Zod/Joi) neste projeto.
  if (!name || !document) {
    throw new AppError('Os campos "name" e "document" são obrigatórios.', 422);
  }

  const client = await Client.create({ name, document, email: email ?? null });

  // 201 Created: convenção HTTP para "um novo recurso foi criado com sucesso".
  return res.status(201).json(client);
}

// GET /api/clients?page=1&limit=10
export async function listClients(req: Request, res: Response) {
  // `Math.max`/`Math.min` "travam" os valores dentro de limites seguros:
  // page nunca menor que 1; limit nunca maior que 100 (protege contra
  // alguém pedir ?limit=999999 e sobrecarregar o banco/a resposta).
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;   // quantos registros "pular" antes de começar a listar

  // findAndCountAll: faz duas consultas SQL de uma vez — uma busca os
  // registros da página (com LIMIT/OFFSET) e outra conta o TOTAL de
  // linhas na tabela (sem LIMIT), necessário para calcular totalPages.
  const { rows, count } = await Client.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']],   // mais recentes primeiro
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

// GET /api/clients/:id
export async function getClientById(req: Request<{ id: string }>, res: Response) {
  const client = await Client.findByPk(req.params.id);   // findByPk = "find by primary key"

  if (!client) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  return res.status(200).json(client);
}
```

**2.** Crie `src/routes/client.routes.ts`:

```typescript
// src/routes/client.routes.ts
import { Router } from 'express';
import { createClient, getClientById, listClients } from '../controllers/client.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// Cada rota é envolvida por asyncHandler — se o controller lançar um
// erro (ex.: `throw new AppError(...)`), ele chega automaticamente ao
// errorHandler global, sem try/catch aqui.
router.post('/', asyncHandler(createClient));
router.get('/', asyncHandler(listClients));
router.get('/:id', asyncHandler(getClientById));

export default router;
```

**3.** Crie `src/routes/index.ts` (o "roteador raiz" da API, que agrupa todas as sub-rotas por recurso):

```typescript
// src/routes/index.ts
import { Router } from 'express';
import clientRoutes from './client.routes.js';

const router = Router();

router.use('/clients', clientRoutes);

export default router;
```

### Como confirmar que deu certo

```bash
# Criar um cliente
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"João Teste","document":"111.111.111-11"}'

# Listar (com paginação)
curl "http://localhost:3000/api/clients?page=1&limit=5"
```

Teste também o caminho de erro — mandar sem o campo obrigatório `document` deve responder `422` com a mensagem definida no `AppError`.

---

## 3.3. Endpoints de Processos (Lawsuits)

### O que vamos construir e por quê

Agora o recurso central do domínio: vincular um número CNJ a um cliente, consultar um processo com seu histórico completo de movimentações, e o endpoint que **inicia** o fluxo assíncrono da Fase 4 (importação em lote).

> ⚠️ Nesta seção o endpoint de importação em lote (`batch-import`) já referencia `enqueueLawsuitSync`, de um arquivo (`queues/lawsuitSync.queue.ts`) que só existe a partir da Fase 4. Isso é proposital — é assim que o projeto real foi construído: o **contrato** da rota (o que ela recebe, o que ela responde) foi definido aqui na Fase 3, e a **implementação** da fila foi plugada na Fase 4. Se você quiser rodar e testar a API **antes** de chegar na Fase 4, comente temporariamente a linha do `import` e a chamada de `enqueueLawsuitSync` — ou simplesmente siga direto para a Fase 4 antes de testar este endpoint específico.

### Passo a passo

**1.** Crie `src/controllers/lawsuit.controller.ts`:

```typescript
// src/controllers/lawsuit.controller.ts
import type { Request, Response } from 'express';
import { Client, Lawsuit, Movement } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';
import { enqueueLawsuitSync } from '../queues/lawsuitSync.queue.js';   // criado na Fase 4

interface CreateLawsuitBody {
  cnjNumber?: string;
  clientId?: string;
  status?: string;
}

/**
 * POST /api/lawsuits
 * Vincula um número CNJ a um cliente existente.
 */
export async function createLawsuit(req: Request<unknown, unknown, CreateLawsuitBody>, res: Response) {
  const { cnjNumber, clientId, status } = req.body;

  if (!cnjNumber || !clientId) {
    throw new AppError('Os campos "cnjNumber" e "clientId" são obrigatórios.', 422);
  }

  // Antes de criar o processo, confirmamos que o cliente informado
  // REALMENTE existe — senão a FK do banco rejeitaria com um erro menos
  // claro (violação de constraint), em vez da mensagem de negócio abaixo.
  const client = await Client.findByPk(clientId);
  if (!client) {
    throw new AppError('Cliente informado não existe.', 404);
  }

  const lawsuit = await Lawsuit.create({ cnjNumber, clientId, status });

  return res.status(201).json(lawsuit);
}

/**
 * GET /api/lawsuits/:id
 * Retorna o processo, o cliente vinculado e o histórico de movimentações.
 */
export async function getLawsuitById(req: Request<{ id: string }>, res: Response) {
  const lawsuit = await Lawsuit.findByPk(req.params.id, {
    include: [
      { model: Client, as: 'client' },
      // `separate: true` faz o Sequelize buscar as movimentações numa
      // SEGUNDA query (em vez de um único JOIN gigante) — necessário
      // aqui porque queremos ORDENAR as movimentações (`order`) sem que
      // essa ordenação "vaze" e bagunce a ordenação do processo principal.
      { model: Movement, as: 'movements', separate: true, order: [['date', 'ASC']] },
    ],
  });

  if (!lawsuit) {
    throw new AppError('Processo não encontrado.', 404);
  }

  return res.status(200).json(lawsuit);
}

interface BatchImportItem {
  cnjNumber?: string;
  clientId?: string;
}

interface BatchImportBody {
  items?: BatchImportItem[];
}

interface BatchImportResultItem {
  cnjNumber: string;
  lawsuitId: string;
  wasNew: boolean;
  enqueued: boolean;
}

/**
 * POST /api/lawsuits/batch-import
 *
 * Para cada item: garante que o processo exista (findOrCreate por cnjNumber)
 * e enfileira um job de sincronização na fila `lawsuit-sync` (BullMQ/Redis).
 * O processamento em si — consulta ao tribunal, gravação de movimentações e
 * atualização de status — acontece no worker (`src/workers/lawsuitSync.worker.ts`).
 */
export async function batchImportLawsuits(req: Request<unknown, unknown, BatchImportBody>, res: Response) {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('O campo "items" deve ser uma lista não vazia de { cnjNumber, clientId }.', 422);
  }

  // Valida TODOS os itens antes de processar qualquer um — evita
  // enfileirar "pela metade" se um item no meio da lista estiver malformado.
  const invalidIndex = items.findIndex((item) => !item.cnjNumber || !item.clientId);
  if (invalidIndex !== -1) {
    throw new AppError(
      `Item inválido no índice ${invalidIndex}: "cnjNumber" e "clientId" são obrigatórios.`,
      422
    );
  }

  const results: BatchImportResultItem[] = [];

  // Loop sequencial (não Promise.all em paralelo) de propósito: evita
  // sobrecarregar o banco com centenas de queries simultâneas numa
  // importação grande, e mantém a ordem dos resultados previsível.
  for (const item of items) {
    const cnjNumber = item.cnjNumber as string;
    const clientId = item.clientId as string;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new AppError(`Cliente "${clientId}" (item cnjNumber=${cnjNumber}) não existe.`, 404);
    }

    // findOrCreate: busca por cnjNumber; se não existir, cria com os
    // valores em `defaults`. `wasNew` diz se o registro é novo ou já existia.
    const [lawsuit, wasNew] = await Lawsuit.findOrCreate({
      where: { cnjNumber },
      defaults: { cnjNumber, clientId },
    });

    await enqueueLawsuitSync({ lawsuitId: lawsuit.id, cnjNumber: lawsuit.cnjNumber });

    results.push({ cnjNumber, lawsuitId: lawsuit.id, wasNew, enqueued: true });
  }

  // 202 Accepted: a requisição foi aceita, mas o PROCESSAMENTO ainda vai
  // acontecer de forma assíncrona (nos jobs) — não 200/201, que
  // sugeririam que tudo já terminou de fato.
  return res.status(202).json({
    message: 'Importação em lote aceita — jobs de sincronização enfileirados.',
    itemsReceived: items.length,
    results,
  });
}
```

**2.** Crie `src/routes/lawsuit.routes.ts`:

```typescript
// src/routes/lawsuit.routes.ts
import { Router } from 'express';
import { batchImportLawsuits, createLawsuit, getLawsuitById } from '../controllers/lawsuit.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// Rota específica ANTES da rota com :id — se `/:id` viesse primeiro, o
// Express interpretaria "batch-import" como um valor de :id e nunca
// chegaria no handler certo. Ordem de declaração de rotas importa.
router.post('/batch-import', asyncHandler(batchImportLawsuits));
router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;
```

**3.** Atualize `src/routes/index.ts` para incluir as novas rotas:

```typescript
// src/routes/index.ts
import { Router } from 'express';
import clientRoutes from './client.routes.js';
import lawsuitRoutes from './lawsuit.routes.js';

const router = Router();

router.use('/clients', clientRoutes);
router.use('/lawsuits', lawsuitRoutes);

export default router;
```

### Como confirmar que deu certo

```bash
# 1. Pegue o ID de um cliente já criado (ou use um do seeder da Fase 2)
CLIENT_ID="<cole aqui o id de um cliente>"

# 2. Crie um processo vinculado a ele
curl -X POST http://localhost:3000/api/lawsuits \
  -H "Content-Type: application/json" \
  -d "{\"cnjNumber\":\"0009999-11.2024.8.19.0001\",\"clientId\":\"$CLIENT_ID\"}"

# 3. Busque o processo criado (troque <LAWSUIT_ID> pelo id retornado acima)
curl http://localhost:3000/api/lawsuits/<LAWSUIT_ID>
```

O endpoint `/batch-import` só vai funcionar de ponta a ponta depois que a fila (Fase 4) existir — por enquanto, o objetivo é só confirmar que `createLawsuit` e `getLawsuitById` respondem corretamente.

---

✅ **Fim da Fase 3.** A API já cadastra e consulta clientes e processos, com validação e tratamento de erro consistentes. Falta a peça que faz o sistema ser "assíncrono" de verdade: a fila e o worker. Siga para `04 - Fase 4 - Processamento Assincrono.md`.
