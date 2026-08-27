import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { generateToken, verifyToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/mailService.js';

/**
 * Cadastro de novo usuário
 * Rota: POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { nome, email, senha, role } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios (nome, email, senha).' });
    }

    if (senha.length < 4) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 4 caracteres.' });
    }

    const emailNorm = email.trim().toLowerCase();

    // Valida papel (role) - aceita 'usuario' ou 'admin', padroniza para 'usuario'
    const allowedRoles = ['usuario', 'admin'];
    const userRole = role && allowedRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'usuario';

    // Verifica se o e-mail já existe
    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [emailNorm]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Hash da senha
    const saltRounds = 10;
    const senha_hash = await bcrypt.hash(senha, saltRounds);

    // Insere novo usuário com seu papel (role)
    const [result] = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
      [nome.trim(), emailNorm, senha_hash, userRole]
    );

    const user = {
      id: result.insertId,
      nome: nome.trim(),
      email: emailNorm,
      role: userRole
    };

    const token = generateToken(user);

    // Define cookie seguro
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso.',
      user,
      token
    });
  } catch (err) {
    console.error('[Auth-Service] Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
}

/**
 * Login de usuário
 * Rota: POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const emailNorm = email.trim().toLowerCase();

    const [rows] = await pool.query(
      'SELECT id, nome, email, senha_hash, role FROM usuarios WHERE email = ?',
      [emailNorm]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas. E-mail ou senha incorretos.' });
    }

    const userRecord = rows[0];
    const senhaValida = await bcrypt.compare(senha, userRecord.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas. E-mail ou senha incorretos.' });
    }

    const user = {
      id: userRecord.id,
      nome: userRecord.nome,
      email: userRecord.email,
      role: userRecord.role || 'usuario'
    };

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      user,
      token
    });
  } catch (err) {
    console.error('[Auth-Service] Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
}

/**
 * Retorna dados do usuário atualmente autenticado
 * Rota: GET /api/auth/me
 */
export async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, email, role, criado_em FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({
      user: rows[0]
    });
  } catch (err) {
    console.error('[Auth-Service] Erro ao consultar perfil:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar perfil.' });
  }
}

/**
 * Logout
 * Rota: POST /api/auth/logout
 */
export function logout(req, res) {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logout realizado com sucesso.' });
}

/**
 * Consulta papel (role) do usuário (para comunicação inter-serviços)
 * Rota: GET /api/auth/role/:id
 */
export async function getUserRole(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuário inválido.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nome, email, role FROM usuarios WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({
      id: rows[0].id,
      nome: rows[0].nome,
      email: rows[0].email,
      role: rows[0].role || 'usuario'
    });
  } catch (err) {
    console.error('[Auth-Service] Erro ao buscar role:', err);
    return res.status(500).json({ error: 'Erro ao consultar papel do usuário.' });
  }
}

/**
 * Validação de token JWT (para comunicação inter-serviços)
 * Rota: POST /api/auth/validate-token
 */
export async function validateTokenEndpoint(req, res) {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token não fornecido.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ valid: false, error: 'Token inválido ou expirado.' });
    }

    return res.json({
      valid: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        nome: decoded.nome,
        role: decoded.role || 'usuario'
      }
    });
  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
}

/**
 * Solicitação de recuperação de senha ("Esqueci minha senha")
 * Gera token único com expiração real de 30 minutos e envia por e-mail
 * Rota: POST /api/auth/forgot-password
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'O e-mail é obrigatório para recuperação de senha.' });
    }

    const emailNorm = email.trim().toLowerCase();

    // 1. Busca usuário pelo e-mail
    const [rows] = await pool.query(
      'SELECT id, nome, email FROM usuarios WHERE email = ?',
      [emailNorm]
    );

    if (rows.length === 0) {
      // Para segurança e boa prática, podemos retornar mensagem de sucesso genérica
      return res.json({
        success: true,
        message: 'Se o e-mail informado estiver cadastrado, um link de redefinição de senha foi enviado.'
      });
    }

    const user = rows[0];

    // 2. Gera token aleatório e único de 32 bytes (64 caracteres hexadecimais)
    const token = crypto.randomBytes(32).toString('hex');

    // 3. Calcula expiração: criado_em + 30 minutos
    const criadoEm = new Date();
    const expiraEm = new Date(criadoEm.getTime() + 30 * 60 * 1000); // 30 minutos

    // 4. Salva token na tabela reset_tokens
    await pool.query(
      `INSERT INTO reset_tokens (token, usuario_id, criado_em, expira_em, usado)
       VALUES (?, ?, ?, ?, FALSE)`,
      [token, user.id, criadoEm, expiraEm]
    );

    // 5. Monta a URL de redefinição apontando para a interface pública do catálogo
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${appUrl}/?reset_token=${token}`;

    // 6. Envia o e-mail transacional de verdade (Mailtrap / Brevo)
    await sendPasswordResetEmail(user.email, user.nome, resetUrl, token);

    return res.json({
      success: true,
      message: 'Link de recuperação de senha enviado com sucesso para o seu e-mail. Válido por 30 minutos.'
    });
  } catch (err) {
    console.error('[Auth-Service] Erro ao processar recuperação de senha:', err);
    return res.status(500).json({
      error: 'Erro interno ao processar pedido de recuperação de senha. Tente novamente mais tarde.'
    });
  }
}

/**
 * Validação do link / token de recuperação
 * Checa: (1) token existe? (2) ainda não passou de expira_em (30 min)? (3) ainda não foi usado?
 * Rota: GET /api/auth/verify-reset-token
 */
