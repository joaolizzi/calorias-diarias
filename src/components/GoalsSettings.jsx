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
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="goal-input" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <label className="muted">Calorias</label>
            <input
              type="number"
              min="500"
              max="10000"
              step="50"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
            />
          </div>
          <span className="muted">kcal</span>
        </div>
        <div className="goal-input" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <label className="muted">Água</label>
            <input
              type="number"
              min="250"
              max="10000"
              step="50"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
            />
          </div>
          <span className="muted">ml</span>
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Salva automaticamente ao sair do campo.
      </div>
    </div>
  );
}