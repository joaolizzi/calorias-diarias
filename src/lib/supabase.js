import { createClient } from '@supabase/supabase-js';
import { calculateMacroGoals } from './macros.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas. Veja o README.');
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon', {
  auth: { persistSession: true, autoRefreshToken: true },
});

const isMissingColumn = (error) => /column|schema cache|could not find|does not exist/i.test(String(error?.message || ''));

// ---------- perfil / metas ----------
export const ensureProfile = async (userId) => {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!existing) {
    const macro = calculateMacroGoals(2000, 70);
    let { error } = await supabase.from('profiles').insert({
      id: userId,
      daily_kcal_goal: 2000,
      daily_water_goal_ml: 2000,
      daily_protein_goal_g: macro.protein,
      daily_carbs_goal_g: macro.carbs,
      daily_fat_goal_g: macro.fat,
      onboarding_complete: false,
    });
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('profiles').insert({ id: userId, daily_kcal_goal: 2000, daily_water_goal_ml: 2000, onboarding_complete: false }));
    }
    if (error && error.code !== '23505') throw error;
  }
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
};

export const updateGoals = async (userId, { kcalGoal, waterGoal, proteinGoal, carbsGoal, fatGoal }) => {
  const updates = {};
  if (kcalGoal != null) updates.daily_kcal_goal = Math.round(Number(kcalGoal));
  if (waterGoal != null) updates.daily_water_goal_ml = Math.round(Number(waterGoal));
  if (proteinGoal != null) updates.daily_protein_goal_g = Math.round(Number(proteinGoal) * 10) / 10;
  if (carbsGoal != null) updates.daily_carbs_goal_g = Math.round(Number(carbsGoal) * 10) / 10;
  if (fatGoal != null) updates.daily_fat_goal_g = Math.round(Number(fatGoal) * 10) / 10;

  let { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error && isMissingColumn(error)) {
    const legacy = {};
    if (updates.daily_kcal_goal != null) legacy.daily_kcal_goal = updates.daily_kcal_goal;
    if (updates.daily_water_goal_ml != null) legacy.daily_water_goal_ml = updates.daily_water_goal_ml;
    ({ error } = await supabase.from('profiles').update(legacy).eq('id', userId));
  }
  if (error) throw error;
};

export const saveGoalProfile = async (userId, payload) => {
  const macro = calculateMacroGoals(payload.kcalGoal, payload.weightKg);
  const updates = {
    display_name: payload.displayName || null,
    weight_kg: Number(payload.weightKg),
    height_cm: Number(payload.heightCm),
    age: Number(payload.age),
    sex: payload.sex,
    activity_level: payload.activity,
    goal: payload.goal,
    daily_kcal_goal: Math.round(Number(payload.kcalGoal)),
    daily_water_goal_ml: Math.round(Number(payload.waterGoal)),
    daily_protein_goal_g: macro.protein,
    daily_carbs_goal_g: macro.carbs,
    daily_fat_goal_g: macro.fat,
    onboarding_complete: true,
  };
  let { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error && isMissingColumn(error)) {
    const { daily_protein_goal_g, daily_carbs_goal_g, daily_fat_goal_g, ...legacy } = updates;
    ({ error } = await supabase.from('profiles').update(legacy).eq('id', userId));
  }
  if (error) throw error;
};

// ---------- água ----------
export const getWaterForDay = async (userId, day) => { const { data, error } = await supabase.from('water_entries').select('*').eq('user_id', userId).eq('day', day).order('consumed_at', { ascending: true }); if (error) throw error; return data || []; };
export const addWater = async (userId, day, ml) => { const { error } = await supabase.from('water_entries').insert({ user_id: userId, day, ml }); if (error) throw error; };
export const deleteWater = async (id) => { const { error } = await supabase.from('water_entries').delete().eq('id', id); if (error) throw error; };
export const clearWaterDay = async (userId, day) => { const { error } = await supabase.from('water_entries').delete().eq('user_id', userId).eq('day', day); if (error) throw error; };

// ---------- comida ----------
export const getFoodForDay = async (userId, day) => {
  const { data, error } = await supabase.from('food_entries').select('*').eq('user_id', userId).eq('day', day).order('consumed_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addFood = async (userId, day, { meal, name, kcal, grams, protein = 0, carbs = 0, fat = 0, source = null, confidence = null }) => {
  const full = {
    user_id: userId,
    day,
    meal,
    name,
    kcal: Math.max(0, Math.round(Number(kcal) || 0)),
    grams: grams == null ? null : Math.max(1, Math.round(Number(grams) || 0)),
    protein_g: Math.max(0, Math.round((Number(protein) || 0) * 10) / 10),
    carbs_g: Math.max(0, Math.round((Number(carbs) || 0) * 10) / 10),
    fat_g: Math.max(0, Math.round((Number(fat) || 0) * 10) / 10),
    source,
    confidence: confidence == null ? null : String(confidence),
  };

  let { error } = await supabase.from('food_entries').insert(full);
  if (error && isMissingColumn(error)) {
    ({ error } = await supabase.from('food_entries').insert({ user_id: userId, day, meal, name, kcal: full.kcal, grams: full.grams }));
  }
  if (error) throw error;
};

export const deleteFood = async (id) => { const { error } = await supabase.from('food_entries').delete().eq('id', id); if (error) throw error; };
export const clearFoodMeal = async (userId, day, meal) => { const { error } = await supabase.from('food_entries').delete().eq('user_id', userId).eq('day', day).eq('meal', meal); if (error) throw error; };

// ---------- histórico ----------
export const getWaterRange = async (userId, fromDay, toDay) => { const { data, error } = await supabase.from('water_entries').select('ml, day').eq('user_id', userId).gte('day', fromDay).lte('day', toDay); if (error) throw error; return data || []; };
export const getFoodRange = async (userId, fromDay, toDay) => {
  let { data, error } = await supabase.from('food_entries').select('kcal, protein_g, carbs_g, fat_g, day').eq('user_id', userId).gte('day', fromDay).lte('day', toDay);
  if (error && isMissingColumn(error)) {
    ({ data, error } = await supabase.from('food_entries').select('kcal, day').eq('user_id', userId).gte('day', fromDay).lte('day', toDay));
  }
  if (error) throw error;
  return data || [];
};

// ---------- histórico das descrições com IA ----------
export const getAiFoodHistory = async (userId) => { const { data, error } = await supabase.from('ai_food_history').select('id, description, items, created_at, last_used_at').eq('user_id', userId).order('last_used_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(30); if (error) throw error; return data || []; };
export const saveAiFoodHistory = async (userId, description, items) => { const cleanItems = (items || []).map(({ selected, ...item }) => item); const { data, error } = await supabase.from('ai_food_history').insert({ user_id: userId, description: description.trim(), items: cleanItems }).select('id, description, items, created_at, last_used_at').single(); if (error) throw error; return data; };
export const markAiFoodHistoryUsed = async (id) => { const { error } = await supabase.from('ai_food_history').update({ last_used_at: new Date().toISOString() }).eq('id', id); if (error) throw error; };
export const deleteAiFoodHistory = async (id) => { const { error } = await supabase.from('ai_food_history').delete().eq('id', id); if (error) throw error; };
