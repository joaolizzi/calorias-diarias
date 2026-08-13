// src/lib/gemini.js
// Wrapper front para /api/gemini (proxy Vercel). Mantém a chave do Gemini
// fora do bundle e exige login (o proxy valida o JWT do Supabase).
//
// Reaproveita o cliente supabase já configurado em src/lib/supabase.js para
// obter o access_token atual. Em ambiente de dev sem o proxy (vite puro), as
// chamadas vão falhar com 404 e o caller cai no fallback manual — esperado.

import { supabase } from './supabase.js';

const ENDPOINT = '/api/gemini';

let _cachedToken = null;
let _cachedTokenExp = 0;

async function getAccessToken() {
  // Reaproveita a sessão do supabase; se faltam < 30s para expirar, renova.
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session?.access_token) {
    throw new Error('Não autenticado');
  }
  _cachedToken = session.access_token;
  // exp é unix seconds; damos margem
  _cachedTokenExp = (session.expires_at || 0) * 1000 - 30_000;
  return _cachedToken;
}

async function post(body, { signal } = {}) {
  const token = await getAccessToken();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  let json = null;
  try { json = await res.json(); } catch { /* resposta não-JSON */ }
  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (!json?.ok) {
    const err = new Error(json?.error || 'Resposta inválida');
    err.status = res.status;
    throw err;
  }
  return json.data;
}

// ---- APIs públicas ----

// Estima kcal/100g para uma busca. Retorna no formato de foods.js:
//   [{ id, name, brand, kcalPer100g, source: 'gemini' }]
// Pode devolver [] se o Gemini não souber estimar.
export async function searchFoodsGemini(query, { signal } = {}) {
  const items = await post({ intent: 'search', q: query }, { signal });
  if (!Array.isArray(items)) return [];
  return items.map((it, i) => ({
    id: `gemini:${Date.now()}:${i}`,
    name: it.name,
    brand: 'Estimativa IA',
    kcalPer100g: it.kcalPer100g,
    portionSuggestionG: it.portionSuggestionG ?? null,
    source: 'gemini',
  }));
}

// Interpreta uma frase em linguagem natural. Retorna:
//   [{ name, grams, kcal, meal, source: 'gemini' }] (1 a 6 itens)
export async function parseNaturalFood(query, defaultMeal = 'snack', { signal } = {}) {
  const items = await post({ intent: 'parse', q: query, meal: defaultMeal }, { signal });
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    name: it.name,
    grams: it.grams,
    kcal: it.kcal,
    meal: it.meal || defaultMeal,
    source: 'gemini',
  }));
}

// Gera um insight curto do dia. Retorna { title, body } ou null.
export async function getDailyInsight(payload, { signal } = {}) {
  const data = await post({ intent: 'insight', payload }, { signal });
  if (!data || typeof data !== 'object') return null;
  if (!data.title || !data.body) return null;
  return { title: data.title, body: data.body };
}
