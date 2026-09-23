import { Router } from 'express';
import {
  createLogEvent,
  getLogEvents,
  getLogStats
} from '../controllers/logController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Endpoint interno para ingestão de eventos de auditoria (usado pelo Catálogo e Auth-Service)
router.post('/events', createLogEvent);

// Endpoint de consulta protegido - apenas administradores autenticados
router.get('/', authenticate, requireAdmin, getLogEvents);

// Estatísticas da Stream (também protegido para admin)
router.get('/stats', authenticate, requireAdmin, getLogStats);

export default router;
