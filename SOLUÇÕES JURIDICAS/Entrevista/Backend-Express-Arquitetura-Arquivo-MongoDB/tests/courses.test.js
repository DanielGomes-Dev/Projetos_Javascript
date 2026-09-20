const request = require('supertest');
const app = require('../src/app');
const Course = require('../src/models/Course');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} = require('./helpers/mongo');

beforeAll(connectTestDatabase);
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);


describe('GET /courses', () => {
  it('deve listar os cursos cadastrados', async () => {
    await Course.create({
      nome: 'Curso de teste',
      codigo: 'TEST-01',
      idadeMinima: 18,
      capacidadeVagas: 2,
      valorMensalidade: 500
    });

    const response = await request(app).get('/courses');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      nome: 'Curso de teste',
      codigo: 'TEST-01',
      vagasOcupadas: 0
    });
  });
});
