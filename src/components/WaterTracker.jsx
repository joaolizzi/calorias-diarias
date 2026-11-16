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
    const ml = Math.round(Number(mlRaw));
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
      toast(`+${ml} ml registrado`);
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

  const items = [...entries].reverse();

  return (
    <>
      <div className="quick">
        {QUICK.map((ml) => (
          <button type="button" key={ml} className="chip-btn" onClick={() => add(ml)} aria-label={`Adicionar ${ml} ml de água`}>
            +{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
          </button>
        ))}
      </div>

      <div className="custom">
        <label htmlFor="water-custom" className="sr-only">Quantidade de água em mililitros</label>
        <input
          id="water-custom"
          type="number"
          min="1"
          max="5000"
          step="1"
          placeholder="Outra quantidade, em ml"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(custom); }}
          inputMode="numeric"
        />
        <button type="button" className="btn primary" onClick={() => add(custom)}>Adicionar</button>
      </div>

      <div className="water-log">
        <h3>Registros de hoje</h3>
        {items.length === 0 ? (
          <p className="muted water-empty">Nenhuma água registrada ainda.</p>
        ) : (
          <ul className="log">
            {items.map((e) => (
              <li key={e.id}>
                <span className="when">{fmtTime(e.consumed_at)}</span>
                <span className="amt">+{e.ml} ml</span>
              </li>
            ))}
          </ul>
        )}
        <div className="water-log-foot">
          <button type="button" className="btn-quiet" onClick={clearDay} disabled={!entries.length}>Limpar água do dia</button>
        </div>
      </div>
    </>
  );
}
