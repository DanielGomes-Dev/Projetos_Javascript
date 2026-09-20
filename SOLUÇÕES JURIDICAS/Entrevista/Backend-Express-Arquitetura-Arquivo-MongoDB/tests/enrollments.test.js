const request = require('supertest');
const app = require('../src/app');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} = require('./helpers/mongo');
const { createStudent, createCourse } = require('./helpers/fixtures');

beforeAll(connectTestDatabase);
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

describe('POST /enrollments', () => {
  it('confirma a matrícula quando há vaga disponível', async () => {
    const aluno = await createStudent({ dataNascimento: new Date('2000-01-01') });
    const curso = await createCourse({ capacidadeVagas: 2, idadeMinima: 18, valorMensalidade: 1000 });

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('CONFIRMADA');

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(1);
  });

  it('coloca em fila de espera quando o curso está lotado', async () => {
    const curso = await createCourse({ capacidadeVagas: 1 });
    const aluno1 = await createStudent();
    const aluno2 = await createStudent();

    await request(app).post('/enrollments').send({ alunoId: aluno1._id.toString(), cursoId: curso._id.toString() });
    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno2._id.toString(), cursoId: curso._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('FILA_ESPERA');

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(1);
  });

  it('rejeita matrícula por idade insuficiente com 422', async () => {
    const aluno = await createStudent({ dataNascimento: new Date('2015-01-01') });
    const curso = await createCourse({ idadeMinima: 18 });

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.status).toBe(422);
  });

  it('rejeita matrícula em curso encerrado com 422', async () => {
    const aluno = await createStudent();
    const curso = await createCourse({ status: 'ENCERRADO' });

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.status).toBe(422);
  });

  it('retorna 400 para ObjectId malformado', async () => {
    const response = await request(app).post('/enrollments').send({ alunoId: 'invalido', cursoId: 'invalido' });
    expect(response.status).toBe(400);
  });

  it('retorna 404 quando aluno ou curso não existem', async () => {
    const curso = await createCourse();
    const idInexistente = '507f1f77bcf86cd799439011';

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: idInexistente, cursoId: curso._id.toString() });

    expect(response.status).toBe(404);
  });

  it('impede matrícula ativa duplicada com 409', async () => {
    const aluno = await createStudent();
    const curso = await createCourse();

    await request(app).post('/enrollments').send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });
    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.status).toBe(409);
  });

  it('permite nova matrícula após cancelamento', async () => {
    const aluno = await createStudent();
    const curso = await createCourse();

    const primeira = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });
    await request(app).patch(`/enrollments/${primeira.body._id}/cancel`);

    const segunda = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(segunda.status).toBe(201);
  });

  it('calcula percentual de bolsa e mensalidade final conforme a renda', async () => {
    const curso = await createCourse({ valorMensalidade: 1000 });
    const aluno = await createStudent({ rendaFamiliar: 2824.00 });

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.body.percentualBolsa).toBe(0.5);
    expect(response.body.valorFinal).toBe(500);
  });

  it('não permite que vagasOcupadas ultrapasse a capacidade sob concorrência', async () => {
    const curso = await createCourse({ capacidadeVagas: 1 });
    const aluno1 = await createStudent();
    const aluno2 = await createStudent();

    const [res1, res2] = await Promise.all([
      request(app).post('/enrollments').send({ alunoId: aluno1._id.toString(), cursoId: curso._id.toString() }),
      request(app).post('/enrollments').send({ alunoId: aluno2._id.toString(), cursoId: curso._id.toString() })
    ]);

    const statuses = [res1.body.status, res2.body.status].sort();
    expect(statuses).toEqual(['CONFIRMADA', 'FILA_ESPERA']);

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(1);
  });
});

describe('PATCH /enrollments/:id/cancel', () => {
  it('cancela uma matrícula em fila de espera sem alterar vagasOcupadas nem promover', async () => {
    const curso = await createCourse({ capacidadeVagas: 1 });
    const aluno1 = await createStudent();
    const aluno2 = await createStudent();

    await request(app).post('/enrollments').send({ alunoId: aluno1._id.toString(), cursoId: curso._id.toString() });
    const fila = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno2._id.toString(), cursoId: curso._id.toString() });

    const cancelamento = await request(app).patch(`/enrollments/${fila.body._id}/cancel`);
    expect(cancelamento.status).toBe(200);
    expect(cancelamento.body.status).toBe('CANCELADA');

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(1);
  });

  it('promove o primeiro da fila ao cancelar uma matrícula confirmada', async () => {
    const curso = await createCourse({ capacidadeVagas: 1 });
    const aluno1 = await createStudent();
    const aluno2 = await createStudent();

    const confirmada = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno1._id.toString(), cursoId: curso._id.toString() });
    const emFila = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno2._id.toString(), cursoId: curso._id.toString() });

    const cancelamento = await request(app).patch(`/enrollments/${confirmada.body._id}/cancel`);
    expect(cancelamento.status).toBe(200);

    const promovida = await Enrollment.findById(emFila.body._id);
    expect(promovida.status).toBe('CONFIRMADA');

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(1);
  });

  it('decrementa vagasOcupadas ao cancelar matrícula confirmada sem fila', async () => {
    const curso = await createCourse({ capacidadeVagas: 2 });
    const aluno = await createStudent();

    const confirmada = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });
    await request(app).patch(`/enrollments/${confirmada.body._id}/cancel`);

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(0);
  });

  it('cancelamento repetido é idempotente e não produz novos efeitos', async () => {
    const curso = await createCourse({ capacidadeVagas: 1 });
    const aluno = await createStudent();

    const confirmada = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });
    await request(app).patch(`/enrollments/${confirmada.body._id}/cancel`);
    const segundoCancelamento = await request(app).patch(`/enrollments/${confirmada.body._id}/cancel`);

    expect(segundoCancelamento.status).toBe(200);
    expect(segundoCancelamento.body.status).toBe('CANCELADA');

    const cursoAtualizado = await Course.findById(curso._id);
    expect(cursoAtualizado.vagasOcupadas).toBe(0);
  });

  it('retorna 404 para matrícula inexistente', async () => {
    const response = await request(app).patch('/enrollments/507f1f77bcf86cd799439011/cancel');
    expect(response.status).toBe(404);
  });

  it('retorna 400 para id malformado', async () => {
    const response = await request(app).patch('/enrollments/id-invalido/cancel');
    expect(response.status).toBe(400);
  });
});

describe('GET /enrollments', () => {
  it('filtra matrículas por cursoId e por status', async () => {
    const curso = await createCourse({ capacidadeVagas: 5 });
    const aluno = await createStudent();
    await request(app).post('/enrollments').send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    const porCurso = await request(app).get(`/enrollments?cursoId=${curso._id}`);
    expect(porCurso.status).toBe(200);
    expect(porCurso.body).toHaveLength(1);

    const porStatus = await request(app).get('/enrollments?status=CONFIRMADA');
    expect(porStatus.body).toHaveLength(1);

    const semResultado = await request(app).get('/enrollments?status=CANCELADA');
    expect(semResultado.body).toHaveLength(0);
  });

  it('retorna 400 para status inválido', async () => {
    const response = await request(app).get('/enrollments?status=INVALIDO');
    expect(response.status).toBe(400);
  });

  it('retorna 400 para cursoId malformado', async () => {
    const response = await request(app).get('/enrollments?cursoId=invalido');
    expect(response.status).toBe(400);
  });
});
