import { pool } from '../config/db.js';
import { minioClient, BUCKET_NAME, getPhotoPublicUrl } from '../config/minio.js';
import { validateImageMagicBytes } from '../utils/fileValidation.js';
import { logAuditEvent } from '../services/auditService.js';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || req.ip || 'desconhecido';
}

/**
 * Consulta perfil de um usuário (com dados cadastrais, bio, foto e lista de filmes favoritados)
 * Rota: GET /api/profile/me ou GET /api/profile/:id
 */
export async function getProfile(req, res) {
  try {
    let targetUserId = req.user?.id;

    if (req.params.id && req.params.id !== 'me') {
      const parsed = parseInt(req.params.id, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'ID de usuário inválido.' });
      }
      targetUserId = parsed;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Identificador de usuário não informado.' });
    }

    // 1. Busca dados do usuário no MariaDB
    const [users] = await pool.query(
      'SELECT id, nome, email, role, bio, foto_perfil, criado_em FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    }

    const user = users[0];

    // 2. Busca filmes favoritados do usuário (reaproveitando tabela favoritos existente)
    const [favoritesRows] = await pool.query(
      `SELECT f.id, f.usuario_id, f.tmdb_movie_id, f.titulo, f.poster_path, f.criado_em,
              (SELECT COUNT(*) FROM comentarios c WHERE c.tmdb_movie_id = f.tmdb_movie_id) as comments_count
       FROM favoritos f
       WHERE f.usuario_id = ?
       ORDER BY f.criado_em DESC`,
      [targetUserId]
    );

    const formattedFavorites = favoritesRows.map((fav) => ({
      ...fav,
      poster_url: fav.poster_path ? (fav.poster_path.startsWith('http') ? fav.poster_path : `${IMAGE_BASE_URL}${fav.poster_path}`) : null
    }));

    // Monta URLs de foto (direta do MinIO e proxy via catálogo)
    const fotoDirectUrl = user.foto_perfil ? getPhotoPublicUrl(user.foto_perfil) : null;
    const fotoProxyUrl = user.foto_perfil ? `/api/profile/photo/${user.foto_perfil}` : null;

    return res.json({
      success: true,
      profile: {
        id: user.id,
        nome: user.nome,
        email: (req.user?.id === user.id || req.user?.role === 'admin') ? user.email : undefined,
        role: user.role,
        bio: user.bio || '',
        foto_perfil: user.foto_perfil || null,
        foto_url: fotoProxyUrl || fotoDirectUrl || null,
        foto_direct_url: fotoDirectUrl,
        criado_em: user.criado_em,
        is_owner: req.user ? req.user.id === user.id : false,
        favoritos: formattedFavorites,
        total_favoritos: formattedFavorites.length
      }
    });
  } catch (err) {
    console.error('[Profile] Erro ao carregar perfil:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar perfil de usuário.' });
  }
}

/**
 * Atualiza dados textuais do perfil (nome e bio)
 * Regra Dura de Segurança: O backend SEMPRE usa o ID do token JWT (req.user.id).
 * Se o cliente tentar enviar um usuario_id diferente no corpo ou parâmetro, retorna 403 e registra auditoria.
 * 
 * Rota: PUT /api/profile ou PUT /api/profile/:id
 */
