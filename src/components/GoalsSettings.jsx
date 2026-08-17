import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { updateGoals } from '../lib/supabase.js';
import { toast } from './Toast.jsx';

export default function GoalsSettings({ profile, onSaved }) {
  const { user } = useAuth();
  const [kcal, setKcal] = useState(profile?.daily_kcal_goal || 2000);
  const [water, setWater] = useState(profile?.daily_water_goal_ml || 2000);

  useEffect(() => {
    setKcal(profile?.daily_kcal_goal || 2000);
    setWater(profile?.daily_water_goal_ml || 2000);
  }, [profile]);

  const save = async () => {
    let k = Math.round(Number(kcal));
    let w = Math.round(Number(water));
    if (!Number.isFinite(k) || k < 500 || k > 10000) k = 2000;
    if (!Number.isFinite(w) || w < 250 || w > 10000) w = 2000;
    try {
      await updateGoals(user.id, { kcalGoal: k, waterGoal: w });
      await onSaved();
      toast('Metas atualizadas');
    } catch (e) {
      toast(e.message || 'Falha ao salvar', { type: 'error' });
    }
  };

  return (
    <div className="card">
      <h2>Metas diárias</h2>

      <div className="goals-settings-grid">
        <div className="goal-field">
          <label htmlFor="goal-kcal">Calorias</label>
          <div className="goal-field-row">
            <input
              id="goal-kcal"
              type="number"
              min="500"
              max="10000"
              step="50"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
              }}
            />
            <span className="goal-field-unit muted">kcal</span>
          </div>
        </div>

        <div className="goal-field">
          <label htmlFor="goal-water">Água</label>
          <div className="goal-field-row">
            <input
              id="goal-water"
              type="number"
              min="250"
              max="10000"
              step="50"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
              }}
            />
            <span className="goal-field-unit muted">ml</span>
          </div>
        </div>
      </div>

      <p className="goals-hint muted">
        As alterações são salvas automaticamente ao sair do campo.
      </p>
    </div>
  );
}
