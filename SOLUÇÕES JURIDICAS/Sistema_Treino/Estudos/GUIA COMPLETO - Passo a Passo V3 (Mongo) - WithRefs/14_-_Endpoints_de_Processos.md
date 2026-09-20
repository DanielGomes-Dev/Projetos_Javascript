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

  const client = await Client.findById(clientId);
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
  const lawsuit = await Lawsuit.findById(req.params.id).populate('client');

  if (!lawsuit) {
    throw new AppError('Processo não encontrado.', 404);
  }

  return res.status(200).json(lawsuit);
}
```

> 💡 **Por que `createLawsuit` confere se o cliente existe (`Client.findById`) ANTES de tentar criar o processo?** No V2/Postgres, essa checagem já era recomendada como forma de dar um erro amigável em vez de deixar a constraint de chave estrangeira do banco recusar com uma mensagem genérica. Aqui, no MongoDB, ela é **obrigatória** para a integridade dos dados fazer algum sentido: como o passo 13 explicou, não existe nenhuma validação de referência no nível do banco — sem essa checagem, seria possível criar um processo apontando para um `clientId` que nunca existiu.

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
# → 200, com o objeto "client" incluído (não "clientId" — veja a nota do passo 13)

curl -X POST http://localhost:3000/api/lawsuits \
  -H "Content-Type: application/json" \
  -d '{"cnjNumber":"0002222-33.2024.8.19.0001","clientId":"507f1f77bcf86cd799439011"}'
# → 404 ("Cliente informado não existe.")
```

## 🔧 Commit sugerido

```bash
git add src/controllers/lawsuit.controller.ts src/routes/lawsuit.routes.ts src/routes/index.ts
git commit -m "feat: adicionar endpoints de processos"
```

## 📚 Documentação Oficial

- **Mongoose — `Model.create()`**: https://mongoosejs.com/docs/api/model.html#Model.create()
- **Mongoose — Populate**: https://mongoosejs.com/docs/populate.html
- **Express — Routing**: https://expressjs.com/en/guide/routing.html
