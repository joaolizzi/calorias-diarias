import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today } from '../lib/dates.js';
import { parseNaturalFood } from '../lib/gemini.js';
import { nutritionForGrams } from '../lib/macros.js';
import { toast } from './Toast.jsx';

export default function AddFoodModal({ item, meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const [meal, setMeal] = useState(defaultMeal || 'breakfast');
  const [grams, setGrams] = useState(item?.portionSuggestionG || (item?.kcalPer100g ? 100 : ''));
  const [name, setName] = useState(item?.name || '');
  const [kcalManual, setKcalManual] = useState('');
  const [proteinManual, setProteinManual] = useState('');
  const [carbsManual, setCarbsManual] = useState('');
  const [fatManual, setFatManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const calculated = useMemo(() => item ? nutritionForGrams(item, grams || 1) : null, [item, grams]);

  const save = async () => {
    let payload;
    const finalName = name.trim();
    if (!finalName) { toast('Informe o nome do alimento', { type: 'error' }); return; }

    if (item) {
      const g = Math.round(Number(grams));
      if (!Number.isFinite(g) || g <= 0 || g > 3000) { toast('Porção inválida (1 a 3000 g)', { type: 'error' }); return; }
      payload = {
        meal,
        name: finalName,
        ...calculated,
        source: item.source || 'manual',
        confidence: item.confidence || null,
      };
    } else {
      const kcal = Math.round(Number(kcalManual));
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) { toast('Kcal inválido (0 a 5000)', { type: 'error' }); return; }
      const manualGrams = Number(grams);
      payload = {
        meal,
        name: finalName,
        kcal,
        grams: Number.isFinite(manualGrams) && manualGrams > 0 ? Math.round(manualGrams) : null,
        protein: Math.max(0, Number(proteinManual) || 0),
        carbs: Math.max(0, Number(carbsManual) || 0),
        fat: Math.max(0, Number(fatManual) || 0),
        source: 'manual',
      };
    }

    setBusy(true);
    try {
      await addFood(user.id, today(), payload);
      toast(`${payload.kcal} kcal em ${finalName}`);
      await onSaved();
      onClose();
    } catch (e) { toast(e.message || 'Falha ao salvar', { type: 'error' }); }
    finally { setBusy(false); }
  };

  const estimateKcal = async () => {
    const q = name.trim();
    if (q.length < 2) { toast('Digite o nome do alimento primeiro', { type: 'error' }); return; }
    setEstimating(true);
    try {
      const items = await parseNaturalFood(q, meal);
      if (!items?.length) { toast('IA não soube estimar. Use o valor da embalagem.', { type: 'error' }); return; }
      const pick = items.find((it) => it.grams >= 50 && it.grams <= 200) || items[0];
      setGrams(String(pick.grams || ''));
      setKcalManual(String(pick.kcal || 0));
      setProteinManual(String(pick.protein || 0));
      setCarbsManual(String(pick.carbs || 0));
      setFatManual(String(pick.fat || 0));
      toast(`Estimativa para ${pick.grams}g preenchida. Confira antes de salvar.`);
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 429) toast('A IA está ocupada; tente novamente em alguns segundos', { type: 'error' });
      else toast(e.message || 'Falha na estimativa', { type: 'error' });
    } finally { setEstimating(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal add-food-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{item ? `Adicionar: ${item.name}` : 'Adicionar manualmente'}</h3>

        <div className="field"><label>Refeição</label><select value={meal} onChange={(e) => setMeal(e.target.value)}><option value="breakfast">Café da manhã</option><option value="lunch">Almoço</option><option value="dinner">Jantar</option><option value="snack">Lanche</option></select></div>

        {item ? (
          <>
            <div className="field"><label>Porção (gramas)</label><input type="number" min="1" max="3000" value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="numeric" /></div>
            <div className="preview macro-food-preview">
              <div className="muted">{item.kcalPer100g} kcal / 100g × {grams || 0}g</div>
              <div className="v">{calculated?.kcal || 0} kcal</div>
              <div className="macro-inline-stats"><span><b>{Number(calculated?.protein || 0).toFixed(1)}</b> P</span><span><b>{Number(calculated?.carbs || 0).toFixed(1)}</b> C</span><span><b>{Number(calculated?.fat || 0).toFixed(1)}</b> G</span></div>
            </div>
          </>
        ) : (
          <>
            <div className="field"><label>Nome do alimento</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: maçã" /></div>
            <div className="manual-estimate-row"><button className="btn" onClick={estimateKcal} disabled={estimating || busy || name.trim().length < 2}>{estimating ? 'Estimando…' : <><span className="pill ai">IA</span> Preencher valores</>}</button></div>
            <div className="manual-nutrition-grid">
              <div className="field"><label>Quantidade</label><div className="goal-field-row"><input type="number" min="1" max="3000" value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="numeric" /><span className="goal-field-unit muted">g</span></div></div>
              <div className="field"><label>Calorias</label><div className="goal-field-row"><input type="number" min="0" max="5000" value={kcalManual} onChange={(e) => setKcalManual(e.target.value)} inputMode="numeric" /><span className="goal-field-unit muted">kcal</span></div></div>
              <div className="field"><label>Proteína</label><div className="goal-field-row"><input type="number" min="0" max="500" step="0.1" value={proteinManual} onChange={(e) => setProteinManual(e.target.value)} /><span className="goal-field-unit muted">g</span></div></div>
              <div className="field"><label>Carboidratos</label><div className="goal-field-row"><input type="number" min="0" max="1000" step="0.1" value={carbsManual} onChange={(e) => setCarbsManual(e.target.value)} /><span className="goal-field-unit muted">g</span></div></div>
              <div className="field"><label>Gorduras</label><div className="goal-field-row"><input type="number" min="0" max="500" step="0.1" value={fatManual} onChange={(e) => setFatManual(e.target.value)} /><span className="goal-field-unit muted">g</span></div></div>
            </div>
          </>
        )}

        <div className="actions"><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn primary food" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
      </div>
    </div>
  );
}
