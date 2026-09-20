// teste-conexao-socket.ts (temporário, na raiz)
import { io } from 'socket.io-client';

console.log("Iniciando...");

const socket = io('http://localhost:3000');

console.log("Socket criado:", socket.id);

// Evento disparado quando a conexão é bem-sucedida
socket.on('connect', () => {
  console.log('Conectado com sucesso! ID do socket:', socket.id);
  socket.emit('join-lawsuit', '0001111-22.2024.8.19.0001');
});

// 👇 ADICIONADO: Captura erros na tentativa de conexão inicial ou reconexão
socket.on('connect_error', (err) => {
  console.error('❌ Erro de conexão com o Socket.IO:', err.message);
});

// (Opcional, mas muito útil) Para saber se ele perdeu a conexão depois de conectado
socket.on('disconnect', (reason) => {
  console.warn('⚠️ Desconectado do servidor. Motivo:', reason);
});