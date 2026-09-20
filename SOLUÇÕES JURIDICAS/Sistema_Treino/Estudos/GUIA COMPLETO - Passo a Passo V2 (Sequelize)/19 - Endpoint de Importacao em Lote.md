# 19 — Endpoint de Importação em Lote

## 🎯 Objetivo

Ligar a API à fila: um endpoint que recebe uma lista de processos e enfileira um job de sincronização para cada um, respondendo imediatamente (sem esperar o processamento terminar).

## 📝 Código

Atualize `src/controllers/lawsuit.controller.ts` (editando o arquivo do passo 14), adicionando `batchImportLawsuits`:

```typescript
// src/controllers/lawsuit.controller.ts
import type { Request, Response } from 'express';
import { Client, Lawsuit, Movement } from '../models/index.js';
import { AppError } from '../middlewares/AppError.js';
import { enqueueLawsuitSync } from '../queues/lawsuitSync.queue.js';

// ... createLawsuit e getLawsuitById continuam iguais ao passo 15 ...

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
 * Para cada item: garante que o processo exista (findOrCreate por
 * cnjNumber) e enfileira um job de sincronização. O processamento em
 * si acontece no Worker (próximo passo) — este endpoint nunca espera
 * por isso, só enfileira e responde.
 */
export async function batchImportLawsuits(req: Request<unknown, unknown, BatchImportBody>, res: Response) {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('O campo "items" deve ser uma lista não vazia de { cnjNumber, clientId }.', 422);
  }

  const invalidIndex = items.findIndex((item) => !item.cnjNumber || !item.clientId);
  if (invalidIndex !== -1) {
    throw new AppError(`Item inválido no índice ${invalidIndex}: "cnjNumber" e "clientId" são obrigatórios.`, 422);
  }

  const results: BatchImportResultItem[] = [];

  for (const item of items) {
    const cnjNumber = item.cnjNumber as string;
    const clientId = item.clientId as string;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new AppError(`Cliente "${clientId}" (item cnjNumber=${cnjNumber}) não existe.`, 404);
    }

    const [lawsuit, wasNew] = await Lawsuit.findOrCreate({
      where: { cnjNumber },
      defaults: { cnjNumber, clientId },
    });

    await enqueueLawsuitSync({ lawsuitId: lawsuit.id, cnjNumber: lawsuit.cnjNumber });

    results.push({ cnjNumber, lawsuitId: lawsuit.id, wasNew, enqueued: true });
  }

  return res.status(202).json({
    message: 'Importação em lote aceita — jobs de sincronização enfileirados.',
    itemsReceived: items.length,
    results,
  });
}
```

> 💡 **Por que `202 Accepted`, e não `200` ou `201`?** `202` é o código HTTP feito exatamente para este cenário: "recebi sua requisição, é válida, mas o processamento ainda não terminou — e pode nem começar imediatamente". `200`/`201` implicariam que o trabalho já está concluído no momento da resposta, o que seria enganoso aqui: as movimentações ainda **não** foram buscadas quando essa resposta é enviada.

Adicione a rota em `src/routes/lawsuit.routes.ts` (editando o arquivo do passo 14) — repare que a rota específica vem **antes** da rota com `:id`, para evitar colisão de path (`/batch-import` não deve ser interpretado como um `id`):

```typescript
// src/routes/lawsuit.routes.ts
import { Router } from 'express';
import { batchImportLawsuits, createLawsuit, getLawsuitById } from '../controllers/lawsuit.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

router.post('/batch-import', asyncHandler(batchImportLawsuits));
router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;
```

## ✅ Como confirmar que funcionou

```bash
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0007777-33.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

Deve responder `202`, com `results` listando o item enfileirado. Nada acontece com o job ainda — sem um Worker consumindo a fila (próximo passo), ele fica só esperando.

## 🔧 Commit sugerido

```bash
git add src/controllers/lawsuit.controller.ts src/routes/lawsuit.routes.ts
git commit -m "feat: adicionar endpoint de importacao em lote"
```
