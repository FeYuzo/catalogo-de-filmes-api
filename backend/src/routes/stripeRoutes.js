import express from 'express';
import { createCheckoutSession, handleWebhook, getSubscriptionStatus } from '../controllers/stripeController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Webhook do Stripe: deve receber o corpo cru (Buffer) para validação da assinatura
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Checkout Session (requer login)
router.post('/create-checkout-session', authenticate, createCheckoutSession);

// Status da assinatura (requer login)
router.get('/status', authenticate, getSubscriptionStatus);

export default router;
