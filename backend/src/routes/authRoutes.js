import { Router } from 'express';
import {
  register,
  login,
  me,
  logout,
  getUserRole,
  authorize,
  getPermissions,
  forgotPassword,
  verifyResetToken,
  resetPassword
} from '../controllers/authController.js';

const router = Router();

// Rotas de Autenticação e Sessão (repassadas internamente ao Auth-Service)
router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);

// Rotas de Papéis (Role) e Autorização RBAC Centralizada (Padrão A)
router.get('/role/:id', getUserRole);
router.post('/authorize', authorize);
router.get('/permissions', getPermissions);

// Rotas de Esqueci Minha Senha / Redefinição com expiração de 30 minutos
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
