import dotenv from 'dotenv';

dotenv.config();

const LOG_SERVICE_URL = (process.env.LOG_SERVICE_URL || 'http://log-service:5000').replace(/\/$/, '');

/**
 * Dispara evento de auditoria para o microsserviço de logs de forma não-bloqueante (fire-and-forget).
 * Em caso de indisponibilidade ou lentidão do log-service, NUNCA quebra a requisição do usuário.
 * 
 * @param {Object} params
 * @param {number|string} params.usuario_id - ID do usuário ou 'anonimo'
 * @param {string} params.acao - Nome da ação (ex: 'login', 'favoritar_filme', 'comentar', 'apagar_comentario_moderacao', 'permissao_negada')
 * @param {string} [params.ip] - IP de origem
 * @param {Object} [params.detalhes] - Informações contextuais adicionais
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

    // Timeout de 2 segundos para evitar conexões pendentes caso o log-service esteja temporariamente indisponível
    fetch(`${LOG_SERVICE_URL}/api/logs/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000)
    }).catch((err) => {
      console.warn(`[AuditLog Warning] Não foi possível registrar evento '${acao}' no log-service: ${err.message}`);
    });
  } catch (err) {
    console.warn(`[AuditLog Warning] Exceção ao despachar log de auditoria: ${err.message}`);
  }
}

/**
 * Consulta os logs de auditoria no log-service (chamada inter-serviços autorizada)
 * @param {string} token - JWT do administrador
 * @param {Object} query - Parâmetros de busca (limit, order)
 */
export async function fetchAuditLogs(token, query = {}) {
  try {
    const params = new URLSearchParams(query);
    const url = `${LOG_SERVICE_URL}/api/logs?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: AbortSignal.timeout(4000)
    });

    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (err) {
    console.error(`[Catalog -> Log-Service Error] Falha ao consultar logs:`, err.message);
    return {
      status: 503,
      ok: false,
      data: {
        error: 'Microsserviço de logs temporariamente indisponível na rede Docker.'
      }
    };
  }
}
