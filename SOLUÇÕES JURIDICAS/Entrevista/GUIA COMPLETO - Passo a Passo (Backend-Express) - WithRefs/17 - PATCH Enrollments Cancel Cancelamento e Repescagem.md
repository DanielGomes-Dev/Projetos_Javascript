# 17 — `PATCH /enrollments/:id/cancel`: Cancelamento e Repescagem

## 🎯 Objetivo

Implementar o cancelamento de matrícula — incluindo a regra mais delicada do desafio: cancelar uma matrícula `CONFIRMADA` precisa promover automaticamente o primeiro aluno da fila de espera, sem nunca duplicar uma promoção nem repetir um decremento, mesmo sob chamadas concorrentes ou repetidas.

## 🔴 Teste (Red)

Adicione o teste adiado do capítulo 15 (agora possível, já que o endpoint de cancelamento vai existir) ao `describe('POST /enrollments', ...)` de `tests/enrollments.test.js`:

```javascript
// tests/enrollments.test.js — dentro de describe('POST /enrollments', ...)
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
```

Crie um novo `describe` em `tests/enrollments.test.js` para o endpoint de cancelamento em si:

```javascript
// tests/enrollments.test.js
const Enrollment = require('../src/models/Enrollment');
// ... (adicione este require no topo do arquivo, junto dos demais)

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
```

Rode `npm test -- enrollments`: o novo `describe` falha inteiro — a rota `PATCH /enrollments/:id/cancel` não existe.

## 🟢 Código (Green)

Adicione `promoteNextOrRelease` e `performCancelEnrollment` a `src/services/enrollments.service.js` (editando o arquivo do capítulo 16), e amplie o `queue = buildDriver(...)` para incluir o novo handler:

```javascript
// src/services/enrollments.service.js
// ... isValidObjectId, ok, fail, unwrap, performCreateEnrollment sem alteração (capítulo 16)

const MAX_PROMOTION_ATTEMPTS = 20;

async function promoteNextOrRelease(cursoId) {
  for (let attempt = 0; attempt < MAX_PROMOTION_ATTEMPTS; attempt += 1) {
    const candidato = await Enrollment.findFirstWaiting(cursoId);
    if (!candidato) {
      await Course.decrementIfPositive(cursoId);
      return null;
    }

    const promovida = await Enrollment.updateStatusIfCurrent(candidato._id, 'FILA_ESPERA', 'CONFIRMADA');
    if (promovida) {
      return promovida;
    }
    // promovida === null: outra chamada concorrente já mexeu neste
    // candidato entre o findFirstWaiting e o updateStatusIfCurrent.
    // Tenta de novo, com o próximo candidato da fila.
  }

  await Course.decrementIfPositive(cursoId);
  return null;
}

async function performCancelEnrollment({ id } = {}) {
  try {
    if (!isValidObjectId(id)) {
      throw badRequest('id inválido');
    }

    const matricula = await Enrollment.findById(id);
    if (!matricula) {
      throw notFound('Matrícula não encontrada');
    }

    if (matricula.status === 'CANCELADA') {
      return ok(matricula.toObject());
    }

    const statusAnterior = matricula.status;
    const cancelada = await Enrollment.updateStatusIfCurrent(id, statusAnterior, 'CANCELADA');
    if (!cancelada) {
      const atual = await Enrollment.findById(id);
      return ok(atual.toObject());
    }

    if (statusAnterior === 'CONFIRMADA') {
      await promoteNextOrRelease(matricula.cursoId);
    }

    return ok(cancelada.toObject());
  } catch (error) {
    return fail(error);
  }
}

const queue = buildDriver({
  createEnrollment: performCreateEnrollment,
  cancelEnrollment: performCancelEnrollment
});

async function createEnrollment(payload) {
  const envelope = await queue.enqueue('createEnrollment', payload || {});
  return unwrap(envelope);
}

async function cancelEnrollment(id) {
  const envelope = await queue.enqueue('cancelEnrollment', { id });
  return unwrap(envelope);
}

module.exports = { createEnrollment, cancelEnrollment };
```

