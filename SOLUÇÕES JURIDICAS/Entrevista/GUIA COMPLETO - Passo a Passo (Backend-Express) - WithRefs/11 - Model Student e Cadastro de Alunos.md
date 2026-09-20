# 11 — Model Student e Cadastro de Alunos

## 🎯 Objetivo

Implementar o primeiro fluxo de negócio completo do desafio: `POST /students` (cadastro, com validação e normalização) e `GET /students` (listagem) — apoiado nas funções puras do capítulo 10.

## 🔴 Teste (Red)

Crie `tests/helpers/fixtures.js` — fábricas de dados de teste reaproveitadas por toda a suíte de integração daqui em diante (começando só com aluno; curso entra no capítulo 15):

```javascript
// tests/helpers/fixtures.js
const Student = require('../../src/models/Student');

let sequence = 0;

function nextSequence() {
  sequence += 1;
  return sequence;
}

async function createStudent(overrides = {}) {
  const n = nextSequence();
  return Student.create({
    nome: `Aluno Teste ${n}`,
    cpf: String(10000000000 + n).padStart(11, '0'),
    email: `aluno${n}@example.com`,
    dataNascimento: new Date('2000-01-01T00:00:00.000Z'),
    rendaFamiliar: 3000,
    ...overrides
  });
}

module.exports = { createStudent };
```

> 💡 **Por que um contador `sequence` compartilhado, em vez de dados fixos repetidos em cada teste?** `cpf` e `email` são únicos no banco (você vai ver o índice a seguir). Se toda chamada de `createStudent()` usasse o mesmo CPF fixo, o segundo teste que precisasse de "um aluno qualquer" colidiria com o primeiro. O contador garante um valor sempre novo, sem cada teste individual precisar inventar um CPF/e-mail exclusivo manualmente.

Crie `tests/students.test.js`:

```javascript
// tests/students.test.js
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
```

Rode `npm test`: todo o arquivo falha de cara — nem `src/models/Student.js` existe ainda.

## 🟢 Código (Green)

Crie `src/models/Student.js`:

```javascript
// src/models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cpf: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true },
  dataNascimento: { type: Date, required: true },
  rendaFamiliar: { type: Number, required: true, min: 0 }
}, { timestamps: true });

studentSchema.statics.findByCpf = function findByCpf(cpf) {
  return this.findOne({ cpf });
};

studentSchema.statics.findByEmail = function findByEmail(email) {
  return this.findOne({ email });
};

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);
```

> 💡 **Por que `findByCpf`/`findByEmail` como *static methods* do model, em vez de `Student.findOne({ cpf })` espalhado pelo service?** É uma escolha de legibilidade e localidade: quem lê `services/students.service.js` (a seguir) vê `Student.findByCpf(cpf)` e entende a intenção sem precisar reconstruir a query mentalmente. Não é uma exigência técnica — só uma convenção que este projeto adota para consultas repetidas por campo único.

Crie `src/services/students.service.js` — onde toda a validação e normalização acontece, **antes** de tocar o banco:

```javascript
// src/services/students.service.js
const Student = require('../models/Student');
const {
  isNonEmptyString,
  normalizeCpf,
  isValidCpf,
  normalizeEmail,
  isValidEmail,
  hasAtMostTwoDecimals
} = require('../utils/validators');
const { badRequest, conflict } = require('../utils/httpErrors');

function parseDataNascimento(dataNascimento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw badRequest('dataNascimento deve estar no formato YYYY-MM-DD');
  }

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const nascimento = new Date(Date.UTC(ano, mes - 1, dia));

  const isDataCivilValida = nascimento.getUTCFullYear() === ano
    && nascimento.getUTCMonth() === mes - 1
    && nascimento.getUTCDate() === dia;
  if (!isDataCivilValida) {
    throw badRequest('dataNascimento inválida');
  }

  const hoje = new Date();
  const hojeUTC = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  if (nascimento > hojeUTC) {
    throw badRequest('dataNascimento não pode estar no futuro');
  }

  return nascimento;
}

async function listStudents() {
  return Student.find().sort({ createdAt: 1 });
}

async function createStudent(payload = {}) {
  const { nome, cpf, email, dataNascimento, rendaFamiliar } = payload;

  if (!isNonEmptyString(nome)
    || !isNonEmptyString(cpf)
    || !isNonEmptyString(email)
    || !isNonEmptyString(dataNascimento)
    || rendaFamiliar === undefined
    || rendaFamiliar === null) {
    throw badRequest('Todos os campos são obrigatórios');
  }

  const nascimento = parseDataNascimento(dataNascimento);

  if (typeof rendaFamiliar !== 'number' || rendaFamiliar < 0 || !hasAtMostTwoDecimals(rendaFamiliar)) {
    throw badRequest('rendaFamiliar deve ser um número maior ou igual a zero, com no máximo duas casas decimais');
  }

  if (!isValidCpf(cpf)) {
    throw badRequest('cpf deve conter exatamente 11 dígitos');
  }
  const cpfNormalizado = normalizeCpf(cpf);

  if (!isValidEmail(email)) {
    throw badRequest('email inválido');
  }
  const emailNormalizado = normalizeEmail(email);

  const [cpfExistente, emailExistente] = await Promise.all([
    Student.findByCpf(cpfNormalizado),
    Student.findByEmail(emailNormalizado)
  ]);
  if (cpfExistente) throw conflict('cpf já cadastrado');
  if (emailExistente) throw conflict('email já cadastrado');

  try {
    return await Student.create({
      nome: nome.trim(),
      cpf: cpfNormalizado,
      email: emailNormalizado,
      dataNascimento: nascimento,
      rendaFamiliar
    });
  } catch (error) {
    if (error.code === 11000) {
      throw conflict('cpf ou email já cadastrado');
    }
    throw error;
  }
}

module.exports = { listStudents, createStudent };
```

