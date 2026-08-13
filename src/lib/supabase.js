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

// ---------- queries ----------
export const ensureProfile = async (userId) => {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!existing) {
    await supabase.from('profiles').insert({
      id: userId,
      daily_kcal_goal: 2000,
      daily_water_goal_ml: 2000,
    });
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
  if (kcalGoal != null) updates.daily_kcal_goal = kcalGoal;
  if (waterGoal != null) updates.daily_water_goal_ml = waterGoal;
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
};

// ---------- water ----------
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

// ---------- food ----------
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