> 💡 **Por que cancelar uma matrícula já `CANCELADA` retorna `200` com o estado atual, em vez de um erro?** É uma escolha deliberada de idempotência: do ponto de vista de quem chama, "a matrícula está cancelada" já é o resultado desejado — tratar isso como erro faria um retry inofensivo (por exemplo, depois de uma resposta perdida na rede) parecer uma falha real. A alternativa (`409 Conflict`) também seria defensável; o importante é que, qualquer que seja a escolha, a operação não produza **novos** efeitos numa matrícula já cancelada — nenhum decremento extra, nenhuma promoção extra.
>
> 💡 **Por que `promoteNextOrRelease` tenta de novo (até `MAX_PROMOTION_ATTEMPTS` vezes) em vez de desistir na primeira falha do `updateStatusIfCurrent`?** `updateStatusIfCurrent` é o mesmo compare-and-swap do capítulo 14 — ele retorna `null` se, entre `findFirstWaiting` e a tentativa de promoção, **outra** operação concorrente já mudou o status daquele candidato (por exemplo, o próprio aluno cancelou a matrícula em fila de espera bem nesse instante). Desistir aí deixaria a vaga sem ninguém, mesmo havendo outros candidatos na fila. Tentar de novo, buscando o próximo primeiro-da-fila a cada iteração, cobre o caso de dois cancelamentos de matrículas `CONFIRMADA`s do mesmo curso acontecendo ao mesmo tempo, ambos "vendo" a mesma pessoa como primeira da fila.
>
> 💡 **Por que `promoteNextOrRelease` decrementa `vagasOcupadas` quando **não** há ninguém na fila, mas não decrementa quando promove alguém?** A vaga nunca fica realmente livre quando há promoção — uma pessoa saiu (a que cancelou), outra ocupou o lugar dela (a promovida): o contador de vagas ocupadas permanece igual. Só quando não existe mais ninguém esperando é que a vaga fica de fato livre, e o contador precisa refletir isso com um decremento.

Crie `src/controllers/enrollments.controller.js` com o novo handler (editando o arquivo do capítulo 15):

```javascript
// src/controllers/enrollments.controller.js
const asyncHandler = require('../utils/asyncHandler');
const enrollmentsService = require('../services/enrollments.service');

const create_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.createEnrollment(req.body);
  return res.status(201).json(matricula);
});

const cancel_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.cancelEnrollment(req.params.id);
  return res.status(200).json(matricula);
});

module.exports = { create_enrollment, cancel_enrollment };
```

Adicione a rota em `src/routes/enrollments.js`:

```javascript
// src/routes/enrollments.js
const { Router } = require('express');
const { create_enrollment, cancel_enrollment } = require('../controllers/enrollments.controller');

const router = Router();

router.post('/', create_enrollment);
router.patch('/:id/cancel', cancel_enrollment);

module.exports = router;
```

## ✅ Como confirmar que funcionou

```bash
npm test -- enrollments
```

Toda a suíte de `tests/enrollments.test.js` deve passar, incluindo o novo `describe('PATCH /enrollments/:id/cancel', ...)` e o teste de re-matrícula após cancelamento.

## 🔧 Commit sugerido

```bash
git add tests/enrollments.test.js
git commit -m "test: adicionar testes de cancelamento e repescagem de matricula"

git add src/services/enrollments.service.js src/controllers/enrollments.controller.js src/routes/enrollments.js
git commit -m "feat: adicionar cancelamento de matricula com promocao da fila"
```

## 📚 Documentação Oficial

- **Mongoose — `findOneAndUpdate` (compare-and-swap revisitado)**: https://mongoosejs.com/docs/api/model.html#Model.findOneAndUpdate()
- **MDN — laços `for` e controle de tentativas**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for
- **REST — idempotência de métodos HTTP**: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
