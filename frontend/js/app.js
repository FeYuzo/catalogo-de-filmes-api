/**
 * Módulo Principal da Aplicação (Catálogo, Favoritos e Comentários)
 */

import { api } from './api.js';
import { initAuth } from './auth.js';

// Elementos da Interface
const moviesGrid = document.getElementById('movies-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptyDesc = document.getElementById('empty-desc');
const catalogAlert = document.getElementById('catalog-alert');

const filterAllBtn = document.getElementById('filter-all');
const filterFavBtn = document.getElementById('filter-favorites');
const badgeAllCount = document.getElementById('badge-all-count');
const badgeFavCount = document.getElementById('badge-fav-count');

const inputSearch = document.getElementById('input-search');
const btnClearSearch = document.getElementById('btn-clear-search');
const selectSort = document.getElementById('select-sort');

// Modal de Comentários
const commentsModal = document.getElementById('comments-modal');
const modalPoster = document.getElementById('modal-poster');
const modalTitle = document.getElementById('modal-title');
const modalYear = document.getElementById('modal-year');
const modalCommentsCount = document.getElementById('modal-comments-count');
const formAddComment = document.getElementById('form-add-comment');
const commentText = document.getElementById('comment-text');
const btnSaveComment = document.getElementById('btn-save-comment');
const commentsList = document.getElementById('comments-list');
const btnCloseModal = document.getElementById('btn-close-modal');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Estado da Aplicação
let moviesState = [];
let currentFilter = 'all'; // 'all' | 'favorites'
let currentSearch = '';
let currentSort = 'year-desc';
let activeMovieForModal = null;

/**
 * Exibe notificação Toast
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Formata data no padrão brasileiro
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Carrega lista de filmes do backend
 */
async function loadMovies(forceRefresh = false) {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  moviesGrid.innerHTML = '';
  catalogAlert.classList.add('hidden');

  try {
    const data = await api.getMovies(forceRefresh);
    moviesState = data.movies || [];
    renderCatalog();
  } catch (err) {
    console.error('Erro ao carregar catálogo:', err);
    catalogAlert.textContent = `Aviso: ${err.message || 'Falha ao buscar catálogo de filmes na TMDB.'}`;
    catalogAlert.className = 'alert alert-danger';
    catalogAlert.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

/**
 * Filtra e ordena os filmes conforme o estado atual
 */
function getFilteredAndSortedMovies() {
  let list = [...moviesState];

  // 1. Filtro por Aba (Todos / Favoritos)
  if (currentFilter === 'favorites') {
    list = list.filter((m) => m.is_favorite);
  }

  // 2. Filtro por Busca (Texto)
  if (currentSearch.trim() !== '') {
    const term = currentSearch.toLowerCase().trim();
    list = list.filter((m) => {
      const matchTitle = m.title?.toLowerCase().includes(term);
      const matchOriginal = m.original_title?.toLowerCase().includes(term);
      const matchChar = m.character?.toLowerCase().includes(term);
      const matchOverview = m.overview?.toLowerCase().includes(term);
      return matchTitle || matchOriginal || matchChar || matchOverview;
    });
  }

  // 3. Ordenação
  list.sort((a, b) => {
    if (currentSort === 'year-desc') {
      const yearA = parseInt(a.release_year, 10) || 0;
      const yearB = parseInt(b.release_year, 10) || 0;
      return yearB - yearA;
    }
    if (currentSort === 'year-asc') {
      const yearA = parseInt(a.release_year, 10) || 0;
      const yearB = parseInt(b.release_year, 10) || 0;
      return yearA - yearB;
    }
    if (currentSort === 'rating-desc') {
      return (b.vote_average || 0) - (a.vote_average || 0);
    }
    if (currentSort === 'title-asc') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });

  return list;
}

/**
 * Renderiza o catálogo na tela
 */
function renderCatalog() {
  const filtered = getFilteredAndSortedMovies();
  
  // Atualiza contadores nas abas
  const totalFavs = moviesState.filter((m) => m.is_favorite).length;
  badgeAllCount.textContent = moviesState.length;
  badgeFavCount.textContent = totalFavs;

  moviesGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (currentFilter === 'favorites') {
      emptyTitle.textContent = 'Nenhum filme favoritado';
      emptyDesc.textContent = 'Clique na estrela ⭐ de qualquer filme para adicioná-lo aos seus favoritos.';
    } else {
      emptyTitle.textContent = 'Nenhum filme encontrado';
      emptyDesc.textContent = `Nenhum resultado para a busca "${currentSearch}".`;
    }
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach((movie) => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.movieId = movie.id;

    const posterMarkup = movie.poster_url
      ? `<img src="${movie.poster_url}" alt="${movie.title}" class="movie-poster" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-fallback\\'><span class=\\'poster-fallback-icon\\'>🎬</span><span>Sem pôster</span></div>'">`
      : `<div class="poster-fallback"><span class="poster-fallback-icon">🎬</span><span>Sem pôster</span></div>`;

    const ratingBadge = movie.vote_average > 0
      ? `<div class="badge-rating">⭐ ${movie.vote_average.toFixed(1)}</div>`
      : '';

    const yearBadge = movie.release_year && movie.release_year !== 'N/A'
      ? `<div class="badge-year">${movie.release_year}</div>`
      : '';

    const characterText = movie.character
      ? `<div class="movie-character">🎭 ${escapeHtml(movie.character)}</div>`
      : '';

    const favButtonClass = movie.is_favorite ? 'btn-action btn-fav is-favorite' : 'btn-action btn-fav';
    const favButtonText = movie.is_favorite ? '⭐ Favorito' : '☆ Favoritar';

    card.innerHTML = `
      <div class="poster-container">
        ${posterMarkup}
        ${ratingBadge}
        ${yearBadge}
      </div>
      <div class="movie-details">
        <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
        ${characterText}
        <p class="movie-synopsis">${escapeHtml(movie.overview)}</p>
        <div class="movie-actions">
          <button class="${favButtonClass}" data-action="toggle-fav" title="Favoritar este filme">
            ${favButtonText}
          </button>
          <button class="btn-action btn-comments" data-action="open-comments" title="Ver ou adicionar comentários">
            💬 Notas <span class="badge comments-badge">${movie.comments_count || 0}</span>
          </button>
        </div>
      </div>
    `;

    // Eventos nos botões do Card
    const btnFav = card.querySelector('[data-action="toggle-fav"]');
    btnFav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(movie);
    });

    const btnComments = card.querySelector('[data-action="open-comments"]');
    btnComments.addEventListener('click', (e) => {
      e.stopPropagation();
      openCommentsModal(movie);
    });

    moviesGrid.appendChild(card);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Alterna favorito (Adicionar / Remover)
 */
async function toggleFavorite(movie) {
  const isCurrentlyFav = movie.is_favorite;

  // Atualização otimista na interface
  movie.is_favorite = !isCurrentlyFav;
  renderCatalog();

  try {
    if (isCurrentlyFav) {
      await api.removeFavorite(movie.id);
      showToast(`"${movie.title}" removido dos favoritos.`, 'info');
    } else {
      await api.addFavorite(movie);
      showToast(`"${movie.title}" adicionado aos favoritos!`, 'success');
    }
  } catch (err) {
    // Reverte em caso de falha
    movie.is_favorite = isCurrentlyFav;
    renderCatalog();
    showToast(err.message || 'Erro ao atualizar favoritos.', 'error');
  }
}

/**
 * Abre o Modal de Comentários
 */
async function openCommentsModal(movie) {
  activeMovieForModal = movie;
  modalTitle.textContent = movie.title;
  modalYear.textContent = `${movie.release_year || 'Ano N/A'} · Tom Hanks`;

  if (movie.poster_url) {
    modalPoster.src = movie.poster_url;
    modalPoster.classList.remove('hidden');
  } else {
    modalPoster.classList.add('hidden');
  }

  commentText.value = '';
  commentsList.innerHTML = '<div class="spinner"></div>';
  modalCommentsCount.textContent = '...';
  commentsModal.classList.remove('hidden');

  await loadMovieComments(movie.id);
}

/**
 * Fecha o Modal de Comentários
 */
function closeCommentsModal() {
  commentsModal.classList.add('hidden');
  activeMovieForModal = null;
}

/**
 * Busca comentários de um filme no backend
 */
async function loadMovieComments(movieId) {
  try {
    const res = await api.getMovieComments(movieId);
    const comments = res.comments || [];
    renderModalComments(comments);
    
    // Atualiza contagem no estado local e re-renderiza badges
    if (activeMovieForModal) {
      activeMovieForModal.comments_count = comments.length;
      modalCommentsCount.textContent = comments.length;
      updateMovieCardBadge(activeMovieForModal.id, comments.length);
    }
  } catch (err) {
    commentsList.innerHTML = `<div class="alert alert-danger text-xs">Erro ao carregar comentários: ${err.message}</div>`;
  }
}

/**
 * Renderiza lista de comentários no modal
 */
function renderModalComments(comments) {
  modalCommentsCount.textContent = comments.length;

  if (comments.length === 0) {
    commentsList.innerHTML = `
      <div class="text-center text-muted text-xs" style="padding: 1.5rem 0;">
        Nenhum comentário adicionado ainda. Escreva suas anotações acima!
      </div>
    `;
    return;
  }

  commentsList.innerHTML = '';
  comments.forEach((comment) => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-item-content">
        <p class="comment-text">${escapeHtml(comment.texto)}</p>
        <div class="comment-date">📅 ${formatDate(comment.criado_em)}</div>
      </div>
      <button class="btn-delete-comment" title="Excluir este comentário" data-comment-id="${comment.id}">
        🗑️
      </button>
    `;

    const btnDelete = item.querySelector('.btn-delete-comment');
    btnDelete.addEventListener('click', () => handleDeleteComment(comment.id));

    commentsList.appendChild(item);
  });
}

/**
 * Adiciona novo comentário
 */
async function handleAddComment(e) {
  e.preventDefault();
  if (!activeMovieForModal) return;

  const texto = commentText.value.trim();
  if (!texto) return;

  btnSaveComment.disabled = true;
  btnSaveComment.textContent = 'Salvando...';

  try {
    await api.addComment(activeMovieForModal.id, texto);
    commentText.value = '';
    showToast('Comentário salvo com sucesso!', 'success');
    await loadMovieComments(activeMovieForModal.id);
  } catch (err) {
    showToast(err.message || 'Erro ao salvar comentário.', 'error');
  } finally {
    btnSaveComment.disabled = false;
    btnSaveComment.innerHTML = '<span>Salvar Comentário</span>';
  }
}

/**
 * Exclui comentário
 */
async function handleDeleteComment(commentId) {
  if (!confirm('Deseja realmente excluir esta anotação?')) return;

  try {
    await api.deleteComment(commentId);
    showToast('Comentário removido.', 'info');
    if (activeMovieForModal) {
      await loadMovieComments(activeMovieForModal.id);
    }
  } catch (err) {
    showToast(err.message || 'Erro ao excluir comentário.', 'error');
  }
}

function updateMovieCardBadge(movieId, count) {
  const card = document.querySelector(`.movie-card[data-movie-id="${movieId}"]`);
  if (card) {
    const badge = card.querySelector('.comments-badge');
    if (badge) badge.textContent = count;
  }
}

// ================= EVENT LISTENERS =================

// Filtros de Abas
filterAllBtn?.addEventListener('click', () => {
  currentFilter = 'all';
  filterAllBtn.classList.add('active');
  filterFavBtn.classList.remove('active');
  renderCatalog();
});

filterFavBtn?.addEventListener('click', () => {
  currentFilter = 'favorites';
  filterFavBtn.classList.add('active');
  filterAllBtn.classList.remove('active');
  renderCatalog();
});

// Busca por Texto
inputSearch?.addEventListener('input', (e) => {
  currentSearch = e.target.value;
  if (currentSearch.trim() !== '') {
    btnClearSearch.classList.remove('hidden');
  } else {
    btnClearSearch.classList.add('hidden');
  }
  renderCatalog();
});

btnClearSearch?.addEventListener('click', () => {
  inputSearch.value = '';
  currentSearch = '';
  btnClearSearch.classList.add('hidden');
  renderCatalog();
});

// Ordenação
selectSort?.addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderCatalog();
});

// Modal Events
btnCloseModal?.addEventListener('click', closeCommentsModal);
commentsModal?.addEventListener('click', (e) => {
  if (e.target === commentsModal) closeCommentsModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !commentsModal.classList.contains('hidden')) {
    closeCommentsModal();
  }
});
formAddComment?.addEventListener('submit', handleAddComment);

// Autenticação Eventos
window.addEventListener('auth:login', () => {
  loadMovies();
});

window.addEventListener('auth:logout', () => {
  moviesState = [];
  closeCommentsModal();
});

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
