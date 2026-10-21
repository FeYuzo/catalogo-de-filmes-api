import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.warn('[Stripe] AVISO: STRIPE_SECRET_KEY não foi configurada no arquivo .env. As funcionalidades de pagamento do Stripe não funcionarão até que a chave seja informada.');
}

export const stripe = stripeKey ? new Stripe(stripeKey) : null;
