import { Router } from 'express';
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favoriteController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', listFavorites);
router.post('/', addFavorite);
router.delete('/:tmdb_movie_id', removeFavorite);

export default router;
