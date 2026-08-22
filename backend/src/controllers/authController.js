import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { generateToken } from '../middleware/auth.js';

/**
 * Cadastro de novo usuário
 */
export async function register(req, res) {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios (nome, email, senha).' });
    }

    if (senha.length < 4) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 4 caracteres.' });
    }

    const emailNorm = email.trim().toLowerCase();

    // Verifica se o email já existe
    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [emailNorm]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Hash da senha
    const saltRounds = 10;
    const senha_hash = await bcrypt.hash(senha, saltRounds);

    // Insere novo usuário
    const [result] = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome.trim(), emailNorm, senha_hash]
    );

    const user = {
      id: result.insertId,
      nome: nome.trim(),
      email: emailNorm
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
    console.error('[Auth] Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
}

/**
 * Login de usuário
 */
export async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const emailNorm = email.trim().toLowerCase();

    const [rows] = await pool.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
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
      email: userRecord.email
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
    console.error('[Auth] Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
}

/**
 * Retorna dados do usuário atualmente autenticado
 */
export async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, email, criado_em FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({
      user: rows[0]
    });
  } catch (err) {
    console.error('[Auth] Erro ao consultar perfil:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar perfil.' });
  }
}

/**
 * Logout
 */
export function logout(req, res) {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logout realizado com sucesso.' });
}
