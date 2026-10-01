/**
 * Módulo Principal da Aplicação (Catálogo, Favoritos e Comentários)
 */

import { api } from './api.js';
import { initAuth, updateNavUserAvatar } from './auth.js';

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

// Modal de Perfil de Usuário
const profileModal = document.getElementById('profile-modal');
const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
const profileModalTitle = document.getElementById('profile-modal-title');
const profileAvatarImg = document.getElementById('profile-avatar-img');
const profileAvatarFallback = document.getElementById('profile-avatar-fallback');
const profilePhotoControls = document.getElementById('profile-photo-controls');
const inputProfilePhoto = document.getElementById('input-profile-photo');
const uploadPhotoSpinner = document.getElementById('upload-photo-spinner');
const profileDisplayName = document.getElementById('profile-display-name');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profileEmail = document.getElementById('profile-email');
const profileCreatedAt = document.getElementById('profile-created-at');
const profileBioContainer = document.getElementById('profile-bio-container');
const profileBioText = document.getElementById('profile-bio-text');
const profileOwnerActions = document.getElementById('profile-owner-actions');
const btnToggleEditProfile = document.getElementById('btn-toggle-edit-profile');
const formEditProfile = document.getElementById('form-edit-profile');
const editProfileName = document.getElementById('edit-profile-name');
const editProfileBio = document.getElementById('edit-profile-bio');
const editBioCounter = document.getElementById('edit-bio-counter');
const btnSaveProfile = document.getElementById('btn-save-profile');
const btnCancelEditProfile = document.getElementById('btn-cancel-edit-profile');
const profileAlert = document.getElementById('profile-alert');
const profileFavsCount = document.getElementById('profile-favs-count');
const profileFavsList = document.getElementById('profile-favs-list');
const profileFavsEmpty = document.getElementById('profile-favs-empty');
const btnOpenMyProfile = document.getElementById('btn-open-my-profile');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Estado da Aplicação
let moviesState = [];
let currentFilter = 'all'; // 'all' | 'favorites'
let currentSearch = '';
let currentSort = 'year-desc';
let activeMovieForModal = null;
let activeProfileUserId = 'me';
let activeProfileData = null;

/**
 * Exibe notificação Toast
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  if (type === 'success') {
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  }
  if (type === 'error') {
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  }

  toast.innerHTML = `<span class="toast-icon-wrapper">${iconSvg}</span> <span>${message}</span>`;
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
      emptyDesc.textContent = 'Clique no botão de favoritar em qualquer filme para adicioná-lo aos seus favoritos.';
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

    const posterFallback = `<div class="poster-fallback">
      <svg class="poster-fallback-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m9 8 6 4-6 4Z"></path></svg>
      <span>Sem pôster</span>
    </div>`;

    const posterMarkup = movie.poster_url
      ? `<img src="${movie.poster_url}" alt="${movie.title}" class="movie-poster" loading="lazy" onerror="this.parentElement.innerHTML=\`${posterFallback}\`">`
      : posterFallback;

    const ratingBadge = movie.vote_average > 0
      ? `<div class="badge-rating">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          ${movie.vote_average.toFixed(1)}
        </div>`
      : '';

    const yearBadge = movie.release_year && movie.release_year !== 'N/A'
      ? `<div class="badge-year">${movie.release_year}</div>`
      : '';

    const characterText = movie.character
      ? `<div class="movie-character">como ${escapeHtml(movie.character)}</div>`
      : '';

    const favIconSvg = movie.is_favorite
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

    const favButtonClass = movie.is_favorite ? 'btn-action btn-fav is-favorite' : 'btn-action btn-fav';
    const favButtonText = movie.is_favorite ? 'Favorito' : 'Favoritar';

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
            ${favIconSvg}
            <span>${favButtonText}</span>
          </button>
          <button class="btn-action btn-comments" data-action="open-comments" title="Ver ou adicionar comentários">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Notas</span>
            <span class="badge comments-badge">${movie.comments_count || 0}</span>
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
        Nenhum comentário adicionado ainda. Seja o primeiro a comentar!
      </div>
    `;
    return;
  }

  const currentUser = api.getUser();

  commentsList.innerHTML = '';
  comments.forEach((comment) => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const isOwn = currentUser && (currentUser.id === comment.usuario_id);
    const canDelete = isOwn || (currentUser && currentUser.role === 'admin');

    const authorDisplay = isOwn
      ? `${escapeHtml(comment.autor_nome || 'Você')} (Você)`
      : escapeHtml(comment.autor_nome || 'Usuário');

    const authorBadge = ` • <button type="button" class="comment-author-btn" data-author-id="${comment.usuario_id}" title="Ver perfil de ${authorDisplay}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-right: 3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><strong>${authorDisplay}</strong></button>`;

    const deleteBtnHtml = canDelete
      ? `<button class="btn-delete-comment" title="${isOwn ? 'Excluir seu comentário' : 'Excluir comentário (Moderação)'}" data-comment-id="${comment.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>`
      : '';

    item.innerHTML = `
      <div class="comment-item-content">
        <p class="comment-text">${escapeHtml(comment.texto)}</p>
        <div class="comment-date">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-right: 3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${formatDate(comment.criado_em)}${authorBadge}
        </div>
      </div>
      ${deleteBtnHtml}
    `;

    const btnAuthor = item.querySelector('.comment-author-btn');
    btnAuthor?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileModal(comment.usuario_id);
    });

    if (canDelete) {
      const btnDelete = item.querySelector('.btn-delete-comment');
      btnDelete?.addEventListener('click', () => handleDeleteComment(comment.id));
    }

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

// ================= PERFIL DE USUÁRIO (OBJECT STORAGE & DADOS) =================

/**
 * Abre o Modal de Perfil do Usuário
 * @param {string|number} userId - 'me' ou o ID numérico do usuário
 */
