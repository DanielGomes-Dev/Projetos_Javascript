// tests/integration/clients.test.ts
//
// Teste de INTEGRAÇÃO (Fase 7.3): usa o `supertest` para simular
// requisições HTTP reais contra `src/app.ts` — sem precisar subir um
// servidor de verdade escutando uma porta (`supertest` conversa
// diretamente com o request handler do Express em memória). As
// requisições atravessam TODAS as camadas reais: rotas, middlewares,
// controllers e o Postgres de teste (juris_db_test) — só o Worker e o
// Socket.IO ficam de fora, porque `app.ts` nunca os importa (é
// exatamente por isso que a Fase 3 manteve `app.ts` e `server.ts`
// separados — ver a Fase 5.1 do guia).

import request from 'supertest';
import app from '../../src/app.js';
import { truncateAllTables, closeTestDatabase } from '../setup/testDatabase.js';

describe('API de Clientes', () => {
  afterEach(async () => {
    await truncateAllTables();
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
      expect(response.body).toMatchObject({
        name: 'Maria Teste',
        document: '111.111.111-11',
        email: 'maria@example.com',
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('responde 422 quando falta o campo obrigatório "document"', async () => {
      const response = await request(app).post('/api/clients').send({ name: 'Sem Documento' });

      expect(response.status).toBe(422);
      expect(response.body.error.message).toMatch(/obrigat/i);
    });

    it('responde 409 ao tentar cadastrar um documento duplicado', async () => {
      await request(app).post('/api/clients').send({ name: 'Cliente 1', document: '222.222.222-22' });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Cliente 2 (mesmo documento)', document: '222.222.222-22' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/duplicado/i);
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
    it('responde 404 para um id que não existe', async () => {
      const response = await request(app).get('/api/clients/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toMatch(/não encontrado/i);
    });
  });
});
