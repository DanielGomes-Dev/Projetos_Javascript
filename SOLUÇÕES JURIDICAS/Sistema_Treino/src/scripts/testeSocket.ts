// src/scripts/testeSocket.ts
//
// Script de teste MANUAL (não faz parte da aplicação) — simula um
// cliente do front-end conectando via WebSocket, entrando na sala de um
// processo específico, e imprimindo no terminal qualquer atualização
// recebida em tempo real. Apague esta pasta quando não precisar mais
// dela, ou mantenha como uma ferramenta de depuração.
//
// Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>

import { io as ioClient } from 'socket.io-client';

const cnjNumber = process.argv[2];

if (!cnjNumber) {
  console.error('Uso: npx tsx src/scripts/testeSocket.ts <numero-cnj>');
  process.exit(1);
}

const SERVER_URL = process.env.SOCKET_URL || 'http://localhost:3000';

// Fase 6: o servidor (src/websocket/socket.ts) agora só aceita
// `transports: ['websocket']` — necessário para funcionar em modo
// cluster (várias instâncias da API via PM2, sem sticky sessions). O
// cliente precisa declarar a mesma restrição, senão tenta primeiro uma
// conexão por long-polling (o padrão do Socket.IO) e o servidor a
// rejeita, atrasando ou até impedindo a conexão.
const socket = ioClient(SERVER_URL, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log(`[cliente-teste] conectado (id=${socket.id}). Entrando na sala do processo ${cnjNumber}...`);
  socket.emit('join-lawsuit', cnjNumber);
});

socket.on('joined-lawsuit', (payload) => {
  console.log('[cliente-teste] inscrição confirmada:', payload);
  console.log('[cliente-teste] aguardando atualizações em tempo real... (Ctrl+C para sair)');
});

// Este é o evento que a Fase 5.3 emite quando o Worker termina de
// sincronizar o processo — é aqui que "sentimos" a atualização chegar
// em tempo real, sem precisar dar F5/fazer polling.
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