async function openProfileModal(userId = 'me') {
  activeProfileUserId = userId;
  profileModal?.classList.remove('hidden');
  resetProfileModalUI();

  try {
    const data = await api.getProfile(userId);
    const profile = data.profile;
    activeProfileData = profile;
    renderProfileData(profile);
  } catch (err) {
    showToast(err.message || 'Erro ao carregar dados do perfil.', 'error');
    closeProfileModal();
  }
}

function closeProfileModal() {
  profileModal?.classList.add('hidden');
  resetProfileModalUI();
  activeProfileData = null;
}

function resetProfileModalUI() {
  formEditProfile?.classList.add('hidden');
  profileBioContainer?.classList.remove('hidden');
  profileAlert?.classList.add('hidden');
  if (profileAlert) profileAlert.textContent = '';
  if (inputProfilePhoto) inputProfilePhoto.value = '';
}

function renderProfileData(profile) {
  if (!profile) return;

  const isOwner = !!profile.is_owner;

  // Título e identificação básica
  if (profileModalTitle) {
    profileModalTitle.textContent = isOwner ? 'Meu Perfil' : `Perfil de ${profile.nome}`;
  }
  if (profileDisplayName) profileDisplayName.textContent = profile.nome;
  if (profileEmail) {
    profileEmail.innerHTML = profile.email
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>${escapeHtml(profile.email)}`
      : '';
  }
  if (profileCreatedAt) {
    profileCreatedAt.innerHTML = profile.criado_em
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><rect width="18" height="18" x="3" y="4" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>Membro desde ${formatDate(profile.criado_em).split(' ')[0]}`
      : '';
  }

  // Role Badge
  if (profileRoleBadge) {
    const role = profile.role || 'usuario';
    profileRoleBadge.textContent = role === 'admin' ? 'Admin' : 'Usuário';
    profileRoleBadge.className = `user-role-badge role-${role}`;
  }

  // Foto de Perfil
  if (profile.foto_url) {
    profileAvatarImg.src = profile.foto_url;
    profileAvatarImg.classList.remove('hidden');
    profileAvatarFallback.classList.add('hidden');
  } else {
    profileAvatarImg.classList.add('hidden');
    profileAvatarFallback.classList.remove('hidden');
  }

  // Bio
  if (profileBioText) {
    profileBioText.textContent = profile.bio ? profile.bio : 'Sem biografia cadastrada ainda.';
  }

  // Controles exclusivos do proprietário (IDOR defense no frontend também)
  if (isOwner) {
    profilePhotoControls?.classList.remove('hidden');
    profileOwnerActions?.classList.remove('hidden');
    if (editProfileName) editProfileName.value = profile.nome;
    if (editProfileBio) {
      editProfileBio.value = profile.bio || '';
      if (editBioCounter) editBioCounter.textContent = `${(profile.bio || '').length}/500`;
    }

    // Sincroniza foto no navbar e no cache local
    if (profile.foto_url) {
      updateNavUserAvatar(profile.foto_url);
      const user = api.getUser();
      if (user) {
        user.foto_url = profile.foto_url;
        user.foto_perfil = profile.foto_perfil;
        api.setUser(user);
      }
    }
  } else {
    profilePhotoControls?.classList.add('hidden');
    profileOwnerActions?.classList.add('hidden');
    formEditProfile?.classList.add('hidden');
  }

  // Filmes Favoritados
  renderProfileFavorites(profile.favoritos || []);
}

