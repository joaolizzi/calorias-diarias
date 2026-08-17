// src/lib/gemini.js
// Wrapper front para /api/gemini (proxy Vercel) e /api/food-image.
// Mantém as chaves do Gemini fora do bundle e exige login.

import { supabase } from './supabase.js';

const ENDPOINT = '/api/gemini';
const IMAGE_ENDPOINT = '/api/food-image';

let _cachedToken = null;
let _cachedTokenExp = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_cachedToken && now < _cachedTokenExp) return _cachedToken;

  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session?.access_token) throw new Error('Não autenticado');

  _cachedToken = session.access_token;
  _cachedTokenExp = (session.expires_at || 0) * 1000 - 30_000;
  return _cachedToken;
}

async function post(body, { signal } = {}) {
  const token = await getAccessToken();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  let json = null;
  try { json = await res.json(); } catch {}
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

async function postImage(body, { signal } = {}) {
  const token = await getAccessToken();
  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  let json = null;
  try { json = await res.json(); } catch {}
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

export async function analyzeFoodImage(imageDataUrl, defaultMeal = 'snack', { signal } = {}) {
  const items = await postImage({ image: imageDataUrl, meal: defaultMeal }, { signal });
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    name: it.name,
    grams: it.grams,
    kcal: it.kcal,
    protein: it.protein,
    carbs: it.carbs,
    fat: it.fat,
    confidence: it.confidence,
    meal: it.meal || defaultMeal,
    source: 'gemini-vision',
  }));
}

export async function getDailyInsight(payload, { signal } = {}) {
  const data = await post({ intent: 'insight', payload }, { signal });
  if (!data || typeof data !== 'object') return null;
  if (!data.title || !data.body) return null;
  return { title: data.title, body: data.body };
}
