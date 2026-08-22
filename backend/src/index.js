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

  const tmdbKeyConfigured = Boolean(process.env.TMDB_API_KEY || process.env.TMDB_TOKEN);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
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
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor.'
  });
});

// Inicialização do servidor e banco de dados
async function startServer() {
  console.log('==============================================');
  console.log('🎬 Catálogo de Filmes Tom Hanks - Servidor');
  console.log('==============================================');

  // Inicializa o banco de dados MariaDB
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse localmente em: http://localhost:${PORT}`);
  });
}

startServer();
