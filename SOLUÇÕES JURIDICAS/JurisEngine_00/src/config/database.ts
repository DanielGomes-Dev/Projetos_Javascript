// src/config/database.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/juris_db';
console.log("URL Mongo Connected: ", MONGODB_URI);

mongoose.connect(MONGODB_URI).catch((err: Error) => {
  console.error('[mongoose] Falha ao conectar:', err.message);
});

mongoose.connection.on('connected', () => {
  console.log('[mongoose] Conectado ao MongoDB.');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('[mongoose] Erro de conexão:', err.message);
});

export default mongoose;