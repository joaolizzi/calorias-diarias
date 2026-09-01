import { supabase } from './supabase.js';

export const getFinanceSettings = async (userId) => {
  const { data, error } = await supabase.from('finance_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: insertError } = await supabase.from('finance_settings').insert({ user_id: userId, current_balance: 0 }).select('*').single();
  if (insertError && insertError.code !== '23505') throw insertError;
  if (insertError) { const retry = await supabase.from('finance_settings').select('*').eq('user_id', userId).single(); if (retry.error) throw retry.error; return retry.data; }
  return created;
};

export const saveFinanceSettings = async (userId, currentBalance) => {
  const { error } = await supabase.from('finance_settings').upsert({ user_id: userId, current_balance: Number(currentBalance), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
};

export const getFinanceTransactions = async (userId) => {
  const { data, error } = await supabase.from('finance_transactions').select('*').eq('user_id', userId).order('transaction_date', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addFinanceTransaction = async (userId, { type, description, category, amount, transaction_date }) => {
  const { error } = await supabase.from('finance_transactions').insert({ user_id: userId, type, description: description.trim(), category: category || 'Outros', amount: Number(amount), transaction_date });
  if (error) throw error;
};

export const deleteFinanceTransaction = async (id) => {
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
  if (error) throw error;
};
