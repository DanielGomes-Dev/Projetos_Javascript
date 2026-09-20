# 15 — `POST /enrollments`: Idade Mínima e Cálculo de Bolsa

## 🎯 Objetivo

Implementar o primeiro fluxo de matrícula: validação de aluno/curso, idade mínima, cálculo de bolsa e uma primeira versão — deliberadamente simples — de controle de capacidade. Este capítulo entrega o comportamento correto sob uso **sequencial**; o capítulo 16 volta exatamente a este código para expor e corrigir o ponto em que ele não é seguro sob **concorrência**.

## 🔴 Teste (Red)

Adicione `createCourse` a `tests/helpers/fixtures.js` (editando o arquivo do capítulo 11):

```javascript
// tests/helpers/fixtures.js
const Student = require('../../src/models/Student');
const Course = require('../../src/models/Course');

let sequence = 0;

function nextSequence() {
  sequence += 1;
  return sequence;
}

async function createStudent(overrides = {}) {
  // ... sem alteração (capítulo 11)
}

async function createCourse(overrides = {}) {
  const n = nextSequence();
  return Course.create({
    nome: `Curso Teste ${n}`,
    codigo: `COD-${n}`,
    idadeMinima: 0,
    capacidadeVagas: 5,
    valorMensalidade: 1000,
    status: 'ABERTO',
    ...overrides
  });
}

module.exports = { createStudent, createCourse };
```

Crie `tests/enrollments.test.js` — só com os cenários que **não** dependem de concorrência nem de cancelamento (ambos chegam nos próximos capítulos):

```javascript
// tests/enrollments.test.js
const request = require('supertest');
const app = require('../src/app');
const Course = require('../src/models/Course');
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

  it('calcula percentual de bolsa e mensalidade final conforme a renda', async () => {
    const curso = await createCourse({ valorMensalidade: 1000 });
    const aluno = await createStudent({ rendaFamiliar: 2824.00 });

    const response = await request(app)
      .post('/enrollments')
      .send({ alunoId: aluno._id.toString(), cursoId: curso._id.toString() });

    expect(response.body.percentualBolsa).toBe(0.5);
    expect(response.body.valorFinal).toBe(500);
  });
});
```

Rode `npm test`: falha inteiro — nem a rota `/enrollments` existe ainda.

## 🟢 Código (Green)

Crie `src/services/enrollments.service.js` — a versão inicial, ainda com uma verificação de capacidade simples (leia com atenção o aviso logo depois do código):

```javascript
// src/services/enrollments.service.js
const mongoose = require('mongoose');

const Student = require('../models/Student');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { calculateAge, calculateScholarshipPercentage } = require('../utils/validators');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/httpErrors');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

async function createEnrollment({ alunoId, cursoId } = {}) {
  if (!isValidObjectId(alunoId) || !isValidObjectId(cursoId)) {
    throw badRequest('alunoId/cursoId inválido');
  }

  const [aluno, curso] = await Promise.all([
    Student.findById(alunoId),
    Course.findById(cursoId)
  ]);
  if (!aluno) throw notFound('Aluno não encontrado');
  if (!curso) throw notFound('Curso não encontrado');

  if (curso.status !== 'ABERTO') {
    throw unprocessable('Curso encerrado para novas matrículas');
  }

  const idade = calculateAge(aluno.dataNascimento);
  if (idade < curso.idadeMinima) {
    throw unprocessable('Aluno não possui idade mínima exigida pelo curso');
  }

  const matriculaAtiva = await Enrollment.findActiveByAlunoAndCurso(alunoId, cursoId);
  if (matriculaAtiva) {
    throw conflict('Aluno já possui matrícula ativa neste curso');
  }

  const percentualBolsa = calculateScholarshipPercentage(aluno.rendaFamiliar);
  const valorFinal = Math.round(curso.valorMensalidade * (1 - percentualBolsa) * 100) / 100;

  // ⚠️ Ler "há vaga?" e, num passo separado, gravar a matrícula/atualizar
  // o contador é exatamente a sequência que o capítulo 16 vai provar (com
  // um teste) que não é segura sob concorrência. Fica assim por enquanto
  // de propósito — o objetivo deste capítulo é fechar a regra de negócio
  // primeiro, sob uso sequencial, antes de resolver a race condition.
  const temVaga = curso.vagasOcupadas < curso.capacidadeVagas;
  const status = temVaga ? 'CONFIRMADA' : 'FILA_ESPERA';

  if (temVaga) {
    await Course.findByIdAndUpdate(cursoId, { $inc: { vagasOcupadas: 1 } });
  }

  const matricula = await Enrollment.createActive({ alunoId, cursoId, status, percentualBolsa, valorFinal });
  return matricula.toObject();
}

module.exports = { createEnrollment };
```

