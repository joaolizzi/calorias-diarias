import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addWater, clearWaterDay } from '../lib/supabase.js';
import { today, fmtTime } from '../lib/dates.js';
import { toast } from './Toast.jsx';

const QUICK = [100, 200, 250, 500, 600, 700, 1000];

export default function WaterTracker({ entries, onChange }) {
  const { user } = useAuth();
  const [custom, setCustom] = useState('');
  const day = today();

  const add = async (mlRaw) => {
    let ml = Math.round(Number(mlRaw));
    if (!Number.isFinite(ml) || ml <= 0) {
      toast('Valor inválido', { type: 'error' });
      return;
    }
    if (ml > 5000) {
      toast('Máximo 5000 ml por vez', { type: 'error' });
      return;
    }
    try {
      await addWater(user.id, day, ml);
      setCustom('');
      await onChange();
      toast(`+${ml} ml registrado 💧`);
    } catch (e) {
      toast(e.message || 'Falha ao salvar', { type: 'error' });
    }
  };

  const clearDay = async () => {
    if (!entries.length) return;
    if (!confirm('Apagar todas as entradas de água de hoje?')) return;
    try {
      await clearWaterDay(user.id, day);
      await onChange();
    } catch (e) {
      toast(e.message || 'Falha ao limpar', { type: 'error' });
    }
  };

  // reverse chronological for display
  const items = [...entries].reverse();

  return (
    <>
      <div className="quick">
        {QUICK.map((ml) => (
          <button key={ml} className="btn" onClick={() => add(ml)}>
            +{ml >= 1000 ? `${ml / 1000}L` : `${ml} ml`}
          </button>
        ))}
      </div>
      <div className="custom">
        <input
          type="number"
          min="1"
          max="5000"
          step="1"
          placeholder="ml (ex: 450)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add(custom);
          }}
          inputMode="numeric"
        />
        <button className="btn primary" onClick={() => add(custom)}>
          Adicionar
        </button>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        💡 1 copo ≈ 200–250 ml · 1 garrafa ≈ 500 ml
      </div>

      {items.length > 0 && (
        <ul className="log" style={{ marginTop: 14 }}>
          {items.map((e) => (
            <li key={e.id}>
              <div>
                <div className="amt">+{e.ml} ml</div>
                <div className="when">{fmtTime(e.consumed_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn danger" onClick={clearDay} disabled={!entries.length}>
          Limpar água do dia
        </button>
      </div>
    </>
  );
}