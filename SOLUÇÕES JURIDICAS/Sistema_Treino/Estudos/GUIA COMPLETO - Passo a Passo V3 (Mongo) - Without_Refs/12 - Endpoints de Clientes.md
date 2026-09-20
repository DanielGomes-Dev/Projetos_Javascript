# 12 — Endpoints de Clientes

## 🎯 Objetivo

O primeiro fluxo HTTP completo, de ponta a ponta: `POST` para criar, `GET` para listar (paginado) e `GET /:id` para buscar um cliente específico.

## 📝 Código

Crie `src/controllers/client.controller.ts`:

```typescript
// src/controllers/client.controller.ts
import type { Request, Response } from 'express';
import { Client } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';

interface CreateClientBody {
  name?: string;
  document?: string;
  email?: string | null;
}

export async function createClient(req: Request<unknown, unknown, CreateClientBody>, res: Response) {
  const { name, document, email } = req.body;

  if (!name || !document) {
    throw new AppError('Os campos "name" e "document" são obrigatórios.', 422);
  }

  const client = await Client.create({ name, document, email: email ?? null });

  return res.status(201).json(client);
}

export async function listClients(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Client.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Client.countDocuments(),
  ]);

  return res.status(200).json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getClientById(req: Request<{ id: string }>, res: Response) {
  const client = await Client.findById(req.params.id);

  if (!client) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  return res.status(200).json(client);
}
```

> 💡 **`Client.find().skip(skip).limit(limit)` + `Client.countDocuments()` em paralelo — o equivalente Mongoose ao `findAndCountAll` do Sequelize.** O Mongoose não tem um único método que faça as duas coisas de uma vez; disparar as duas consultas com `Promise.all` (em vez de uma depois da outra, com `await` sequencial) evita que a segunda espere a primeira terminar à toa — as duas são independentes.
>
> 💡 **`Client.findById(id)` lança `CastError` (tratado no passo 11) se `id` não tiver o formato de um ObjectId válido — diferente do `findByPk` do Sequelize (V2), que simplesmente retornava `null` para um id de formato "errado".** Isso significa que testar o caminho "404" deste endpoint precisa de um id **formatado corretamente, mas inexistente** (ex.: `507f1f77bcf86cd799439011` — 24 caracteres hexadecimais), não qualquer string aleatória.

Crie `src/routes/client.routes.ts`:

```typescript
// src/routes/client.routes.ts
import { Router } from 'express';
import { createClient, getClientById, listClients } from '../controllers/client.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(createClient));
router.get('/', asyncHandler(listClients));
router.get('/:id', asyncHandler(getClientById));

export default router;
```

Crie `src/routes/index.ts` — o roteador "raiz" da API, que a partir de agora agrupa todas as sub-rotas:

```typescript
// src/routes/index.ts
import { Router } from 'express';
import clientRoutes from './client.routes.js';

const router = Router();

router.use('/clients', clientRoutes);

export default router;
```

Conecte ao `src/app.ts` (edite o arquivo do passo 11):

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

## ✅ Como confirmar que funcionou

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Oliveira","document":"123.456.789-00","email":"maria@example.com"}'
# → 201, com um "id" novo (string de 24 caracteres hexadecimais)

curl "http://localhost:3000/api/clients?page=1&limit=10"
# → 200, com "data" (array) e "pagination"

curl http://localhost:3000/api/clients/<ID_RETORNADO_ACIMA>
# → 200, com o cliente

curl http://localhost:3000/api/clients/507f1f77bcf86cd799439011
# → 404 (id com formato válido, mas que não existe)

curl http://localhost:3000/api/clients/id-invalido
# → 404 também (id com formato inválido — vira CastError, tratado no passo 11)
```

## 🔧 Commit sugerido

```bash
git add src/controllers/client.controller.ts src/routes/client.routes.ts src/routes/index.ts src/app.ts
git commit -m "feat: adicionar endpoints de clientes"
```
