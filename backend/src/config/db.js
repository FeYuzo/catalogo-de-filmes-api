import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

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
 * Inicializa as tabelas do catálogo de filmes no MariaDB (Favoritos e Comentários).
 * Nota: A tabela de usuários e tokens de autenticação é de responsabilidade do Auth-Service.
 */
export async function initDatabase(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Catalog-DB] Conectando ao MariaDB em ${dbConfig.host}:${dbConfig.port}... (tentativa ${attempt}/${retries})`);
      const connection = await pool.getConnection();

      console.log('[Catalog-DB] Conexão estabelecida com sucesso. Verificando tabelas de catálogo...');

      // Tabela de Favoritos (com chave única para impedir favoritar 2x o mesmo filme)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS favoritos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          tmdb_movie_id INT NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          poster_path VARCHAR(255),
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
          UNIQUE KEY uq_usuario_filme (usuario_id, tmdb_movie_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Tabela de Comentários
      await connection.query(`
        CREATE TABLE IF NOT EXISTS comentarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          tmdb_movie_id INT NOT NULL,
          texto TEXT NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      connection.release();
      console.log('[Catalog-DB] Tabelas favoritos e comentarios verificadas com sucesso.');
      return true;
    } catch (err) {
      console.error(`[Catalog-DB] Erro ao conectar ao banco (tentativa ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        console.log(`[Catalog-DB] Aguardando ${delayMs / 1000}s antes da próxima tentativa...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('[Catalog-DB] Falha crítica ao conectar com o MariaDB após várias tentativas.');
        return false;
      }
    }
  }
  return false;
}
