const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Rota de Healthcheck
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isReady = dbState === 1;

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || 'unknown'
  });
});

app.use('/', routes);

app.use((req, res) => {
  return res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  return res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Ocorreu um erro interno no servidor'
  });
});

module.exports = app;
