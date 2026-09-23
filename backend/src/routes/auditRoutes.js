import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { fetchAuditLogs } from '../services/auditService.js';

const router = Router();

/**
 * Consulta aos logs de auditoria (Restrita a Administradores)
 * Rota pública no Catálogo: GET /api/logs
 * Repassa com autenticação para o log-service interno
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  const { limit, order } = req.query;

  const result = await fetchAuditLogs(token, { limit, order });
  return res.status(result.status).json(result.data);
});

export default router;
