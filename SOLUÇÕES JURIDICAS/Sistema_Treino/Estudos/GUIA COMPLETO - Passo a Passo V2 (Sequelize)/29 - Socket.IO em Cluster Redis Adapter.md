# 29 — Socket.IO em Cluster: Redis Adapter

## 🎯 Objetivo

Corrigir um problema que só aparece **depois** que a API passa a rodar em modo cluster (passo 27): sem isso, WebSockets funcionam sozinhos localmente, mas quebram silenciosamente com mais de uma instância da API.

## O problema

Cada cópia da API (cada processo do cluster) mantém, na sua **própria** memória, a lista de quem está conectado e em quais salas. Se o Cliente A está conectado à cópia #1, e o evento `completed` do BullMQ (passo 25) é processado pela cópia #2 (poderia ser qualquer uma), a cópia #2 chamaria `getIO().to(sala).emit(...)` numa sala que, para ela, está **vazia** — o Cliente A nunca receberia nada, sem nenhum erro aparente.

Há um segundo problema, independente mas relacionado: por padrão, o Socket.IO tenta primeiro *long-polling* (várias requisições HTTP separadas) antes de fazer o "upgrade" para WebSocket. Em modo cluster, sem *sticky sessions* (que o PM2 não configura sozinho), cada requisição desse handshake pode ir parar numa cópia diferente do processo — e o handshake quebra.

## 📦 Instalar

```bash
npm install @socket.io/redis-adapter
```

## 📝 Código

Edite `src/websocket/socket.ts` (arquivo do passo 24), adicionando o Redis Adapter e restringindo o transporte:

```typescript
// src/websocket/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HTTPServer } from 'node:http';
import { redisConnection } from '../config/redis.js';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },

    // Pula o long-polling inteiramente: o cliente abre direto uma
    // única conexão WebSocket persistente, que naturalmente fica
    // "presa" à mesma cópia do processo do início ao fim — sem
    // precisar de sticky sessions no balanceador.
    transports: ['websocket'],
  });

  // O Redis Adapter resolve o problema de propagação entre cópias:
  // toda vez que qualquer cópia chama `.to(sala).emit(...)`, o adapter
  // publica a mensagem num canal Redis compartilhado; TODAS as cópias
  // assinam esse canal e retransmitem para os seus clientes locais
  // naquela sala. `.duplicate()` abre conexões DEDICADAS — Pub/Sub, tal
  // como os comandos bloqueantes do BullMQ, exige conexões próprias.
  const pubClient = redisConnection.duplicate();
  const subClient = redisConnection.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    console.log(`[socket] cliente conectado: ${socket.id}`);

    socket.on('join-lawsuit', (cnjNumber: unknown) => {
      if (typeof cnjNumber !== 'string' || cnjNumber.trim() === '') {
        socket.emit('error', { message: 'join-lawsuit exige um cnjNumber (string) válido.' });
        return;
      }
      socket.join(cnjNumber);
      socket.emit('joined-lawsuit', { cnjNumber });
    });

    socket.on('leave-lawsuit', (cnjNumber: unknown) => {
      if (typeof cnjNumber !== 'string') return;
      socket.leave(cnjNumber);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] cliente desconectado: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO ainda não foi inicializado. Chame initSocket(httpServer) antes de getIO().');
  }
  return io;
}
```

Atualize também o cliente de teste `src/scripts/testeSocket.ts` (passo 26), declarando o mesmo transporte:

```typescript
// src/scripts/testeSocket.ts — só a criação do socket muda
const socket = ioClient(SERVER_URL, { transports: ['websocket'] });
```

## ✅ Como confirmar que funcionou

```bash
docker build --target production -t jurisengine:prod .
# rode como no passo 28, e depois rode o script de teste (passo 26) duas vezes,
# em terminais diferentes, contra o mesmo processo em cluster:
npx tsx src/scripts/testeSocket.ts 0007777-33.2024.8.19.0001
```

Dispare uma importação (passo 19) — **ambas** as conexões de teste devem receber `lawsuit:updated`, mesmo que o evento `completed` do BullMQ tenha sido processado por uma cópia diferente da que aceitou a conexão WebSocket de cada uma.

## 🔧 Commit sugerido

```bash
git add package.json package-lock.json src/websocket/socket.ts src/scripts/testeSocket.ts
git commit -m "fix: suportar socket.io com multiplas instancias via redis adapter"
```
