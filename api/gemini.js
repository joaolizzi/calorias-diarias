// api/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const TIMEOUT_MS = 15_000;
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
function send(res, status, body) { return res.status(status).json(body); }

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: 'Token ausente' };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { error: 'Servidor sem SUPABASE_URL/SUPABASE_ANON_KEY configurados' };
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { enabled: false } });
  const { data, error } = await sb.auth.getUser(m[1].trim());
  if (error || !data?.user) return { error: 'Sessão inválida' };
  return { user: data.user };
}

function buildPromptSearch(q) {
  return `Você é um assistente nutricional brasileiro. Dada a busca do usuário, estime kcal por 100g do alimento.\nResponda SOMENTE JSON válido, sem markdown, no esquema: {"items":[{"name": string, "kcalPer100g": number, "portion_suggestion_g": number}]}\nAté 3 itens. Nomes curtos em pt-BR. kcal por 100g >= 0.\nBusca: "${q}"`;
}
function buildPromptParse(q, defaultMeal) {
  return `Você é um assistente nutricional brasileiro. Extraia os alimentos da frase do usuário.\nResponda SOMENTE JSON válido: {"items":[{"name": string, "grams": number, "kcal": number, "meal": "breakfast"|"lunch"|"dinner"|"snack"}]}\nEstime gramas e kcal quando necessário. 1 a 6 itens.\nRefeição padrão: ${defaultMeal}.\nFrase: "${q}"`;
}
function buildPromptInsight({ day, kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealSummary }) {
  return `Você é um assistente nutricional brasileiro. Gere um insight curto sobre o dia.\nResponda SOMENTE JSON: {"title": string, "body": string}.\nHoje: ${day}. Calorias: ${kcalConsumed}/${kcalGoal} kcal. Água: ${waterConsumed}/${waterGoal} ml. Refeições: ${mealSummary || 'sem registros'}.`;
}
function buildPromptWorkoutImport(text) {
  return `Você é um especialista em musculação brasileiro. Converta um treino fornecido em texto, especialmente TXT simples, para um plano semanal estruturado.\n\nRESPONDA SOMENTE JSON válido, sem markdown, neste esquema exato:\n{"days":{"monday":{"name":string,"restSeconds":number,"exercises":[{"name":string,"muscle":string,"equipment":string,"notes":string,"sets":[{"kg":string,"reps":string}]}]},"tuesday":{},"wednesday":{},"thursday":{},"friday":{},"saturday":{},"sunday":{}}}\n\nREGRAS IMPORTANTES:\n- TODOS os nomes de exercícios devem ser exclusivamente em português do Brasil. Nunca devolva termos em inglês. Traduza nomes conhecidos como bench press→supino, incline bench press→supino inclinado, chest fly/pec deck→voador/peck deck, lat pulldown→puxada alta, seated row→remada baixa, lateral raise→elevação lateral, shoulder press→desenvolvimento de ombros, leg press→leg press, leg extension→cadeira extensora, leg curl→mesa flexora, calf raise→panturrilha, biceps curl→rosca direta, preacher curl→rosca Scott, triceps pushdown→tríceps na polia.\n- Os sete dias devem existir; dia sem treino usa name vazio e exercises [].\n- Aceite cabeçalhos e abreviações: segunda/seg, terça/ter, quarta/qua, quinta/qui, sexta/sex, sábado/sáb/sab, domingo/dom.\n- TXT pode usar linhas como "Voador - 3x10", "3x8-12 Supino inclinado", "Supino inclinado: 3 séries de 8-12", tabelas simples, marcadores -, •, *, numeração, espaços ou tabulações.\n- Ignore linhas decorativas, títulos sem exercícios, aquecimento genérico e comentários que não sejam exercícios.\n- Preserve a ORDEM dos exercícios no arquivo.\n- Se houver um nome de treino no cabeçalho, preserve-o. Se não houver, gere um nome curto pelo grupo muscular, em português.\n- Para "3x8-12", gere 3 objetos de série com reps "8-12". Para "4 séries de 10", gere 4 séries com reps "10".\n- Se uma carga aparecer, coloque-a em kg. Se não houver carga, deixe kg vazio.\n- notes é opcional e deve receber observações do próprio arquivo, como "até a falha", "dropset", "descanso 90s" etc. Não invente observações.\n- restSeconds deve ser 45, 60, 90, 120 ou 180. Use 90 apenas quando o arquivo não informar.\n- NÃO invente exercícios. Só use exercícios realmente presentes no conteúdo.\n\nCONTEÚDO DO TREINO:\n${text}`;
}

