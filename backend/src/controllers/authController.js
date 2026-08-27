import dotenv from 'dotenv';

dotenv.config();

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://auth-service:4000').replace(/\/$/, '');

/**
 * Função utilitária para chamar o microsserviço de autenticação via rede interna Docker.
 */
async function callAuthService(endpoint, options = {}) {
  const url = `${AUTH_SERVICE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers
    };
  } catch (err) {
    console.error(`[Catalog -> Auth-Service Error] Falha ao comunicar com ${url}:`, err.message);
    return {
      status: 503,
      ok: false,
      data: {
        error: 'Serviço de autenticação temporariamente indisponível. Verifique a rede interna do Docker.'
      }
    };
  }
}

/**
 * Encaminha cadastro para o Auth-Service
 * Rota: POST /api/auth/register
 */
export async function register(req, res) {
  const result = await callAuthService('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(req.body)
  });

  if (result.ok && result.data.token) {
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  return res.status(result.status).json(result.data);
}

/**
 * Encaminha login para o Auth-Service
 * Rota: POST /api/auth/login
 */
export async function login(req, res) {
  const result = await callAuthService('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(req.body)
  });

  if (result.ok && result.data.token) {
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  return res.status(result.status).json(result.data);
}

/**
 * Consulta perfil do usuário autenticado no Auth-Service
 * Rota: GET /api/auth/me
 */
export async function me(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  const result = await callAuthService('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return res.status(result.status).json(result.data);
}

/**
 * Logout
 * Rota: POST /api/auth/logout
 */
export async function logout(req, res) {
  res.clearCookie('token');
  // Notifica o Auth-Service se necessário
  await callAuthService('/api/auth/logout', { method: 'POST' });
  return res.json({ success: true, message: 'Logout realizado com sucesso.' });
}

/**
 * Consulta papel (role) do usuário no Auth-Service
 * Rota: GET /api/auth/role/:id
 */
export async function getUserRole(req, res) {
  const result = await callAuthService(`/api/auth/role/${req.params.id}`, {
    method: 'GET'
  });
  return res.status(result.status).json(result.data);
}

/**
 * Encaminha pedido de "Esqueci minha senha" para o Auth-Service
 * Rota: POST /api/auth/forgot-password
 */
export async function forgotPassword(req, res) {
  const result = await callAuthService('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(req.body)
  });

  return res.status(result.status).json(result.data);
}

/**
 * Encaminha validação de token de recuperação para o Auth-Service
 * Rota: GET /api/auth/verify-reset-token
 */
export async function verifyResetToken(req, res) {
  const token = req.query.token;
  const result = await callAuthService(`/api/auth/verify-reset-token?token=${encodeURIComponent(token || '')}`, {
    method: 'GET'
  });

  return res.status(result.status).json(result.data);
}

/**
 * Encaminha redefinição de senha para o Auth-Service
 * Rota: POST /api/auth/reset-password
 */
export async function resetPassword(req, res) {
  const result = await callAuthService('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(req.body)
  });

  return res.status(result.status).json(result.data);
}
