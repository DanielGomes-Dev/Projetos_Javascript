# 07 — Mongoose: Conectando ao Banco

## 🎯 Objetivo

Instalar o ODM (*Object-Document Mapper*), conectar a aplicação ao MongoDB do capítulo 06, e fazer o `/health` refletir o estado real dessa conexão — ainda **sem nenhuma coleção/model**. Este capítulo também introduz a infraestrutura de banco de teste (MongoDB em memória), porque a partir de agora os testes de integração precisam de um banco de verdade por trás do Supertest.

## 📦 Instalar

```bash
npm install mongoose
npm install -D mongodb-memory-server
```

> **`mongoose`** — o ODM: mapeia coleções do MongoDB para *schemas*/models JavaScript, com validação, valores padrão e um sistema de índices. **`mongodb-memory-server`** — sobe um MongoDB real (não um mock) num processo temporário, direto em memória, usado **só pelos testes** — é o que garante que `npm test` nunca depende do Docker estar rodando.

Fixe a versão do binário que o `mongodb-memory-server` baixa/usa, adicionando um campo `config` ao `package.json` (a mesma versão do MongoDB usada no `docker-compose.yml`, capítulo 06 — mantém desenvolvimento e teste no mesmo binário):

```json
{
  "config": {
    "mongodbMemoryServer": {
      "version": "7.0.14"
    }
  }
}
```

> 💡 **Por que fixar a versão explicitamente?** Sem isso, a biblioteca tenta baixar a versão mais recente disponível na primeira execução — o que torna a suíte de testes vulnerável a uma versão nova do MongoDB introduzir uma mudança de comportamento inesperada. Fixar a versão (e mantê-la igual à do `docker-compose.yml`) garante que "passou nos testes" e "roda em desenvolvimento" estão testando exatamente o mesmo banco.

## 📝 Variáveis de ambiente

Adicione a `.env` e `.env.example` (editando os arquivos do capítulo 04):

```dotenv
PORT=3333
MONGO_URI=mongodb://localhost:27028/desafio_senior
```

> A porta `27028` é a mesma exposta pelo `docker-compose.yml` do capítulo 06 — fora do Docker, é assim que a aplicação enxerga o banco.

## 🔴 Teste (Red)

O `/health` atual (capítulo 05) sempre responde `{"status":"ok"}`, sem nenhuma informação sobre o banco. Isso precisa mudar: se o Mongo não estiver acessível, a aplicação deveria admitir isso, não fingir que está tudo bem.

Antes de mexer no teste, é preciso dar aos testes um banco de verdade para conversar. Crie `tests/helpers/mongo.js` — o primeiro helper de infraestrutura de teste do projeto, reaproveitado por toda suíte de integração daqui em diante:

```javascript
// tests/helpers/mongo.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: process.env.MONGOMS_VERSION || '7.0.14'
    }
  });

  await mongoose.connect(mongoServer.getUri());
}

async function clearTestDatabase() {
  if (mongoose.connection.readyState !== 1) return;

  await Promise.all(
    Object.values(mongoose.connection.collections)
      .map(collection => collection.deleteMany({}))
  );
}

async function disconnectTestDatabase() {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
}

module.exports = { connectTestDatabase, clearTestDatabase, disconnectTestDatabase };
```

> 💡 **Três responsabilidades separadas, de propósito.** `connectTestDatabase` roda uma vez por arquivo de teste (`beforeAll`) — subir um MongoMemoryServer não é instantâneo, então fazer isso a cada teste individual deixaria a suíte lenta. `clearTestDatabase` roda **entre** testes (`afterEach`) — cada teste deve começar com coleções vazias, para um teste não "vazar" dado para o próximo. `disconnectTestDatabase` roda uma vez ao final (`afterAll`), liberando a porta e o processo do MongoMemoryServer — sem isso, o Jest fica "pendurado" esperando o processo terminar sozinho.

Atualize `tests/health.test.js` para usar esse helper e exigir a nova informação:

