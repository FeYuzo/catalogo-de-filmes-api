import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { checkUserPermission } from '../services/authService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao_catalogo_filmes_2026';

/**
 * Middleware para validar o token JWT emitido pelo Auth-Service
 * e injetar os dados do usuário autenticado na requisição.
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
 * Middleware para checar se o usuário autenticado possui o papel necessário
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
 * Middleware para enforcement centralizado de permissão RBAC (Padrão A).
 * Consulta o auth-service em tempo de execução para verificar se o usuário possui a permissão requerida.
 * @param {string} permission - Permissão no formato '<recurso>:<acao>'
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const check = await checkUserPermission(req.user.id, permission);

    if (!check.allowed) {
      return res.status(403).json({
        error: check.data?.error || `Acesso proibido. Ação requer a permissão '${permission}'.`
      });
    }

    // Mantém req.user.role sincronizado com o banco centralizado
    if (check.data?.role) {
      req.user.role = check.data.role;
    }

    next();
  };
}
