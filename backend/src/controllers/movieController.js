import { getTomHanksMovies } from '../services/tmdbService.js';
import { pool } from '../config/db.js';

/**
 * Lista todos os filmes de Tom Hanks vindos da API da TMDB,
 * enriquecidos com o status de favorito e quantidade de comentários
 * DO USUÁRIO LOGADO (isolamento total entre usuários).
 */
export async function listMovies(req, res) {
  try {
    const userId = req.user.id;
    const forceRefresh = req.query.refresh === 'true';

    // 1. Busca filmes ao vivo da TMDB
    const movies = await getTomHanksMovies(forceRefresh);

    // 2. Busca favoritos do usuário logado no MariaDB
    const [favRows] = await pool.query(
      'SELECT tmdb_movie_id FROM favoritos WHERE usuario_id = ?',
      [userId]
    );
    const favoriteMovieIds = new Set(favRows.map((r) => r.tmdb_movie_id));

    // 3. Busca contagem de comentários do usuário logado no MariaDB
    const [comRows] = await pool.query(
      'SELECT tmdb_movie_id, COUNT(*) as total FROM comentarios WHERE usuario_id = ? GROUP BY tmdb_movie_id',
      [userId]
    );
    const commentCountMap = new Map();
    for (const row of comRows) {
      commentCountMap.set(row.tmdb_movie_id, row.total);
    }

    // 4. Concatena os dados sem alterar a lista base
    const enrichedMovies = movies.map((movie) => ({
      ...movie,
      is_favorite: favoriteMovieIds.has(movie.id),
      comments_count: commentCountMap.get(movie.id) || 0
    }));

    return res.json({
      success: true,
      total: enrichedMovies.length,
      movies: enrichedMovies
    });
  } catch (err) {
    console.error('[Movies] Erro ao listar filmes:', err);
    return res.status(500).json({
      error: 'Erro ao buscar catálogo de filmes na TMDB.',
      details: err.message
    });
  }
}

/**
 * Detalhes de um filme específico
 */
export async function getMovieById(req, res) {
  try {
    const userId = req.user.id;
    const movieId = parseInt(req.params.id, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'ID de filme inválido.' });
    }

    const movies = await getTomHanksMovies();
    const movie = movies.find((m) => m.id === movieId);

    if (!movie) {
      return res.status(404).json({ error: 'Filme não encontrado no catálogo de Tom Hanks.' });
    }

    // Verifica favorito para este usuário
    const [favRows] = await pool.query(
      'SELECT id, criado_em FROM favoritos WHERE usuario_id = ? AND tmdb_movie_id = ?',
      [userId, movieId]
    );

    // Busca comentários deste usuário para este filme
    const [commentRows] = await pool.query(
      'SELECT id, texto, criado_em FROM comentarios WHERE usuario_id = ? AND tmdb_movie_id = ? ORDER BY criado_em DESC',
      [userId, movieId]
    );

    return res.json({
      ...movie,
      is_favorite: favRows.length > 0,
      favorite_id: favRows.length > 0 ? favRows[0].id : null,
      comments: commentRows
    });
  } catch (err) {
    console.error('[Movies] Erro ao obter filme:', err);
    return res.status(500).json({ error: 'Erro ao obter detalhes do filme.' });
  }
}
