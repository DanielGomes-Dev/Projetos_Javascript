# 13 — A Fila de Enfileiramento

## 🎯 Objetivo

Construir a fila técnica em si — com **dois drivers intercambiáveis**: um driver Redis/BullMQ de verdade (usado em desenvolvimento/produção) e um driver em memória, muito mais simples, usado automaticamente durante os testes. Ainda sem nada de negócio conectado a ela (isso é o capítulo 15) — este capítulo é só sobre a fila existir, aceitar "jobs" nomeados e processá-los um de cada vez.

## 📦 Instalar

```bash
npm install bullmq ioredis
```

## Por que dois drivers, e não só um

O `README.md` do desafio garante que `npm test` nunca depende do Docker — os testes de banco já resolvem isso com `mongodb-memory-server` (capítulo 07). Rodar Redis de verdade só para os testes quebraria essa garantia. A solução: a fila é construída atrás de uma interface pequena (`enqueue`/`close`), com duas implementações — uma delas (BullMQ + Redis) para o mundo real, outra (uma fila em memória, dentro do próprio processo Node) para os testes. O código que **usa** a fila (o service de matrículas, capítulo 15) nunca precisa saber qual das duas está rodando por trás.

## 🔴 Teste (Red)

O driver em memória é o único testável sem infraestrutura externa — é nele que a suíte automatizada foca. Crie `tests/unit/enrollmentQueue.test.js`:

```javascript
// tests/unit/enrollmentQueue.test.js
//
// Testa só o driver em MEMÓRIA — o mesmo que os testes de integração de
// matrícula (capítulo 15+) vão usar por baixo dos panos, automaticamente,
// porque NODE_ENV=test (definido pelo próprio Jest) escolhe esse driver
// por padrão. O driver Redis/BullMQ é confirmado manualmente (ver "Como
// confirmar", abaixo) — é uma biblioteca de terceiros já testada, e testar
// a conexão de rede real fugiria do objetivo de manter a suíte sem Docker.

const { buildDriver } = require('../../src/queue/enrollmentQueue');

describe('buildDriver (driver em memória, padrão quando NODE_ENV=test)', () => {
  it('executa o handler correspondente e retorna o resultado', async () => {
    const handlers = { somar: async ({ a, b }) => a + b };
    const queue = buildDriver(handlers);

    const resultado = await queue.enqueue('somar', { a: 2, b: 3 });

    expect(resultado).toBe(5);
    await queue.close();
  });

  it('processa jobs em ordem, um de cada vez (serializado)', async () => {
    const ordem = [];
    const handlers = {
      tarefa: async ({ id, delay }) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        ordem.push(id);
      }
    };
    const queue = buildDriver(handlers);

    await Promise.all([
      queue.enqueue('tarefa', { id: 'A', delay: 20 }),
      queue.enqueue('tarefa', { id: 'B', delay: 0 })
    ]);

    // Mesmo "B" sendo mais rápido para processar, a fila só executa um
    // job por vez, na ordem de chegada — B não "ultrapassa" A na fila.
    expect(ordem).toEqual(['A', 'B']);
    await queue.close();
  });

  it('uma falha num job não trava os jobs seguintes', async () => {
    const handlers = {
      falha: async () => { throw new Error('boom'); },
      ok: async () => 'sucesso'
    };
    const queue = buildDriver(handlers);

    await expect(queue.enqueue('falha', {})).rejects.toThrow('boom');
    await expect(queue.enqueue('ok', {})).resolves.toBe('sucesso');
    await queue.close();
  });
});
```

Rode `npm test`: falha com `Cannot find module '../../src/queue/enrollmentQueue'`.

## 🟢 Código (Green)

Crie `src/queue/connection.js` — a conexão Redis compartilhada, criada de forma **preguiçosa** (só na primeira vez que for realmente necessária):

```javascript
// src/queue/connection.js
let connection;

function getRedisConnection() {
  if (!connection) {
    const IORedis = require('ioredis');
    const url = process.env.REDIS_URL || 'redis://localhost:6380';
    connection = new IORedis(url, {
      maxRetriesPerRequest: null
    });
  }
  return connection;
}

async function closeRedisConnection() {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}

module.exports = { getRedisConnection, closeRedisConnection };
```

> ⚠️ **`maxRetriesPerRequest: null` não é um detalhe opcional — é exigido pelo BullMQ.** Sem essa opção, o cliente `ioredis` desiste de comandos bloqueantes internos (usados pelo BullMQ para esperar por novos jobs) depois de poucas tentativas, e a lib lança `ReplyError: max retries per request limit reached` assim que um Worker tentar escutar a fila.
>
> 💡 **Por que `require('ioredis')` acontece *dentro* da função, não no topo do arquivo?** Isso adia o `require` do pacote até o primeiro uso real — combinado com o driver em memória (a seguir), significa que rodar a suíte de testes **nunca** carrega nem toca o `ioredis`/BullMQ de verdade, mesmo que este arquivo seja importado indiretamente.

