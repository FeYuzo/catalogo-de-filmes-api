import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'felipe_shida_filmes_jwt_secret_2026';

/**
 * Valida o token JWT emitido pelo auth-service
 */
export function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Acesso negado. Token de autenticação não fornecido para consulta de logs.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      role: decoded.role || 'usuario'
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token inválido ou expirado. Faça login novamente para consultar logs.'
    });
  }
}

/**
 * Middleware para garantir que apenas o papel 'admin' possa consultar auditoria
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso proibido. A visualização de logs de auditoria é restrita a administradores.'
    });
  }

  next();
}
