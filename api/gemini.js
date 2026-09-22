// api/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const TIMEOUT_MS = 20_000;
const rateBucket = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

function rateLimit(key) {
  const now = Date.now();
  const arr = (rateBucket.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  rateBucket.set(key, arr);
  return true;
}

function send(res, status, body) {
  return res.status(status).json(body);
}

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: 'Token ausente' };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: 'Servidor sem SUPABASE_URL/SUPABASE_ANON_KEY configurados' };
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { enabled: false },
  });

  const { data, error } = await sb.auth.getUser(m[1].trim());
  if (error || !data?.user) return { error: 'Sessão inválida' };
  return { user: data.user };
}

function nutritionRules() {
  return `
REGRAS DE NUTRIÇÃO E INTERPRETAÇÃO:
- Contexto: alimentação no Brasil. Prefira referências compatíveis com TBCA/TACO e alimentos consumidos no Brasil.
- Diferencie obrigatoriamente o estado/preparo quando ele alterar os valores: cru, cozido, grelhado, assado, frito, empanado, com óleo, sem óleo etc.
- Nunca trate peso cru como se fosse peso cozido e vice-versa.
- Para alimentos de marca, suplementos, whey, barras, bebidas prontas e industrializados, não invente um rótulo exato. Use uma estimativa típica e reduza a confiança quando a marca/sabor não estiver informado.
- Se o usuário informar gramas ou ml, preserve a quantidade informada.
- Se informar unidades caseiras (ovo, banana, fatia, colher, concha, xícara, pão etc.), converta para uma massa aproximada realista e marque quantityEstimated=true.
- Se não houver quantidade, escolha uma porção brasileira plausível e marque quantityEstimated=true.
- kcalPer100g, proteinPer100g, carbsPer100g e fatPer100g são valores para 100 g do alimento no estado descrito.
- Não some refeição inteira em um único item quando for possível separar os alimentos.
- Óleo, azeite, manteiga, molhos e queijo devem virar itens separados se estiverem explicitamente presentes e tiverem impacto calórico relevante.
- Não invente ingredientes que o usuário não mencionou. Ex.: "ovo mexido" não significa automaticamente manteiga/óleo.
- Nomes curtos, claros e em português do Brasil.
- confidence deve ser "high" quando alimento + quantidade + preparo são claros; "medium" quando houver pequena estimativa; "low" quando a estimativa depender muito de porção, receita ou marca desconhecida.
- Valores devem ser plausíveis: kcalPer100g entre 0 e 900; proteína/carboidrato/gordura entre 0 e 100 g por 100 g.
`;
}

function buildPromptSearch(q) {
  return `Você é um assistente nutricional brasileiro extremamente cuidadoso com estimativas.
${nutritionRules()}

Dada a busca do usuário, retorne até 3 correspondências prováveis.
Responda SOMENTE JSON válido, sem markdown, neste esquema exato:
{"items":[{"name":string,"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"portion_suggestion_g":number,"confidence":"high"|"medium"|"low"}]}

Não devolva variações irrelevantes. Se a busca já especificar preparo, priorize exatamente esse preparo.
Busca do usuário: ${JSON.stringify(q)}`;
}

function buildPromptParse(q, defaultMeal) {
  return `Você é um assistente nutricional brasileiro especializado em transformar uma descrição de refeição em itens estruturados.
${nutritionRules()}

Responda SOMENTE JSON válido, sem markdown, neste esquema exato:
{"items":[{"name":string,"grams":number,"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number,"meal":"breakfast"|"lunch"|"dinner"|"snack","quantityEstimated":boolean,"confidence":"high"|"medium"|"low"}]}

REGRAS ESPECÍFICAS:
- Retorne de 1 a 10 itens.
- A refeição padrão é ${defaultMeal}; só mude meal se o texto deixar outra refeição explicitamente clara.
- NÃO calcule kcal total do item. Informe kcalPer100g e grams; o servidor fará a conta para evitar erros aritméticos.
- Quando houver quantidade explícita, não altere essa quantidade por conta própria.
- Exemplos de conversão quando a unidade não trouxer peso: 1 ovo grande ≈ 50 g sem casca; 1 banana média ≈ 80-100 g de parte comestível; 1 colher de sopa de azeite ≈ 13 g. São referências, não regras rígidas.
- Para receitas compostas sem ingredientes detalhados (ex.: "1 pedaço de lasanha caseira"), use um único item coerente, estime a porção e use confidence="low" ou "medium".

Descrição do usuário: ${JSON.stringify(q)}`;
}

