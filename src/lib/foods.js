// Wrapper para Open Food Facts + TBCA local.
// A TBCA também é usada para validar/corrigir itens identificados pela IA.

const BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
const TBCA_URL = '/tbca.json';

let _tbcaCache = null;
let _tbcaLoading = null;

async function loadTBCA() {
  if (_tbcaCache) return _tbcaCache;
  if (_tbcaLoading) return _tbcaLoading;

  _tbcaLoading = fetch(TBCA_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`TBCA: HTTP ${r.status}`);
      return r.json();
    })
    .then((arr) => {
      if (!Array.isArray(arr)) throw new Error('TBCA: JSON inválido');
      _tbcaCache = arr;
      return arr;
    })
    .catch((e) => {
      _tbcaLoading = null;
      throw e;
    });

  return _tbcaLoading;
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const STOP_WORDS = new Set([
  'de','da','do','das','dos','com','sem','em','ao','aos','na','no','nas','nos',
  'um','uma','para','por','tipo','caseiro','caseira',
]);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function preparationBonus(query, candidate) {
  const q = norm(query);
  const c = norm(candidate);
  const prepTerms = ['cozido','cozida','cru','crua','grelhado','grelhada','assado','assada','frito','frita','integral','desnatado','desnatada'];
  let score = 0;
  for (const term of prepTerms) {
    const qHas = q.includes(term);
    const cHas = c.includes(term);
    if (qHas && cHas) score += 0.08;
    else if (qHas && !cHas) score -= 0.06;
  }
  return score;
}

function similarity(query, candidate) {
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;

  let score = 0;
  if (c.startsWith(q) || q.startsWith(c)) score += 0.52;
  else if (c.includes(q) || q.includes(c)) score += 0.4;

  const qTokens = tokens(q);
  const cTokens = new Set(tokens(c));
  if (qTokens.length) {
    const hits = qTokens.filter((token) => cTokens.has(token)).length;
    score += (hits / qTokens.length) * 0.48;
  }

  score += preparationBonus(q, c);
  return Math.max(0, Math.min(1, score));
}

function mapTBCAItem(it, score = null) {
  return {
    id: it.id,
    name: it.name,
    brand: 'TBCA',
    kcalPer100g: Number(it.kcalPer100g) || 0,
    proteinPer100g: Number(it.proteinPer100g ?? it.protein ?? 0) || 0,
    carbsPer100g: Number(it.carbsPer100g ?? it.carbs ?? 0) || 0,
    fatPer100g: Number(it.fatPer100g ?? it.fat ?? 0) || 0,
    source: 'tbca',
    matchScore: score,
  };
}

export async function searchTBCA(query, { limit = 8 } = {}) {
  const q = norm(String(query || '').trim());
  if (q.length < 2) return [];

  let arr;
  try {
    arr = await loadTBCA();
  } catch {
    return [];
  }

  return arr
    .map((item) => ({ item, score: similarity(q, item.name) }))
    .filter(({ item, score }) => Number(item.kcalPer100g) > 0 && score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => mapTBCAItem(item, score));
}

// Resolve um item da IA contra a TBCA. Só substitui valores quando o match
// é forte o bastante para não transformar uma correção em outro chute.
export async function resolveTBCAFood(query, { minScore = 0.68 } = {}) {
  const matches = await searchTBCA(query, { limit: 5 });
  const best = matches[0];
  if (!best || Number(best.matchScore || 0) < minScore) return null;
  return best;
}

export function prefetchTBCA() {
  loadTBCA().catch(() => {});
}

export async function searchFoods(query, { limit = 10, signal } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    search_terms: q,
    page_size: String(limit),
    json: '1',
    fields: 'code,product_name,product_name_pt,brands,nutriments,energy_kcal_100g',
    nutriments_100g: '1',
  });

  const res = await fetch(`${BASE}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  const data = await res.json();

  return (data.products || [])
    .map((p) => {
      const name = p.product_name_pt || p.product_name || p.generic_name || p.product_name_en;
      const kcal = Number(
        p.nutriments?.['energy-kcal_100g'] ??
        p.nutriments?.energy_kcal ??
        p.nutriments?.energy ??
        0
      );
      return {
        id: p.code,
        name: (name || '').trim() || '(sem nome)',
        brand: p.brands || '',
        kcalPer100g: Number.isFinite(kcal) ? Math.round(kcal) : 0,
        source: 'off',
      };
    })
    .filter((p) => p.name && p.kcalPer100g > 0)
    .slice(0, limit);
}
