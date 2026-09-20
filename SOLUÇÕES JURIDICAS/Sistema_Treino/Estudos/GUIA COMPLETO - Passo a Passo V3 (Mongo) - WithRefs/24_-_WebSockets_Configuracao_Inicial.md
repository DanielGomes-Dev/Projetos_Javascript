# 24 — WebSockets: Configuração Inicial

## 🎯 Objetivo

Introduzir o Socket.IO e o conceito de "salas" — uma sala por número CNJ, para que um cliente conectado só receba notificações do processo que ele está acompanhando.

## 📦 Instalar

```bash
npm install socket.io
npm install -D socket.io-client
```

## 📝 Código

Crie `src/websocket/socket.ts`:

```typescript
// src/websocket/socket.ts
import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';

let io: SocketIOServer | undefined;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[socket] Cliente conectado: ${socket.id}`);

    // O cliente escolhe qual processo (CNJ) quer acompanhar — a "sala"
    // é literalmente o número CNJ, então `.to(cnjNumber).emit(...)`
    // (usado no próximo passo) alcança só quem entrou nessa sala.
    socket.on('join-lawsuit', (cnjNumber: string) => {
      socket.join(cnjNumber);
      console.log(`[socket] ${socket.id} entrou na sala do processo ${cnjNumber}`);
    });

    socket.on('leave-lawsuit', (cnjNumber: string) => {
      socket.leave(cnjNumber);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO ainda não foi inicializado — chame initSocket() primeiro.');
  }
  return io;
}
```

> 💡 **Por que "salas" (`rooms`), em vez de simplesmente notificar TODOS os clientes conectados a cada atualização?** Um sistema real pode ter centenas de clientes conectados simultaneamente, cada um interessado em processos diferentes. Notificar todo mundo a cada atualização de qualquer processo desperdiçaria banda e forçaria cada cliente a filtrar, no front-end, quais eventos importam para ele. Salas resolvem isso no próprio servidor: o Socket.IO só entrega o evento a quem entrou naquela sala específica.

Atualize `src/server.ts` (editando o arquivo do passo 06) — o Socket.IO precisa de uma referência ao `http.Server`, que o Express não expõe diretamente ao chamar `app.listen()`:

```typescript
// src/server.ts
import http from 'node:http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './websocket/socket.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Antes: `app.listen(PORT, ...)`. O Express também cria um
// `http.Server` internamente ao chamar isso, mas não devolve uma
// REFERÊNCIA a ele — e o Socket.IO precisa dessa referência para
// conseguir "escutar" os mesmos handshakes HTTP e fazer o upgrade para
// WebSocket quando um cliente pedir. Por isso criamos o servidor
// manualmente com http.createServer(app).
const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[Server] Recebido ${signal}, encerrando...`);
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

## ✅ Como confirmar que funcionou

Ainda não existe nada emitindo eventos (isso chega no passo 25) — confirme só que a conexão WebSocket em si funciona, com um clientinho rápido:

```typescript
// teste-conexao-socket.ts (temporário, na raiz)
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
socket.on('connect', () => {
  console.log('Conectado! ID:', socket.id);
  socket.emit('join-lawsuit', '0001111-22.2024.8.19.0001');
});
```

```bash
npx tsx teste-conexao-socket.ts
```

Deve imprimir `Conectado! ID: ...`, e o terminal do servidor deve mostrar `[socket] ... entrou na sala do processo ...`. Apague o arquivo depois (um script de teste "de verdade" chega no passo 26).

## 🔧 Commit sugerido

```bash
git add package.json package-lock.json src/websocket/socket.ts src/server.ts
git commit -m "feat: adicionar socket.io com salas por numero de processo"
```

## 📚 Documentação Oficial

- **Socket.IO — documentação geral**: https://socket.io/docs/v4/
- **Socket.IO — Server API**: https://socket.io/docs/v4/server-api/
- **Socket.IO — Rooms (salas)**: https://socket.io/docs/v4/rooms/
- **Socket.IO — Client API**: https://socket.io/docs/v4/client-api/
- **Node.js — `http.createServer()`**: https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener
