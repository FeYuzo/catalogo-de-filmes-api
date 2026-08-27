import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initAuthDatabase, pool } from './config/db.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Middlewares
app.use(morgan('dev'));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Endpoint de Healthcheck
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const [rows] = await pool.query('SELECT 1 as connected');
    if (rows && rows[0]?.connected === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

  res.json({
    service: 'auth-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    smtp_configured: smtpConfigured,
    smtp_host: process.env.SMTP_HOST || 'none'
  });
});

// Rotas de Autenticação
app.use('/api/auth', authRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado no microsserviço de autenticação.' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('[Auth-Service Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no microsserviço de autenticação.'
  });
});

// Inicialização do servidor
async function startServer() {
  console.log('==============================================');
  console.log('🔐 Microsserviço de Autenticação e Segurança');
  console.log('==============================================');

  await initAuthDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Auth-Service rodando na porta interna ${PORT}`);
    console.log(`🔒 Acesso apenas via rede interna Docker (sem porta host pública)`);
  });
}

startServer();
