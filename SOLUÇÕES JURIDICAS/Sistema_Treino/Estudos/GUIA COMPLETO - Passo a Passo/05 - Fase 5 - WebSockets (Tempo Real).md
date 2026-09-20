# Fase 5 — Comunicação em Tempo Real (WebSockets)

> Objetivo desta fase: fazer o cliente (front-end) **saber, na hora**, quando o Worker encontra uma nova movimentação de um processo — sem precisar ficar chamando `GET /api/lawsuits/:id` de tempos em tempos (*polling*) para descobrir se algo mudou. Vamos usar **Socket.IO**, uma biblioteca de WebSocket com fallback automático e uma API de "salas" (*rooms*) muito conveniente para este caso de uso.
>
> Esta fase já foi **implementada no seu projeto real** (não é só um exercício em pasta separada) — os arquivos abaixo foram criados/alterados diretamente em `Sistema_Treino/src/`. Este documento explica o que foi feito e por quê, no mesmo formato didático das fases anteriores, para que você consiga reproduzir do zero se precisar.

---

## ⚠️ Antes de tudo: por que "o Worker emite direto pro WebSocket" não é literalmente possível

O seu TODO descreve a 5.3 como *"fazer com que o Worker... emita um evento via WebSocket diretamente para a sala correspondente"*. Vale parar um segundo para entender por que isso precisa de um ajuste de arquitetura — é o ponto mais importante (e mais instrutivo) desta fase.

Lembre-se da Fase 4: a **API** e o **Worker** são **dois processos Node.js completamente separados** (rodam com comandos diferentes — `npm run dev` vs `npm run worker` — e no Docker Compose são dois *containers* diferentes, `api` e `worker`). Um servidor Socket.IO só existe **dentro** do processo que tem o servidor HTTP ao qual os navegadores dos clientes se conectam — e esse processo é a **API**, não o Worker. O Worker nunca abre uma porta HTTP para navegador nenhum se conectar; ele só fica escutando jobs no Redis.

Ou seja: **não existe** um objeto `io` (a instância do Socket.IO) que o Worker possa simplesmente importar e usar — mesmo que você escrevesse `import { io } from '../app.js'` dentro do worker, seria um objeto **vazio, sem nenhum cliente conectado**, porque os clientes de verdade se conectaram à instância do Socket.IO que vive **no processo da API**, não no processo do Worker.

**A solução**: os dois processos já compartilham o **Redis** (usado pelo BullMQ desde a Fase 4). Em vez de o Worker "falar" com o Socket.IO diretamente, ele apenas **termina o job normalmente e devolve um resultado** (como sempre fez) — e a **API**, que já está conectada ao mesmo Redis, **escuta o evento de "job concluído"** da fila (usando o recurso `QueueEvents` do próprio BullMQ) e, só então, emite para o Socket.IO. O Redis funciona como a "ponte" entre os dois processos.

```
┌──────────────┐        job termina, resultado         ┌──────────────┐
│   Worker     │ ─────────que devolve────────────►     │    Redis     │
│ (processo A) │        (via BullMQ)                    │ (fila/eventos)│
└──────────────┘                                        └───────┬──────┘
                                                                  │
                                          QueueEvents escuta      │
                                          "completed" da fila     │
                                                                  ▼
                                                          ┌──────────────┐
                                                          │     API      │
                                                          │ (processo B) │
                                                          │  ┌────────┐  │
                                                          │  │Socket. │  │──► navegador do cliente
                                                          │  │  IO    │  │    (conectado só aqui)
                                                          │  └────────┘  │
                                                          └──────────────┘
```

O resultado final, do ponto de vista de quem está usando o sistema, é **exatamente** o que o TODO pedia: o Worker captura a movimentação, e o cliente recebe a atualização em tempo real, sem dar F5. A diferença é só **como** essa informação viaja de um processo para o outro — através do Redis (que já existia), não de uma referência de objeto compartilhada (que é tecnicamente impossível entre dois processos).

