import { pool } from '../config/db.js';

/**
 * Lista os comentários de um filme específico pertencentes AO USUÁRIO LOGADO.
 * Rota: GET /api/movies/:tmdb_movie_id/comments
 */
export async function listMovieComments(req, res) {
  try {
    const userId = req.user.id;
    const movieId = parseInt(req.params.tmdb_movie_id, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'tmdb_movie_id inválido.' });
    }

    // Filtra estritamente pelo usuario_id do usuário logado
    const [rows] = await pool.query(
      `SELECT id, usuario_id, tmdb_movie_id, texto, criado_em
       FROM comentarios
       WHERE usuario_id = ? AND tmdb_movie_id = ?
       ORDER BY criado_em DESC`,
      [userId, movieId]
    );

    return res.json({
      success: true,
      total: rows.length,
      comments: rows
    });
  } catch (err) {
    console.error('[Comments] Erro ao listar comentários:', err);
    return res.status(500).json({ error: 'Erro ao buscar comentários do filme.' });
  }
}

/**
 * Adiciona um comentário para um filme específico vinculado ao usuário logado.
 * Rota: POST /api/movies/:tmdb_movie_id/comments
 */
export async function addComment(req, res) {
  try {
    const userId = req.user.id;
    const movieId = parseInt(req.params.tmdb_movie_id, 10);
    const { texto } = req.body;

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'tmdb_movie_id inválido.' });
    }

    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return res.status(400).json({ error: 'O texto do comentário não pode ser vazio.' });
    }

    const [result] = await pool.query(
      `INSERT INTO comentarios (usuario_id, tmdb_movie_id, texto)
       VALUES (?, ?, ?)`,
      [userId, movieId, texto.trim()]
    );

    const [newCommentRows] = await pool.query(
      'SELECT id, usuario_id, tmdb_movie_id, texto, criado_em FROM comentarios WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Comentário salvo com sucesso.',
      comment: newCommentRows[0]
    });
  } catch (err) {
    console.error('[Comments] Erro ao adicionar comentário:', err);
    return res.status(500).json({ error: 'Erro ao salvar comentário.' });
  }
}

/**
 * Remove um comentário.
 * Rota: DELETE /api/comments/:id
 */
export async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);

    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'ID do comentário inválido.' });
    }

    // Garante que só deleta se o comentário pertencer ao usuário logado
    const [result] = await pool.query(
      'DELETE FROM comentarios WHERE id = ? AND usuario_id = ?',
      [commentId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Comentário não encontrado ou você não tem permissão para excluí-lo.'
      });
    }

    return res.json({
      success: true,
      message: 'Comentário removido com sucesso.'
    });
  } catch (err) {
    console.error('[Comments] Erro ao remover comentário:', err);
    return res.status(500).json({ error: 'Erro ao remover comentário.' });
  }
}
