import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import logRoutes from './routes/logRoutes.js';
import { initRedis, redis, STREAM_KEY } from './config/redis.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(morgan('dev'));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint de Healthcheck
app.get('/api/health', async (req, res) => {
  let redisStatus = 'disconnected';
  try {
    const ping = await redis.ping();
    if (ping === 'PONG') {
      redisStatus = 'connected';
    }
  } catch (err) {
    redisStatus = `error: ${err.message}`;
  }

  res.json({
    service: 'log-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: {
      status: redisStatus,
      stream: STREAM_KEY
    }
  });
});

// Rotas do serviço de auditoria
app.use('/api/logs', logRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado no microsserviço de logs.' });
});

// Middleware global de erros
app.use((err, req, res, next) => {
  console.error('[Log-Service Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no microsserviço de logs.'
  });
});

async function startServer() {
  console.log('==============================================');
  console.log('📜 Microsserviço de Logs e Auditoria (Redis)');
  console.log('==============================================');

  await initRedis();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Log-Service rodando na porta interna ${PORT}`);
    console.log(`🔒 Acesso apenas via rede interna Docker (sem porta host pública)`);
  });
}

startServer();
