import { supabase } from './supabase.js';

export const WORKOUT_STORAGE_KEY = 'nutrix-workouts-v1';
export const WORKOUT_PLAN_DAYS = [
  { id: 'monday', label: 'Segunda' }, { id: 'tuesday', label: 'Terça' }, { id: 'wednesday', label: 'Quarta' },
  { id: 'thursday', label: 'Quinta' }, { id: 'friday', label: 'Sexta' }, { id: 'saturday', label: 'Sábado' }, { id: 'sunday', label: 'Domingo' },
];

export const DEFAULT_EXERCISES = [
  { id: 'chest-fly', name: 'Voador', muscle: 'Peito', equipment: 'Máquina' }, { id: 'incline-press', name: 'Supino inclinado máquina', muscle: 'Peito', equipment: 'Máquina' },
  { id: 'chest-press', name: 'Supino reto máquina', muscle: 'Peito', equipment: 'Máquina' }, { id: 'cable-crossover', name: 'Crossover na polia', muscle: 'Peito', equipment: 'Polia' },
  { id: 'pec-deck', name: 'Peck deck', muscle: 'Peito', equipment: 'Máquina' }, { id: 'lat-pulldown', name: 'Puxada alta', muscle: 'Costas', equipment: 'Polia' },
  { id: 'low-row', name: 'Remada baixa máquina', muscle: 'Costas', equipment: 'Máquina' }, { id: 'tbar-row', name: 'Remada T-Bar máquina', muscle: 'Costas', equipment: 'Máquina' },
  { id: 'high-row', name: 'Remada alta máquina', muscle: 'Costas', equipment: 'Máquina' }, { id: 'pullover-machine', name: 'Pullover máquina', muscle: 'Costas', equipment: 'Máquina' },
  { id: 'lateral-raise', name: 'Elevação lateral máquina', muscle: 'Ombros', equipment: 'Máquina' }, { id: 'cable-lateral', name: 'Elevação lateral na polia', muscle: 'Ombros', equipment: 'Polia' },
  { id: 'shoulder-press', name: 'Desenvolvimento de ombros máquina', muscle: 'Ombros', equipment: 'Máquina' }, { id: 'reverse-fly', name: 'Crucifixo inverso máquina', muscle: 'Ombros', equipment: 'Máquina' },
  { id: 'leg-press', name: 'Leg press', muscle: 'Quadríceps', equipment: 'Máquina' }, { id: 'hack-squat', name: 'Agachamento hack', muscle: 'Quadríceps', equipment: 'Máquina' },
  { id: 'leg-extension', name: 'Cadeira extensora', muscle: 'Quadríceps', equipment: 'Máquina' }, { id: 'leg-curl', name: 'Mesa flexora', muscle: 'Posterior', equipment: 'Máquina' },
  { id: 'seated-leg-curl', name: 'Cadeira flexora', muscle: 'Posterior', equipment: 'Máquina' }, { id: 'hip-thrust', name: 'Hip thrust máquina', muscle: 'Glúteos', equipment: 'Máquina' },
  { id: 'abductor', name: 'Cadeira abdutora', muscle: 'Glúteos', equipment: 'Máquina' }, { id: 'adductor', name: 'Cadeira adutora', muscle: 'Adutores', equipment: 'Máquina' },
  { id: 'calf', name: 'Panturrilha máquina', muscle: 'Panturrilhas', equipment: 'Máquina' }, { id: 'scott', name: 'Rosca Scott máquina', muscle: 'Bíceps', equipment: 'Máquina' },
  { id: 'biceps-machine', name: 'Bíceps articulado', muscle: 'Bíceps', equipment: 'Máquina' }, { id: 'cable-curl', name: 'Rosca na polia', muscle: 'Bíceps', equipment: 'Polia' },
  { id: 'triceps-machine', name: 'Tríceps máquina', muscle: 'Tríceps', equipment: 'Máquina' }, { id: 'triceps-rope', name: 'Tríceps corda', muscle: 'Tríceps', equipment: 'Polia' },
  { id: 'triceps-bar', name: 'Tríceps barra na polia', muscle: 'Tríceps', equipment: 'Polia' }, { id: 'crunch-machine', name: 'Abdominal máquina', muscle: 'Abdômen', equipment: 'Máquina' },
  { id: 'cable-crunch', name: 'Abdominal na polia', muscle: 'Abdômen', equipment: 'Polia' },
];

