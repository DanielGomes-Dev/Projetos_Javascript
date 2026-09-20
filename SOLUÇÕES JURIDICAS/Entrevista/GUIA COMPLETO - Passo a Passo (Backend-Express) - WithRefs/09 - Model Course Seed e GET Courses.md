# 09 — Model Course, Seed e `GET /courses`

## 🎯 Objetivo

Criar o primeiro model persistido do projeto (`Course`), o primeiro endpoint de negócio (`GET /courses`) e um script de seed para popular o banco local com dados de exemplo — o menor "fim a fim" possível de dado real.

## 🔴 Teste (Red)

Adicione um novo bloco a `tests/health.test.js` (o mesmo arquivo do capítulo 07 — cursos e healthcheck continuam sendo, por enquanto, os únicos recursos "prontos" da aplicação):

```javascript
// tests/health.test.js
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

describe('GET /health', () => {
  // ... testes do capítulo 07, sem alteração
});

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
```

Rode `npm test`: falha em dois lugares — `require('../src/models/Course')` não existe, e mesmo que existisse, `GET /courses` ainda cairia no handler de 404.

## 🟢 Código (Green)

Crie `src/models/Course.js`:

```javascript
// src/models/Course.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  codigo: { type: String, required: true, unique: true, trim: true },
  descricao: { type: String, trim: true },
  idadeMinima: { type: Number, required: true, default: 0, min: 0 },
  capacidadeVagas: { type: Number, required: true, min: 1 },
  vagasOcupadas: { type: Number, default: 0, min: 0 },
  valorMensalidade: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['ABERTO', 'ENCERRADO'],
    default: 'ABERTO'
  }
}, { timestamps: true });

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema);
```

> 💡 **`mongoose.models.Course || mongoose.model('Course', courseSchema)` — por que essa verificação, em vez de só `mongoose.model(...)`?** O Mongoose lança um erro se você tentar registrar o **mesmo** nome de model duas vezes na mesma conexão. Isso normalmente não aconteceria em produção (cada arquivo é `require`ado uma única vez), mas o Jest, ao rodar vários arquivos de teste que importam este model, pode recarregar módulos em cenários específicos (`jest.resetModules`, *watch mode*) — este padrão defensivo evita o erro "Cannot overwrite `Course` model once compiled" nesses casos. É seguro manter mesmo quando não é estritamente necessário.
>
> 💡 **`vagasOcupadas` já nasce com um schema pensando em concorrência**, mesmo que a lógica de incrementar/decrementar só chegue no capítulo 16 — `min: 0` no schema é uma segunda linha de defesa (a primeira, a de verdade, vai ser um filtro condicional no `findOneAndUpdate`), garantindo que o Mongoose rejeita qualquer tentativa de gravar um valor negativo por engano.
>
> 💡 **`status: enum: ['ABERTO', 'ENCERRADO']`** — travar os valores possíveis no próprio schema significa que uma tentativa de gravar `status: 'QUALQUER_COISA'` falha com `ValidationError` do Mongoose antes mesmo de chegar à lógica de negócio.

Crie `src/services/courses.service.js`:

```javascript
// src/services/courses.service.js
const Course = require('../models/Course');

async function listCourses() {
  return Course.find().sort({ createdAt: 1 });
}

module.exports = { listCourses };
```

Crie `src/controllers/courses.controller.js`:

```javascript
// src/controllers/courses.controller.js
const asyncHandler = require('../utils/asyncHandler');
const coursesService = require('../services/courses.service');

const get_all_courses = asyncHandler(async (req, res) => {
  const courses = await coursesService.listCourses();
  return res.status(200).json(courses);
});

module.exports = { get_all_courses };
```

Crie `src/routes/courses.js`:

```javascript
// src/routes/courses.js
const { Router } = require('express');
const { get_all_courses } = require('../controllers/courses.controller');

const router = Router();

router.get('/', get_all_courses);

module.exports = router;
```

Crie `src/routes/index.js` — o roteador "raiz" da API, que a partir de agora agrupa todas as sub-rotas:

```javascript
// src/routes/index.js
const { Router } = require('express');

const coursesRoutes = require('./courses');

const router = Router();

router.use('/courses', coursesRoutes);

module.exports = router;
```

Conecte ao `src/app.js` — adicione o `require` e `app.use('/', routes)` **antes** do handler de 404:

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  // ... sem alteração (capítulo 07)
});

app.use('/', routes);

app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  // ... sem alteração (capítulo 08)
});

module.exports = app;
```

Atualize `tests/helpers/mongo.js` (capítulo 07) para esperar o índice único de `codigo` terminar de ser construído antes do primeiro teste que depende dele:

```javascript
// tests/helpers/mongo.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Course = require('../../src/models/Course');

