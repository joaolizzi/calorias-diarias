// Wrapper minimalista para Open Food Facts (gratuita, sem chave).
// Doc: https://openfoodfacts.github.io/openfoodfacts-server/api/

const BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
const TBCA_URL = '/tbca.json';

// TBCA local: carregada sob demanda e cacheada em módulo. O JSON é gerado
// por `npm run build:tbca` (scripts/build-tbca.mjs) e copiado para /public.
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

// Normaliza termo para busca: lowercase + remove diacríticos (Unicode
// "Combining Diacritical Marks" — U+0300..U+036F). Range escrito em código
// para evitar que o regex vire vazio após transporte por pipelines que
// colapsam intervalos Unicode.
const COMBINING_MARKS = /[̀-ͯ]/g;
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

// Busca local na TBCA. Filtro por substring; ranqueia por match no início do
// nome (mais útil para o usuário) e, em empate, mantém a ordem alfabética
// original do JSON.
export async function searchTBCA(query, { limit = 8 } = {}) {
  const q = norm(String(query || '').trim());
  if (q.length < 2) return [];
  let arr;
  try {
    arr = await loadTBCA();
  } catch {
    return [];
  }
  const startsWith = [];
  const contains = [];
  const cap = limit * 4;
  for (const item of arr) {
    const name = norm(item.name);
    if (!name) continue;
    if (name.startsWith(q)) startsWith.push(item);
    else if (name.includes(q)) contains.push(item);
    if (startsWith.length >= cap && contains.length >= cap) break;
  }
  return startsWith.concat(contains).slice(0, limit).map((it) => ({
    id: it.id,
    name: it.name,
    brand: 'TBCA',
    kcalPer100g: Number(it.kcalPer100g) || 0,
    source: 'tbca',
  }));
}

// Pre-aquece a TBCA em background (chamado no boot do app) para que a
// primeira busca seja instantânea.
export function prefetchTBCA() {
  loadTBCA().catch(() => { /* silencioso */ });
}

// Retorna até `limit` resultados normalizados:
// { id, name, brand, kcalPer100g, source: 'off' }
export async function searchFoods(query, { limit = 10, signal } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    search_terms: q,
    page_size: String(limit),
    json: '1',
    fields:
      'code,product_name,product_name_pt,brands,nutriments,energy_kcal_100g',
    // força busca em produtos com info nutricional
    nutriments_100g: '1',
  });
  const url = `${BASE}?${params.toString()}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  const data = await res.json();
  const products = data.products || [];

  return products
    .map((p) => {
      const name =
        p.product_name_pt || p.product_name || p.generic_name || p.product_name_en;
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