const cacheKey = 'nutrix-exercise-catalog-v4';
const API_URLS = ['https://wger.de/api/v2/exerciseinfo/?limit=1000'];
const PT_EXERCISE_ALIASES = {
  'bench press': 'Supino reto', 'barbell bench press': 'Supino reto', 'incline bench press': 'Supino inclinado', 'incline dumbbell press': 'Supino inclinado com halteres',
  'chest fly': 'Voador', 'machine chest fly': 'Voador', 'pec deck': 'Peck deck', 'cable crossover': 'Crossover na polia', 'lat pulldown': 'Puxada alta',
  'pull down': 'Puxada alta', 'seated row': 'Remada baixa', 'cable row': 'Remada baixa na polia', 't bar row': 'Remada T-Bar', 'shoulder press': 'Desenvolvimento de ombros',
  'overhead press': 'Desenvolvimento de ombros', 'lateral raise': 'Elevação lateral', 'reverse fly': 'Crucifixo inverso', 'leg press': 'Leg press', 'leg extension': 'Cadeira extensora',
  'leg curl': 'Mesa flexora', 'seated leg curl': 'Cadeira flexora', 'hack squat': 'Agachamento hack', 'hip thrust': 'Hip thrust', 'calf raise': 'Panturrilha',
  'standing calf raise': 'Panturrilha em pé', 'seated calf raise': 'Panturrilha sentada', 'biceps curl': 'Rosca direta', 'barbell curl': 'Rosca direta',
  'dumbbell curl': 'Rosca alternada', 'preacher curl': 'Rosca Scott', 'cable curl': 'Rosca na polia', 'triceps pushdown': 'Tríceps na polia',
  'triceps rope pushdown': 'Tríceps corda', 'triceps extension': 'Tríceps extensão', 'cable crunch': 'Abdominal na polia', 'crunch': 'Abdominal',
};
const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const localizeExerciseName = (name) => {
  const raw = String(name || '').trim(); if (!raw) return '';
  const normalized = normalizeText(raw);
  const exact = Object.entries(PT_EXERCISE_ALIASES).find(([key]) => normalizeText(key) === normalized);
  if (exact) return exact[1];
  for (const [key, value] of Object.entries(PT_EXERCISE_ALIASES)) { const k = normalizeText(key); if (normalized.includes(k) || k.includes(normalized)) return value; }
  return raw;
};

const read = () => { try { return JSON.parse(localStorage.getItem(WORKOUT_STORAGE_KEY) || '[]'); } catch { return []; } };
const write = (value) => localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(value));
export const getWorkoutHistory = () => read();
export const saveWorkout = (workout) => { const history = read(); const next = { ...workout, id: workout.id || `${Date.now()}`, finishedAt: workout.finishedAt || new Date().toISOString() }; write([next, ...history].slice(0, 200)); return next; };
export const getExerciseHistory = (exerciseId) => read().flatMap(w => (w.exercises || []).filter(e => e.exerciseId === exerciseId).map(e => ({ ...e, date: w.date, workoutId: w.id })));
export const calculateWorkoutStats = (workout) => { const sets = (workout.exercises || []).flatMap(e => e.sets || []); return { exercises: workout.exercises?.length || 0, sets: sets.length, volume: Math.round(sets.reduce((sum, s) => sum + (Number(s.weight ?? s.kg) || 0) * (Number(s.reps) || 0), 0)), duration: workout.startedAt && workout.finishedAt ? Math.max(1, Math.round((new Date(workout.finishedAt) - new Date(workout.startedAt)) / 60000)) : 0 }; };
export const getPersonalBest = (exerciseId) => getExerciseHistory(exerciseId).flatMap(e => e.sets || []).reduce((best, s) => (Number(s.weight ?? s.kg) || 0) > (Number(best?.weight ?? best?.kg) || 0) ? s : best, null);

