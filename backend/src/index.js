import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase, pool } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import movieRoutes from './routes/movieRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import { deleteComment } from './controllers/commentController.js';
import { authenticate } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://auth-service:4000').replace(/\/$/, '');

// Middlewares
app.use(morgan('dev'));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir arquivos estáticos do Frontend
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Endpoint de verificação de saúde (Healthcheck)
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

  // Verifica conectividade interna com o Auth-Service
  let authServiceStatus = 'unreachable';
  let authServiceDetails = null;
  try {
    const authRes = await fetch(`${AUTH_SERVICE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (authRes.ok) {
      authServiceStatus = 'connected';
      authServiceDetails = await authRes.json();
    } else {
      authServiceStatus = `http_error_${authRes.status}`;
    }
  } catch (err) {
    authServiceStatus = `error: ${err.message}`;
  }

  const tmdbKeyConfigured = Boolean(process.env.TMDB_API_KEY || process.env.TMDB_TOKEN);

  res.json({
    service: 'catalog-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    auth_service: {
      url: AUTH_SERVICE_URL,
      status: authServiceStatus,
      details: authServiceDetails
    },
    tmdb_configured: tmdbKeyConfigured
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/movies/:tmdb_movie_id/comments', commentRoutes);
app.delete('/api/comments/:id', authenticate, deleteComment);
app.use('/api/favorites', favoriteRoutes);

// Rota fallback para SPA (Single Page Application)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint da API não encontrado.' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Middleware de tratamento global de erros
app.use((err, req, res, next) => {
  console.error('[Catalog Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor do catálogo.'
  });
});

// Inicialização do servidor e banco de dados
async function startServer() {
  console.log('==============================================');
  console.log('🎬 Catálogo de Filmes Tom Hanks - Servidor');
  console.log(`🔗 Auth-Service configurado em: ${AUTH_SERVICE_URL}`);
  console.log('==============================================');

  // Inicializa o banco de dados MariaDB do catálogo
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Catálogo rodando na porta pública ${PORT}`);
    console.log(`🌐 Ponto de entrada público: http://localhost:${PORT}`);
  });
}

startServer();