function buildPromptInsight({ day, kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealSummary }) {
  return `Você é um assistente nutricional brasileiro. Gere um insight curto, útil e não alarmista sobre o dia.
Responda SOMENTE JSON válido: {"title":string,"body":string}.
Não faça diagnóstico médico. Não invente alimentos ou metas que não foram fornecidos.
Hoje: ${day}. Calorias: ${kcalConsumed}/${kcalGoal} kcal. Água: ${waterConsumed}/${waterGoal} ml. Refeições: ${mealSummary || 'sem registros'}.`;
}

function buildPromptWorkoutImport(text) {
  return `Você é um especialista em musculação brasileiro. Converta um treino fornecido em texto, especialmente TXT simples, para um plano semanal estruturado.

RESPONDA SOMENTE JSON válido, sem markdown, neste esquema exato:
{"days":{"monday":{"name":string,"restSeconds":number,"exercises":[{"name":string,"muscle":string,"equipment":string,"notes":string,"sets":[{"kg":string,"reps":string}]}]},"tuesday":{},"wednesday":{},"thursday":{},"friday":{},"saturday":{},"sunday":{}}}

REGRAS IMPORTANTES:
- TODOS os nomes de exercícios devem ser exclusivamente em português do Brasil. Nunca devolva termos em inglês.
- Os sete dias devem existir; dia sem treino usa name vazio e exercises [].
- Aceite cabeçalhos e abreviações: segunda/seg, terça/ter, quarta/qua, quinta/qui, sexta/sex, sábado/sáb/sab, domingo/dom.
- Preserve a ORDEM dos exercícios no arquivo.
- Para "3x8-12", gere 3 objetos de série com reps "8-12". Para "4 séries de 10", gere 4 séries com reps "10".
- Se uma carga aparecer, coloque-a em kg. Se não houver carga, deixe kg vazio.
- notes só deve receber observações existentes no arquivo. Não invente observações.
- restSeconds deve ser 45, 60, 90, 120 ou 180. Use 90 apenas quando o arquivo não informar.
- NÃO invente exercícios. Só use exercícios realmente presentes no conteúdo.

CONTEÚDO DO TREINO:
${text}`;
}

async function callGemini(parts) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const gen = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = gen.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      topP: 0.8,
    },
  });

  const result = await Promise.race([
    model.generateContent(parts),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo limite da IA excedido')), TIMEOUT_MS)),
  ]);

  return result.response.text();
}

function extractJson(text) {
  if (!text) return null;
  const t = String(text).trim();
  try { return JSON.parse(t); } catch {}

  const m = t.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }

  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch {}
  }
  return null;
}

function numberInRange(v, min, max, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function intInRange(v, min, max, fallback = null) {
  const n = numberInRange(v, min, max, fallback);
  return n == null ? fallback : Math.round(n);
}

function round1(v) {
  return Math.round(Number(v) * 10) / 10;
}

function sanitizeConfidence(v) {
  return ['high', 'medium', 'low'].includes(v) ? v : 'medium';
}

function sanitizeMacros(it) {
  return {
    proteinPer100g: round1(numberInRange(it?.proteinPer100g, 0, 100, 0)),
    carbsPer100g: round1(numberInRange(it?.carbsPer100g, 0, 100, 0)),
    fatPer100g: round1(numberInRange(it?.fatPer100g, 0, 100, 0)),
  };
}

function shapeSearch(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];

  return parsed.items.map((it) => {
    const name = String(it?.name || '').trim().slice(0, 120);
    const kcalPer100g = intInRange(it?.kcalPer100g, 0, 900);
    const portionSuggestionG = intInRange(it?.portion_suggestion_g, 1, 2000);
    if (!name || kcalPer100g == null) return null;

    return {
      name,
      kcalPer100g,
      portionSuggestionG,
      ...sanitizeMacros(it),
      confidence: sanitizeConfidence(it?.confidence),
    };
  }).filter(Boolean).slice(0, 3);
}

function shapeParse(parsed, defaultMeal) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

  return parsed.items.map((it) => {
    const name = String(it?.name || '').trim().slice(0, 120);
    const grams = intInRange(it?.grams, 1, 3000);
    const kcalPer100g = numberInRange(it?.kcalPer100g, 0, 900);
    const meal = MEALS.has(it?.meal) ? it.meal : defaultMeal;

    if (!name || grams == null || kcalPer100g == null || !MEALS.has(meal)) return null;

    // A IA identifica densidade energética; o servidor calcula a kcal total.
    // Isso evita respostas em que gramas e kcal não batem entre si.
    const kcal = Math.max(0, Math.round((grams * kcalPer100g) / 100));
    const macros = sanitizeMacros(it);

    return {
      name,
      grams,
      kcal,
      meal,
      kcalPer100g: Math.round(kcalPer100g),
      ...macros,
      protein: round1((grams * macros.proteinPer100g) / 100),
      carbs: round1((grams * macros.carbsPer100g) / 100),
      fat: round1((grams * macros.fatPer100g) / 100),
      quantityEstimated: Boolean(it?.quantityEstimated),
      confidence: sanitizeConfidence(it?.confidence),
    };
  }).filter(Boolean).slice(0, 10);
}