let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' }
  });

  await mongoose.connect(mongoServer.getUri());
  await Course.init();
}

// clearTestDatabase e disconnectTestDatabase sem alteração
```

> 💡 **`Course.init()` — o mesmo cuidado desde já, mesmo sem nenhum teste de duplicidade de curso ainda.** Um índice `unique: true` no Mongoose não é construído de forma síncrona/instantânea — ele é criado em segundo plano, assim que o model é usado pela primeira vez. `Model.init()` retorna uma Promise que só resolve depois que esse índice termina de ser construído. Sem esperar por isso explicitamente aqui, um teste futuro que dependa dessa unicidade poderia ficar instável (*flaky*) — passando ou falhando dependendo de quão rápido o MongoDB terminou de indexar. Este projeto vai repetir esse padrão para cada model novo que tiver um índice único (`Student`, no capítulo 11; `Enrollment`, no capítulo 14).

Por fim, crie `src/seed.js` — um script independente (não faz parte da API) para popular o banco local com cursos de exemplo:

```javascript
// src/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('./models/Course');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

const initialCourses = [
  {
    nome: 'Introdução à Lógica de Programação',
    codigo: 'DEV-LOG-01',
    descricao: 'Fundamentos de algoritmos e estruturas de dados.',
    idadeMinima: 16,
    capacidadeVagas: 5,
    valorMensalidade: 450.00,
    status: 'ABERTO'
  },
  {
    nome: 'Arquitetura de Software e Microsserviços',
    codigo: 'ARQ-SEN-01',
    descricao: 'Princípios de design e integração entre serviços.',
    idadeMinima: 21,
    capacidadeVagas: 1, // capacidade pequena para facilitar testar a fila de espera manualmente
    valorMensalidade: 1200.00,
    status: 'ABERTO'
  }
];

async function seed() {
  try {
    console.log('Conectando ao MongoDB para executar seed...');
    await mongoose.connect(MONGO_URI);
    await Course.init();

    console.log('Criando ou atualizando cursos iniciais...');
    await Course.bulkWrite(initialCourses.map(course => ({
      updateOne: {
        filter: { codigo: course.codigo },
        update: { $set: course, $setOnInsert: { vagasOcupadas: 0 } },
        upsert: true
      }
    })));

    console.log('✅ Seed executado com sucesso!');
    const courses = await Course.find();
    console.table(courses.map(c => ({
      Codigo: c.codigo,
      Nome: c.nome,
      Vagas: `${c.vagasOcupadas}/${c.capacidadeVagas}`
    })));
  } catch (error) {
    console.error('❌ Erro ao executar seed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
```

> 💡 **Por que `bulkWrite` com `updateOne`/`upsert: true`, em vez de `Course.insertMany(...)`?** `insertMany` falharia na segunda vez que o script rodasse (violação do índice único de `codigo`). O padrão *upsert* ("update ou insert") torna o script **idempotente**: rodar `npm run seed` dez vezes seguidas sempre resulta no mesmo estado final, em vez de acumular erros ou duplicatas — uma propriedade valiosa para um script que qualquer pessoa vai rodar ao clonar o projeto.

Adicione o script ao `package.json`:

```json
{
  "scripts": {
    "seed": "node src/seed.js"
  }
}
```

## ✅ Como confirmar que funcionou

```bash
npm test
```

Todos os testes de `tests/health.test.js` (incluindo o novo bloco `GET /courses`) devem passar.

Manualmente, com o Mongo do capítulo 06 rodando:

```bash
npm run db:up
npm run seed
npm run dev
```

Em outro terminal:

```bash
curl http://localhost:3333/courses
```

Deve responder `200` com um array de dois cursos.

## 🔧 Commit sugerido

```bash
git add tests/health.test.js tests/helpers/mongo.js
git commit -m "test: adicionar teste de listagem de cursos"

git add src/models/Course.js src/services/courses.service.js src/controllers/courses.controller.js src/routes/courses.js src/routes/index.js src/app.js
git commit -m "feat: adicionar model de curso e endpoint de listagem"

git add src/seed.js package.json
git commit -m "feat: adicionar script de seed de cursos"
```

## 📚 Documentação Oficial

- **Mongoose — Schemas**: https://mongoosejs.com/docs/guide.html
- **Mongoose — índices (`unique`, `Model.init()`)**: https://mongoosejs.com/docs/guide.html#indexes
- **Mongoose — `bulkWrite`**: https://mongoosejs.com/docs/api/model.html#Model.bulkWrite()
- **Express — `Router`**: https://expressjs.com/en/guide/routing.html
