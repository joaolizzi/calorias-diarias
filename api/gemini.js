// api/gemini.js
// Proxy serverless (Vercel) que:
//  1. valida o JWT do Supabase no header Authorization
//  2. roteia por intent: 'search' | 'parse' | 'insight'
//  3. chama gemini-1.5-flash via SDK oficial
//  4. devolve { ok, data } ou { ok: false, error }
//
// Variáveis de ambiente (NUNCA usar prefixo VITE_):
//   GEMINI_API_KEY  - chave do Google AI Studio (https://aistudio.google.com/app/apikey)
//   GEMINI_MODEL    - default 'gemini-1.5-flash'
//   SUPABASE_URL    - já usado pelo Vite como VITE_SUPABASE_URL; server usa este nome
//   SUPABASE_ANON_KEY - idem
//
// O front manda um access_token do Supabase em `Authorization: Bearer <jwt>`.
// O servidor valida chamando supabase.auth.getUser(token) — sem persistir nada.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const TIMEOUT_MS = 15_000;

// limita uso do Gemini por IP+intent (memória do processo — best-effort)
const rateBucket = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30; // 30 chamadas / minuto por chave (suficiente para um usuário)

function rateLimit(key) {
  const now = Date.now();
  const arr = (rateBucket.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  rateBucket.set(key, arr);
  return true;
}

function send(res, status, body) {
  res.status(status).json(body);
}

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: 'Token ausente' };
  const token = m[1].trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: 'Servidor sem SUPABASE_URL/SUPABASE_ANON_KEY configurados' };
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: 'Sessão inválida' };
  return { user: data.user };
}

// ---- prompts ----
function buildPromptSearch(q) {
  return `Você é um assistente nutricional brasileiro. Dada a busca do usuário, estime kcal por 100g do alimento.

Responda SOMENTE JSON válido, sem markdown, sem explicações, no esquema:
{"items":[{"name": string, "kcalPer100g": number, "portion_suggestion_g": number}]}

Regras:
- Até 3 itens.
- Nomes curtos em pt-BR (ex: "Arroz branco cozido", "Peito de frango grelhado").
- kcal por 100g, número inteiro >= 0.
- portion_suggestion_g é uma porção típica em gramas (opcional).
- Se a busca for ambígua (ex: "suco"), devolva variações comuns (com açúcar / sem açúcar).

Busca: "${q}"`;
}

function buildPromptParse(q, defaultMeal) {
  return `Você é um assistente nutricional brasileiro. Extraia os alimentos da frase do usuário.

Responda SOMENTE JSON válido, sem markdown, sem explicações, no esquema:
{"items":[{"name": string, "grams": number, "kcal": number, "meal": "breakfast"|"lunch"|"dinner"|"snack"}]}

Regras:
- gramas: número inteiro entre 1 e 2000. Estime se o usuário não disse.
- kcal: número inteiro >= 0. Estime com base no alimento e na porção.
- meal: se a refeição não for óbvia na frase, use "${defaultMeal}".
- Nomes curtos em pt-BR.
- Devolva 1 a 6 itens. Se a frase não descrever comida, devolva {"items":[]}.

Frase: "${q}"`;
}

function buildPromptInsight({ day, kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealSummary }) {
  return `Você é um assistente nutricional brasileiro. Gere um insight curto sobre o dia.

Responda SOMENTE JSON válido, sem markdown, sem explicações, no esquema:
{"title": string, "body": string}

Regras:
- title: até 40 caracteres, em pt-BR, sem emoji obrigatório.
- body: até 280 caracteres, 2-3 frases + 1 sugestão prática curta.
- Seja direto e gentil. Semmoralismo.
- Se o consumo estiver dentro da meta, parabenize brevemente.

Hoje: ${day}.
Calorias: ${kcalConsumed} / ${kcalGoal} kcal.
Água: ${waterConsumed} / ${waterGoal} ml.
Refeições: ${mealSummary || 'sem registros'}.`;
}

// chama Gemini com timeout via Promise.race
async function callGemini(prompt, { signal } = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const gen = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = gen.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const t = setTimeout(() => {
    try { signal?.abort?.(); } catch {}
  }, TIMEOUT_MS);
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text;
  } finally {
    clearTimeout(t);
  }
}