function renderProfileFavorites(favorites) {
  if (!profileFavsList || !profileFavsCount || !profileFavsEmpty) return;

  profileFavsCount.textContent = favorites.length;

  if (favorites.length === 0) {
    profileFavsList.innerHTML = '';
    profileFavsEmpty.classList.remove('hidden');
    return;
  }

  profileFavsEmpty.classList.add('hidden');
  profileFavsList.innerHTML = '';

  favorites.forEach((fav) => {
    const item = document.createElement('div');
    item.className = 'profile-fav-item';
    item.title = `Ver comentários de ${fav.titulo}`;

    const posterSrc = fav.poster_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150"><rect width="100" height="150" fill="%23222"/><text x="50" y="75" fill="%23888" text-anchor="middle">Sem foto</text></svg>';

    item.innerHTML = `
      <img src="${posterSrc}" alt="${escapeHtml(fav.titulo)}" class="profile-fav-poster" loading="lazy">
      <div class="profile-fav-info">
        <span class="profile-fav-title">${escapeHtml(fav.titulo)}</span>
        <div class="profile-fav-meta">
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            ${fav.comments_count || 0}
          </span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      closeProfileModal();
      const movie = moviesState.find(m => m.id === fav.tmdb_movie_id);
      if (movie) {
        openCommentsModal(movie);
      } else {
        openCommentsModal({
          id: fav.tmdb_movie_id,
          title: fav.titulo,
          poster_path: fav.poster_path,
          release_date: fav.criado_em
        });
      }
    });

    profileFavsList.appendChild(item);
  });
}

/**
 * Upload de Foto de Perfil para o MinIO
 */
async function handlePhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validação de Tamanho no Frontend (máx 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showToast('A imagem excede o tamanho máximo de 5MB.', 'error');
    inputProfilePhoto.value = '';
    return;
  }

  // Validação de formato de arquivo no Frontend
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    showToast('Tipo de arquivo não permitido. Envie JPEG, PNG, WebP ou GIF.', 'error');
    inputProfilePhoto.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('foto', file);

  try {
    uploadPhotoSpinner?.classList.remove('hidden');
    const result = await api.uploadProfilePhoto(formData, activeProfileUserId);

    showToast('Foto de perfil salva com sucesso no MinIO!', 'success');

    if (result.foto_url) {
      profileAvatarImg.src = result.foto_url;
      profileAvatarImg.classList.remove('hidden');
      profileAvatarFallback.classList.add('hidden');
      
      // Atualiza thumbnail no navbar
      updateNavUserAvatar(result.foto_url);

      // Atualiza usuário salvo no localStorage
      const user = api.getUser();
      if (user) {
        user.foto_url = result.foto_url;
        user.foto_perfil = result.foto_perfil;
        api.setUser(user);
      }
    }
  } catch (err) {
    showToast(err.message || 'Falha no upload da foto.', 'error');
  } finally {
    uploadPhotoSpinner?.classList.add('hidden');
    inputProfilePhoto.value = '';
  }
}

/**
 * Salva alterações de nome e bio
 */
async function handleProfileSave(e) {
  e.preventDefault();
  const nome = editProfileName.value.trim();
  const bio = editProfileBio.value.trim();

  if (!nome || nome.length < 2) {
    showToast('O nome deve conter pelo menos 2 caracteres.', 'error');
    return;
  }

  btnSaveProfile.disabled = true;
  btnSaveProfile.textContent = 'Salvando...';

  try {
    const result = await api.updateProfile({ nome, bio }, activeProfileUserId);
    showToast('Perfil atualizado com sucesso!', 'success');

    profileDisplayName.textContent = nome;
    profileBioText.textContent = bio || 'Sem biografia cadastrada ainda.';
    formEditProfile.classList.add('hidden');
    profileBioContainer.classList.remove('hidden');

    const navUserName = document.getElementById('nav-user-name');
    if (navUserName) navUserName.textContent = nome;

    const user = api.getUser();
    if (user) {
      user.nome = nome;
      user.bio = bio;
      api.setUser(user);
    }
  } catch (err) {
    showToast(err.message || 'Erro ao salvar perfil.', 'error');
  } finally {
    btnSaveProfile.disabled = false;
    btnSaveProfile.innerHTML = '<span>Salvar Alterações</span>';
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

// Modal de Perfil Events
btnOpenMyProfile?.addEventListener('click', () => openProfileModal('me'));
btnCloseProfileModal?.addEventListener('click', closeProfileModal);
profileModal?.addEventListener('click', (e) => {
  if (e.target === profileModal) closeProfileModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !profileModal.classList.contains('hidden')) {
    closeProfileModal();
  }
});
btnToggleEditProfile?.addEventListener('click', () => {
  formEditProfile.classList.toggle('hidden');
  profileBioContainer.classList.toggle('hidden');
});
btnCancelEditProfile?.addEventListener('click', () => {
  formEditProfile.classList.add('hidden');
  profileBioContainer.classList.remove('hidden');
});
editProfileBio?.addEventListener('input', (e) => {
  if (editBioCounter) editBioCounter.textContent = `${e.target.value.length}/500`;
});
inputProfilePhoto?.addEventListener('change', handlePhotoUpload);
formEditProfile?.addEventListener('submit', handleProfileSave);

// Autenticação Eventos
window.addEventListener('auth:login', () => {
  loadMovies();
});

window.addEventListener('auth:logout', () => {
  moviesState = [];
  closeCommentsModal();
  closeProfileModal();
});

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
