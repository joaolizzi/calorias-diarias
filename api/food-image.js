import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const MAX_BASE64_CHARS = 11_000_000;
const TIMEOUT_MS = 30_000;

const rateBucket = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function send(res, status, body) {
  return res.status(status).json(body);
}

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
  const entries = (rateBucket.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (entries.length >= RATE_MAX) return false;
  entries.push(now);
  rateBucket.set(userId, entries);
  return true;
}

function sanitizeInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function extractJson(text) {
  if (!text) return null;
  const value = String(text).trim();
  try { return JSON.parse(value); } catch {}
  const block = value.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (block) {
    try { return JSON.parse(block[1]); } catch {}
  }
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(value.slice(first, last + 1)); } catch {}
  }
  return null;
}

function shapeItems(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  return parsed.items.map((item) => {
    const name = String(item.name || '').trim();
    const grams = sanitizeInt(item.grams, 1, 2000);
    const kcal = sanitizeInt(item.kcal, 0, 5000);
    const protein = sanitizeInt(item.protein, 0, 300);
    const carbs = sanitizeInt(item.carbs, 0, 500);
    const fat = sanitizeInt(item.fat, 0, 300);
    const confidence = sanitizeInt(item.confidence, 0, 100);
    const meals = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
    const meal = meals.has(item.meal) ? item.meal : null;
    if (!name || grams == null || kcal == null || protein == null || carbs == null || fat == null) return null;
    return { name, grams, kcal, protein, carbs, fat, confidence: confidence ?? 0, meal };
  }).filter(Boolean).slice(0, 10);
}

function promptFor(meal) {
  return `Você é um especialista em nutrição brasileira analisando uma foto de uma refeição. Identifique os alimentos visíveis e estime a porção com base no tamanho aparente, densidade e contexto do prato.

Responda SOMENTE JSON válido, sem markdown, no esquema:
{"items":[{"name":string,"grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"meal":"breakfast"|"lunch"|"dinner"|"snack"}]}

Regras:
- Liste no máximo 10 alimentos claramente visíveis.
- Não invente ingredientes escondidos. Se algo não puder ser identificado, não inclua.
- grams é a porção total estimada daquele alimento na foto, entre 1 e 2000.
- kcal, protein, carbs e fat são estimativas para a porção indicada.
- confidence é de 0 a 100 e representa confiança na identificação/estimativa.
- Use nomes curtos em pt-BR.
- Se for um prato misto, tente separar componentes visíveis.
- Use "${meal}" como meal quando a refeição não puder ser inferida da imagem.
- A estimativa deve ser prática e conservadora; não trate como medição exata.

Refeição informada pelo usuário: ${meal}`;
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
  if (!GEMINI_API_KEY) return send(res, 500, { ok: false, error: 'GEMINI_API_KEY não configurada' });

  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return send(res, 400, { ok: false, error: 'Formato de imagem não suportado' });

  try {
    const gen = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = gen.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const resultPromise = model.generateContent([
      { text: promptFor(meal) },
      { inlineData: { mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(), data: match[2] } },
    ]);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite da análise')), TIMEOUT_MS));
    const result = await Promise.race([resultPromise, timeout]);
    const parsed = extractJson(result.response.text());
    const items = shapeItems(parsed);

    return send(res, 200, { ok: true, data: items });
  } catch (e) {
    const msg = e?.message || 'Falha ao analisar imagem';
    const status = /429|quota|rate|exhausted/i.test(msg) ? 429 : 502;
    console.warn(`[food-image] erro user=${auth.user.id} status=${status} msg=${msg}`);
    return send(res, status, { ok: false, error: msg });
  }
}