```javascript
// tests/health.test.js
const request = require('supertest');
const app = require('../src/app');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} = require('./helpers/mongo');

beforeAll(connectTestDatabase);
afterEach(clearTestDatabase);
afterAll(disconnectTestDatabase);

describe('GET /health', () => {
  it('deve retornar status 200 e informações de saúde da aplicação e banco', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.database).toBe('connected');
  });

  it('deve retornar 404 para rotas inexistentes', async () => {
    const response = await request(app).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Rota não encontrada');
  });
});
```

Rode `npm test`: o teste de 404 continua passando, mas o primeiro teste falha — `response.body.database` é `undefined`, porque `/health` ainda não olha para o Mongoose.

## 🟢 Código (Green)

Atualize `src/app.js` para consultar o estado da conexão do Mongoose:

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isReady = dbState === 1;

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown'
  });
});

app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

module.exports = app;
```

> 💡 **Por que `app.js` importa `mongoose` diretamente, em vez de um módulo próprio (`config/database.js`)?** O Mongoose mantém, por padrão, uma **conexão global única** por processo — qualquer arquivo que faça `require('mongoose')` enxerga o mesmo `mongoose.connection`, não importa quem chamou `.connect()`. Isso significa que não é preciso passar a conexão manualmente entre arquivos: quem conecta (o `server.js`, a seguir) e quem só consulta o status (`app.js`) podem viver em arquivos diferentes sem se conhecer.
>
> 💡 **Por que `readyState` (um número) e não simplesmente "conectado ou não"?** O Mongoose modela a conexão como uma máquina de estados — `connecting` (1) e `disconnecting` (3) são estados de trânsito reais, não só "ligado"/"desligado". Reportar o estado exato, em vez de simplificar para um booleano, é mais honesto sobre o que está acontecendo — útil de verdade num ambiente de produção monitorado.

Atualize `src/server.js` para conectar ao Mongo **antes** de abrir a porta HTTP:

```javascript
// src/server.js
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3333;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

async function bootstrap() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado com sucesso');

    app.listen(PORT, () => {
      console.log(`Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`Healthcheck: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Falha ao inicializar o servidor:', error);
    process.exit(1);
  }
}

bootstrap();
```

> 💡 **Por que só abrir a porta HTTP depois que o `await mongoose.connect(...)` resolve, em vez de deixar os dois acontecerem em paralelo?** Porque, embora o Mongoose enfileire operações de banco enquanto a conexão ainda está abrindo (então a aplicação não *quebraria* sem esse `await`), não faz sentido anunciar "servidor no ar" antes de confirmar que a peça mais crítica da infraestrutura está de pé. Se a string de conexão estiver errada, por exemplo, é melhor o processo falhar alto e cedo (`process.exit(1)`) do que subir "pela metade" silenciosamente.

## ✅ Como confirmar que funcionou

```bash
npm test
```

Os dois testes de `tests/health.test.js` devem passar.

Com o Mongo do capítulo 06 rodando (`npm run db:up`), confirme também manualmente:

```bash
npm run dev
curl http://localhost:3333/health
```

Deve responder `200`, com `"database":"connected"`. Pare o container (`npm run db:down`) e repita o `curl` — desta vez deve responder `503`, com `"database":"disconnected"`.

## 🔧 Commit sugerido

```bash
git add tests/helpers/mongo.js tests/health.test.js
git commit -m "test: cobrir status do banco no health check"

git add src/app.js src/server.js .env.example package.json package-lock.json
git commit -m "feat: conectar aplicacao ao mongodb via mongoose"
```

## 📚 Documentação Oficial

- **Mongoose — conexões**: https://mongoosejs.com/docs/connections.html
- **Mongoose — `connection.readyState`**: https://mongoosejs.com/docs/api/connection.html#Connection.prototype.readyState
- **mongodb-memory-server — documentação**: https://typegoose.github.io/mongodb-memory-server/
- **Jest — hooks `beforeAll`/`afterEach`/`afterAll`**: https://jestjs.io/docs/setup-teardown
