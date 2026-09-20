// src/websocket/socket.ts
//
// Camada de transporte em tempo real (Socket.IO). Responsável SÓ por:
//   1. anexar o servidor de WebSocket ao mesmo servidor HTTP da API;
//   2. deixar o cliente entrar/sair de "salas" por número CNJ;
//   3. (Fase 6) fazer o servidor funcionar corretamente quando existem
//      VÁRIAS instâncias da API rodando ao mesmo tempo (modo cluster
//      do PM2) — ver os comentários abaixo sobre o Redis Adapter e a
//      restrição de transporte.
//
// A REGRA DE NEGÓCIO de "quando emitir o quê" mora em outro arquivo
// (lawsuitSyncEvents.ts) — este arquivo não sabe nada sobre BullMQ,
// Sequelize ou processos jurídicos, só sobre conexões e salas.

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HTTPServer } from 'node:http';
import { redisConnection } from '../config/redis.js';

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

    // ── Fase 6: por que restringir a APENAS 'websocket' ───────────
    // Por padrão, o Socket.IO tenta primeiro uma conexão por
    // long-polling (várias requisições HTTP comuns, uma atrás da
    // outra) e só DEPOIS faz o "upgrade" para WebSocket de verdade.
    // Isso funciona bem com UM único processo — mas a partir desta
    // fase a API pode rodar em MODO CLUSTER (várias cópias do
    // processo, uma por núcleo de CPU, via PM2 — seção 6.2). Sem
    // "sticky sessions" (que o PM2 não configura automaticamente), o
    // sistema operacional pode rotear cada requisição HTTP do
    // long-polling para uma cópia DIFERENTE do processo — e o
    // handshake do Socket.IO quebra, porque o estado da conexão
    // (o "session ID") só existe na memória da cópia que recebeu a
    // PRIMEIRA requisição.
    //
    // Forçando `transports: ['websocket']`, pulamos o long-polling
    // inteiramente: o cliente abre direto uma única conexão TCP que já
    // nasce como WebSocket e permanece aberta — como é uma única
    // conexão persistente (não uma sequência de requisições HTTP
    // separadas), ela naturalmente fica "presa" à MESMA cópia do
    // processo do início ao fim, sem precisar de nenhuma configuração
    // extra de sticky session no balanceador.
    transports: ['websocket'],
  });

  // ── Fase 6: por que o Redis Adapter é obrigatório em modo cluster ──
  // Cada cópia da API (cada processo do cluster) mantém, na sua
  // PRÓPRIA memória, a lista de quem está conectado e em quais salas.
  // Se o Cliente A está conectado à cópia #1 e o Worker termina um job
  // do processo dele, mas quem recebe o evento "completed" do BullMQ
  // é a cópia #2 (poderia ser qualquer uma — não há garantia de qual
  // cópia vai processar aquele evento específico), a cópia #2 chamaria
  // `getIO().to(sala).emit(...)` numa sala que, PARA ELA, está vazia —
  // e o Cliente A nunca receberia nada.
  //
  // O Redis Adapter resolve isso: toda vez que qualquer cópia chama
  // `.to(sala).emit(...)`, o adapter publica essa mensagem num canal
  // Redis compartilhado; TODAS as cópias (inclusive a #1, onde o
  // Cliente A está de verdade) assinam esse canal e retransmitem para
  // os seus próprios clientes locais que estejam naquela sala. Fica
  // como se todas as cópias da API compartilhassem uma única "lista de
  // salas", ainda que cada uma só conheça diretamente seus próprios
  // clientes.
  //
  // Usamos `.duplicate()` (do ioredis) para abrir DUAS conexões novas
  // a partir da mesma configuração de `redisConnection` — Pub/Sub, tal
  // como os comandos bloqueantes do BullMQ (Fase 4), exige conexões
  // DEDICADAS: uma conexão em modo "subscriber" fica presa ouvindo o
  // canal e não pode mais executar outros comandos Redis normalmente.
  const pubClient = redisConnection.duplicate();
  const subClient = redisConnection.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

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