// o Gemini às vezes embrulha em ```json ... ``` mesmo pedindo mimeType; limpamos
function extractJson(text) {
  if (!text) return null;
  const t = String(text).trim();
  // tenta parse direto
  try { return JSON.parse(t); } catch {}
  // tenta extrair bloco ```json ... ```
  const m = t.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  // tenta pegar do primeiro { ao último }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch {}
  }
  return null;
}

// sanitiza itens retornados pelo Gemini para evitar kcal/gramas absurdos
function sanitizeInt(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function shapeSearch(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  return parsed.items
    .map((it) => {
      const name = String(it.name || '').trim();
      const kcal = sanitizeInt(it.kcalPer100g, 0, 900);
      const portion = it.portion_suggestion_g != null
        ? sanitizeInt(it.portion_suggestion_g, 1, 2000)
        : null;
      if (!name || kcal == null) return null;
      return { name, kcalPer100g: kcal, portionSuggestionG: portion };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function shapeParse(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
  return parsed.items
    .map((it) => {
      const name = String(it.name || '').trim();
      const grams = sanitizeInt(it.grams, 1, 2000);
      const kcal = sanitizeInt(it.kcal, 0, 5000);
      const meal = MEALS.has(it.meal) ? it.meal : null;
      if (!name || grams == null || kcal == null || !meal) return null;
      return { name, grams, kcal, meal };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function shapeInsight(parsed) {
  if (!parsed) return null;
  const title = String(parsed.title || '').trim().slice(0, 60);
  const body = String(parsed.body || '').trim().slice(0, 400);
  if (!title || !body) return null;
  return { title, body };
}

// ---- handler ----
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, error: 'Método não permitido' });
  }

  const auth = await authenticate(req);
  if (auth.error) return send(res, 401, { ok: false, error: auth.error });

  const intent = String(req.body?.intent || '').trim();
  if (!['search', 'parse', 'insight'].includes(intent)) {
    return send(res, 400, { ok: false, error: 'Intent inválido' });
  }

  if (!rateLimit(`${auth.user.id}:${intent}`)) {
    return send(res, 429, { ok: false, error: 'Muitas requisições; tente em alguns segundos' });
  }

  let prompt;
  try {
    if (intent === 'search') {
      const q = String(req.body?.q || '').trim();
      if (q.length < 2) return send(res, 400, { ok: false, error: 'q muito curto' });
      prompt = buildPromptSearch(q);
    } else if (intent === 'parse') {
      const q = String(req.body?.q || '').trim();
      const defaultMeal = String(req.body?.meal || 'snack');
      if (q.length < 3) return send(res, 400, { ok: false, error: 'q muito curto' });
      prompt = buildPromptParse(q, defaultMeal);
    } else {
      const payload = req.body?.payload || {};
      prompt = buildPromptInsight({
        day: payload.day,
        kcalConsumed: payload.kcalConsumed,
        kcalGoal: payload.kcalGoal,
        waterConsumed: payload.waterConsumed,
        waterGoal: payload.waterGoal,
        mealSummary: payload.mealSummary,
      });
    }
  } catch (e) {
    return send(res, 400, { ok: false, error: 'Payload inválido: ' + e.message });
  }

  const t0 = Date.now();
  try {
    const text = await callGemini(prompt);
    const parsed = extractJson(text);
    if (!parsed) {
      // log mínimo, sem conteúdo do prompt
      console.warn(`[gemini] parse falhou (${Date.now() - t0}ms) user=${auth.user.id} intent=${intent}`);
      return send(res, 502, { ok: false, error: 'Resposta do Gemini não é JSON válido' });
    }
    let data;
    if (intent === 'search') data = shapeSearch(parsed);
    else if (intent === 'parse') data = shapeParse(parsed);
    else data = shapeInsight(parsed);

    if (intent === 'search' || intent === 'parse') {
      if (!data || data.length === 0) {
        return send(res, 200, { ok: true, data: [] });
      }
    } else {
      if (!data) {
        return send(res, 502, { ok: false, error: 'Insight vazio' });
      }
    }
    return send(res, 200, { ok: true, data });
  } catch (e) {
    const msg = e?.message || 'Falha no Gemini';
    // erros típicos: cota estourada (429), chave inválida (400), rede
    const status = /429|quota|rate|exhausted/i.test(msg) ? 429
                 : /API key|permission|401|403/i.test(msg) ? 502
                 : 502;
    console.warn(`[gemini] erro (${Date.now() - t0}ms) user=${auth.user.id} intent=${intent} status=${status} msg=${msg}`);
    return send(res, status, { ok: false, error: msg });
  }
}
