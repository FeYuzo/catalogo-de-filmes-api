import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao_catalogo_filmes_2026';

/**
 * Middleware para validar o token JWT
 */
export function authenticate(req, res, next) {
  let token = null;

  // 1. Verifica no Header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Verifica nos cookies
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
      nome: decoded.nome,
      role: decoded.role || 'usuario'
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.'
    });
  }
}

/**
 * Middleware para restringir rotas por papel de usuário (role)
 */
export function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso proibido. Esta ação requer permissão: ${roles.join(' ou ')}.`
      });
    }
    next();
  };
}

/**
 * Gera um token JWT contendo id, email, nome e role do usuário
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role || 'usuario'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verifica e decodifica um token diretamente
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
