/**
 * Módulo de Autenticação no Frontend
 * Gerencia a tela de login, cadastro, papéis (roles), esqueci minha senha e redefinição com expiração
 */

import { api } from './api.js';

const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const userNav = document.getElementById('user-nav');
const navUserName = document.getElementById('nav-user-name');
const navUserRole = document.getElementById('nav-user-role');
const btnLogout = document.getElementById('btn-logout');

const authNavTabs = document.getElementById('auth-nav-tabs');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authAlert = document.getElementById('auth-alert');

// Formulários
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formForgot = document.getElementById('form-forgot');
const formReset = document.getElementById('form-reset');

// Inputs de Login
const loginEmail = document.getElementById('login-email');
const loginSenha = document.getElementById('login-senha');
const btnSubmitLogin = document.getElementById('btn-submit-login');
const btnForgotPassword = document.getElementById('btn-forgot-password');

// Inputs de Registro
const registerNome = document.getElementById('register-nome');
const registerEmail = document.getElementById('register-email');
const registerRole = document.getElementById('register-role');
const registerSenha = document.getElementById('register-senha');
const btnSubmitRegister = document.getElementById('btn-submit-register');

// Inputs de Recuperação (Esqueci Senha)
const forgotEmail = document.getElementById('forgot-email');
const btnSubmitForgot = document.getElementById('btn-submit-forgot');
const btnForgotBack = document.getElementById('btn-forgot-back');

// Inputs de Redefinição (Com Token)
const resetNovaSenha = document.getElementById('reset-nova-senha');
const resetConfirmaSenha = document.getElementById('reset-confirma-senha');
const resetTokenInfo = document.getElementById('reset-token-info');
const btnSubmitReset = document.getElementById('btn-submit-reset');
const btnResetBack = document.getElementById('btn-reset-back');

let activeResetToken = null;

function showAlert(message, type = 'danger') {
  authAlert.textContent = message;
  authAlert.className = `alert alert-${type}`;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  authAlert.classList.add('hidden');
  authAlert.textContent = '';
}

export function switchTab(tab) {
  hideAlert();

  // Esconde todos os formulários primeiro
  formLogin?.classList.add('hidden');
  formRegister?.classList.add('hidden');
  formForgot?.classList.add('hidden');
  formReset?.classList.add('hidden');

  if (tab === 'login') {
    authNavTabs?.classList.remove('hidden');
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');
  } else if (tab === 'register') {
    authNavTabs?.classList.remove('hidden');
    tabRegister?.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.remove('hidden');
  } else if (tab === 'forgot') {
    authNavTabs?.classList.add('hidden');
    formForgot?.classList.remove('hidden');
  } else if (tab === 'reset') {
    authNavTabs?.classList.add('hidden');
    formReset?.classList.remove('hidden');
  }
}

export function showAuthView() {
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
  userNav.classList.add('hidden');
  switchTab('login');
}

export function showAppView(user) {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  userNav.classList.remove('hidden');
  
  navUserName.textContent = user?.nome || 'Usuário';
  
  const role = user?.role || 'usuario';
  if (navUserRole) {
    navUserRole.textContent = role === 'admin' ? 'Admin' : 'Usuário';
    navUserRole.className = `user-role-badge role-${role}`;
  }
}

// ===== LOGIN =====
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();

  const email = loginEmail.value.trim();
  const senha = loginSenha.value;

  if (!email || !senha) {
    showAlert('Por favor, preencha o e-mail e a senha.');
    return;
  }

  btnSubmitLogin.disabled = true;
  btnSubmitLogin.textContent = 'Entrando...';

  try {
    const data = await api.login(email, senha);
    formLogin.reset();
    showAppView(data.user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user }));
  } catch (err) {
    showAlert(err.message || 'Falha ao autenticar. Verifique suas credenciais.');
  } finally {
    btnSubmitLogin.disabled = false;
    btnSubmitLogin.innerHTML = '<span>Entrar no Catálogo</span>';
  }
}

// ===== CADASTRO (COM ROLE) =====
async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const nome = registerNome.value.trim();
  const email = registerEmail.value.trim();
  const role = registerRole ? registerRole.value : 'usuario';
  const senha = registerSenha.value;

  if (!nome || !email || !senha) {
    showAlert('Por favor, preencha todos os campos.');
    return;
  }

  if (senha.length < 4) {
    showAlert('A senha deve conter no mínimo 4 caracteres.');
    return;
  }

  btnSubmitRegister.disabled = true;
  btnSubmitRegister.textContent = 'Cadastrando...';

  try {
    const data = await api.register(nome, email, senha, role);
    formRegister.reset();
    showAppView(data.user);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user }));
  } catch (err) {
    showAlert(err.message || 'Falha ao criar conta.');
  } finally {
    btnSubmitRegister.disabled = false;
    btnSubmitRegister.innerHTML = '<span>Criar Minha Conta</span>';
  }
}