Crie `src/queue/enrollmentQueue.js` — os dois drivers e a função que escolhe qual usar:

```javascript
// src/queue/enrollmentQueue.js
const { getRedisConnection } = require('./connection');

const QUEUE_NAME = 'enrollments';

function resolveDriver() {
  if (process.env.QUEUE_DRIVER) return process.env.QUEUE_DRIVER;
  return process.env.NODE_ENV === 'test' ? 'memory' : 'redis';
}

function createMemoryDriver(handlers) {
  let tail = Promise.resolve();

  async function enqueue(name, data) {
    const run = tail.then(() => handlers[name](data));
    tail = run.catch(() => {}); // uma falha não deve travar a fila
    return run;
  }

  return { enqueue, close: async () => {} };
}

function createRedisDriver(handlers) {
  const { Queue, Worker, QueueEvents } = require('bullmq');
  const connection = getRedisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    (job) => handlers[job.name](job.data),
    { connection, concurrency: 1 }
  );

  const ready = Promise.all([queueEvents.waitUntilReady(), worker.waitUntilReady()]);

  async function enqueue(name, data) {
    await ready;
    const job = await queue.add(name, data);
    return job.waitUntilFinished(queueEvents);
  }

  async function close() {
    await Promise.all([worker.close(), queueEvents.close(), queue.close()]);
  }

  return { enqueue, close };
}

function buildDriver(handlers) {
  return resolveDriver() === 'redis' ? createRedisDriver(handlers) : createMemoryDriver(handlers);
}

module.exports = { buildDriver };
```

> 💡 **A peça central do driver em memória: `tail = tail.then(() => handlers[name](data))`.** `tail` começa como uma Promise já resolvida. Cada `enqueue` novo encadeia o próximo trabalho **depois** do que já estava encadeado — não depois de `data` chegar, depois do *trabalho anterior terminar*. É essa corrente de `.then()` que garante processamento um-de-cada-vez, na ordem de chegada, sem precisar de nenhuma fila "de verdade" por trás. `tail = run.catch(() => {})` (não `tail = run`) é o que impede uma falha de travar a corrente inteira: se não fosse por esse `.catch`, uma rejeição em `run` faria `tail` virar uma Promise rejeitada, e todo `.then()` encadeado *depois* dela herdaria essa rejeição, mesmo sem relação nenhuma com o job que falhou.
>
> 💡 **Por que `concurrency: 1` no Worker do BullMQ?** É o que faz o driver Redis se comportar da mesma forma que o driver em memória: um único job de matrícula sendo processado por vez, nunca dois em paralelo — a peça central da estratégia de serialização deste capítulo.
>
> 💡 **`resolveDriver()` decide sozinho, sem nenhuma configuração manual em cada ambiente.** Rodando os testes (`NODE_ENV=test`, definido automaticamente pelo próprio Jest), o driver em memória é escolhido; rodando `npm run dev`/`npm start`, o driver Redis é escolhido. `QUEUE_DRIVER=memory` ou `QUEUE_DRIVER=redis` como variável de ambiente força manualmente qualquer um dos dois, útil para depurar.

## ✅ Como confirmar que funcionou

```bash
npm test -- enrollmentQueue
```

Os três testes do driver em memória devem passar.

Para confirmar o driver Redis manualmente (sem nenhum endpoint usando-o ainda, então via um script descartável):

```bash
npm run db:up
QUEUE_DRIVER=redis node -e "
const { buildDriver } = require('./src/queue/enrollmentQueue');
const queue = buildDriver({ echo: async (data) => data });
queue.enqueue('echo', { ok: true }).then((r) => {
  console.log('resultado:', r);
  return queue.close();
}).then(() => process.exit(0));
"
```

Deve imprimir `resultado: { ok: true }` e encerrar sem travar.

## 🔧 Commit sugerido

```bash
git add tests/unit/enrollmentQueue.test.js
git commit -m "test: adicionar testes do driver de fila em memoria"

git add src/queue/connection.js src/queue/enrollmentQueue.js package.json package-lock.json
git commit -m "feat: adicionar fila tecnica com driver redis e driver em memoria"
```

## 📚 Documentação Oficial

- **BullMQ — documentação geral**: https://docs.bullmq.io/
- **BullMQ — Queues**: https://docs.bullmq.io/guide/queues/
- **BullMQ — Workers e `concurrency`**: https://docs.bullmq.io/guide/workers
- **BullMQ — Conexões (`maxRetriesPerRequest`)**: https://docs.bullmq.io/guide/connections
- **ioredis — repositório e documentação**: https://github.com/redis/ioredis
- **MDN — encadeamento de Promises (`.then`)**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
