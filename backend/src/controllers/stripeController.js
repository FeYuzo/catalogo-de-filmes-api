import { stripe } from '../config/stripe.js';
import { pool } from '../config/db.js';
import { logAuditEvent } from '../services/auditService.js';

/**
 * Cria uma Checkout Session do Stripe para o Plano Premium
 * Rota: POST /api/stripe/create-checkout-session (autenticado)
 */
export async function createCheckoutSession(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Serviço de pagamentos (Stripe) não configurado no servidor. Configure STRIPE_SECRET_KEY no arquivo .env.'
      });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({
        error: 'Preço do plano não configurado. Adicione STRIPE_PRICE_ID no arquivo .env.'
      });
    }

    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.nome;

    // Obtém a URL base da aplicação para os redirecionamentos de sucesso e cancelamento
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const sessionParams = {
      customer_email: userEmail,
      client_reference_id: String(userId),
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${appUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?payment=cancel`,
      metadata: {
        userId: String(userId),
        userEmail: userEmail,
        userName: userName
      }
    };

    let session;
    try {
      // Tenta criar como assinatura (recorrente)
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (err) {
      // Se o plano criado no Stripe for de pagamento único (one-time payment), faz fallback gracioso
      if (err.message && err.message.includes('recurring')) {
        console.log('[Stripe] Preço configurado como pagamento único. Alternando modo para "payment"...');
        sessionParams.mode = 'payment';
        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw err;
      }
    }

    logAuditEvent({
      usuario_id: userId,
      acao: 'iniciar_checkout_stripe',
      ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip,
      detalhes: {
        sessionId: session.id,
        priceId
      }
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error('[Stripe] Erro ao criar Checkout Session:', err);
    return res.status(500).json({
      error: `Erro ao criar sessão de pagamento no Stripe: ${err.message}`
    });
  }
}

/**
 * Webhook do Stripe: recebe notificações oficiais do Stripe e atualiza o usuário para premium
 * Rota: POST /api/stripe/webhook
 * IMPORTANTE: Recebe o payload bruto (rawBody) para verificar a assinatura criptográfica.
 */
export async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    console.error('[Stripe-Webhook] Stripe SDK não inicializado.');
    return res.status(500).send('Stripe não inicializado.');
  }

  if (!webhookSecret) {
    console.error('[Stripe-Webhook] STRIPE_WEBHOOK_SECRET não configurado no .env.');
    return res.status(500).send('STRIPE_WEBHOOK_SECRET não configurado.');
  }

  if (!sig) {
    console.error('[Stripe-Webhook] Header stripe-signature ausente.');
    return res.status(400).send('Assinatura do webhook ausente.');
  }

  let event;

  try {
    // Usa req.rawBody se disponível (injetado pelo middleware) ou req.body (se express.raw)
    const rawPayload = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(rawPayload, sig, webhookSecret);
  } catch (err) {
    console.error(`[Stripe-Webhook] Falha na validação da assinatura: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe-Webhook] Evento verificado com sucesso: ${event.type} [ID: ${event.id}]`);

  try {
    switch (event.type) {
      // 1. Pagamento/Assinatura confirmado via Checkout Session
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription || null;

        console.log(`[Stripe-Webhook] Checkout concluído! Usuário: ${userId}, Customer: ${customerId}, Sub: ${subscriptionId}`);

        if (userId) {
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? 
             WHERE id = ?`,
            [customerId, subscriptionId, userId]
          );

          logAuditEvent({
            usuario_id: parseInt(userId, 10),
            acao: 'upgrade_premium_confirmado',
            detalhes: {
              evento: 'checkout.session.completed',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              sessionId: session.id
            }
          });
        } else if (session.customer_email) {
          // Fallback por e-mail caso client_reference_id não esteja preenchido
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE, stripe_customer_id = ?, stripe_subscription_id = ? 
             WHERE email = ?`,
            [customerId, subscriptionId, session.customer_email]
          );
        }
        break;
      }

      // 2. Fatura paga com sucesso (renovação mensal de assinatura)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        if (subscriptionId) {
          await pool.query(
            `UPDATE usuarios 
             SET is_premium = TRUE 
             WHERE stripe_subscription_id = ? OR stripe_customer_id = ?`,
            [subscriptionId, customerId]
          );
        }
        break;
      }

      // 3. Assinatura cancelada ou expirada
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer;

        console.log(`[Stripe-Webhook] Assinatura cancelada: ${subscriptionId}`);

        await pool.query(
          `UPDATE usuarios 
           SET is_premium = FALSE 
           WHERE stripe_subscription_id = ? OR stripe_customer_id = ?`,
          [subscriptionId, customerId]
        );

        logAuditEvent({
          acao: 'cancelamento_premium',
          detalhes: {
            evento: 'customer.subscription.deleted',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId
          }
        });
        break;
      }

      default:
        console.log(`[Stripe-Webhook] Evento não manipulado: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (dbErr) {
    console.error('[Stripe-Webhook] Erro ao processar evento no banco de dados:', dbErr);
    return res.status(500).json({ error: 'Erro interno ao persistir dados do webhook.' });
  }
}

/**
 * Consulta status de assinatura premium do usuário atual
 * Rota: GET /api/stripe/status (autenticado)
 */
export async function getSubscriptionStatus(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, nome, email, is_premium, stripe_customer_id, stripe_subscription_id FROM usuarios WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = rows[0];

    return res.json({
      success: true,
      user_id: user.id,
      is_premium: Boolean(user.is_premium),
      stripe_customer_id: user.stripe_customer_id || null,
      stripe_subscription_id: user.stripe_subscription_id || null
    });
  } catch (err) {
    console.error('[Stripe] Erro ao consultar status da assinatura:', err);
    return res.status(500).json({ error: 'Erro ao consultar status da assinatura.' });
  }
}
