// src/server.ts
import dotenv from 'dotenv';
import app from './app.js';
import http from 'node:http';
import { initSocket } from './websocket/socket.js';
import { initLawsuitSyncEvents } from './websocket/lawsuitSyncEvents.js';


dotenv.config();

const PORT = process.env.PORT || 3001;



// Antes: `app.listen(PORT, ...)`. O Express também cria um
// `http.Server` internamente ao chamar isso, mas não devolve uma
// REFERÊNCIA a ele — e o Socket.IO precisa dessa referência para
// conseguir "escutar" os mesmos handshakes HTTP e fazer o upgrade para
// WebSocket quando um cliente pedir. Por isso criamos o servidor
// manualmente com http.createServer(app).

const httpServer = http.createServer(app);
initSocket(httpServer);
const lawsuitSyncEvents = initLawsuitSyncEvents();


httpServer.listen(PORT, () => {
  console.log(`[Server] JurisEngine rodando na porta ${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[Server] Recebido ${signal}, encerrando...`);
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));