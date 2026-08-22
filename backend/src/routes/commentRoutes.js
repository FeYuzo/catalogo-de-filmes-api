import { Router } from 'express';
import { listMovieComments, addComment, deleteComment } from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Rotas para comentários de um filme específico (/api/movies/:tmdb_movie_id/comments)
router.get('/', listMovieComments);
router.post('/', addComment);

// Rota para deletar um comentário pelo ID do comentário (/api/comments/:id)
router.delete('/:id', deleteComment);

export default router;