> 💡 **Por que checar `cpfExistente`/`emailExistente` por uma consulta explícita, **e também** capturar `error.code === 11000` do `Student.create(...)`?** É uma defesa em duas camadas, deliberadamente redundante. A consulta prévia existe para devolver uma mensagem de erro clara e específica (`'cpf já cadastrado'` vs. `'email já cadastrado'`) no caminho comum. Mas entre essa consulta e o `.create()` que vem logo depois, uma requisição concorrente poderia inserir o mesmo CPF nesse intervalo — é uma *race condition* pequena, porém real. O índice único do Mongo (`unique: true` no schema) é a garantia definitiva: se isso acontecer, o `.create()` falha com o código de erro `11000` (chave duplicada), e o `catch` traduz isso no mesmo `409` — só que com uma mensagem mais genérica, porque nesse ponto não se sabe mais qual dos dois campos colidiu.
>
> 💡 **Por que `parseDataNascimento` monta a data com `Date.UTC(ano, mes - 1, dia)`, em vez de `new Date('2000-08-20')` diretamente?** `new Date('2000-08-20')` (formato `YYYY-MM-DD` sem hora) já é interpretado como UTC-meia-noite pelo próprio JavaScript — mas essa conversão automática **não valida** a data civil: `new Date('2023-02-30')` não lança erro, ela "rola para frente" silenciosamente para 2 de março. Construir a data manualmente com `Date.UTC(ano, mes - 1, dia)` e depois **reler** os componentes (`getUTCFullYear()`, etc.) para conferir que batem com o que foi pedido é o que permite rejeitar `30 de fevereiro` como `400`, em vez de aceitar silenciosamente uma data errada.

Crie `src/controllers/student.controller.js`:

```javascript
// src/controllers/student.controller.js
const asyncHandler = require('../utils/asyncHandler');
const studentsService = require('../services/students.service');

const get_all_student = asyncHandler(async (req, res) => {
  const students = await studentsService.listStudents();
  return res.status(200).json(students);
});

const create_student = asyncHandler(async (req, res) => {
  const student = await studentsService.createStudent(req.body);
  return res.status(201).json(student);
});

module.exports = { get_all_student, create_student };
```

Crie `src/routes/students.js`:

```javascript
// src/routes/students.js
const { Router } = require('express');
const { get_all_student, create_student } = require('../controllers/student.controller');

const router = Router();

router.get('/', get_all_student);
router.post('/', create_student);

module.exports = router;
```

Registre a nova rota em `src/routes/index.js`:

```javascript
// src/routes/index.js
const { Router } = require('express');

const studentsRoutes = require('./students');
const coursesRoutes = require('./courses');

const router = Router();

router.use('/students', studentsRoutes);
router.use('/courses', coursesRoutes);

module.exports = router;
```

Por fim, atualize `tests/helpers/mongo.js` para também esperar os índices únicos de `Student` (`cpf`, `email`):

```javascript
// tests/helpers/mongo.js
const Student = require('../../src/models/Student');
const Course = require('../../src/models/Course');

// ... dentro de connectTestDatabase, depois de mongoose.connect(...):
await Promise.all([Student.init(), Course.init()]);
```

## ✅ Como confirmar que funcionou

```bash
npm test
```

Todos os testes de `tests/students.test.js` devem passar, junto com o resto da suíte.

## 🔧 Commit sugerido

```bash
git add tests/students.test.js tests/helpers/fixtures.js tests/helpers/mongo.js
git commit -m "test: adicionar testes de cadastro e listagem de alunos"

git add src/models/Student.js src/services/students.service.js src/controllers/student.controller.js src/routes/students.js src/routes/index.js
git commit -m "feat: adicionar cadastro e listagem de alunos"
```

## 📚 Documentação Oficial

- **Mongoose — Schemas e `statics`**: https://mongoosejs.com/docs/guide.html#statics
- **Mongoose — `Model.init()`**: https://mongoosejs.com/docs/api/model.html#Model.init()
- **MongoDB — erro de chave duplicada (código `11000`)**: https://www.mongodb.com/docs/manual/core/index-unique/
- **MDN — `Date.UTC()`**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC
