// src/scripts/testeSocket.ts
//
// Script de teste MANUAL — não faz parte da aplicação (não é
// importado por nada em src/), só um cliente de terminal para validar
// o fluxo Worker → WebSocket → Cliente de ponta a ponta.
//
// Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>
import { io as ioClient } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

const cnjNumber = process.argv[2];

if (!cnjNumber) {
  console.error('Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>');
  process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const socket = ioClient(SERVER_URL);

socket.on('connect', () => {
  console.log(`[teste-socket] Conectado (${socket.id}). Entrando na sala do processo ${cnjNumber}...`);
  socket.emit('join-lawsuit', cnjNumber);
  console.log('[teste-socket] Aguardando evento "lawsuit:updated"... (Ctrl+C para sair)');
});

socket.on('lawsuit:updated', (payload) => {
  console.log('[teste-socket] 🔔 lawsuit:updated recebido:');
  console.log(JSON.stringify(payload, null, 2));
});

socket.on('disconnect', () => {
  console.log('[teste-socket] Desconectado.');
});