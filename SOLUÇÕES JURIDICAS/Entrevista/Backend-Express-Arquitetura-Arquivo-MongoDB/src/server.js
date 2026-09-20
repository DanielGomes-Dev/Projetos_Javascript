require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const Student = require('./models/Student');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const { closeQueue } = require('./services/enrollments.service');

const PORT = process.env.PORT || 3333;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

let server;

async function bootstrap() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado com sucesso');

    await Promise.all([Student.init(), Course.init(), Enrollment.init()]);

    server = app.listen(PORT, () => {
      console.log(`Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`Healthcheck: http://localhost:${PORT}/health`);
      console.log(`Cursos: http://localhost:${PORT}/courses`);
    });
  } catch (error) {
    console.error('❌ Falha ao inicializar o servidor:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await closeQueue();
    await mongoose.disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
