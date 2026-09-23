import dotenv from 'dotenv';

dotenv.config();

const LOG_SERVICE_URL = (process.env.LOG_SERVICE_URL || 'http://log-service:5000').replace(/\/$/, '');

/**
 * Dispara evento de auditoria de autenticação para o microsserviço de logs (fire-and-forget).
 * Em caso de falha de conexão com o log-service, não bloqueia e nem derruba o fluxo de autenticação.
 * 
 * @param {Object} params
 * @param {number|string} params.usuario_id
 * @param {string} params.acao - ex: 'login', 'logout', 'cadastro', 'permissao_negada'
 * @param {string} [params.ip]
 * @param {Object} [params.detalhes]
 */
export async function logAuditEvent({ usuario_id, acao, ip = 'desconhecido', detalhes = {} }) {
  try {
    const payload = {
      usuario_id: usuario_id !== undefined && usuario_id !== null ? usuario_id : 'anonimo',
      acao,
      ip,
      detalhes,
      timestamp: new Date().toISOString()
    };

    fetch(`${LOG_SERVICE_URL}/api/logs/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000)
    }).catch((err) => {
      console.warn(`[Auth -> Log Warning] Falha ao enviar evento '${acao}' para log-service: ${err.message}`);
    });
  } catch (err) {
    console.warn(`[Auth -> Log Warning] Exceção ao despachar evento de auditoria: ${err.message}`);
  }
}
