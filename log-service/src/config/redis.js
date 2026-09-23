import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const STREAM_KEY = process.env.STREAM_KEY || 'audit:events';

export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

redis.on('connect', () => {
  console.log(`[Log-Service] Conectado ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);
});

redis.on('error', (err) => {
  console.error('[Log-Service] Erro de conexão com o Redis:', err.message);
});

/**
 * Inicializa e valida a conexão com o Redis
 */
export async function initRedis() {
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log(`[Log-Service] Redis Ping: ${pong}. Chave do Stream: '${STREAM_KEY}'`);
    return true;
  } catch (err) {
    console.warn(`[Log-Service] Aviso: Conexão inicial com o Redis pendente (${err.message}). O cliente tentará reconectar.`);
    return false;
  }
}
