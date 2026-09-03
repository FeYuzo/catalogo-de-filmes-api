import { Router } from 'express';
import {
  register,
  login,
  me,
  logout,
  getUserRole,
  validateTokenEndpoint,
  authorizeEndpoint,
  getPermissionsMatrix,
  forgotPassword,
  verifyResetToken,
  resetPassword
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Rotas de Cadastro, Login, Sessão e Perfil
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/logout', logout);

// Rotas de Papéis (Role) e Autorização RBAC Centralizada (Padrão A)
router.get('/role/:id', getUserRole);
router.post('/validate-token', validateTokenEndpoint);
router.post('/authorize', authorizeEndpoint);
router.get('/permissions', getPermissionsMatrix);

// Rotas de Recuperação e Redefinição de Senha
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