> 💡 **Por que a idade é calculada a partir de `aluno.dataNascimento` (já um `Date` gravado no banco), reaproveitando `calculateAge` do capítulo 10, sem nenhuma lógica nova aqui?** Esta é a recompensa de ter isolado aquela função como pura e bem testada: nenhum caso de borda de calendário (aniversário hoje, mês/ano cruzando a virada) precisa ser reconsiderado aqui — o service só chama a função e confia nela.
>
> 💡 **A ordem das checagens importa: `curso` existe → `curso.status` → idade → duplicidade.** Cada `throw` interrompe a função imediatamente (o restante do código não roda), então a ordem determina qual erro o cliente vê primeiro quando várias coisas estão erradas ao mesmo tempo. Aqui a ordem segue "o que é mais barato/fundamental de checar primeiro" — não faz sentido calcular bolsa para um curso que nem existe.

Crie `src/controllers/enrollments.controller.js`:

```javascript
// src/controllers/enrollments.controller.js
const asyncHandler = require('../utils/asyncHandler');
const enrollmentsService = require('../services/enrollments.service');

const create_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.createEnrollment(req.body);
  return res.status(201).json(matricula);
});

module.exports = { create_enrollment };
```

Crie `src/routes/enrollments.js`:

```javascript
// src/routes/enrollments.js
const { Router } = require('express');
const { create_enrollment } = require('../controllers/enrollments.controller');

const router = Router();

router.post('/', create_enrollment);

module.exports = router;
```

Registre em `src/routes/index.js`:

```javascript
// src/routes/index.js
const { Router } = require('express');

const studentsRoutes = require('./students');
const coursesRoutes = require('./courses');
const enrollmentsRoutes = require('./enrollments');

const router = Router();

router.use('/students', studentsRoutes);
router.use('/courses', coursesRoutes);
router.use('/enrollments', enrollmentsRoutes);

module.exports = router;
```

## ✅ Como confirmar que funcionou

```bash
npm test
```

Todos os testes de `tests/enrollments.test.js` devem passar — inclusive os dois cenários de capacidade (`CONFIRMADA` e `FILA_ESPERA`), porque o Supertest, por padrão, executa as requisições de um teste **sequencialmente**, uma de cada vez. Isso é exatamente o ponto cego que o próximo capítulo escancara.

## 🔧 Commit sugerido

```bash
git add tests/helpers/fixtures.js tests/enrollments.test.js
git commit -m "test: adicionar testes de criacao de matricula"

git add src/services/enrollments.service.js src/controllers/enrollments.controller.js src/routes/enrollments.js src/routes/index.js
git commit -m "feat: adicionar criacao de matricula com idade minima e bolsa"
```

## 📚 Documentação Oficial

- **Mongoose — `isValidObjectId`**: https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.isValidObjectId()
- **Mongoose — `findByIdAndUpdate` e `$inc`**: https://mongoosejs.com/docs/api/model.html#Model.findByIdAndUpdate()
- **MongoDB — operador `$inc`**: https://www.mongodb.com/docs/manual/reference/operator/update/inc/