// ===== ESQUECI MINHA SENHA (ENVIO DE LINK COM EXPIRAÇÃO) =====
async function handleForgot(e) {
  e.preventDefault();
  hideAlert();

  const email = forgotEmail.value.trim();
  if (!email) {
    showAlert('Por favor, informe seu e-mail cadastrado.');
    return;
  }

  btnSubmitForgot.disabled = true;
  btnSubmitForgot.textContent = 'Enviando e-mail...';

  try {
    const data = await api.forgotPassword(email);
    showAlert(
      data.message || 'Link de recuperação enviado para seu e-mail! Válido por 30 minutos.',
      'success'
    );
    formForgot.reset();
  } catch (err) {
    showAlert(err.message || 'Erro ao solicitar recuperação de senha.');
  } finally {
    btnSubmitForgot.disabled = false;
    btnSubmitForgot.innerHTML = '<span>Enviar Link de Recuperação</span>';
  }
}

// ===== REDEFINIÇÃO DE SENHA (VALIDAÇÃO DO TOKEN + NOVA SENHA) =====
async function handleReset(e) {
  e.preventDefault();
  hideAlert();

  if (!activeResetToken) {
    showAlert('Token de recuperação não identificado. Solicite um novo link.');
    return;
  }

  const novaSenha = resetNovaSenha.value;
  const confirmaSenha = resetConfirmaSenha.value;

  if (!novaSenha || novaSenha.length < 4) {
    showAlert('A nova senha deve ter no mínimo 4 caracteres.');
    return;
  }

  if (novaSenha !== confirmaSenha) {
    showAlert('As senhas não coincidem. Digite a mesma senha em ambos os campos.');
    return;
  }

  btnSubmitReset.disabled = true;
  btnSubmitReset.textContent = 'Atualizando senha...';

  try {
    const res = await api.resetPassword(activeResetToken, novaSenha);
    formReset.reset();
    activeResetToken = null;
    switchTab('login');
    showAlert(res.message || 'Senha alterada com sucesso! Faça login com a nova senha.', 'success');
  } catch (err) {
    showAlert(err.message || 'Erro ao redefinir senha. O link pode ter expirado ou já sido utilizado.');
  } finally {
    btnSubmitReset.disabled = false;
    btnSubmitReset.innerHTML = '<span>Salvar Nova Senha</span>';
  }
}

// ===== LOGOUT =====
async function handleLogout() {
  await api.logout();
  showAuthView();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

// Event Listeners
tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));
btnForgotPassword?.addEventListener('click', () => switchTab('forgot'));
btnForgotBack?.addEventListener('click', () => switchTab('login'));
btnResetBack?.addEventListener('click', () => switchTab('login'));

formLogin?.addEventListener('submit', handleLogin);
formRegister?.addEventListener('submit', handleRegister);
formForgot?.addEventListener('submit', handleForgot);
formReset?.addEventListener('submit', handleReset);
btnLogout?.addEventListener('click', handleLogout);

window.addEventListener('auth:unauthorized', () => {
  showAuthView();
});

// Inicialização: Verifica parâmetros de URL (Token de Reset) e Sessão Ativa
export async function initAuth() {
  // 1. Verifica se o usuário chegou clicando no link de recuperação de senha (?reset_token=...)
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');

  if (resetToken) {
    // Limpa a URL visível mantendo o token na memória
    window.history.replaceState({}, document.title, window.location.pathname);
    
    showAuthView();
    showAlert('Verificando token de recuperação...', 'info');

    try {
      const check = await api.verifyResetToken(resetToken);
      activeResetToken = resetToken;
      switchTab('reset');
      if (resetTokenInfo) {
        resetTokenInfo.textContent = `Redefinindo senha da conta: ${check.email || ''}`;
      }
      hideAlert();
      return;
    } catch (err) {
      switchTab('login');
      showAlert(err.message || 'Link de recuperação inválido ou expirado (limite de 30 minutos).', 'danger');
      return;
    }
  }

  // 2. Verifica se já há sessão ativa salva
  const token = api.getToken();
  const user = api.getUser();

  if (token && user) {
    try {
      const res = await api.me();
      showAppView(res.user);
      window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
    } catch {
      api.clearSession();
      showAuthView();
    }
  } else {
    showAuthView();
  }
}
