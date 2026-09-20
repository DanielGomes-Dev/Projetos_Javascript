// src/server.ts
import http from 'node:http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './websocket/socket.js';
import { initLawsuitSyncEvents } from './websocket/lawsuitSyncEvents.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Antes (Fases 1-4): `app.listen(PORT, ...)`.
//
// O Express, por baixo dos panos, também cria um `http.Server` quando
// você chama `app.listen()` — só que ele não te dá uma REFERÊNCIA a
// esse servidor antes de já estar escutando. O Socket.IO, por outro
// lado, precisa RECEBER essa referência explicitamente para conseguir
// "escutar" os mesmos handshakes HTTP que o Express e fazer o upgrade
// para WebSocket quando um cliente pedir. Por isso, a partir da Fase 5,
// criamos o `http.Server` manualmente com `http.createServer(app)` —
// o Express (`app`) continua tratando todas as rotas REST normalmente,
// e agora também temos a referência (`httpServer`) para entregar ao Socket.IO.
const httpServer = http.createServer(app);

// Liga o Socket.IO neste mesmo servidor/porta (não abre uma porta nova).
initSocket(httpServer);

// Liga a "ponte" que traduz jobs concluídos do Worker em eventos
// WebSocket para os clientes conectados (ver Fase 5.3 do guia).
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
