import { Router } from 'express';
import {
  register,
  login,
  me,
  logout,
  getUserRole,
  validateTokenEndpoint,
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

// Rotas de Papéis (Role) e Validação Interna
router.get('/role/:id', getUserRole);
router.post('/validate-token', validateTokenEndpoint);

// Rotas de Recuperação e Redefinição de Senha
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
