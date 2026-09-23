import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { updateGoals } from '../lib/supabase.js';
import { macroGoalsFromProfile } from '../lib/macros.js';
import { toast } from './Toast.jsx';

export default function GoalsSettings({ profile, onSaved }) {
  const { user } = useAuth();
  const fallback = macroGoalsFromProfile(profile);
  const [kcal, setKcal] = useState(profile?.daily_kcal_goal || 2000);
  const [water, setWater] = useState(profile?.daily_water_goal_ml || 2000);
  const [protein, setProtein] = useState(fallback.protein);
  const [carbs, setCarbs] = useState(fallback.carbs);
  const [fat, setFat] = useState(fallback.fat);

  useEffect(() => {
    const macros = macroGoalsFromProfile(profile);
    setKcal(profile?.daily_kcal_goal || 2000);
    setWater(profile?.daily_water_goal_ml || 2000);
    setProtein(macros.protein);
    setCarbs(macros.carbs);
    setFat(macros.fat);
  }, [profile]);

  const save = async () => {
    let k = Math.round(Number(kcal));
    let w = Math.round(Number(water));
    let p = Math.round(Number(protein));
    let c = Math.round(Number(carbs));
    let f = Math.round(Number(fat));
    if (!Number.isFinite(k) || k < 500 || k > 10000) k = 2000;
    if (!Number.isFinite(w) || w < 250 || w > 10000) w = 2000;
    if (!Number.isFinite(p) || p < 0 || p > 500) p = fallback.protein;
    if (!Number.isFinite(c) || c < 0 || c > 1000) c = fallback.carbs;
    if (!Number.isFinite(f) || f < 0 || f > 500) f = fallback.fat;
    try {
      await updateGoals(user.id, { kcalGoal: k, waterGoal: w, proteinGoal: p, carbsGoal: c, fatGoal: f });
      await onSaved();
      toast('Metas atualizadas');
    } catch (e) { toast(e.message || 'Falha ao salvar', { type: 'error' }); }
  };

  const field = (id, label, value, setter, unit, min, max, step = 1) => (
    <div className="goal-field">
      <label htmlFor={id}>{label}</label>
      <div className="goal-field-row">
        <input id={id} type="number" min={min} max={max} step={step} value={value} onChange={(e) => setter(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
        <span className="goal-field-unit muted">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="goals-settings-head"><div><h2>Metas diárias</h2><p className="muted">Ajuste calorias, hidratação e distribuição de macros.</p></div></div>
      <div className="goals-settings-grid macro-goals-grid">
        {field('goal-kcal', 'Calorias', kcal, setKcal, 'kcal', 500, 10000, 50)}
        {field('goal-water', 'Água', water, setWater, 'ml', 250, 10000, 50)}
        {field('goal-protein', 'Proteína', protein, setProtein, 'g', 0, 500)}
        {field('goal-carbs', 'Carboidratos', carbs, setCarbs, 'g', 0, 1000)}
        {field('goal-fat', 'Gorduras', fat, setFat, 'g', 0, 500)}
      </div>
      <p className="goals-hint muted">As alterações são salvas automaticamente ao sair do campo.</p>
    </div>
  );
}
