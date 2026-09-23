import { createClient } from '@supabase/supabase-js';
import { generateGemini } from '../server/gemini-rest.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
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

function rateLimit(key) {
  const now = Date.now();
  const entries = (rateBucket.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (entries.length >= RATE_MAX) return false;
  entries.push(now);
  rateBucket.set(key, entries);
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

const clamp = (value, min, max, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const integer = (value, min, max, fallback = null) => {
  const n = clamp(value, min, max, fallback);
  return n == null ? fallback : Math.round(n);
};
const round1 = (value) => Math.round(Number(value) * 10) / 10;
const confidence = (value) => ['high', 'medium', 'low'].includes(value) ? value : 'medium';

function nutritionRules() {
  return `Contexto: alimentação no Brasil. Use referências plausíveis compatíveis com TBCA/TACO. Diferencie cru, cozido, grelhado, assado, frito e empanado quando isso alterar valores. Preserve gramas/ml explícitos. Para unidades caseiras, converta para massa plausível e marque quantityEstimated=true. Não invente óleo, manteiga, molhos ou ingredientes não mencionados. Para marcas/suplementos sem rótulo exato, use estimativa típica e confiança menor. Nomes em pt-BR.`;
}

function promptSearch(query) {
  return `Você é um assistente nutricional brasileiro. ${nutritionRules()}\nRetorne SOMENTE JSON válido no formato {"items":[{"name":string,"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"portion_suggestion_g":number,"confidence":"high"|"medium"|"low"}]}. Máximo 3 itens. Busca: ${JSON.stringify(query)}`;
}

function promptParse(query, meal) {
  return `Você transforma uma descrição de refeição em alimentos estruturados. ${nutritionRules()}\nRetorne SOMENTE JSON válido no formato {"items":[{"name":string,"grams":number,"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"meal":"breakfast"|"lunch"|"dinner"|"snack","quantityEstimated":boolean,"confidence":"high"|"medium"|"low"}]}. Separe alimentos quando possível. Não calcule kcal total; forneça kcalPer100g e grams. Refeição padrão: ${meal}. Descrição: ${JSON.stringify(query)}`;
}

function promptInsight(payload) {
  const { day, kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealSummary } = payload || {};
  return `Gere um insight nutricional curto, útil e não alarmista em pt-BR. Retorne SOMENTE JSON válido {"title":string,"body":string}. Não faça diagnóstico médico. Dia: ${day}. Calorias: ${kcalConsumed}/${kcalGoal}. Água: ${waterConsumed}/${waterGoal} ml. Refeições: ${mealSummary || 'sem registros'}.`;
}

function promptWorkout(text) {
  return `Converta o treino abaixo em plano semanal. Retorne SOMENTE JSON válido no formato {"days":{"monday":{"name":string,"restSeconds":number,"exercises":[{"name":string,"muscle":string,"equipment":string,"notes":string,"sets":[{"kg":string,"reps":string}]}]},"tuesday":{},"wednesday":{},"thursday":{},"friday":{},"saturday":{},"sunday":{}}}. Todos os nomes em pt-BR. Preserve ordem, séries e repetições. Não invente exercícios. Dias sem treino devem ter name vazio, restSeconds 90 e exercises []. Texto:\n${text}`;
}

function shapeSearch(parsed) {
  if (!Array.isArray(parsed?.items)) return [];
  return parsed.items.map((item) => {
    const name = String(item?.name || '').trim().slice(0, 120);
    const kcalPer100g = integer(item?.kcalPer100g, 0, 900);
    if (!name || kcalPer100g == null) return null;
    return {
      name,
      kcalPer100g,
      portionSuggestionG: integer(item?.portion_suggestion_g, 1, 2000),
      proteinPer100g: round1(clamp(item?.proteinPer100g, 0, 100, 0)),
      carbsPer100g: round1(clamp(item?.carbsPer100g, 0, 100, 0)),
      fatPer100g: round1(clamp(item?.fatPer100g, 0, 100, 0)),
      confidence: confidence(item?.confidence),
    };
  }).filter(Boolean).slice(0, 3);
}

function shapeParse(parsed, defaultMeal) {
  if (!Array.isArray(parsed?.items)) return [];
  const meals = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
  return parsed.items.map((item) => {
    const name = String(item?.name || '').trim().slice(0, 120);
    const grams = integer(item?.grams, 1, 3000);
    const kcalPer100g = clamp(item?.kcalPer100g, 0, 900);
    const meal = meals.has(item?.meal) ? item.meal : defaultMeal;
    if (!name || grams == null || kcalPer100g == null) return null;
    const proteinPer100g = round1(clamp(item?.proteinPer100g, 0, 100, 0));
    const carbsPer100g = round1(clamp(item?.carbsPer100g, 0, 100, 0));
    const fatPer100g = round1(clamp(item?.fatPer100g, 0, 100, 0));
    return {
      name,
      grams,
      kcal: Math.round((grams * kcalPer100g) / 100),
      meal,
      kcalPer100g: Math.round(kcalPer100g),
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      protein: round1((grams * proteinPer100g) / 100),
      carbs: round1((grams * carbsPer100g) / 100),
      fat: round1((grams * fatPer100g) / 100),
      quantityEstimated: Boolean(item?.quantityEstimated),
      confidence: confidence(item?.confidence),
    };
  }).filter(Boolean).slice(0, 10);
}

function shapeInsight(parsed) {
  const title = String(parsed?.title || '').trim().slice(0, 70);
  const body = String(parsed?.body || '').trim().slice(0, 500);
  return title && body ? { title, body } : null;
}

function shapeWorkout(parsed) {
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (!parsed?.days || typeof parsed.days !== 'object') return null;
  const days = {};
  for (const key of keys) {
    const day = parsed.days[key] || {};
    days[key] = {
      name: String(day?.name || '').trim().slice(0, 80),
      restSeconds: [45, 60, 90, 120, 180].includes(Number(day?.restSeconds)) ? Number(day.restSeconds) : 90,
      exercises: Array.isArray(day?.exercises) ? day.exercises.slice(0, 40).map((exercise) => ({
        name: String(exercise?.name || '').trim().slice(0, 120),
        muscle: String(exercise?.muscle || 'Geral').trim().slice(0, 60),
        equipment: String(exercise?.equipment || 'Diversos').trim().slice(0, 80),
        notes: String(exercise?.notes || '').trim().slice(0, 400),
        sets: Array.isArray(exercise?.sets) ? exercise.sets.slice(0, 12).map((set) => ({ kg: String(set?.kg ?? '').trim().slice(0, 30), reps: String(set?.reps ?? '').trim().slice(0, 30), done: false })) : [],
      })).filter((exercise) => exercise.name) : [],
    };
  }
  return days;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido' });

  const auth = await authenticate(req);
  if (auth.error) return send(res, 401, { ok: false, error: auth.error });

  const intent = String(req.body?.intent || '').trim();
  if (!['search', 'parse', 'insight', 'workout_import'].includes(intent)) return send(res, 400, { ok: false, error: 'Intent inválido' });
  if (!rateLimit(`${auth.user.id}:${intent}`)) return send(res, 429, { ok: false, error: 'Muitas requisições; tente novamente em alguns segundos' });

  let prompt;
  let defaultMeal = 'snack';
  let parts = null;

  if (intent === 'search') {
    const query = String(req.body?.q || '').trim();
    if (query.length < 2) return send(res, 400, { ok: false, error: 'Busca muito curta' });
    prompt = promptSearch(query);
  } else if (intent === 'parse') {
    const query = String(req.body?.q || '').trim();
    if (query.length < 3) return send(res, 400, { ok: false, error: 'Descrição muito curta' });
    defaultMeal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(req.body?.meal) ? req.body.meal : 'snack';
    prompt = promptParse(query, defaultMeal);
  } else if (intent === 'insight') {
    prompt = promptInsight(req.body?.payload || {});
  } else {
    const text = String(req.body?.text || '').trim();
    const image = req.body?.image;
    if (!text && !image) return send(res, 400, { ok: false, error: 'Envie texto ou imagem do treino' });
    prompt = promptWorkout(text || 'O treino está na imagem enviada.');
    parts = image ? [
      { text: prompt },
      { inlineData: { mimeType: String(image?.mimeType || 'image/jpeg'), data: String(image?.data || '') } },
    ] : [{ text: prompt }];
  }

  try {
    const result = await generateGemini({ parts: parts || [{ text: prompt }], timeoutMs: 25_000, temperature: 0.1 });
    const parsed = extractJson(result.text);
    if (!parsed) return send(res, 502, { ok: false, error: 'A IA respondeu em um formato inválido' });

    let data;
    if (intent === 'search') data = shapeSearch(parsed);
    else if (intent === 'parse') data = shapeParse(parsed, defaultMeal);
    else if (intent === 'insight') data = shapeInsight(parsed);
    else data = shapeWorkout(parsed);

    if ((intent === 'search' || intent === 'parse') && !data.length) return send(res, 502, { ok: false, error: 'A IA não identificou alimentos válidos' });
    if (intent === 'insight' && !data) return send(res, 502, { ok: false, error: 'A IA não gerou um insight válido' });
    if (intent === 'workout_import' && !data) return send(res, 502, { ok: false, error: 'Não consegui identificar um treino válido' });

    return send(res, 200, { ok: true, data, model: result.model });
  } catch (error) {
    const technicalMessage = error?.message || 'Falha na IA';
    const publicMessage = error?.publicMessage || technicalMessage;
    const status = error?.code === 'AI_TEMPORARILY_UNAVAILABLE'
      ? 503
      : error?.status === 429
        ? 429
        : error?.status === 500
          ? 500
          : 502;
    console.error(`[gemini] intent=${intent} user=${auth.user.id} status=${status} ${technicalMessage}`);
    return send(res, status, { ok: false, error: publicMessage });
  }
}
