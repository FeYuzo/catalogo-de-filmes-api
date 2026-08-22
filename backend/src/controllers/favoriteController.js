import { pool } from '../config/db.js';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

/**
 * Lista todos os favoritos do usuário logado
 * Rota: GET /api/favorites
 */
export async function listFavorites(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT f.id, f.usuario_id, f.tmdb_movie_id, f.titulo, f.poster_path, f.criado_em,
              (SELECT COUNT(*) FROM comentarios c WHERE c.usuario_id = ? AND c.tmdb_movie_id = f.tmdb_movie_id) as comments_count
       FROM favoritos f
       WHERE f.usuario_id = ?
       ORDER BY f.criado_em DESC`,
      [userId, userId]
    );

    const formattedFavorites = rows.map((fav) => ({
      ...fav,
      poster_url: fav.poster_path ? (fav.poster_path.startsWith('http') ? fav.poster_path : `${IMAGE_BASE_URL}${fav.poster_path}`) : null
    }));

    return res.json({
      success: true,
      total: formattedFavorites.length,
      favorites: formattedFavorites
    });
  } catch (err) {
    console.error('[Favorites] Erro ao listar favoritos:', err);
    return res.status(500).json({ error: 'Erro ao listar filmes favoritos.' });
  }
}

/**
 * Adiciona um filme aos favoritos do usuário logado
 * Rota: POST /api/favorites
 */
export async function addFavorite(req, res) {
  try {
    const userId = req.user.id;
    const { tmdb_movie_id, titulo, poster_path } = req.body;

    if (!tmdb_movie_id || !titulo) {
      return res.status(400).json({ error: 'tmdb_movie_id e titulo são obrigatórios.' });
    }

    const movieId = parseInt(tmdb_movie_id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'tmdb_movie_id deve ser um número inteiro.' });
    }

    // Insere ou atualiza caso já exista
    await pool.query(
      `INSERT INTO favoritos (usuario_id, tmdb_movie_id, titulo, poster_path)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), poster_path = VALUES(poster_path)`,
      [userId, movieId, titulo.trim(), poster_path || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Filme adicionado aos favoritos com sucesso.',
      favorite: {
        usuario_id: userId,
        tmdb_movie_id: movieId,
        titulo: titulo.trim(),
        poster_path: poster_path || null
      }
    });
  } catch (err) {
    console.error('[Favorites] Erro ao adicionar favorito:', err);
    return res.status(500).json({ error: 'Erro ao salvar favorito no banco de dados.' });
  }
}

/**
 * Remove um filme dos favoritos do usuário logado
 * Rota: DELETE /api/favorites/:tmdb_movie_id
 */
export async function removeFavorite(req, res) {
  try {
    const userId = req.user.id;
    const movieId = parseInt(req.params.tmdb_movie_id, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'tmdb_movie_id inválido.' });
    }

    const [result] = await pool.query(
      'DELETE FROM favoritos WHERE usuario_id = ? AND tmdb_movie_id = ?',
      [userId, movieId]
    );

    return res.json({
      success: true,
      message: 'Filme removido dos favoritos com sucesso.',
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error('[Favorites] Erro ao remover favorito:', err);
    return res.status(500).json({ error: 'Erro ao remover favorito do banco de dados.' });
  }
}
