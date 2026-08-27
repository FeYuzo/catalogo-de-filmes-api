import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env do auth-service ou da raiz do projeto
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'catalogo_filmes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

export const pool = mysql.createPool(dbConfig);

/**
 * Inicializa e verifica as tabelas de autenticação (usuarios e reset_tokens)
 */
export async function initAuthDatabase(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Auth-DB] Conectando ao MariaDB em ${dbConfig.host}:${dbConfig.port}... (tentativa ${attempt}/${retries})`);
      const connection = await pool.getConnection();

      console.log('[Auth-DB] Conexão estabelecida com sucesso. Verificando tabelas de autenticação...');

      // 1. Tabela de Usuários (com campo role: 'usuario' ou 'admin')
      await connection.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          senha_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'usuario',
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Verifica se a coluna 'role' já existe caso a tabela tenha sido criada anteriormente
      const [columns] = await connection.query(`
        SHOW COLUMNS FROM usuarios LIKE 'role';
      `);
      if (columns.length === 0) {
        console.log('[Auth-DB] Adicionando coluna "role" na tabela usuarios...');
        await connection.query(`
          ALTER TABLE usuarios ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'usuario' AFTER senha_hash;
        `);
      }

      // 2. Tabela de Tokens de Recuperação de Senha (com expiração real de 30 minutos e flag de uso)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS reset_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          token VARCHAR(255) UNIQUE NOT NULL,
          usuario_id INT NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expira_em DATETIME NOT NULL,
          usado BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      connection.release();
      console.log('[Auth-DB] Tabelas usuarios e reset_tokens verificadas com sucesso.');
      return true;
    } catch (err) {
      console.error(`[Auth-DB] Erro ao conectar ao banco (tentativa ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        console.log(`[Auth-DB] Aguardando ${delayMs / 1000}s antes da próxima tentativa...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('[Auth-DB] Falha crítica ao conectar com o MariaDB após várias tentativas.');
        return false;
      }
    }
  }
  return false;
}
