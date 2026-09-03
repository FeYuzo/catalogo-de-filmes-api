import dotenv from 'dotenv';

dotenv.config();

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://auth-service:4000').replace(/\/$/, '');

/**
 * Realiza chamadas HTTP internas para o microsserviço de autenticação (auth-service)
 */
export async function callAuthService(endpoint, options = {}) {
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
 * Consulta o auth-service (Padrão A - Enforcement Centralizado)
 * para verificar se o usuário possui a permissão solicitada.
 * @param {number|string} userId
 * @param {string} permission
 * @returns {Promise<{ allowed: boolean, status: number, data: object }>}
 */
export async function checkUserPermission(userId, permission) {
  const result = await callAuthService('/api/auth/authorize', {
    method: 'POST',
    body: JSON.stringify({ userId, permission })
  });

  return {
    allowed: result.ok && result.data?.allowed === true,
    status: result.status,
    data: result.data
  };
}
