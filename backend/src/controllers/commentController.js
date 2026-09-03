import { pool } from '../config/db.js';
import { checkUserPermission } from '../services/authService.js';

/**
 * Lista os comentários de um filme específico.
 * Se o usuário for admin, pode visualizar todos os comentários com dados do autor (moderação).
 * Se o usuário for comum, visualiza apenas os seus próprios comentários.
 * Rota: GET /api/movies/:tmdb_movie_id/comments
 */
export async function listMovieComments(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'usuario';
    const movieId = parseInt(req.params.tmdb_movie_id, 10);

    if (isNaN(movieId)) {
      return res.status(400).json({ error: 'tmdb_movie_id inválido.' });
    }

    let query = `
      SELECT c.id, c.usuario_id, c.tmdb_movie_id, c.texto, c.criado_em, u.nome AS autor_nome, u.email AS autor_email
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.tmdb_movie_id = ?
    `;
    const params = [movieId];

    // Usuário comum só visualiza seus próprios comentários
    if (userRole !== 'admin') {
      query += ' AND c.usuario_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY c.criado_em DESC';

    const [rows] = await pool.query(query, params);

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
 * Remove um comentário com Enforcement Centralizado de Permissões RBAC (Padrão A).
 * - Usuário comum: só pode apagar o próprio comentário (comentarios:excluir_proprio).
 * - Moderação (Admin): pode apagar comentários de qualquer usuário (comentarios:excluir_qualquer).
 * Rota: DELETE /api/comments/:id
 */
export async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);

    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'ID do comentário inválido.' });
    }

    // 1. Busca o comentário no banco de dados
    const [rows] = await pool.query(
      'SELECT id, usuario_id, tmdb_movie_id, texto FROM comentarios WHERE id = ?',
      [commentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado.' });
    }

    const comment = rows[0];

    // 2. Se o usuário autenticado for o autor do comentário:
    // Permissão 'comentarios:excluir_proprio' (permitido para usuario e admin)
    if (comment.usuario_id === userId) {
      await pool.query('DELETE FROM comentarios WHERE id = ?', [commentId]);
      return res.json({
        success: true,
        message: 'Comentário removido com sucesso pelo autor.'
      });
    }

    // 3. Se NÃO for o autor, trata-se de tentativa de excluir comentário de outro usuário.
    // Requer a permissão exclusiva de moderação: 'comentarios:excluir_qualquer'
    // Consulta centralizada ao auth-service (Padrão A)
    const authCheck = await checkUserPermission(userId, 'comentarios:excluir_qualquer');

    if (!authCheck.allowed) {
      return res.status(403).json({
        error: 'Acesso proibido. Você não tem permissão para excluir comentários de outros usuários.'
      });
    }

    // 4. Autorizado pelo auth-service (papel admin): executa a exclusão de moderação
    await pool.query('DELETE FROM comentarios WHERE id = ?', [commentId]);

    return res.json({
      success: true,
      message: 'Comentário removido com sucesso (ação de moderação administrativa).'
    });
  } catch (err) {
    console.error('[Comments] Erro ao remover comentário:', err);
    return res.status(500).json({ error: 'Erro ao remover comentário.' });
  }
}
