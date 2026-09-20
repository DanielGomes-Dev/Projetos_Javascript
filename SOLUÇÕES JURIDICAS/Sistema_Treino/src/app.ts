import express, { Application, Request, Response } from 'express';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { bullBoardAuth, bullBoardBasePath, bullBoardRouter } from './admin/bullBoard.js';

const app: Application = express();

app.use(express.json());

interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

// Rota Health-Check com tipagem forte
app.get('/health', (req: Request, res: Response<HealthCheckResponse>) => {
  return res.status(200).json({
    status: 'ONLINE',
    service: 'JurisEngine API (TypeScript)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Dashboard de monitoramento das filas (equivalente ao Flower do Celery).
// http://localhost:3000/admin/queues — protegido por Basic Auth.
app.use(bullBoardBasePath, bullBoardAuth, bullBoardRouter);

app.use('/api', apiRoutes);

// Deve vir por último: 404 para rotas não mapeadas, depois o handler de erros global.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;