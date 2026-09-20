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