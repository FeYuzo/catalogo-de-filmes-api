/**
 * Módulo de Autenticação no Frontend
 * Gerencia a tela de login/cadastro e a transição para o catálogo
 */

import { api } from './api.js';

const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const userNav = document.getElementById('user-nav');
const navUserName = document.getElementById('nav-user-name');
const btnLogout = document.getElementById('btn-logout');

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const authAlert = document.getElementById('auth-alert');

const loginEmail = document.getElementById('login-email');
const loginSenha = document.getElementById('login-senha');
const btnSubmitLogin = document.getElementById('btn-submit-login');

const registerNome = document.getElementById('register-nome');
const registerEmail = document.getElementById('register-email');
const registerSenha = document.getElementById('register-senha');
const btnSubmitRegister = document.getElementById('btn-submit-register');

function showAlert(message, type = 'danger') {
  authAlert.textContent = message;
  authAlert.className = `alert alert-${type}`;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  authAlert.classList.add('hidden');
  authAlert.textContent = '';
}

function switchTab(activeTab) {
  hideAlert();
  if (activeTab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
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
}

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

async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const nome = registerNome.value.trim();
  const email = registerEmail.value.trim();
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
    const data = await api.register(nome, email, senha);
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

async function handleLogout() {
  await api.logout();
  showAuthView();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

// Event Listeners
tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));
formLogin?.addEventListener('submit', handleLogin);
formRegister?.addEventListener('submit', handleRegister);
btnLogout?.addEventListener('click', handleLogout);

window.addEventListener('auth:unauthorized', () => {
  showAuthView();
});

// Inicialização: Verifica se já há sessão ativa
export async function initAuth() {
  const token = api.getToken();
  const user = api.getUser();

  if (token && user) {
    try {
      // Valida token com o backend
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
