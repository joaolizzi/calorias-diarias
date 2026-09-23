import { createClient } from '@supabase/supabase-js';
import { generateGemini } from '../server/gemini-rest.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const MAX_BASE64_CHARS = 11_000_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateBucket = new Map();

function send(res, status, body) { return res.status(status).json(body); }

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Token ausente' };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { error: 'Servidor sem Supabase configurado' };
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { enabled: false },
  });
  const { data, error } = await sb.auth.getUser(match[1].trim());
  if (error || !data?.user) return { error: 'Sessão inválida' };
  return { user: data.user };
}

function rateLimit(userId) {
  const now = Date.now();
  const entries = (rateBucket.get(userId) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (entries.length >= RATE_MAX) return false;
  entries.push(now);
  rateBucket.set(userId, entries);
  return true;
}

function extractJson(text) {
  if (!text) return null;
  const value = String(text).trim();
  try { return JSON.parse(value); } catch {}
  const block = value.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (block) { try { return JSON.parse(block[1]); } catch {} }
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(value.slice(first, last + 1)); } catch {}
  }
  return null;
}

function number(value, min, max, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function shapeItems(parsed, defaultMeal) {
  if (!Array.isArray(parsed?.items)) return [];
  const meals = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
  return parsed.items.map((item) => {
    const name = String(item?.name || '').trim().slice(0, 120);
    const grams = Math.round(number(item?.grams, 1, 2500, 0));
    const kcalPer100g = number(item?.kcalPer100g, 0, 900, null);
    const proteinPer100g = number(item?.proteinPer100g, 0, 100, 0);
    const carbsPer100g = number(item?.carbsPer100g, 0, 100, 0);
    const fatPer100g = number(item?.fatPer100g, 0, 100, 0);
    if (!name || !grams || kcalPer100g == null) return null;
    const meal = meals.has(item?.meal) ? item.meal : defaultMeal;
    return {
      name,
      grams,
      kcal: Math.round((grams * kcalPer100g) / 100),
      protein: Math.round((grams * proteinPer100g) / 10) / 10,
      carbs: Math.round((grams * carbsPer100g) / 10) / 10,
      fat: Math.round((grams * fatPer100g) / 10) / 10,
      confidence: Math.round(number(item?.confidence, 0, 100, 50)),
      meal,
    };
  }).filter(Boolean).slice(0, 10);
}

function promptFor(meal) {
  return `Analise a foto como assistente nutricional brasileiro. Identifique SOMENTE alimentos visíveis. Retorne SOMENTE JSON válido no formato {"items":[{"name":string,"grams":number,"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"confidence":number,"meal":"breakfast"|"lunch"|"dinner"|"snack"}]}. Regras: nomes em pt-BR; máximo 10 itens; não invente marca, variedade ou ingredientes escondidos; não presuma óleo/manteiga invisível; estime grams pela porção aparente; use valores por 100 g plausíveis e compatíveis com alimentos brasileiros; confidence entre 0 e 100; use ${meal} quando a refeição não puder ser inferida.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido' });

  const auth = await authenticate(req);
  if (auth.error) return send(res, 401, { ok: false, error: auth.error });
  if (!rateLimit(auth.user.id)) return send(res, 429, { ok: false, error: 'Muitas análises; tente novamente em alguns segundos' });

  const image = req.body?.image;
  const meal = String(req.body?.meal || 'snack');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal)) return send(res, 400, { ok: false, error: 'Refeição inválida' });
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return send(res, 400, { ok: false, error: 'Imagem inválida' });
  if (image.length > MAX_BASE64_CHARS) return send(res, 413, { ok: false, error: 'Imagem muito grande' });

  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return send(res, 400, { ok: false, error: 'Formato de imagem não suportado' });

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();

  try {
    const result = await generateGemini({
      parts: [
        { text: promptFor(meal) },
        { inlineData: { mimeType, data: match[2] } },
      ],
      timeoutMs: 30_000,
      temperature: 0.1,
    });
    const parsed = extractJson(result.text);
    const items = shapeItems(parsed, meal);
    if (!items.length) return send(res, 502, { ok: false, error: 'Não consegui identificar alimentos visíveis na imagem' });
    return send(res, 200, { ok: true, data: items, model: result.model });
  } catch (error) {
    const technicalMessage = error?.message || 'Falha ao analisar imagem';
    const publicMessage = error?.publicMessage || technicalMessage;
    const status = error?.code === 'AI_TEMPORARILY_UNAVAILABLE'
      ? 503
      : error?.status === 429
        ? 429
        : error?.status === 500
          ? 500
          : 502;
    console.error(`[food-image] user=${auth.user.id} status=${status} ${technicalMessage}`);
    return send(res, status, { ok: false, error: publicMessage });
  }
}
