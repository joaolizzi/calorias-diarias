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
    .then((r) => { if (!r.ok) throw new Error(`TBCA: HTTP ${r.status}`); return r.json(); })
    .then((arr) => { if (!Array.isArray(arr)) throw new Error('TBCA: JSON inválido'); _tbcaCache = arr; return arr; })
    .catch((e) => { _tbcaLoading = null; throw e; });
  return _tbcaLoading;
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const STOP_WORDS = new Set([
  'de','da','do','das','dos','com','sem','em','ao','aos','na','no','nas','nos','um','uma','para','por','tipo','caseiro','caseira',
  'e','ou','a','o','as','os',
]);
const UNIT_WORDS = new Set([
  'g','gr','grama','gramas','kg','quilo','quilos','ml','l','litro','litros','unidade','unidades','porcao','porcoes',
]);
const PREP_TERMS = new Set([
  'cozido','cozida','cru','crua','grelhado','grelhada','assado','assada','frito','frita','integral','desnatado','desnatada',
]);
// Ingredientes que normalmente indicam que a entrada virou uma preparação composta.
// Eles só são penalizados quando NÃO aparecem na busca do usuário.
const COMPOSITE_TERMS = new Set([
  'coco','leite','queijo','bacon','carne','frango','ovo','ovos','acucar','manteiga','margarina','farinha','feijao','tomate',
  'cenoura','ervilha','milho','caldo','creme','maionese','molho','linguica','presunto','requeijao','cebola','alho','banana',
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
  return norm(s).split(' ').filter((token) => (
    token.length > 1
    && !STOP_WORDS.has(token)
    && !UNIT_WORDS.has(token)
    && !/^\d+(?:\.\d+)?$/.test(token)
  ));
}

function unique(arr) { return [...new Set(arr)]; }

function contiguousStart(haystack, needles) {
  if (!needles.length || haystack.length < needles.length) return -1;
  for (let start = 0; start <= haystack.length - needles.length; start++) {
    let ok = true;
    for (let i = 0; i < needles.length; i++) {
      if (haystack[start + i] !== needles[i]) { ok = false; break; }
    }
    if (ok) return start;
  }
  return -1;
}

function preparationScore(queryTokens, candidateTokens) {
  const q = new Set(queryTokens);
  const c = new Set(candidateTokens);
  let score = 0;
  for (const term of PREP_TERMS) {
    if (q.has(term) && c.has(term)) score += 0.06;
    else if (q.has(term) && !c.has(term)) score -= 0.1;
  }
  return Math.max(-0.22, Math.min(0.12, score));
}

function matchInfo(query, candidate) {
  const qNorm = norm(query);
  const cNorm = norm(candidate);
  const qTokens = tokens(qNorm);
  const cTokens = tokens(cNorm);
  const qUnique = unique(qTokens);
  const cUnique = unique(cTokens);

  if (!qNorm || !cNorm || !qUnique.length || !cUnique.length) {
    return { score: 0, coverage: 0, precision: 0, extraCount: 99 };
  }
  if (qNorm === cNorm) return { score: 1, coverage: 1, precision: 1, extraCount: 0 };

  const qSet = new Set(qUnique);
  const cSet = new Set(cUnique);
  const matched = qUnique.filter((token) => cSet.has(token));
  const coverage = matched.length / qUnique.length;
  const precision = matched.length / cUnique.length;
  const extraTokens = cUnique.filter((token) => !qSet.has(token));
  const extraCount = extraTokens.length;

  const sequenceStart = contiguousStart(cTokens, qTokens);
  const prefix = sequenceStart === 0;
  const nearStart = sequenceStart === 1;
  const contiguous = sequenceStart >= 0;

  // Ingredientes não pedidos são um forte sinal de prato composto.
  const compositeExtras = extraTokens.filter((token) => COMPOSITE_TERMS.has(token)).length;
  const extraPenalty = Math.min(0.34, extraCount * 0.045);
  const compositePenalty = Math.min(0.28, compositeExtras * 0.055);
  const veryLongPenalty = cTokens.length > Math.max(7, qTokens.length * 3)
    ? Math.min(0.14, (cTokens.length - Math.max(7, qTokens.length * 3)) * 0.012)
    : 0;

  let score = 0;
  score += coverage * 0.52;
  score += precision * 0.18;
  if (prefix) score += 0.18;
  else if (nearStart) score += 0.08;
  if (contiguous) score += 0.08;
  score += preparationScore(qTokens, cTokens);
  score -= extraPenalty;
  score -= compositePenalty;
  score -= veryLongPenalty;

  // Um nome que contém todos os termos e quase nada além deles é especialmente confiável.
  if (coverage === 1 && extraCount <= 1) score += 0.08;

  return {
    score: Math.max(0, Math.min(1, score)),
    coverage,
    precision,
    extraCount,
  };
}

function mapTBCAItem(it, match = null) {
  return {
    id: it.id,
    name: it.name,
    brand: 'TBCA',
    kcalPer100g: Number(it.kcalPer100g) || 0,
    proteinPer100g: Number(it.proteinPer100g ?? it.protein ?? 0) || 0,
    carbsPer100g: Number(it.carbsPer100g ?? it.carbs ?? 0) || 0,
    fatPer100g: Number(it.fatPer100g ?? it.fat ?? 0) || 0,
    category: it.category || '',
    source: 'tbca',
    matchScore: match?.score ?? null,
    matchCoverage: match?.coverage ?? null,
    matchPrecision: match?.precision ?? null,
    matchExtraCount: match?.extraCount ?? null,
  };
}

export async function searchTBCA(query, { limit = 8 } = {}) {
  const q = norm(String(query || '').trim());
  if (q.length < 2) return [];
  let arr;
  try { arr = await loadTBCA(); } catch { return []; }

  return arr
    .map((item) => ({ item, match: matchInfo(q, item.name) }))
    .filter(({ item, match }) => Number(item.kcalPer100g) > 0 && match.score >= 0.3 && match.coverage >= 0.5)
    .sort((a, b) => {
      if (Math.abs(b.match.score - a.match.score) > 0.001) return b.match.score - a.match.score;
      // Empate: o nome mais simples e com menos ingredientes extras vence.
      if (a.match.extraCount !== b.match.extraCount) return a.match.extraCount - b.match.extraCount;
      return String(a.item.name || '').length - String(b.item.name || '').length;
    })
    .slice(0, limit)
    .map(({ item, match }) => mapTBCAItem(item, match));
}

export async function resolveTBCAFood(query, { minScore = 0.68 } = {}) {
  const matches = await searchTBCA(query, { limit: 5 });
  const best = matches[0];
  if (!best) return null;

  // Para a TBCA substituir uma estimativa da IA, exigimos uma correspondência
  // realmente limpa. Isso evita casos como "arroz integral" => "arroz de coco...".
  if (Number(best.matchScore || 0) < minScore) return null;
  if (Number(best.matchCoverage || 0) < 0.8) return null;
  if (Number(best.matchPrecision || 0) < 0.28 && Number(best.matchExtraCount || 0) >= 4) return null;
  return best;
}

export function prefetchTBCA() { loadTBCA().catch(() => {}); }

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
      const nutriments = p.nutriments || {};
      const kcal = Number(nutriments['energy-kcal_100g'] ?? nutriments.energy_kcal ?? nutriments.energy ?? 0);
      const protein = Number(nutriments.proteins_100g ?? nutriments.proteins ?? 0);
      const carbs = Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0);
      const fat = Number(nutriments.fat_100g ?? nutriments.fat ?? 0);
      return {
        id: p.code,
        name: (name || '').trim() || '(sem nome)',
        brand: p.brands || '',
        kcalPer100g: Number.isFinite(kcal) ? Math.round(kcal) : 0,
        proteinPer100g: Number.isFinite(protein) ? Math.round(protein * 10) / 10 : 0,
        carbsPer100g: Number.isFinite(carbs) ? Math.round(carbs * 10) / 10 : 0,
        fatPer100g: Number.isFinite(fat) ? Math.round(fat * 10) / 10 : 0,
        source: 'openfoodfacts',
      };
    })
    .filter((p) => p.name && p.kcalPer100g > 0)
    .slice(0, limit);
}
