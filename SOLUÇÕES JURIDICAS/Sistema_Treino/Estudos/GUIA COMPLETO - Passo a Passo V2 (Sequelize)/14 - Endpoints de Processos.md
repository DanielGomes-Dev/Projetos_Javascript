# 14 — Endpoints de Processos

## 🎯 Objetivo

Vincular um processo (número CNJ) a um cliente existente via API, e consultá-lo depois.

## 📝 Código

Crie `src/controllers/lawsuit.controller.ts` (por enquanto, só as duas primeiras funções — `batchImportLawsuits` chega no passo 19, quando a fila existir):

```typescript
// src/controllers/lawsuit.controller.ts
import type { Request, Response } from 'express';
import { Client, Lawsuit } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';

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

  const client = await Client.findByPk(clientId);
  if (!client) {
    throw new AppError('Cliente informado não existe.', 404);
  }

  const lawsuit = await Lawsuit.create({ cnjNumber, clientId, status });

  return res.status(201).json(lawsuit);
}

/**
 * GET /api/lawsuits/:id
 * Retorna o processo e o cliente vinculado.
 */
export async function getLawsuitById(req: Request<{ id: string }>, res: Response) {
  const lawsuit = await Lawsuit.findByPk(req.params.id, {
    include: [{ model: Client, as: 'client' }],
  });

  if (!lawsuit) {
    throw new AppError('Processo não encontrado.', 404);
  }

  return res.status(200).json(lawsuit);
}
```

> 💡 **Por que `createLawsuit` confere se o cliente existe (`Client.findByPk`) ANTES de tentar criar o processo, em vez de deixar o banco recusar via a constraint de chave estrangeira (passo 13)?** As duas abordagens acabam impedindo o dado inválido, mas com experiências bem diferentes: sem essa checagem explícita, o Postgres recusaria com um erro genérico de violação de chave estrangeira, que o `errorHandler` (passo 11) não sabe traduzir para uma mensagem amigável — o cliente da API receberia um `500` confuso em vez de um `404` claro dizendo exatamente o que está errado.

Crie `src/routes/lawsuit.routes.ts`:

```typescript
// src/routes/lawsuit.routes.ts
import { Router } from 'express';
import { createLawsuit, getLawsuitById } from '../controllers/lawsuit.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;
```

Atualize `src/routes/index.ts` (editando o arquivo do passo 12):

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

## ✅ Como confirmar que funcionou

```bash
# Reaproveite um ID de cliente já criado no passo 12
curl -X POST http://localhost:3000/api/lawsuits \
  -H "Content-Type: application/json" \
  -d '{"cnjNumber":"0001111-22.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}'
# → 201, status inicial "PENDING"

curl http://localhost:3000/api/lawsuits/<ID_RETORNADO_ACIMA>
# → 200, com o objeto "client" incluído

curl -X POST http://localhost:3000/api/lawsuits \
  -H "Content-Type: application/json" \
  -d '{"cnjNumber":"0002222-33.2024.8.19.0001","clientId":"00000000-0000-0000-0000-000000000000"}'
# → 404 ("Cliente informado não existe.")
```

## 🔧 Commit sugerido

```bash
git add src/controllers/lawsuit.controller.ts src/routes/lawsuit.routes.ts src/routes/index.ts
git commit -m "feat: adicionar endpoints de processos"
```
