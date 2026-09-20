# 18 — `GET /enrollments`: Listagem Filtrada

## 🎯 Objetivo

Fechar o CRUD de matrículas com uma listagem que aceita filtros opcionais por curso, aluno e status — validando cada filtro individualmente, sem depender das camadas anteriores para isso.

## 🔴 Teste (Red)

Adicione a `tests/enrollments.test.js`:

```javascript
// tests/enrollments.test.js
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
```

Rode `npm test -- enrollments`: falha — `GET /enrollments` ainda não existe (cai no handler de 404).

## 🟢 Código (Green)

Adicione `listEnrollments` a `src/services/enrollments.service.js` (editando o arquivo do capítulo 17):

```javascript
// src/services/enrollments.service.js
// ... resto do arquivo sem alteração

const VALID_STATUSES = Enrollment.STATUSES;

async function listEnrollments({ cursoId, alunoId, status } = {}) {
  if (status && !VALID_STATUSES.includes(status)) {
    throw badRequest('status inválido');
  }
  if (cursoId && !isValidObjectId(cursoId)) {
    throw badRequest('cursoId inválido');
  }
  if (alunoId && !isValidObjectId(alunoId)) {
    throw badRequest('alunoId inválido');
  }

  const filter = {};
  if (cursoId) filter.cursoId = cursoId;
  if (alunoId) filter.alunoId = alunoId;
  if (status) filter.status = status;

  return Enrollment.find(filter).sort({ createdAt: 1, _id: 1 });
}

module.exports = { createEnrollment, cancelEnrollment, listEnrollments };
```

> 💡 **Por que `VALID_STATUSES = Enrollment.STATUSES`, reaproveitando a constante já anexada ao model (capítulo 14), em vez de repetir a lista `['CONFIRMADA', 'FILA_ESPERA', 'CANCELADA']` aqui?** Se um quarto status fosse adicionado no futuro, bastaria mudar `STATUSES` num único lugar (`models/Enrollment.js`) — todo o resto do projeto que depende dessa lista (o `enum` do schema, e agora esta validação) fica automaticamente sincronizado, sem risco de um dos dois lugares ficar desatualizado.
>
> 💡 **Por que `listEnrollments` não passa pela fila técnica (`queue.enqueue(...)`), diferente de `createEnrollment`/`cancelEnrollment`?** A fila serializa **mutações** que afetam a capacidade do curso — não há necessidade de serializar uma leitura. `Enrollment.find(...)` não escreve nada, então não há condição de corrida para proteger aqui.
>
> 💡 **Por que a ordenação é `{ createdAt: 1, _id: 1 }`, com `_id` como desempate?** É a mesma ordenação usada por `Enrollment.findFirstWaiting` (capítulo 14/17) — importante para consistência: se duas matrículas forem criadas no mesmo milissegundo (o que `createdAt`, por si só, não consegue distinguir), o `_id` do MongoDB (que embute um contador incremental) desempata de forma determinística, sem depender de sorte.

Adicione o controller a `src/controllers/enrollments.controller.js`:

```javascript
// src/controllers/enrollments.controller.js
const asyncHandler = require('../utils/asyncHandler');
const enrollmentsService = require('../services/enrollments.service');

const create_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.createEnrollment(req.body);
  return res.status(201).json(matricula);
});

const get_all_enrollments = asyncHandler(async (req, res) => {
  const matriculas = await enrollmentsService.listEnrollments(req.query);
  return res.status(200).json(matriculas);
});

const cancel_enrollment = asyncHandler(async (req, res) => {
  const matricula = await enrollmentsService.cancelEnrollment(req.params.id);
  return res.status(200).json(matricula);
});

module.exports = { create_enrollment, get_all_enrollments, cancel_enrollment };
```

Adicione a rota a `src/routes/enrollments.js`:

```javascript
// src/routes/enrollments.js
const { Router } = require('express');
const {
  create_enrollment,
  get_all_enrollments,
  cancel_enrollment
} = require('../controllers/enrollments.controller');

const router = Router();

router.post('/', create_enrollment);
router.get('/', get_all_enrollments);
router.patch('/:id/cancel', cancel_enrollment);

module.exports = router;
```

## ✅ Como confirmar que funcionou

```bash
npm test
```

A suíte inteira do projeto deve passar — este é o último endpoint HTTP do desafio.

## 🔧 Commit sugerido

```bash
git add tests/enrollments.test.js
git commit -m "test: adicionar testes de listagem filtrada de matriculas"

git add src/services/enrollments.service.js src/controllers/enrollments.controller.js src/routes/enrollments.js
git commit -m "feat: adicionar listagem filtrada de matriculas"
```

## 📚 Documentação Oficial

- **Express — `req.query`**: https://expressjs.com/en/api.html#req.query
- **Mongoose — Queries e `sort`**: https://mongoosejs.com/docs/api/query.html#Query.prototype.sort()
- **MongoDB — ordenação por múltiplos campos**: https://www.mongodb.com/docs/manual/reference/method/cursor.sort/
