// src/lib/gemini.js
// Wrapper front para /api/gemini (proxy Vercel) e /api/food-image.
// A interpretação natural usa Gemini para entender a frase e TBCA para
// substituir estimativas quando há correspondência confiável.

import { supabase } from './supabase.js';
import { resolveTBCAFood } from './foods.js';

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

  return Promise.all(items.map(async (it) => {
    const grams = Math.max(1, Math.round(Number(it.grams) || 0));
    let tbca = null;

    try {
      tbca = await resolveTBCAFood(it.name, { minScore: 0.68 });
    } catch {
      tbca = null;
    }

    if (tbca && grams > 0) {
      return {
        name: tbca.name || it.name,
        grams,
        kcal: Math.max(0, Math.round((Number(tbca.kcalPer100g) * grams) / 100)),
        kcalPer100g: Number(tbca.kcalPer100g),
        proteinPer100g: Number(tbca.proteinPer100g || 0),
        carbsPer100g: Number(tbca.carbsPer100g || 0),
        fatPer100g: Number(tbca.fatPer100g || 0),
        meal: it.meal || defaultMeal,
        confidence: Number(tbca.matchScore || 0) >= 0.82 ? 'high' : 'medium',
        source: 'tbca',
        originalName: it.name,
      };
    }

    return {
      name: it.name,
      grams,
      kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
      meal: it.meal || defaultMeal,
      confidence: it.confidence || 'medium',
      source: 'gemini',
    };
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
