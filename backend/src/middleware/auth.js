import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao_catalogo_filmes_2026';

/**
 * Middleware para verificar o token JWT e injetar o usuário autenticado na requisição.
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Verifica no Header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Se não encontrou no header, verifica nos cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Acesso negado. Token de autenticação não fornecido.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.'
    });
  }
}

/**
 * Gera um token JWT para o usuário.
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome: user.nome
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