export async function updateProfile(req, res) {
  try {
    const authenticatedUserId = req.user.id;
    const clientIp = getClientIp(req);

    // 1. Verificação de IDOR / Tentativa de adulteração de identidade de terceiro
    const paramId = req.params.id && req.params.id !== 'me' ? parseInt(req.params.id, 10) : null;
    const bodyUserId = req.body.usuario_id !== undefined ? parseInt(req.body.usuario_id, 10) : null;
    const bodyId = req.body.id !== undefined ? parseInt(req.body.id, 10) : null;

    const attemptedTargetId = paramId || bodyUserId || bodyId;

    if (attemptedTargetId && attemptedTargetId !== authenticatedUserId) {
      // Bloqueia e audita tentativa no log-service
      logAuditEvent({
        usuario_id: authenticatedUserId,
        acao: 'permissao_negada',
        ip: clientIp,
        detalhes: {
          motivo: 'tentativa_edicao_perfil_terceiro',
          usuario_autenticado: authenticatedUserId,
          usuario_alvo_tentado: attemptedTargetId,
          rota: req.originalUrl,
          metodo: req.method
        }
      });

      return res.status(403).json({
        error: 'Acesso proibido. Você não tem permissão para editar o perfil de outro usuário.'
      });
    }

    const { nome, bio } = req.body;

    if (nome !== undefined && (!nome || nome.trim().length < 2)) {
      return res.status(400).json({ error: 'O nome deve ter no mínimo 2 caracteres.' });
    }

    if (bio !== undefined && bio.length > 500) {
      return res.status(400).json({ error: 'A bio deve ter no máximo 500 caracteres.' });
    }

    // Busca valores atuais
    const [currentRows] = await pool.query('SELECT nome, bio FROM usuarios WHERE id = ?', [authenticatedUserId]);
    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updatedNome = nome !== undefined ? nome.trim() : currentRows[0].nome;
    const updatedBio = bio !== undefined ? bio.trim() : currentRows[0].bio;

    // Atualiza estritamente WHERE id = req.user.id
    await pool.query(
      'UPDATE usuarios SET nome = ?, bio = ? WHERE id = ?',
      [updatedNome, updatedBio, authenticatedUserId]
    );

    // Auditoria: evento 'perfil_atualizado'
    logAuditEvent({
      usuario_id: authenticatedUserId,
      acao: 'perfil_atualizado',
      ip: clientIp,
      detalhes: {
        nome_alterado: nome !== undefined,
        bio_alterada: bio !== undefined
      }
    });

    return res.json({
      success: true,
      message: 'Perfil atualizado com sucesso.',
      user: {
        id: authenticatedUserId,
        nome: updatedNome,
        bio: updatedBio
      }
    });
  } catch (err) {
    console.error('[Profile] Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
  }
}

/**
 * Upload de Foto de Perfil
 * - Validação de tamanho (máximo 5MB)
 * - Validação por Magic Bytes (evita MIME spoofing)
 * - Armazenamento no MinIO (Object Storage)
 * - Salva apenas a chave do objeto no MariaDB
 * - Bloqueio com 403 e auditoria caso tente enviar ID de terceiro
 * 
 * Rota: POST /api/profile/photo ou POST /api/profile/:id/photo
 */
export async function uploadProfilePhoto(req, res) {
  try {
    const authenticatedUserId = req.user.id;
    const clientIp = getClientIp(req);

    // 1. Verificação de IDOR
    const paramId = req.params.id && req.params.id !== 'me' ? parseInt(req.params.id, 10) : null;
    const bodyUserId = req.body.usuario_id !== undefined ? parseInt(req.body.usuario_id, 10) : null;
    const attemptedTargetId = paramId || bodyUserId;

    if (attemptedTargetId && attemptedTargetId !== authenticatedUserId) {
      logAuditEvent({
        usuario_id: authenticatedUserId,
        acao: 'permissao_negada',
        ip: clientIp,
        detalhes: {
          motivo: 'tentativa_upload_foto_terceiro',
          usuario_autenticado: authenticatedUserId,
          usuario_alvo_tentado: attemptedTargetId,
          rota: req.originalUrl,
          metodo: req.method
        }
      });

      return res.status(403).json({
        error: 'Acesso proibido. Você não pode alterar a foto de outro usuário.'
      });
    }

    // 2. Valida se o arquivo foi enviado
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: 'Nenhum arquivo de imagem foi enviado no campo "foto".'
      });
    }

    // 3. Validação rigorosa por Magic Bytes (Assinatura Binária do Arquivo)
    const magicCheck = validateImageMagicBytes(req.file.buffer);
    if (!magicCheck.valid) {
      return res.status(400).json({
        error: magicCheck.error || 'Formato de imagem inválido ou adulterado.'
      });
    }

    // 4. Gera chave única do objeto no MinIO: avatars/user-<id>-<timestamp>.<ext>
    const objectKey = `avatars/user-${authenticatedUserId}-${Date.now()}.${magicCheck.ext}`;

    // 5. Garante a existência do bucket e envia o buffer para o MinIO
    try {
      const exists = await minioClient.bucketExists(BUCKET_NAME);
      if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      }
    } catch (bErr) {
      console.warn('[MinIO] Verificação de bucket:', bErr.message);
    }

    const metaData = {
      'Content-Type': magicCheck.mime,
      'X-Amz-Meta-UserId': String(authenticatedUserId),
      'X-Amz-Meta-OriginalName': encodeURIComponent(req.file.originalname || 'avatar')
    };

    await minioClient.putObject(
      BUCKET_NAME,
      objectKey,
      req.file.buffer,
      req.file.buffer.length,
      metaData
    );

    // 6. Atualiza o banco de dados MariaDB: guarda APENAS a chave/referência
    const [userRows] = await pool.query('SELECT foto_perfil FROM usuarios WHERE id = ?', [authenticatedUserId]);
    const oldFotoKey = userRows[0]?.foto_perfil;

    await pool.query(
      'UPDATE usuarios SET foto_perfil = ? WHERE id = ?',
      [objectKey, authenticatedUserId]
    );

    // 7. Remove foto antiga do MinIO de forma assíncrona (boa prática para economizar storage)
    if (oldFotoKey && oldFotoKey !== objectKey) {
      minioClient.removeObject(BUCKET_NAME, oldFotoKey).catch((err) => {
        console.warn(`[MinIO Warning] Falha ao limpar foto antiga '${oldFotoKey}': ${err.message}`);
      });
    }

    // 8. Auditoria: evento 'upload_foto_perfil'
    logAuditEvent({
      usuario_id: authenticatedUserId,
      acao: 'upload_foto_perfil',
      ip: clientIp,
      detalhes: {
        chave_objeto: objectKey,
        tamanho_bytes: req.file.buffer.length,
        formato_detectado: magicCheck.mime
      }
    });

    const fotoDirectUrl = getPhotoPublicUrl(objectKey);
    const fotoProxyUrl = `/api/profile/photo/${objectKey}`;

    return res.status(200).json({
      success: true,
      message: 'Foto de perfil enviada com sucesso.',
      foto_perfil: objectKey,
      foto_url: fotoProxyUrl,
      foto_direct_url: fotoDirectUrl
    });
  } catch (err) {
    console.error('[Profile Upload] Erro ao processar upload:', err);
    return res.status(500).json({ error: `Erro ao realizar upload da foto: ${err.message}` });
  }
}

/**
 * Proxy / Streaming para servir foto de perfil direto do MinIO via porta do catálogo
 * Rota pública: GET /api/profile/photo/:key(*)
 */
export async function getProfilePhoto(req, res) {
  try {
    const rawKey = req.params.key || req.params[0];
    const objectKey = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!objectKey) {
      return res.status(400).json({ error: 'Chave da foto não informada.' });
    }

    // Busca metadados do objeto no MinIO
    const stat = await minioClient.statObject(BUCKET_NAME, objectKey).catch(() => null);
    if (!stat) {
      return res.status(404).json({ error: 'Imagem não encontrada no Object Storage.' });
    }

    // Define cabeçalhos de resposta
    const contentType = stat.metaData?.['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    if (stat.etag) {
      res.setHeader('ETag', stat.etag);
    }

    // Stream direto do MinIO para a resposta HTTP
    const dataStream = await minioClient.getObject(BUCKET_NAME, objectKey);
    dataStream.pipe(res);
  } catch (err) {
    console.error('[Profile Photo Stream] Erro ao servir foto:', err);
    return res.status(500).json({ error: 'Erro ao carregar foto de perfil.' });
  }
}