function shapeInsight(parsed) {
  if (!parsed) return null;
  const title = String(parsed.title || '').trim().slice(0, 60);
  const body = String(parsed.body || '').trim().slice(0, 400);
  return title && body ? { title, body } : null;
}

function shapeWorkoutImport(parsed) {
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (!parsed?.days || typeof parsed.days !== 'object') return null;

  const days = {};
  for (const key of DAY_KEYS) {
    const day = parsed.days[key] || {};
    const restSeconds = [45, 60, 90, 120, 180].includes(Number(day.restSeconds)) ? Number(day.restSeconds) : 90;
    const exercises = Array.isArray(day.exercises)
      ? day.exercises.slice(0, 40).map((ex) => ({
          name: String(ex?.name || '').trim().slice(0, 120),
          muscle: String(ex?.muscle || 'Geral').trim().slice(0, 60),
          equipment: String(ex?.equipment || 'Diversos').trim().slice(0, 80),
          notes: String(ex?.notes || '').trim().slice(0, 400),
          sets: Array.isArray(ex?.sets)
            ? ex.sets.slice(0, 12).map((s) => ({
                kg: String(s?.kg ?? '').trim().slice(0, 30),
                reps: String(s?.reps ?? '').trim().slice(0, 30),
                done: false,
              }))
            : [],
        })).filter((ex) => ex.name)
      : [];

    days[key] = {
      name: String(day.name || '').trim().slice(0, 80),
      restSeconds,
      exercises,
    };
  }
  return days;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido' });

  const auth = await authenticate(req);
  if (auth.error) return send(res, 401, { ok: false, error: auth.error });

  const intent = String(req.body?.intent || '').trim();
  if (!['search', 'parse', 'insight', 'workout_import'].includes(intent)) {
    return send(res, 400, { ok: false, error: 'Intent inválido' });
  }

  if (!rateLimit(`${auth.user.id}:${intent}`)) {
    return send(res, 429, { ok: false, error: 'Muitas requisições; tente em alguns segundos' });
  }

  let parts;
  let defaultMeal = 'snack';

  try {
    if (intent === 'search') {
      const q = String(req.body?.q || '').trim();
      if (q.length < 2) return send(res, 400, { ok: false, error: 'q muito curto' });
      parts = buildPromptSearch(q);
    } else if (intent === 'parse') {
      const q = String(req.body?.q || '').trim();
      if (q.length < 3) return send(res, 400, { ok: false, error: 'q muito curto' });
      defaultMeal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(req.body?.meal) ? req.body.meal : 'snack';
      parts = buildPromptParse(q, defaultMeal);
    } else if (intent === 'insight') {
      parts = buildPromptInsight(req.body?.payload || {});
    } else {
      const text = String(req.body?.text || '').trim();
      const image = req.body?.image;
      if (!text && !image) return send(res, 400, { ok: false, error: 'Envie texto ou imagem do treino' });
      const prompt = buildPromptWorkoutImport(text || 'O treino está na imagem enviada.');
      parts = image
        ? [{ text: prompt }, { inlineData: { mimeType: String(image.mimeType || 'image/jpeg'), data: String(image.data || '') } }]
        : prompt;
    }
  } catch (e) {
    return send(res, 400, { ok: false, error: `Payload inválido: ${e.message}` });
  }

  try {
    const parsed = extractJson(await callGemini(parts));
    if (!parsed) return send(res, 502, { ok: false, error: 'Resposta do Gemini não é JSON válido' });

    let data;
    if (intent === 'search') data = shapeSearch(parsed);
    else if (intent === 'parse') data = shapeParse(parsed, defaultMeal);
    else if (intent === 'insight') data = shapeInsight(parsed);
    else data = shapeWorkoutImport(parsed);

    if ((intent === 'search' || intent === 'parse') && !data.length) {
      return send(res, 502, { ok: false, error: 'A IA não retornou alimentos válidos' });
    }
    if (intent === 'insight' && !data) return send(res, 502, { ok: false, error: 'Insight vazio' });
    if (intent === 'workout_import' && !data) {
      return send(res, 502, { ok: false, error: 'Não consegui identificar um treino válido' });
    }

    return send(res, 200, { ok: true, data, model: GEMINI_MODEL });
  } catch (e) {
    const msg = e?.message || 'Falha no Gemini';
    const status = /429|quota|rate|exhausted/i.test(msg) ? 429 : 502;
    return send(res, status, { ok: false, error: msg });
  }
}
