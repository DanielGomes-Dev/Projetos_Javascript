# 32 — Testes de Integração: API

## 🎯 Objetivo

Confirmar, com testes automatizados de ponta a ponta, que os fluxos HTTP mais importantes (clientes e processos) realmente funcionam — rota → controller → model → MongoDB, com os códigos de status e payloads de erro certos.

## 📝 Código

Crie `tests/setup/testDatabase.ts` — helper reaproveitado por todos os testes de integração:

```typescript
// tests/setup/testDatabase.ts
//
// Garante que cada teste começa com as coleções VAZIAS, espera os
// índices únicos terminarem de ser construídos antes do primeiro teste
// que depende deles, e fecha TODAS as conexões abertas ao importar a
// aplicação (MongoDB, Redis, fila BullMQ) ao final da suíte — sem isso,
// o Jest fica "pendurado".

import mongoose from '../../src/config/database.js';
import { redisConnection } from '../../src/config/redis.js';
import { lawsuitSyncQueue } from '../../src/queues/lawsuitSync.queue.js';
import { Client, Lawsuit } from '../../src/models/index.js';

export async function ensureIndexes(): Promise<void> {
  // Model.init() só resolve depois que os índices (como o unique:true
  // de "document"/"cnjNumber", passos 10 e 13) terminam de ser
  // construídos no MongoDB. Sem esperar por isso explicitamente, um
  // teste que depende de um índice único (ex.: "responde 409 em
  // documento duplicado") pode ficar instável (flaky) — passando ou
  // falhando dependendo de quão rápido o MongoDB terminou de indexar
  // em segundo plano.
  await Promise.all([Client.init(), Lawsuit.init()]);
}

export async function truncateAllCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function closeTestDatabase(): Promise<void> {
  await lawsuitSyncQueue.close();
  await mongoose.disconnect();
  await redisConnection.quit();
}
```

> 💡 **Por que essas conexões existem mesmo num teste que só chama `/api/clients`?** `src/app.ts` importa `admin/bullBoard.ts` (passo 23), que importa a fila BullMQ, que abre uma conexão Redis **assim que o módulo carrega** — não só quando alguém usa a fila de verdade. Importar um arquivo executa todo o código de nível superior dele, mesmo que você só queira uma função específica lá de dentro.

Crie `tests/integration/clients.test.ts`:

```typescript
// tests/integration/clients.test.ts
//
// supertest simula requisições HTTP reais contra src/app.ts, sem abrir
// porta de rede — atravessa rotas, middlewares, controllers e o
// MongoDB de teste (juris_db_test). Só o Worker e o Socket.IO ficam
// de fora, porque app.ts nunca os importa (por isso app.ts/server.ts
// são separados desde o passo 05).

import request from 'supertest';
import app from '../../src/app.js';
import { ensureIndexes, truncateAllCollections, closeTestDatabase } from '../setup/testDatabase.js';

describe('API de Clientes', () => {
  beforeAll(async () => {
    await ensureIndexes();
  });

  afterEach(async () => {
    await truncateAllCollections();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/clients', () => {
    it('cria um cliente com dados válidos e responde 201', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Maria Teste', document: '111.111.111-11', email: 'maria@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ name: 'Maria Teste', document: '111.111.111-11' });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('responde 422 quando falta o campo obrigatório "document"', async () => {
      const response = await request(app).post('/api/clients').send({ name: 'Sem Documento' });
      expect(response.status).toBe(422);
    });

    it('responde 409 ao tentar cadastrar um documento duplicado', async () => {
      await request(app).post('/api/clients').send({ name: 'Cliente 1', document: '222.222.222-22' });
      const response = await request(app).post('/api/clients').send({ name: 'Cliente 2', document: '222.222.222-22' });
      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/clients', () => {
    it('lista clientes com paginação', async () => {
      await request(app).post('/api/clients').send({ name: 'Cliente A', document: 'doc-a' });
      await request(app).post('/api/clients').send({ name: 'Cliente B', document: 'doc-b' });

      const response = await request(app).get('/api/clients').query({ page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    });
  });

  describe('GET /api/clients/:id', () => {
    it('responde 404 para um id que não existe (mas com formato válido)', async () => {
      const response = await request(app).get('/api/clients/507f1f77bcf86cd799439011');
      expect(response.status).toBe(404);
    });

    it('responde 404 também para um id com formato inválido', async () => {
      // Diferente da V2 (findByPk simplesmente retornava null para
      // qualquer id "estranho"), aqui um id que não é um ObjectId de 24
      // caracteres hexadecimais vira CastError — tratado no passo 11.
      const response = await request(app).get('/api/clients/id-invalido');
      expect(response.status).toBe(404);
    });
  });
});
```

Crie `tests/integration/lawsuits.test.ts`:

```typescript
// tests/integration/lawsuits.test.ts
import request from 'supertest';
import app from '../../src/app.js';
import { ensureIndexes, truncateAllCollections, closeTestDatabase } from '../setup/testDatabase.js';

async function createTestClient(): Promise<string> {
  const response = await request(app)
    .post('/api/clients')
    .send({ name: 'Cliente de Teste', document: `doc-${Date.now()}-${Math.random()}` });
  return response.body.id as string;
}

describe('API de Processos (Lawsuits)', () => {
  beforeAll(async () => {
    await ensureIndexes();
  });

  afterEach(async () => {
    await truncateAllCollections();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/lawsuits', () => {
    it('vincula um processo a um cliente existente e responde 201', async () => {
      const clientId = await createTestClient();

      const response = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0001234-72.2024.8.19.0001', clientId });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ cnjNumber: '0001234-72.2024.8.19.0001', status: 'PENDING' });
    });

    it('responde 422 quando falta "cnjNumber" ou "clientId"', async () => {
      const response = await request(app).post('/api/lawsuits').send({ cnjNumber: '0001234-72.2024.8.19.0001' });
      expect(response.status).toBe(422);
    });

    it('responde 404 quando o cliente informado não existe', async () => {
      const response = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0001234-72.2024.8.19.0001', clientId: '507f1f77bcf86cd799439011' });
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/lawsuits/:id', () => {
    it('retorna o processo com o cliente incluído (sob "client") e movimentações vazias', async () => {
      const clientId = await createTestClient();
      const created = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0007654-27.2023.8.19.0002', clientId });

      const response = await request(app).get(`/api/lawsuits/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.client.id).toBe(clientId);
      expect(response.body.movements).toEqual([]);
    });

    it('responde 404 para um processo que não existe', async () => {
      const response = await request(app).get('/api/lawsuits/507f1f77bcf86cd799439011');
      expect(response.status).toBe(404);
    });
  });
});
```

## ✅ Como confirmar que funcionou

```bash
docker compose up -d mongo redis
npm test
```

Deve mostrar os três arquivos de teste (`cnjNumber.test.ts`, `clients.test.ts`, `lawsuits.test.ts`) com `PASS`.

## 🔧 Commit sugerido

```bash
git add tests/setup/testDatabase.ts tests/integration
git commit -m "test: adicionar testes de integracao de clientes e processos"
```

## 📚 Documentação Oficial

- **supertest — repositório e documentação**: https://github.com/ladjs/supertest
- **Jest — hooks `beforeAll`/`afterEach`/`afterAll`**: https://jestjs.io/docs/setup-teardown
- **Mongoose — `Model.init()`**: https://mongoosejs.com/docs/api/model.html#Model.init()
- **Mongoose — `Connection.collections`**: https://mongoosejs.com/docs/api/connection.html#Connection.prototype.collections
