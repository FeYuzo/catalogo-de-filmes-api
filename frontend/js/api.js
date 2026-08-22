/**
 * Módulo de Integração com a API Backend
 * Gerencia tokens de autenticação e requisições HTTP
 */

const API_BASE = '/api';

export const api = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },

  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
      this.clearSession();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Erro ${response.status}: Falha na requisição`;
      throw new Error(errorMsg);
    }

    return data;
  },

  // ===== AUTH =====
  async register(nome, email, senha) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async login(email, senha) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async me() {
    return this.request('/auth/me');
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Erro ao notificar logout no backend:', e);
    } finally {
      this.clearSession();
    }
  },

  // ===== MOVIES =====
  async getMovies(forceRefresh = false) {
    const query = forceRefresh ? '?refresh=true' : '';
    return this.request(`/movies${query}`);
  },

  async getMovie(id) {
    return this.request(`/movies/${id}`);
  },

  // ===== FAVORITES =====
  async getFavorites() {
    return this.request('/favorites');
  },

  async addFavorite(movie) {
    return this.request('/favorites', {
      method: 'POST',
      body: JSON.stringify({
        tmdb_movie_id: movie.id,
        titulo: movie.title,
        poster_path: movie.poster_path
      })
    });
  },

  async removeFavorite(tmdbMovieId) {
    return this.request(`/favorites/${tmdbMovieId}`, {
      method: 'DELETE'
    });
  },

  // ===== COMMENTS =====
  async getMovieComments(tmdbMovieId) {
    return this.request(`/movies/${tmdbMovieId}/comments`);
  },

  async addComment(tmdbMovieId, texto) {
    return this.request(`/movies/${tmdbMovieId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ texto })
    });
  },

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
  }
};