export async function verifyResetToken(req, res) {
  try {
    const token = req.query.token || req.body.token;

    if (!token) {
      return res.status(400).json({ error: 'Token de recuperação não fornecido.' });
    }

    const [rows] = await pool.query(
      `SELECT rt.id, rt.token, rt.usuario_id, rt.criado_em, rt.expira_em, rt.usado,
              u.nome, u.email
       FROM reset_tokens rt
       INNER JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token = ?`,
      [token]
    );

    // 1. Checagem: o token existe?
    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Token de recuperação inválido ou inexistente. Por favor, solicite um novo link.'
      });
    }

    const record = rows[0];

    // 2. Checagem: o token já foi usado?
    if (record.usado) {
      return res.status(400).json({
        error: 'Este link de recuperação já foi utilizado. Por favor, solicite um novo link.'
      });
    }

    // 3. Checagem: ainda não passou de expira_em (30 minutos)?
    const agora = new Date();
    const expiraEm = new Date(record.expira_em);

    if (agora > expiraEm) {
      return res.status(400).json({
        error: 'Este link de recuperação expirou (validade de 30 minutos ultrapassada). Por favor, solicite um novo link.'
      });
    }

    return res.json({
      valid: true,
      message: 'Token válido.',
      email: record.email,
      nome: record.nome,
      expira_em: record.expira_em
    });
  } catch (err) {
    console.error('[Auth-Service] Erro ao validar token de reset:', err);
    return res.status(500).json({ error: 'Erro interno ao validar token de recuperação.' });
  }
}

/**
 * Conclusão da redefinição de senha com a nova senha
 * Checa: (1) token existe? (2) não expirou? (3) não foi usado?
 * Rota: POST /api/auth/reset-password
 */
export async function resetPassword(req, res) {
  try {
    const { token, nova_senha } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token de recuperação é obrigatório.' });
    }

    if (!nova_senha || nova_senha.length < 4) {
      return res.status(400).json({ error: 'A nova senha deve conter no mínimo 4 caracteres.' });
    }

    // Busca o registro do token
    const [rows] = await pool.query(
      `SELECT rt.id, rt.token, rt.usuario_id, rt.expira_em, rt.usado, u.email
       FROM reset_tokens rt
       INNER JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token = ?`,
      [token]
    );

    // 1. Checagem: o token existe?
    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Token de recuperação inválido ou inexistente. Por favor, solicite um novo link.'
      });
    }

    const record = rows[0];

    // 2. Checagem: ainda não foi usado?
    if (record.usado) {
      return res.status(400).json({
        error: 'Este link de recuperação já foi utilizado. Por favor, solicite um novo link.'
      });
    }

    // 3. Checagem: ainda não passou de expira_em?
    const agora = new Date();
    const expiraEm = new Date(record.expira_em);

    if (agora > expiraEm) {
      return res.status(400).json({
        error: 'Este link de recuperação expirou (validade de 30 minutos ultrapassada). Por favor, solicite um novo link.'
      });
    }

    // Hash da nova senha
    const saltRounds = 10;
    const novaSenhaHash = await bcrypt.hash(nova_senha, saltRounds);

    // Atualiza a senha do usuário
    await pool.query(
      'UPDATE usuarios SET senha_hash = ? WHERE id = ?',
      [novaSenhaHash, record.usuario_id]
    );

    // Marca o token como usado para impedir reutilização
    await pool.query(
      'UPDATE reset_tokens SET usado = TRUE WHERE id = ?',
      [record.id]
    );

    console.log(`[Auth-Service] Senha alterada com sucesso para o usuário ID ${record.usuario_id} (${record.email})`);

    return res.json({
      success: true,
      message: 'Senha alterada com sucesso! Você já pode fazer login com a nova senha.'
    });
  } catch (err) {
    console.error('[Auth-Service] Erro ao redefinir senha:', err);
    return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
}