const translationLanguageText = (translation) => { const language = translation?.language; if (!language) return ''; if (typeof language === 'string') return language; if (typeof language === 'object') return [language.short_name, language.shortName, language.iso_code, language.code, language.name, language.full_name].filter(Boolean).join(' '); return String(language); };
const chooseTranslation = (translations = []) => translations.find((t) => /pt[_-]?br|portugu[eê]s\s*\(?brasil|brazilian\s*portuguese/i.test(translationLanguageText(t))) || translations.find((t) => /^pt(?:\s|$)/i.test(translationLanguageText(t)));
const normalizeExercise = (exercise) => { const translation = chooseTranslation(exercise.translations); if (!translation?.name) return null; const name = localizeExerciseName(translation.name); const muscle = exercise.muscles?.[0]?.name || exercise.muscles?.[0]?.name_en || 'Geral'; const equipment = exercise.equipment?.map((e) => e.name || e.name_en).filter(Boolean).join(', ') || 'Diversos'; return { id: `wger-${exercise.id}`, sourceId: exercise.id, name: name.trim(), muscle: String(muscle).trim(), equipment: equipment.trim(), category: exercise.category?.name || 'Força', image: exercise.images?.[0]?.image || exercise.images?.[0]?.url || null }; };
export const getExerciseCatalog = async () => {
  try { const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (Array.isArray(cached) && cached.length >= DEFAULT_EXERCISES.length) return cached; } catch {}
  for (const url of API_URLS) {
    try { const response = await fetch(url, { headers: { Accept: 'application/json' } }); if (!response.ok) continue; const payload = await response.json(); const remote = (payload.results || []).map(normalizeExercise).filter(Boolean); const merged = [...DEFAULT_EXERCISES, ...remote].filter((item, index, all) => all.findIndex((x) => normalizeText(x.name) === normalizeText(item.name)) === index); if (merged.length) { localStorage.setItem(cacheKey, JSON.stringify(merged)); return merged; } } catch {}
  }
  return DEFAULT_EXERCISES;
};
export const emptyWorkoutPlan = () => Object.fromEntries(WORKOUT_PLAN_DAYS.map(day => [day.id, { name: '', restSeconds: 90, exercises: [] }]));

// O plano semanal fica salvo no navegador e é recuperado antes do Supabase.
const readWorkoutPlan = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKOUT_STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const base = emptyWorkoutPlan();
      for (const day of WORKOUT_PLAN_DAYS) base[day.id] = { ...base[day.id], ...(saved[day.id] || {}) };
      return base;
    }
  } catch {}
  return null;
};

const cloneWorkoutPlan = (days) => JSON.parse(JSON.stringify(days || emptyWorkoutPlan()));

export const getWorkoutPlan = async (userId) => {
  const localPlan = readWorkoutPlan();
  if (localPlan) return localPlan;

  try {
    const { data, error } = await supabase.from('workout_plans').select('days').eq('user_id', userId).maybeSingle();
    if (!error) {
      const base = emptyWorkoutPlan();
      const saved = data?.days && typeof data.days === 'object' ? data.days : {};
      for (const day of WORKOUT_PLAN_DAYS) base[day.id] = { ...base[day.id], ...(saved[day.id] || {}) };
      if (data?.days) write(base);
      return base;
    }
  } catch {}

  return emptyWorkoutPlan();
};

export const saveWorkoutPlan = async (userId, days) => {
  const plan = cloneWorkoutPlan(days);
  // A gravação local acontece primeiro e não depende de internet ou Supabase.
  write(plan);

  // Sincronização opcional com o Supabase para preservar compatibilidade.
  try {
    await supabase.from('workout_plans').upsert({ user_id: userId, days: plan }, { onConflict: 'user_id' });
  } catch {}
};
