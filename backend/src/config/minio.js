import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'perfil-usuarios';
export const MINIO_PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '');

// Cliente MinIO SDK
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

/**
 * Política de leitura pública para o bucket de avatares (Object Storage)
 * Permite que clientes web baixem e renderizem as fotos de perfil diretamente.
 */
function getPublicReadPolicy(bucket) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetBucketLocation', 's3:ListBucket'],
        Resource: [`arn:aws:s3:::${bucket}`]
      },
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`]
      }
    ]
  });
}

/**
 * Inicializa conexão com o MinIO e assegura a existência do bucket com política pública.
 */
export async function initMinIO(retries = 5, delayMs = 3000) {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = process.env.MINIO_PORT || '9000';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MinIO] Conectando ao Object Storage em ${endpoint}:${port}... (tentativa ${attempt}/${retries})`);
      
      const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
      if (!bucketExists) {
        console.log(`[MinIO] Bucket '${BUCKET_NAME}' não existe. Criando bucket dedicado...`);
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
        console.log(`[MinIO] Bucket '${BUCKET_NAME}' criado com sucesso.`);
      }

      // Aplica política de leitura pública
      try {
        await minioClient.setBucketPolicy(BUCKET_NAME, getPublicReadPolicy(BUCKET_NAME));
        console.log(`[MinIO] Política de leitura pública aplicada com sucesso no bucket '${BUCKET_NAME}'.`);
      } catch (policyErr) {
        console.warn(`[MinIO Warning] Não foi possível definir política de bucket: ${policyErr.message}`);
      }

      console.log(`[MinIO] Object Storage operacional. Bucket: '${BUCKET_NAME}'.`);
      return true;
    } catch (err) {
      console.error(`[MinIO Error] Falha ao conectar ao MinIO (tentativa ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        console.log(`[MinIO] Aguardando ${delayMs / 1000}s antes da próxima tentativa...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('[MinIO Error] Não foi possível conectar ao MinIO após tentativas. O serviço continuará sem persistência de imagens.');
        return false;
      }
    }
  }
  return false;
}

/**
 * Retorna a URL pública direta do MinIO para uma chave de objeto
 */
export function getPhotoPublicUrl(key) {
  if (!key) return null;
  return `${MINIO_PUBLIC_URL}/${BUCKET_NAME}/${key}`;
}

/**
 * Gera uma URL pré-assinada temporária para o objeto (caso opte pelo modo privado)
 * @param {string} key - Chave do objeto
 * @param {number} expirySeconds - Tempo de expiração em segundos (padrão 3600 = 1 hora)
 */
export async function getPresignedPhotoUrl(key, expirySeconds = 3600) {
  if (!key) return null;
  return minioClient.presignedGetObject(BUCKET_NAME, key, expirySeconds);
}
