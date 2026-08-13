import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today } from '../lib/dates.js';
import { parseNaturalFood } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

export default function AddFoodModal({ item, meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const [meal, setMeal] = useState(defaultMeal || 'breakfast');
  const [grams, setGrams] = useState(item?.kcalPer100g ? 100 : '');
  const [name, setName] = useState(item?.name || '');
  const [kcalManual, setKcalManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const calc = item ? Math.round((item.kcalPer100g * Number(grams || 0)) / 100) : 0;

  const save = async () => {
    let kcal = 0;
    let finalName = name.trim();
    let finalGrams = null;

    if (item) {
      const g = Math.round(Number(grams));
      if (!Number.isFinite(g) || g <= 0 || g > 2000) {
        toast('Porção inválida (1 a 2000 g)', { type: 'error' });
        return;
      }
      kcal = calc;
      finalGrams = g;
    } else {
      const k = Math.round(Number(kcalManual));
      if (!Number.isFinite(k) || k < 0 || k > 5000) {
        toast('Kcal inválido (0 a 5000)', { type: 'error' });
        return;
      }
      kcal = k;
    }

    if (!finalName) {
      toast('Informe o nome do alimento', { type: 'error' });
      return;
    }

    setBusy(true);
    try {
      await addFood(user.id, today(), {
        meal,
        name: finalName,
        kcal,
        grams: finalGrams,
      });
      toast(`${kcal} kcal em ${finalName}`);
      await onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Falha ao salvar', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Estima kcal do alimento via Gemini. Usado no fluxo manual (item == null)
  // quando o usuário não sabe kcal de cabeça. Parseia a frase e soma 1 item
  // (assume que `name` é um único alimento) — ou pega o primeiro se vier mais.
  const estimateKcal = async () => {
    const q = name.trim();
    if (q.length < 2) {
      toast('Digite o nome do alimento primeiro', { type: 'error' });
      return;
    }
    setEstimating(true);
    try {
      const items = await parseNaturalFood(q, meal);
      if (!items || items.length === 0) {
        toast('IA não soube estimar. Use o valor da embalagem.', { type: 'error' });
        return;
      }
      // prioriza o item cuja porção estimada é a mais "típica" (50-200g)
      const pick = items.find((it) => it.grams >= 50 && it.grams <= 200) || items[0];
      setKcalManual(String(pick.kcal));
      toast(`Estimativa: ${pick.kcal} kcal por ${pick.grams}g. Confira antes de salvar.`);
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 429) toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
      else toast(e.message || 'Falha na estimativa', { type: 'error' });
    } finally {
      setEstimating(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{item ? `Adicionar: ${item.name}` : 'Adicionar manualmente'}</h3>

        <div className="field">
          <label>Refeição</label>
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            <option value="breakfast">Café da manhã</option>
            <option value="lunch">Almoço</option>
            <option value="dinner">Jantar</option>
            <option value="snack">Lanche</option>
          </select>
        </div>

        {item ? (
          <>
            <div className="field">
              <label>Porção (gramas)</label>
              <input
                type="number"
                min="1"
                max="2000"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="preview">
              <div className="muted">
                {item.kcalPer100g} kcal / 100g × {grams || 0} g
              </div>
              <div className="v">{calc} kcal</div>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>Nome do alimento</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: maçã"
              />
            </div>
            <div className="field">
              <label>Kcal totais</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={kcalManual}
                  onChange={(e) => setKcalManual(e.target.value)}
                  inputMode="numeric"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn"
                  onClick={estimateKcal}
                  disabled={estimating || busy || name.trim().length < 2}
                  title="Estima kcal do alimento com IA"
                >
                  {estimating ? '...' : <><span className="pill ai">IA</span> Estimar</>}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn primary food" onClick={save} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}