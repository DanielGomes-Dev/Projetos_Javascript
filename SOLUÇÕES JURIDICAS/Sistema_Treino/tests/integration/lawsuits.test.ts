// tests/integration/lawsuits.test.ts
//
// Teste de INTEGRAÇÃO (Fase 7.3) do fluxo de processos (lawsuits) — o
// mesmo espírito de tests/integration/clients.test.ts, cobrindo o
// "caminho feliz" (criar e depois consultar) e os principais caminhos
// de erro.

import request from 'supertest';
import app from '../../src/app.js';
import { truncateAllTables, closeTestDatabase } from '../setup/testDatabase.js';

/**
 * Cria um cliente de apoio via a própria API (em vez de usar o model
 * Sequelize diretamente) — assim o teste também exercita, de
 * propósito, o mesmo caminho que um cliente HTTP real usaria.
 * `document` recebe um valor único por chamada para nunca esbarrar na
 * constraint UNIQUE entre um teste e outro.
 */
async function createTestClient(): Promise<string> {
  const response = await request(app)
    .post('/api/clients')
    .send({ name: 'Cliente de Teste', document: `doc-${Date.now()}-${Math.random()}` });
  return response.body.id as string;
}

describe('API de Processos (Lawsuits)', () => {
  afterEach(async () => {
    await truncateAllTables();
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
      expect(response.body).toMatchObject({
        cnjNumber: '0001234-72.2024.8.19.0001',
        clientId,
        status: 'PENDING', // valor padrão definido na migration/model (Fase 2)
      });
    });

    it('responde 422 quando falta "cnjNumber" ou "clientId"', async () => {
      const response = await request(app).post('/api/lawsuits').send({ cnjNumber: '0001234-72.2024.8.19.0001' });

      expect(response.status).toBe(422);
    });

    it('responde 404 quando o cliente informado não existe', async () => {
      const response = await request(app).post('/api/lawsuits').send({
        cnjNumber: '0001234-72.2024.8.19.0001',
        clientId: '00000000-0000-0000-0000-000000000000',
      });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toMatch(/não existe/i);
    });
  });

  describe('GET /api/lawsuits/:id', () => {
    it('retorna o processo com o cliente incluído e a lista de movimentações (vazia)', async () => {
      const clientId = await createTestClient();
      const created = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0007654-27.2023.8.19.0002', clientId });

      const response = await request(app).get(`/api/lawsuits/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.client.id).toBe(clientId);
      // Nenhuma sincronização foi disparada neste teste (não chamamos
      // /batch-import) — por isso o histórico começa vazio.
      expect(response.body.movements).toEqual([]);
    });

    it('responde 404 para um processo que não existe', async () => {
      const response = await request(app).get('/api/lawsuits/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });
});
