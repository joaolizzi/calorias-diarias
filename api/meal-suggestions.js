import { createClient } from '@supabase/supabase-js';
import { generateGemini } from '../server/gemini-rest.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
  });
  const { data, error } = await sb.auth.getUser(match[1].trim());
  if (error || !data?.user) return { error: 'Sessão inválida' };
  return { user: data.user };
}

function extractJson(text) {
  const value = String(text || '').trim();
  try { return JSON.parse(value); } catch {}
  const block = value.match(/\`\`\`(?:json)?\s*([\s\S]+?)\s*\`\`\`/i);
  if (block) { try { return JSON.parse(block[1]); } catch {} }
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(value.slice(first, last + 1)); } catch {}
  }
  return null;
}

const clamp = (value, min, max, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

function sanitizeStringList(value, limit = 30) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeFeedback(value) {
  const clean = (items) => Array.isArray(items)
    ? items.slice(0, 25).map((item) => ({
        name: String(item?.name || '').trim().slice(0, 120),
        ingredients: sanitizeStringList(item?.ingredients, 12),
      })).filter((item) => item.name)
    : [];
  return { liked: clean(value?.liked), disliked: clean(value?.disliked) };
}

function shapeSwaps(parsed) {
  if (!Array.isArray(parsed?.alternatives)) return [];
  return parsed.alternatives.slice(0, 3).map((item, index) => ({
    id: `swap-${index + 1}`,
    name: String(item?.name || '').trim().slice(0, 100),
    grams: Math.round(clamp(item?.grams, 1, 1500, 1)),
    kcal: Math.round(clamp(item?.kcal, 1, 1500, 1)),
    protein: round1(clamp(item?.protein, 0, 200, 0)),
    carbs: round1(clamp(item?.carbs, 0, 300, 0)),
    fat: round1(clamp(item?.fat, 0, 200, 0)),
    reason: String(item?.reason || '').trim().slice(0, 180),
  })).filter((item) => item.name);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function chooseRecipeSearch(history, notes, meal) {
  const text = normalize([
    notes,
    ...(Array.isArray(history) ? history.map((item) => item?.name) : []),
  ].filter(Boolean).join(' '));

  const candidates = [
    [/frango|chicken/, 'chicken'],
    [/arroz|rice/, 'rice'],
    [/ovo|omelete|egg/, 'egg'],
    [/carne|bife|patinho|alcatra|beef/, 'beef'],
    [/peixe|tilapia|salmao|atum|tuna|fish/, 'fish'],
    [/batata|potato/, 'potato'],
    [/macarrao|massa|pasta/, 'pasta'],
    [/banana/, 'banana'],
  ];

  for (const [pattern, term] of candidates) {
    if (pattern.test(text)) return term;
  }
  if (meal === 'breakfast') return 'egg';
  if (meal === 'snack') return 'banana';
  return 'chicken';
}

async function fetchRecipeInspirations(history, notes, meal) {
  const term = chooseRecipeSearch(history, notes, meal);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Nutrix/1.0' },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    const meals = Array.isArray(payload?.meals) ? payload.meals.slice(0, 3) : [];

    return meals.map((recipe) => {
      const ingredients = [];
      for (let index = 1; index <= 20; index += 1) {
        const ingredient = String(recipe?.[`strIngredient${index}`] || '').trim();
        const measure = String(recipe?.[`strMeasure${index}`] || '').trim();
        if (ingredient) ingredients.push(measure ? `${measure} ${ingredient}` : ingredient);
      }
      return {
        title: String(recipe?.strMeal || '').slice(0, 120),
        category: String(recipe?.strCategory || '').slice(0, 60),
        area: String(recipe?.strArea || '').slice(0, 60),
        ingredients: ingredients.slice(0, 14),
        sourceUrl: recipe?.idMeal ? `https://www.themealdb.com/meal/${recipe.idMeal}` : null,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function shapeSuggestions(parsed, inspirations) {
  if (!Array.isArray(parsed?.suggestions)) return [];

  return parsed.suggestions.slice(0, 4).map((suggestion, index) => {
    const ingredients = Array.isArray(suggestion?.ingredients)
      ? suggestion.ingredients.slice(0, 12).map((ingredient) => ({
          name: String(ingredient?.name || '').trim().slice(0, 100),
          grams: Math.round(clamp(ingredient?.grams, 1, 1500, 1)),
          kcal: Math.round(clamp(ingredient?.kcal, 0, 1500, 0)),
          protein: round1(clamp(ingredient?.protein, 0, 200, 0)),
          carbs: round1(clamp(ingredient?.carbs, 0, 300, 0)),
          fat: round1(clamp(ingredient?.fat, 0, 200, 0)),
        })).filter((ingredient) => ingredient.name)
      : [];

    const computed = ingredients.reduce((total, ingredient) => ({
      kcal: total.kcal + ingredient.kcal,
      protein: total.protein + ingredient.protein,
      carbs: total.carbs + ingredient.carbs,
      fat: total.fat + ingredient.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const sourceIndex = suggestion?.sourceIndex == null
      ? null
      : Number.isInteger(Number(suggestion.sourceIndex))
        ? Number(suggestion.sourceIndex)
        : null;
    const source = sourceIndex != null && inspirations[sourceIndex] ? inspirations[sourceIndex] : null;
    const type = ['familiar', 'variation', 'recipe', 'new'].includes(suggestion?.type)
      ? suggestion.type
      : index === 0 ? 'familiar' : 'new';

    return {
      id: `suggestion-${index + 1}`,
      type,
      name: String(suggestion?.name || 'Sugestão de refeição').trim().slice(0, 120),
      description: String(suggestion?.description || '').trim().slice(0, 360),
      reason: String(suggestion?.reason || '').trim().slice(0, 240),
      prepMinutes: Math.round(clamp(suggestion?.prepMinutes, 1, 240, 15)),
      kcal: Math.round(computed.kcal || clamp(suggestion?.kcal, 0, 2500, 0)),
      protein: round1(computed.protein || clamp(suggestion?.protein, 0, 250, 0)),
      carbs: round1(computed.carbs || clamp(suggestion?.carbs, 0, 350, 0)),
      fat: round1(computed.fat || clamp(suggestion?.fat, 0, 200, 0)),
      ingredients,
      steps: Array.isArray(suggestion?.steps)
        ? suggestion.steps.slice(0, 6).map((step) => String(step || '').trim().slice(0, 260)).filter(Boolean)
        : [],
      sourceTitle: source?.title || null,
      sourceUrl: source?.sourceUrl || null,
    };
  }).filter((suggestion) => suggestion.name && suggestion.kcal > 0 && suggestion.ingredients.length);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido' });

  const auth = await authenticate(req);
  if (auth.error) return send(res, 401, { ok: false, error: auth.error });

  if (req.body?.action === 'swap') {
    const ingredient = req.body?.ingredient || {};
    const ingredientName = String(ingredient?.name || '').trim().slice(0, 100);
    const targetKcal = Math.round(clamp(ingredient?.kcal, 10, 1500, 100));
    if (!ingredientName) return send(res, 400, { ok: false, error: 'Ingrediente inválido' });

    const pantry = sanitizeStringList(req.body?.pantry, 40);
    const pantryMode = req.body?.pantryMode === 'only' ? 'only' : 'prefer';
    const history = sanitizeStringList(req.body?.history, 25);
    const feedback = sanitizeFeedback(req.body?.feedback);
    const otherIngredients = sanitizeStringList(req.body?.otherIngredients, 15);
    const suggestionName = String(req.body?.suggestionName || '').trim().slice(0, 120);

    const pantryRule = pantry.length
      ? pantryMode === 'only'
        ? `Use somente opções que possam ser feitas com estes ingredientes disponíveis: ${JSON.stringify(pantry)}. Água, sal e pimenta podem ser considerados básicos.`
        : `Priorize substitutos presentes nesta lista do que a pessoa tem em casa: ${JSON.stringify(pantry)}.`
      : 'Não há informação sobre ingredientes disponíveis em casa.';

    const prompt = `Substitua um ingrediente de uma refeição mantendo calorias semelhantes.
Ingrediente atual: ${JSON.stringify({ name: ingredientName, grams: ingredient?.grams, kcal: targetKcal, protein: ingredient?.protein, carbs: ingredient?.carbs, fat: ingredient?.fat })}.
Refeição: ${JSON.stringify(suggestionName)}.
Outros ingredientes da refeição: ${JSON.stringify(otherIngredients)}.
${pantryRule}
Alimentos frequentes: ${JSON.stringify(history)}.
Preferências positivas: ${JSON.stringify(feedback.liked)}.
Preferências negativas: ${JSON.stringify(feedback.disliked)}.
Gere 3 substitutos plausíveis em alimentação brasileira, idealmente entre ${Math.max(5, Math.round(targetKcal * 0.9))} e ${Math.round(targetKcal * 1.1)} kcal.
Ajuste a quantidade em gramas para aproximar as calorias do ingrediente atual. Não sugira o mesmo ingrediente com outro nome.
Retorne SOMENTE JSON válido:
{"alternatives":[{"name":string,"grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number,"reason":string}]}`;

    try {
      const result = await generateGemini({ parts: [{ text: prompt }], timeoutMs: 22_000, temperature: 0.25 });
      const parsed = extractJson(result.text);
      if (!parsed) return send(res, 502, { ok: false, error: 'A IA respondeu em um formato inválido' });
      const data = shapeSwaps(parsed);
      if (!data.length) return send(res, 502, { ok: false, error: 'Não encontrei substituições válidas' });
      return send(res, 200, { ok: true, data, model: result.model });
    } catch (error) {
      const status = error?.code === 'AI_TEMPORARILY_UNAVAILABLE' ? 503 : error?.status === 429 ? 429 : 502;
      return send(res, status, { ok: false, error: error?.publicMessage || error?.message || 'Falha ao buscar substituições' });
    }
  }

  const targetKcal = Math.round(clamp(req.body?.targetKcal, 100, 2000, 500));
  const meal = ['breakfast', 'lunch', 'snack', 'dinner'].includes(req.body?.meal) ? req.body.meal : 'lunch';
  const mode = ['mixed', 'familiar', 'recipes'].includes(req.body?.mode) ? req.body.mode : 'mixed';
  const style = ['balanced', 'protein', 'quick', 'budget'].includes(req.body?.style) ? req.body.style : 'balanced';
  const notes = String(req.body?.notes || '').trim().slice(0, 300);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(0, 25).map((item) => ({
    name: String(item?.name || '').trim().slice(0, 100),
    count: Math.round(clamp(item?.count, 1, 100, 1)),
    avgGrams: Math.round(clamp(item?.avgGrams, 0, 2000, 0)),
    avgKcal: Math.round(clamp(item?.avgKcal, 0, 2000, 0)),
    meal: ['breakfast', 'lunch', 'snack', 'dinner'].includes(item?.meal) ? item.meal : null,
  })).filter((item) => item.name) : [];

  const inspirations = mode === 'familiar' ? [] : await fetchRecipeInspirations(history, notes, meal);
  const mealNames = { breakfast: 'café da manhã', lunch: 'almoço', snack: 'lanche', dinner: 'jantar' };
  const modeInstruction = mode === 'familiar'
    ? 'Priorize apenas combinações muito próximas dos alimentos do histórico.'
    : mode === 'recipes'
      ? 'Priorize receitas completas e diferentes, usando as inspirações externas quando fizer sentido.'
      : 'Misture uma opção familiar, uma variação dos hábitos e receitas novas.';

  const pantryInstruction = pantry.length
    ? pantryMode === 'only'
      ? `Use somente estes ingredientes disponíveis em casa: ${JSON.stringify(pantry)}. Água, sal e pimenta podem ser considerados básicos. Não adicione outros ingredientes.`
      : `Priorize estes ingredientes disponíveis em casa sempre que fizer sentido: ${JSON.stringify(pantry)}.`
    : 'Não há uma lista de ingredientes disponíveis em casa.';
  const feedbackInstruction = `Preferências aprendidas: gostou de ${JSON.stringify(feedback.liked)}; não gostou de ${JSON.stringify(feedback.disliked)}. Favoreça padrões das opções curtidas e evite repetir as rejeitadas.`;

  const prompt = `Você é o recurso "O que comer?" de um app brasileiro de nutrição.
Sua tarefa é sugerir refeições práticas em pt-BR, sem diagnóstico médico.
Meta por refeição: aproximadamente ${targetKcal} kcal para ${mealNames[meal]}.
Preferência: ${style}. Modo: ${mode}. ${modeInstruction}
Tente ficar entre ${Math.round(targetKcal * 0.9)} e ${Math.round(targetKcal * 1.1)} kcal. Se não for possível, chegue o mais perto possível.
Use quantidades em gramas e valores nutricionais plausíveis compatíveis com alimentos brasileiros/TBCA/TACO.
O histórico representa alimentos que a pessoa realmente costuma comer; use isso para personalizar, sem assumir alergias ou restrições que não foram informadas.
${pantryInstruction}
${feedbackInstruction}
Observações do usuário: ${JSON.stringify(notes || 'nenhuma')}.
Histórico frequente: ${JSON.stringify(history)}.
Inspirações de receitas públicas: ${JSON.stringify(inspirations.map((item, index) => ({ index, title: item.title, category: item.category, area: item.area, ingredients: item.ingredients })))}.

Retorne SOMENTE JSON válido:
{"suggestions":[
  {
    "type":"familiar"|"variation"|"recipe"|"new",
    "name":string,
    "description":string,
    "reason":string,
    "prepMinutes":number,
    "kcal":number,
    "protein":number,
    "carbs":number,
    "fat":number,
    "sourceIndex":number|null,
    "ingredients":[{"name":string,"grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number}],
    "steps":[string]
  }
]}
Gere 4 sugestões distintas. Pelo menos uma deve aproveitar claramente o histórico quando houver histórico. Quando houver inspiração externa, pelo menos uma pode ser adaptada dela e deve informar sourceIndex. As calorias e macros totais devem bater aproximadamente com a soma dos ingredientes.`;

  try {
    const result = await generateGemini({
      parts: [{ text: prompt }],
      timeoutMs: 28_000,
      temperature: 0.35,
    });
    const parsed = extractJson(result.text);
    if (!parsed) return send(res, 502, { ok: false, error: 'A IA respondeu em um formato inválido' });

    const data = shapeSuggestions(parsed, inspirations);
    if (!data.length) return send(res, 502, { ok: false, error: 'Não consegui montar sugestões válidas' });

    return send(res, 200, {
      ok: true,
      data,
      meta: {
        targetKcal,
        usedHistory: history.length > 0,
        recipeSources: inspirations.length,
        model: result.model,
      },
    });
  } catch (error) {
    const status = error?.code === 'AI_TEMPORARILY_UNAVAILABLE'
      ? 503
      : error?.status === 429
        ? 429
        : error?.status === 500
          ? 500
          : 502;
    const message = error?.publicMessage || error?.message || 'Falha ao gerar sugestões';
    console.error(`[meal-suggestions] user=${auth.user.id} status=${status} ${error?.message || ''}`);
    return send(res, status, { ok: false, error: message });
  }
}