---

## 5.1. Instalação e Configuração do Socket.IO

### O que vamos construir e por quê

O **Socket.IO** é uma biblioteca sobre WebSocket (com fallback para *long-polling* em redes que bloqueiam WebSocket) que abstrai a parte chata de gerenciar conexões, reconexões automáticas e — o mais importante para nós — o conceito de **salas** (*rooms*): grupos de conexões que podem receber mensagens direcionadas, sem que você precise manter essa lista manualmente.

Vamos anexar o Socket.IO ao **mesmo** servidor HTTP que já serve a API REST — não abrimos uma porta nova; WebSocket e REST convivem na mesma porta (3000).

### Passo a passo

**1.** Instale as dependências:

```bash
npm install socket.io
npm install -D socket.io-client
```

> - **`socket.io`** — o servidor, que vamos anexar ao `http.Server` da aplicação.
> - **`socket.io-client`** — instalado como dependência de **desenvolvimento** aqui porque, neste projeto, só vamos usá-la num script de teste manual pelo terminal (seção "Como confirmar que deu certo", mais abaixo). Se você fosse construir o front-end deste sistema (um site/app React, por exemplo), o `socket.io-client` entraria como dependência normal **daquele** outro projeto, não deste backend.

**2.** Por que **não** basta `import socket.io from 'socket.io'` dentro do `app.ts` de sempre? Porque o `Application` do Express (o objeto `app`) **não é** um servidor HTTP de verdade — é uma função de *request handler*. Quando você chama `app.listen(PORT)`, o Express cria um `http.Server` internamente **para você**, só que sem te devolver uma referência a esse servidor **antes** de ele já estar escutando. O Socket.IO precisa dessa referência para conseguir interceptar o *handshake* HTTP que o navegador manda ao tentar abrir uma conexão WebSocket. A solução é criar o `http.Server` **manualmente**, com `http.createServer(app)`, e usar essa referência tanto para o Socket.IO quanto para, no final, chamar `.listen()`.

Isso muda `src/server.ts` de:

```typescript
// ANTES (Fases 1-4)
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT} em modo ${process.env.NODE_ENV || 'development'}`);
});
```

para:

```typescript
// src/server.ts (Fase 5 — arquivo já atualizado no seu projeto)
import http from 'node:http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './websocket/socket.js';
import { initLawsuitSyncEvents } from './websocket/lawsuitSyncEvents.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// http.createServer(app): cria o servidor HTTP "na mão", passando o
// Express como a função que trata cada requisição. `app` continua
// cuidando de TODAS as rotas REST normalmente — a única diferença é
// que agora TEMOS a referência (`httpServer`) para entregar ao Socket.IO.
const httpServer = http.createServer(app);

// Liga o Socket.IO neste mesmo servidor/porta (não abre uma porta nova).
initSocket(httpServer);

// Liga a "ponte" que traduz jobs concluídos do Worker em eventos
// WebSocket para os clientes conectados (seção 5.3 abaixo).
const lawsuitSyncEvents = initLawsuitSyncEvents();

