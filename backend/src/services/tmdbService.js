import dotenv from 'dotenv';

dotenv.config();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

let cachedPersonId = null;
let cachedMovies = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de cache em memória

/**
 * Retorna os headers ou parâmetros de autenticação da TMDB.
 */
function getTmdbAuth() {
  const apiKey = process.env.TMDB_API_KEY || process.env.TMDB_TOKEN;
  if (!apiKey) {
    throw new Error('Chave da API da TMDB não configurada. Defina TMDB_API_KEY nas variáveis de ambiente do servidor.');
  }

  // Verifica se é um token v4 (Bearer token) ou chave v3
  if (apiKey.startsWith('eyJ') || apiKey.length > 50) {
    return {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      params: ''
    };
  }

  return {
    headers: {
      'Content-Type': 'application/json'
    },
    params: `api_key=${apiKey}`
  };
}

/**
 * Busca o person_id de Tom Hanks na API do TMDB.
 * Rota: GET /search/person?query=Tom+Hanks
 */
export async function getTomHanksPersonId() {
  if (cachedPersonId) {
    return cachedPersonId;
  }

  const auth = getTmdbAuth();
  const queryParam = auth.params ? `&${auth.params}` : '';
  const url = `${TMDB_BASE_URL}/search/person?query=Tom+Hanks&language=pt-BR${queryParam}`;

  const response = await fetch(url, { headers: auth.headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar Tom Hanks na TMDB: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    // Fallback para o ID conhecido de Tom Hanks na TMDB
    cachedPersonId = 31;
    return cachedPersonId;
  }

  // Encontra o Tom Hanks mais relevante
  const tomHanks = data.results.find(
    (p) => p.name.toLowerCase() === 'tom hanks'
  ) || data.results[0];

  cachedPersonId = tomHanks.id;
  return cachedPersonId;
}

/**
 * Busca os filmes de Tom Hanks na API do TMDB.
 * Rota: GET /person/{person_id}/movie_credits
 */
export async function getTomHanksMovies(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedMovies && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedMovies;
  }

  const personId = await getTomHanksPersonId();
  const auth = getTmdbAuth();
  const queryParam = auth.params ? `&${auth.params}` : '';
  const url = `${TMDB_BASE_URL}/person/${personId}/movie_credits?language=pt-BR${queryParam}`;

  const response = await fetch(url, { headers: auth.headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar créditos de filmes na TMDB: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const cast = data.cast || [];

  // Mapeia e remove duplicatas (caso o ator apareça mais de uma vez)
  const movieMap = new Map();

  for (const movie of cast) {
    if (!movie.id || !movie.title) continue;

    if (!movieMap.has(movie.id)) {
      const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
      movieMap.set(movie.id, {
        id: movie.id,
        title: movie.title,
        original_title: movie.original_title || movie.title,
        overview: movie.overview || 'Sinopse não disponível em português.',
        poster_path: movie.poster_path || null,
        poster_url: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : null,
        backdrop_path: movie.backdrop_path || null,
        backdrop_url: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : null,
        release_date: movie.release_date || null,
        release_year: releaseYear,
        character: movie.character || '',
        vote_average: typeof movie.vote_average === 'number' ? Number(movie.vote_average.toFixed(1)) : 0,
        vote_count: movie.vote_count || 0,
        popularity: movie.popularity || 0
      });
    }
  }

  // Ordena por popularidade/lançamento por padrão
  const movieList = Array.from(movieMap.values()).sort((a, b) => {
    if (a.release_date && b.release_date) {
      return b.release_date.localeCompare(a.release_date);
    }
    return b.popularity - a.popularity;
  });

  cachedMovies = movieList;
  cacheTimestamp = now;

  return movieList;
}
