import { redis, STREAM_KEY } from '../config/redis.js';

/**
 * Registra um evento de auditoria no Redis Stream via XADD
 * Rota interna: POST /api/logs/events
 */
export async function createLogEvent(req, res) {
  try {
    const { usuario_id, acao, timestamp, ip, detalhes } = req.body;

    if (!acao) {
      return res.status(400).json({ error: 'O campo "acao" é obrigatório.' });
    }

    const eventUser = usuario_id !== undefined && usuario_id !== null ? String(usuario_id) : 'anonimo';
    const eventTime = timestamp || new Date().toISOString();
    const clientIp = ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'desconhecido';
    const eventDetails = typeof detalhes === 'object' ? JSON.stringify(detalhes) : String(detalhes || '{}');

    // Gravação no Redis Stream usando XADD
    // Sintaxe Redis: XADD audit:events * usuario_id <val> acao <val> timestamp <val> ip <val> detalhes <val>
    const eventId = await redis.xadd(
      STREAM_KEY,
      '*',
      'usuario_id', eventUser,
      'acao', String(acao),
      'timestamp', String(eventTime),
      'ip', String(clientIp),
      'detalhes', eventDetails
    );

    return res.status(201).json({
      success: true,
      eventId,
      event: {
        id: eventId,
        usuario_id: eventUser,
        acao,
        timestamp: eventTime,
        ip: clientIp,
        detalhes: typeof detalhes === 'object' ? detalhes : eventDetails
      }
    });
  } catch (err) {
    console.error('[Log-Service] Erro ao gravar evento no Redis Stream:', err);
    return res.status(500).json({
      error: 'Erro interno ao persistir log de auditoria no Redis Stream.',
      details: err.message
    });
  }
}

/**
 * Consulta os eventos de auditoria protegidos
 * Suporta XREVRANGE (mais recentes primeiro) e XRANGE (cronológico ascendente)
 * Rota protegida: GET /api/logs
 */
export async function getLogEvents(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500);
    const order = (req.query.order || 'desc').toLowerCase();

    let rawEntries = [];

    if (order === 'asc') {
      // XRANGE audit:events - + COUNT <limit>
      // Retorna em ordem cronológica crescente (do mais antigo para o mais novo)
      rawEntries = await redis.xrange(STREAM_KEY, '-', '+', 'COUNT', limit);
    } else {
      // XREVRANGE audit:events + - COUNT <limit>
      // Retorna em ordem cronológica decrescente (do mais recente para o mais antigo)
      rawEntries = await redis.xrevrange(STREAM_KEY, '+', '-', 'COUNT', limit);
    }

    // Formata o retorno de pares de campos do Redis Stream:
    // [ [ "1711200000000-0", [ "usuario_id", "1", "acao", "login", ... ] ] ]
    const logs = rawEntries.map(([id, fields]) => {
      const entry = { id };
      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        let val = fields[i + 1];

        if (key === 'detalhes') {
          try {
            val = JSON.parse(val);
          } catch (_) {
            // Mantém string caso não seja JSON válido
          }
        } else if (key === 'usuario_id' && !isNaN(Number(val))) {
          val = Number(val);
        }

        entry[key] = val;
      }
      return entry;
    });

    const totalInStream = await redis.xlen(STREAM_KEY).catch(() => logs.length);

    return res.json({
      success: true,
      total_in_stream: totalInStream,
      returned_count: logs.length,
      order,
      stream: STREAM_KEY,
      logs
    });
  } catch (err) {
    console.error('[Log-Service] Erro ao consultar eventos no Redis Stream:', err);
    return res.status(500).json({
      error: 'Erro ao consultar logs de auditoria no Redis.',
      details: err.message
    });
  }
}

/**
 * Retorna estatísticas rápidas do Redis Stream de auditoria
 * Rota: GET /api/logs/stats
 */
export async function getLogStats(req, res) {
  try {
    const total = await redis.xlen(STREAM_KEY);
    return res.json({
      success: true,
      stream: STREAM_KEY,
      total_events: total
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao obter estatísticas da Stream.', details: err.message });
  }
}
