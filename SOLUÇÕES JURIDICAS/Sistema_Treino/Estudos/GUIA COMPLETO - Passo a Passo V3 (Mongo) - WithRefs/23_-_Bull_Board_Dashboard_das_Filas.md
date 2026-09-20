# 23 — Bull Board: Dashboard das Filas

## 🎯 Objetivo

Ver os jobs da fila em tempo real, num painel visual, em vez de ficar lendo logs no terminal.

## 📦 Instalar

```bash
npm install @bull-board/api @bull-board/express express-basic-auth
```

## 📝 Código

Adicione as credenciais do dashboard a `.env`/`.env.example` (a primeira vez que este projeto precisa delas):

```dotenv
ADMIN_USER=admin
ADMIN_PASS=troque_essa_senha
```

Crie `src/admin/bullBoard.ts`:

```typescript
// src/admin/bullBoard.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { lawsuitSyncQueue } from '../queues/lawsuitSync.queue.js';

const BASE_PATH = '/admin/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BASE_PATH);

createBullBoard({
  queues: [new BullMQAdapter(lawsuitSyncQueue)],
  serverAdapter,
});

/**
 * O Bull Board expõe payloads de job e permite retry/remoção manual —
 * nunca deixe isso público sem autenticação.
 */
export const bullBoardAuth = basicAuth({
  users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASS || 'admin' },
  challenge: true,
});

export const bullBoardRouter = serverAdapter.getRouter();
export const bullBoardBasePath = BASE_PATH;
```

Conecte ao `src/app.ts` (edite o arquivo do passo 12), **antes** de `app.use('/api', apiRoutes)`:

```typescript
// src/app.ts
import express, { Application, Request, Response } from 'express';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { bullBoardAuth, bullBoardBasePath, bullBoardRouter } from './admin/bullBoard.js';

const app: Application = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'ONLINE' });
});

app.use(bullBoardBasePath, bullBoardAuth, bullBoardRouter);
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

## ✅ Como confirmar que funcionou

```bash
npm run dev
```

Abra `http://localhost:3000/admin/queues` no navegador. Deve pedir usuário/senha (os valores de `ADMIN_USER`/`ADMIN_PASS`). Dispare uma importação (passo 19) e acompanhe o job em **Active**, depois **Completed** (ou voltando para retry).

## 🔧 Commit sugerido

```bash
git add .env.example package.json package-lock.json src/admin/bullBoard.ts src/app.ts
git commit -m "feat: adicionar dashboard bull board para monitorar filas"
```

## 📚 Documentação Oficial

- **Bull Board — repositório e documentação oficial**: https://github.com/felixmosh/bull-board
- **express-basic-auth — pacote no npm**: https://www.npmjs.com/package/express-basic-auth
- **BullMQ — Queues (usadas pelo `BullMQAdapter`)**: https://docs.bullmq.io/guide/queues/
