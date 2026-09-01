import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas. Veja o README.'
  );
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon', {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ---------- perfil / metas ----------
export const ensureProfile = async (userId) => {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      daily_kcal_goal: 2000,
      daily_water_goal_ml: 2000,
      onboarding_complete: false,
    });
    if (error && error.code !== '23505') throw error;
  }
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateGoals = async (userId, { kcalGoal, waterGoal }) => {
  const updates = {};
  if (kcalGoal != null) updates.daily_kcal_goal = Math.round(Number(kcalGoal));
  if (waterGoal != null) updates.daily_water_goal_ml = Math.round(Number(waterGoal));
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
};

export const saveGoalProfile = async (userId, payload) => {
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
    onboarding_complete: true,
  };
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
};

// ---------- água ----------
export const getWaterForDay = async (userId, day) => {
  const { data, error } = await supabase
    .from('water_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .order('consumed_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addWater = async (userId, day, ml) => {
  const { error } = await supabase
    .from('water_entries')
    .insert({ user_id: userId, day, ml });
  if (error) throw error;
};

export const deleteWater = async (id) => {
  const { error } = await supabase
    .from('water_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const clearWaterDay = async (userId, day) => {
  const { error } = await supabase
    .from('water_entries')
    .delete()
    .eq('user_id', userId)
    .eq('day', day);
  if (error) throw error;
};

// ---------- comida ----------
export const getFoodForDay = async (userId, day) => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .order('consumed_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addFood = async (userId, day, { meal, name, kcal, grams }) => {
  const { error } = await supabase
    .from('food_entries')
    .insert({ user_id: userId, day, meal, name, kcal, grams });
  if (error) throw error;
};

export const deleteFood = async (id) => {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const clearFoodMeal = async (userId, day, meal) => {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('user_id', userId)
    .eq('day', day)
    .eq('meal', meal);
  if (error) throw error;
};

// ---------- histórico ----------
export const getWaterRange = async (userId, fromDay, toDay) => {
  const { data, error } = await supabase
    .from('water_entries')
    .select('ml, day')
    .eq('user_id', userId)
    .gte('day', fromDay)
    .lte('day', toDay);
  if (error) throw error;
  return data || [];
};

export const getFoodRange = async (userId, fromDay, toDay) => {
  const { data, error } = await supabase
    .from('food_entries')
    .select('kcal, day')
    .eq('user_id', userId)
    .gte('day', fromDay)
    .lte('day', toDay);
  if (error) throw error;
  return data || [];
};

// ---------- histórico das descrições com IA ----------
export const getAiFoodHistory = async (userId) => {
  const { data, error } = await supabase
    .from('ai_food_history')
    .select('id, description, items, created_at, last_used_at')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
};

export const saveAiFoodHistory = async (userId, description, items) => {
  const cleanItems = (items || []).map(({ selected, ...item }) => item);
  const { data, error } = await supabase
    .from('ai_food_history')
    .insert({
      user_id: userId,
      description: description.trim(),
      items: cleanItems,
    })
    .select('id, description, items, created_at, last_used_at')
    .single();
  if (error) throw error;
  return data;
};

export const markAiFoodHistoryUsed = async (id) => {
  const { error } = await supabase
    .from('ai_food_history')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const deleteAiFoodHistory = async (id) => {
  const { error } = await supabase
    .from('ai_food_history')
    .delete()
    .eq('id', id);
  if (error) throw error;
};
