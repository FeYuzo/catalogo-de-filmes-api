import { Router } from 'express';
import { listMovies, getMovieById } from '../controllers/movieController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Todas as rotas de filmes exigem autenticação para isolar favoritos e comentários do usuário
router.get('/', authenticate, listMovies);
router.get('/:id', authenticate, getMovieById);

export default router;