httpServer.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT} em modo ${process.env.NODE_ENV || 'development'}`);
});

// Encerramento gracioso, no mesmo espírito do worker (Fase 4): fecha a
// ponte de eventos e o servidor HTTP (que por sua vez fecha as conexões
// WebSocket abertas) antes de derrubar o processo.
async function shutdown(signal: string) {
  console.log(`[Server] Recebido ${signal}, encerrando...`);
  await lawsuitSyncEvents.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

> 📝 **Nota do professor sobre nomes de arquivo:** o seu TODO nomeia o arquivo como `src/websocket/socket.js`. Seguindo a mesma decisão que o projeto já tomou lá na Fase 1 (converter tudo para TypeScript — inclusive o script de lint, que era `*.js` e virou `*.ts`), este guia usa `src/websocket/socket.ts`, para manter 100% do código-fonte do projeto na mesma linguagem e sob a mesma checagem de tipos do `tsconfig.json`. Um arquivo `.js` solto funcionaria em tempo de execução (o `tsx`/Node consegue rodar `.js` normalmente), mas ficaria de fora da checagem de tipos do `tsc` e do ESLint configurado para TypeScript — inconsistente com o resto do projeto.

**3.** Crie `src/websocket/socket.ts` — a camada de transporte, responsável **só** por conexões e salas (a regra de negócio de "quando emitir o quê" fica isolada em outro arquivo, na seção 5.3):

```typescript
// src/websocket/socket.ts
//
// Camada de transporte em tempo real (Socket.IO). Responsável SÓ por:
//   1. anexar o servidor de WebSocket ao mesmo servidor HTTP da API;
//   2. deixar o cliente entrar/sair de "salas" por número CNJ.
//
// A REGRA DE NEGÓCIO de "quando emitir o quê" mora em outro arquivo
// (lawsuitSyncEvents.ts) — este arquivo não sabe nada sobre BullMQ,
// Sequelize ou processos jurídicos, só sobre conexões e salas.

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';

// Guardamos a instância aqui, no escopo do módulo, porque o Node.js
// cacheia módulos ES: todo arquivo que fizer `import { getIO } from
// './socket.js'` recebe a MESMA instância — não uma cópia nova.
let io: SocketIOServer | null = null;

/**
 * Cria o servidor Socket.IO "grudado" no mesmo servidor HTTP que já
 * serve a API REST (mesma porta, ex.: 3000) e configura o que acontece
 * a cada conexão de cliente.
 *
 * Deve ser chamada UMA VEZ, em server.ts, depois de criar o httpServer
 * e antes de chamar httpServer.listen().
 */
