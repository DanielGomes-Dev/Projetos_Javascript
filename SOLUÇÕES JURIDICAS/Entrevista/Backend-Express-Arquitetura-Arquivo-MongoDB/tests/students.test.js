const request = require('supertest');
const app = require('../src/app');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} = require('./helpers/mongo');
const { createStudent } = require('./helpers/fixtures');

beforeAll(connectTestDatabase);
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

const validPayload = () => ({
  nome: 'Maria Silva',
  cpf: '123.456.789-00',
  email: 'Maria@Example.com',
  dataNascimento: '2000-08-20',
  rendaFamiliar: 2824.00
});

describe('POST /students', () => {
  it('cadastra um aluno válido normalizando cpf e email', async () => {
    const response = await request(app).post('/students').send(validPayload());

    expect(response.status).toBe(201);
    expect(response.body.cpf).toBe('12345678900');
    expect(response.body.email).toBe('maria@example.com');
    expect(response.body.nome).toBe('Maria Silva');
  });

  it('rejeita payload com campo obrigatório ausente', async () => {
    const payload = validPayload();
    delete payload.nome;

    const response = await request(app).post('/students').send(payload);
    expect(response.status).toBe(400);
  });

  it('rejeita string vazia', async () => {
    const response = await request(app).post('/students').send({ ...validPayload(), nome: '   ' });
    expect(response.status).toBe(400);
  });

  it('rejeita dataNascimento no futuro', async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    const response = await request(app).post('/students').send({
      ...validPayload(),
      dataNascimento: amanha.toISOString().slice(0, 10)
    });
    expect(response.status).toBe(400);
  });

  it('rejeita dataNascimento com data civil inválida', async () => {
    const response = await request(app).post('/students').send({
      ...validPayload(),
      dataNascimento: '2023-02-30'
    });
    expect(response.status).toBe(400);
  });

  it('rejeita rendaFamiliar com mais de duas casas decimais', async () => {
    const response = await request(app).post('/students').send({ ...validPayload(), rendaFamiliar: 10.999 });
    expect(response.status).toBe(400);
  });

  it('rejeita rendaFamiliar negativa', async () => {
    const response = await request(app).post('/students').send({ ...validPayload(), rendaFamiliar: -1 });
    expect(response.status).toBe(400);
  });

  it('rejeita cpf com formato inválido', async () => {
    const response = await request(app).post('/students').send({ ...validPayload(), cpf: '123' });
    expect(response.status).toBe(400);
  });

  it('rejeita email com formato inválido', async () => {
    const response = await request(app).post('/students').send({ ...validPayload(), email: 'invalido' });
    expect(response.status).toBe(400);
  });

  it('retorna 409 para cpf duplicado', async () => {
    await request(app).post('/students').send(validPayload());

    const response = await request(app).post('/students').send({ ...validPayload(), email: 'outro@example.com' });
    expect(response.status).toBe(409);
  });

  it('retorna 409 para email duplicado (comparação case-insensitive)', async () => {
    await request(app).post('/students').send(validPayload());

    const response = await request(app).post('/students').send({
      ...validPayload(),
      cpf: '987.654.321-00',
      email: 'MARIA@EXAMPLE.COM'
    });
    expect(response.status).toBe(409);
  });
});

describe('GET /students', () => {
  it('lista os alunos cadastrados', async () => {
    await createStudent({ nome: 'Aluno 1' });
    await createStudent({ nome: 'Aluno 2' });

    const response = await request(app).get('/students');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });
});