async function callGemini(parts) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const gen = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = gen.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: 'application/json' } });
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
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  const first = t.indexOf('{'); const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) { try { return JSON.parse(t.slice(first, last + 1)); } catch {} }
  return null;
}
function sanitizeInt(v, min, max) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; }
function shapeSearch(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  return parsed.items.map((it) => { const name=String(it.name||'').trim(); const kcal=sanitizeInt(it.kcalPer100g,0,900); const portion=it.portion_suggestion_g!=null?sanitizeInt(it.portion_suggestion_g,1,2000):null; return !name||kcal==null?null:{name,kcalPer100g:kcal,portionSuggestionG:portion}; }).filter(Boolean).slice(0,3);
}
function shapeParse(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return [];
  const MEALS = new Set(['breakfast','lunch','dinner','snack']);
  return parsed.items.map((it) => { const name=String(it.name||'').trim(); const grams=sanitizeInt(it.grams,1,2000); const kcal=sanitizeInt(it.kcal,0,5000); const meal=MEALS.has(it.meal)?it.meal:null; return !name||grams==null||kcal==null||!meal?null:{name,grams,kcal,meal}; }).filter(Boolean).slice(0,6);
}
function shapeInsight(parsed) { if (!parsed) return null; const title=String(parsed.title||'').trim().slice(0,60); const body=String(parsed.body||'').trim().slice(0,400); return title&&body?{title,body}:null; }

function shapeWorkoutImport(parsed) {
  const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  if (!parsed?.days || typeof parsed.days !== 'object') return null;
  const days = {};
  for (const key of DAY_KEYS) {
    const day = parsed.days[key] || {};
    const restSeconds = [45,60,90,120,180].includes(Number(day.restSeconds)) ? Number(day.restSeconds) : 90;
    const exercises = Array.isArray(day.exercises) ? day.exercises.slice(0,40).map((ex) => ({
      name: String(ex?.name || '').trim().slice(0,120),
      muscle: String(ex?.muscle || 'Geral').trim().slice(0,60),
      equipment: String(ex?.equipment || 'Diversos').trim().slice(0,80),
      notes: String(ex?.notes || '').trim().slice(0,400),
      sets: Array.isArray(ex?.sets) ? ex.sets.slice(0,12).map((s) => ({ kg: String(s?.kg ?? '').trim().slice(0,30), reps: String(s?.reps ?? '').trim().slice(0,30), done: false })) : [],
    })).filter((ex) => ex.name) : [];
    days[key] = { name: String(day.name || '').trim().slice(0,80), restSeconds, exercises };
  }
  return days;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok:false, error:'Método não permitido' });
  const auth = await authenticate(req); if (auth.error) return send(res,401,{ok:false,error:auth.error});
  const intent = String(req.body?.intent || '').trim();
  if (!['search','parse','insight','workout_import'].includes(intent)) return send(res,400,{ok:false,error:'Intent inválido'});
  if (!rateLimit(`${auth.user.id}:${intent}`)) return send(res,429,{ok:false,error:'Muitas requisições; tente em alguns segundos'});

  let parts;
  try {
    if (intent === 'search') {
      const q=String(req.body?.q||'').trim(); if(q.length<2)return send(res,400,{ok:false,error:'q muito curto'}); parts=buildPromptSearch(q);
    } else if (intent === 'parse') {
      const q=String(req.body?.q||'').trim(); if(q.length<3)return send(res,400,{ok:false,error:'q muito curto'}); parts=buildPromptParse(q,String(req.body?.meal||'snack'));
    } else if (intent === 'insight') {
      parts=buildPromptInsight(req.body?.payload||{});
    } else {
      const text=String(req.body?.text||'').trim(); const image=req.body?.image;
      if (!text && !image) return send(res,400,{ok:false,error:'Envie texto ou imagem do treino'});
      const prompt=buildPromptWorkoutImport(text || 'O treino está na imagem enviada.');
      parts=image ? [{ text: prompt }, { inlineData: { mimeType: String(image.mimeType||'image/jpeg'), data: String(image.data||'') } }] : prompt;
    }
  } catch(e) { return send(res,400,{ok:false,error:'Payload inválido: '+e.message}); }

  try {
    const parsed=extractJson(await callGemini(parts));
    if(!parsed)return send(res,502,{ok:false,error:'Resposta do Gemini não é JSON válido'});
    let data;
    if(intent==='search')data=shapeSearch(parsed);
    else if(intent==='parse')data=shapeParse(parsed);
    else if(intent==='insight')data=shapeInsight(parsed);
    else data=shapeWorkoutImport(parsed);
    if(intent==='insight'&&!data)return send(res,502,{ok:false,error:'Insight vazio'});
    if(intent==='workout_import'&&!data)return send(res,502,{ok:false,error:'Não consegui identificar um treino válido'});
    return send(res,200,{ok:true,data});
  } catch(e) {
    const msg=e?.message||'Falha no Gemini';
    const status=/429|quota|rate|exhausted/i.test(msg)?429:/API key|permission|401|403/i.test(msg)?502:502;
    return send(res,status,{ok:false,error:msg});
  }
}