export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      // Em produção, troque '*' pela URL real do seu front-end
      // (ex.: 'https://app.suaempresa.com.br') — liberar qualquer
      // origem é aceitável só em desenvolvimento/estudo.
      origin: '*',
    },
  });

  // Este bloco roda UMA VEZ PARA CADA cliente que conecta (cada aba de
  // navegador, cada instância do app, etc. — cada `socket` é uma conexão individual).
  io.on('connection', (socket) => {
    console.log(`[socket] cliente conectado: ${socket.id}`);

    // O cliente decide, depois de conectado, de qual processo quer
    // receber atualizações — emitindo o evento customizado
    // "join-lawsuit" com o número CNJ como payload.
    socket.on('join-lawsuit', (cnjNumber: unknown) => {
      if (typeof cnjNumber !== 'string' || cnjNumber.trim() === '') {
        socket.emit('error', { message: 'join-lawsuit exige um cnjNumber (string) válido.' });
        return;
      }

      // socket.join(sala): a "sala" aqui é simplesmente uma string —
      // o Socket.IO não exige que ela exista antes; ele cria a sala na
      // hora, se ainda não existir. Usamos o PRÓPRIO número CNJ como
      // nome da sala: simples e sem precisar de um registro à parte.
      socket.join(cnjNumber);
      console.log(`[socket] ${socket.id} entrou na sala do processo ${cnjNumber}`);

      // Confirma para O PRÓPRIO cliente que a inscrição funcionou —
      // importante para a UI mostrar "acompanhando este processo em tempo real".
      socket.emit('joined-lawsuit', { cnjNumber });
    });

    socket.on('leave-lawsuit', (cnjNumber: unknown) => {
      if (typeof cnjNumber !== 'string') return;
      socket.leave(cnjNumber);
      console.log(`[socket] ${socket.id} saiu da sala do processo ${cnjNumber}`);
    });

    socket.on('disconnect', (reason) => {
      // Não precisamos chamar socket.leave() manualmente aqui — o
      // Socket.IO remove o socket de TODAS as salas automaticamente ao desconectar.
      console.log(`[socket] cliente desconectado: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Dá acesso à instância do Socket.IO para qualquer outro módulo que
 * precise EMITIR eventos (ex.: lawsuitSyncEvents.ts), sem precisar
 * passar a instância manualmente de arquivo em arquivo.
 *
 * Lança um erro claro se for chamada antes de initSocket() — mais fácil
 * de depurar do que um `Cannot read properties of null` genérico.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO ainda não foi inicializado. Chame initSocket(httpServer) antes de getIO().');
  }
  return io;
}
```

> 💡 **O padrão "singleton em módulo" (`let io: ... = null`, `initSocket`, `getIO`)**: é uma forma simples de compartilhar uma única instância entre vários arquivos, sem precisar de um contêiner de injeção de dependência. Funciona aqui porque o Node.js só carrega cada arquivo de módulo **uma vez** por processo (o resultado fica em cache) — então `getIO()`, chamado de qualquer lugar do processo da API, sempre enxerga a mesma instância criada em `initSocket()`.

### Como confirmar que deu certo

```bash
docker compose up --build
```

Os logs da API devem mostrar a mensagem normal de "rodando na porta 3000" (sem erros). Isso já confirma que o `http.createServer` + Socket.IO não quebrou nada da API REST existente — teste também `curl http://localhost:3000/health` para confirmar.

---

## 5.2. Regra de Negócio de Salas (Rooms)

### O que vamos construir e por quê

Já implementamos isso dentro do `socket.ts` acima (eventos `join-lawsuit` / `leave-lawsuit`) — esta seção existe para explicar a **decisão de design** por trás, já que o TODO trata como um item separado.

### Por que uma "sala" por número CNJ, e não um broadcast global?

Imagine 500 usuários usando o sistema ao mesmo tempo, cada um acompanhando processos diferentes. Se toda atualização fosse enviada para **todo mundo conectado** (broadcast global) e o front-end filtrasse localmente "é do processo que eu quero?", isso desperdiçaria banda e processamento — cada navegador receberia centenas de eventos irrelevantes por hora.

Com **salas**, o Socket.IO mantém, no servidor, um mapeamento eficiente de "quais conexões estão em qual sala", e o método `.to(sala).emit(...)` já filtra isso — só as conexões daquela sala específica recebem a mensagem. É a forma idiomática do Socket.IO de fazer *pub/sub* direcionado sem reinventar essa lógica na mão.

### Como o cliente usa isso, na prática (do lado do front-end)

```javascript
// Exemplo do lado do NAVEGADOR (front-end) — não faz parte deste
// projeto backend, é só para você visualizar o fluxo completo.
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // Assim que a página do processo "0001234-56.2024.8.19.0001" abre,
  // o front-end entra na sala correspondente.
  socket.emit('join-lawsuit', '0001234-56.2024.8.19.0001');
});

socket.on('lawsuit:updated', (payload) => {
  console.log('Nova atualização em tempo real:', payload);
  // Aqui você atualizaria o estado da UI (ex.: React state, Vue ref, etc.)
});
```

### Como confirmar que deu certo

Veremos o teste completo (ponta a ponta, incluindo o Worker de verdade) ao final da seção 5.3 — as duas partes precisam existir juntas para o teste fazer sentido.

---

## 5.3. Integração Worker → WebSocket

### O que vamos construir e por quê

A ponte explicada no aviso do início deste documento: um listener, do lado da **API**, que escuta o evento `completed` da fila `lawsuit-sync` (via `QueueEvents` do BullMQ) e repassa a informação para a sala certa via Socket.IO.

### Passo a passo

**1.** Primeiro, precisamos que o **Worker devolva mais informação** no resultado do job — até a Fase 4, ele só devolvia `{ movementsSaved }`. Agora, para conseguirmos montar a notificação completa, ele também devolve o `cnjNumber` e a lista de `movements` capturadas. Esta é a única mudança dentro de `src/workers/lawsuitSync.worker.ts` (o resto do arquivo continua igual à Fase 4):

```typescript
// src/workers/lawsuitSync.worker.ts (trecho alterado)

// Formato do valor de retorno do processador. Além de `movementsSaved`
// (já existia desde a Fase 4), agora também devolvemos `cnjNumber` e a
// lista de `movements` capturadas — é ESTE retorno que o BullMQ grava
// no Redis como `returnvalue` do job, e é dele que
// `src/websocket/lawsuitSyncEvents.ts` (Fase 5) lê os dados para
// notificar os clientes conectados em tempo real. O worker continua
// SEM SABER que o WebSocket existe — ele só devolve dados; quem decide
// o que fazer com eles é a camada de eventos, na API.
interface LawsuitSyncResult {
  cnjNumber: string;
  movementsSaved: number;
  movements: Array<{ description: string; date: Date }>;
}

async function processLawsuitSync(job: Job<LawsuitSyncJobData>): Promise<LawsuitSyncResult> {
  const { lawsuitId, cnjNumber } = job.data;

  // ...(igual à Fase 4: log, fetchTribunalMovements, transação salvando
  // Movement.bulkCreate + Lawsuit.update)...

  const capturedMovements = await fetchTribunalMovements(cnjNumber);

  const result = await sequelize.transaction(async (transaction) => {
    await Movement.bulkCreate(
      capturedMovements.map((m) => ({ lawsuitId, description: m.description, date: m.date })),
      { transaction }
    );
    await Lawsuit.update({ status: 'UPDATED' }, { where: { id: lawsuitId }, transaction });
    return { movementsSaved: capturedMovements.length };
  });

  // Devolvemos cnjNumber + as movimentações capturadas junto do total —
  // o BullMQ serializa este objeto inteiro para JSON e guarda como o
  // "returnvalue" do job no Redis, disponível para quem escuta o evento
  // "completed" da fila (a API, via QueueEvents).
  return { cnjNumber, movementsSaved: result.movementsSaved, movements: capturedMovements };
}
```

> 💡 Note que o Worker continua **sem importar nada** de `socket.io` ou de `websocket/` — ele só enriqueceu o que já devolvia. Essa é a prova, no código, de que a separação de responsabilidades está correta: o Worker não precisa saber que WebSocket existe.

**2.** Crie `src/websocket/lawsuitSyncEvents.ts` — a ponte propriamente dita:

```typescript
// src/websocket/lawsuitSyncEvents.ts
//
// A PONTE entre o Worker (processo separado, sem acesso direto aos
// clientes WebSocket) e a API (processo que hospeda o Socket.IO).

import { QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { LAWSUIT_SYNC_QUEUE } from '../queues/lawsuitSync.queue.js';
import { getIO } from './socket.js';

// Formato do valor retornado por `processLawsuitSync`, no Worker. Como
// esse valor atravessa o Redis (é serializado para JSON e depois
// desserializado aqui), as datas chegam como STRING (ISO 8601), não
// como objetos `Date`.
export interface LawsuitSyncCompletedPayload {
  cnjNumber: string;
  movementsSaved: number;
  movements: Array<{ description: string; date: string }>;
}

/**
 * Assina os eventos de ciclo de vida da fila `lawsuit-sync` via
 * `QueueEvents` do BullMQ — um recurso que já escuta um stream de
 * eventos no Redis, sem precisarmos criar um canal de Pub/Sub manual.
 *
 * Deve ser chamada UMA VEZ, em server.ts, junto com initSocket().
 */
export function initLawsuitSyncEvents(): QueueEvents {
  const queueEvents = new QueueEvents(LAWSUIT_SYNC_QUEUE, { connection: redisConnection });

  // Disparado sempre que UM job da fila `lawsuit-sync` termina com
  // sucesso — em QUALQUER processo Worker que o tenha processado
  // (mesmo que você rode várias réplicas do worker, isso funciona igual,
  // porque o evento vem do Redis, não de uma referência direta ao worker).
  queueEvents.on('completed', ({ returnvalue }) => {
    if (!returnvalue) return;

    let payload: LawsuitSyncCompletedPayload;
    try {
      // O BullMQ entrega `returnvalue` como STRING JSON (é assim que
      // ele trafega pelo Redis) — por isso o parse manual aqui.
      payload = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
    } catch (parseError) {
      console.error('[socket] Não foi possível interpretar o retorno do job lawsuit-sync:', parseError);
      return;
    }

    const { cnjNumber, movementsSaved, movements } = payload;
    if (!cnjNumber) return;

    // Emite SÓ para quem entrou na sala deste CNJ específico (via
    // `join-lawsuit`, em socket.ts) — clientes acompanhando outros
    // processos não recebem este evento.
    getIO().to(cnjNumber).emit('lawsuit:updated', {
      cnjNumber,
      movementsSaved,
      movements,
    });

    console.log(
      `[socket] evento "lawsuit:updated" emitido para a sala ${cnjNumber} (${movementsSaved} nova(s) movimentação(ões))`
    );
  });

  queueEvents.on('error', (err) => {
    console.error('[socket] erro no QueueEvents de lawsuit-sync:', err);
  });

  return queueEvents;
}
```

> 💡 **Por que usar `QueueEvents` do BullMQ em vez de criar um canal de Pub/Sub manual no Redis (`redis.publish`/`redis.subscribe`)?** Porque o BullMQ **já** grava um stream de eventos de ciclo de vida de cada job no Redis (`waiting`, `active`, `completed`, `failed`, etc.) — é exatamente o mesmo mecanismo que alimenta o Bull Board (Fase 4.3). `QueueEvents` é só uma forma de **assinar** esse stream que já existe. Criar um canal de Pub/Sub separado seria reinventar uma infraestrutura que o projeto já tem, com mais uma conexão Redis dedicada e mais um formato de mensagem para manter.

> ⚠️ **Uma limitação importante para se ter em mente**: se a **API estiver fora do ar** no momento exato em que um job termina (por exemplo, durante um deploy), o evento `completed` daquele job específico **não será reentregue** depois que a API voltar — o `QueueEvents` só recebe eventos que acontecem **enquanto está conectado e escutando**. Isso é aceitável neste projeto porque o dado "de verdade" (a movimentação em si) **já foi salvo no Postgres pelo Worker**, independente do WebSocket — o cliente só perderia a notificação em **tempo real**, mas veria a atualização normalmente na próxima vez que consultasse `GET /api/lawsuits/:id`. Ou seja: o WebSocket é uma camada de **conveniência/UX** sobre um sistema que já é correto sem ele — nunca o contrário.

**3.** `src/server.ts` já foi atualizado na seção 5.1 para chamar `initLawsuitSyncEvents()` — não é preciso nenhum passo adicional aqui.

### Como confirmar que deu certo (teste ponta a ponta da Fase 5)

**1.** Suba tudo (API com Socket.IO + Worker + Postgres + Redis):

```bash
docker compose up --build
```

**2.** Crie um script de teste que age como um cliente WebSocket simples, direto do terminal — `src/scripts/testeSocket.ts` (já criado no seu projeto):

```typescript
// src/scripts/testeSocket.ts
//
// Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>

import { io as ioClient } from 'socket.io-client';

const cnjNumber = process.argv[2];

if (!cnjNumber) {
  console.error('Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>');
  process.exit(1);
}

const SERVER_URL = process.env.SOCKET_URL || 'http://localhost:3000';

const socket = ioClient(SERVER_URL);

socket.on('connect', () => {
  console.log(`[cliente-teste] conectado (id=${socket.id}). Entrando na sala do processo ${cnjNumber}...`);
  socket.emit('join-lawsuit', cnjNumber);
});

socket.on('joined-lawsuit', (payload) => {
  console.log('[cliente-teste] inscrição confirmada:', payload);
  console.log('[cliente-teste] aguardando atualizações em tempo real... (Ctrl+C para sair)');
});

socket.on('lawsuit:updated', (payload) => {
  console.log('\n🔔 [cliente-teste] lawsuit:updated recebido:');
  console.log(JSON.stringify(payload, null, 2));
});

socket.on('disconnect', (reason) => {
  console.log(`[cliente-teste] desconectado: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error('[cliente-teste] erro de conexão:', err.message);
});
```

**3.** Escolha (ou crie) um processo já cadastrado e rode o script de teste, passando o número CNJ dele:

```bash
npx tsx src/scripts/testeSocket.ts 0001234-56.2024.8.19.0001
```

Deve aparecer:

```
[cliente-teste] conectado (id=abcd1234). Entrando na sala do processo 0001234-56.2024.8.19.0001...
[cliente-teste] inscrição confirmada: { cnjNumber: '0001234-56.2024.8.19.0001' }
[cliente-teste] aguardando atualizações em tempo real... (Ctrl+C para sair)
```

**4.** Em **outro** terminal, com o script de teste ainda rodando, dispare a importação em lote para o mesmo CNJ:

```bash
curl -X POST http://localhost:3000/api/lawsuits/batch-import \
  -H "Content-Type: application/json" \
  -d '{"items":[{"cnjNumber":"0001234-56.2024.8.19.0001","clientId":"<ID_DO_CLIENTE>"}]}'
```

**5.** Volte para o terminal do script de teste — assim que o Worker terminar de processar o job (pode levar de 0,5 a 2,5s, por causa do delay artificial do simulador), você deve ver, **sem precisar consultar nada manualmente**:

```
🔔 [cliente-teste] lawsuit:updated recebido:
{
  "cnjNumber": "0001234-56.2024.8.19.0001",
  "movementsSaved": 2,
  "movements": [
    { "description": "Juntada de petição da parte autora.", "date": "2026-08-22T14:03:11.482Z" },
    { "description": "Audiência de conciliação designada.", "date": "2026-08-22T14:03:11.482Z" }
  ]
}
```

Se essa mensagem chegou **sem você dar refresh em nada**, a Fase 5 está funcionando de ponta a ponta: Worker capturou a movimentação → API foi notificada via BullMQ/Redis → Socket.IO emitiu para a sala certa → seu "cliente" no terminal recebeu em tempo real.

> 🧪 **Teste extra (opcional) — confirme que a sala realmente isola**: abra um segundo terminal rodando `npx tsx src/scripts/testeSocket.ts <OUTRO_CNJ_DIFERENTE>` (um número CNJ diferente do que você vai atualizar) e dispare a mesma importação de antes. Só o terminal inscrito no CNJ correto deve receber o evento `lawsuit:updated` — o outro fica em silêncio, confirmando que o isolamento por sala está funcionando.

---

## 📁 Estrutura de pastas — o que foi adicionado nesta fase

```
src/
├── server.ts                      ← ALTERADO (http.createServer + initSocket + initLawsuitSyncEvents)
├── websocket/                      ← NOVO
│   ├── socket.ts                    (transporte: conexões e salas)
│   └── lawsuitSyncEvents.ts          (ponte: BullMQ "completed" → Socket.IO)
├── workers/
│   └── lawsuitSync.worker.ts        ← ALTERADO (retorna cnjNumber + movements, além de movementsSaved)
└── scripts/
    └── testeSocket.ts               ← NOVO (cliente de teste via terminal, não faz parte da aplicação)
```

---

✅ **Fim da Fase 5.** O sistema agora notifica em tempo real, sem abandonar nada do que já existia: a API REST continua funcionando exatamente igual, o Worker continua desacoplado (nem sabe que WebSocket existe), e a nova camada de tempo real é só mais um "assinante" dos eventos que o BullMQ já produzia desde a Fase 4.
