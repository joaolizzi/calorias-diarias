import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deleteFood, clearFoodMeal } from '../lib/supabase.js';
import { MEAL_LABELS } from '../lib/dates.js';
import { entryMacros, sumMacros } from '../lib/macros.js';
import { toast } from './Toast.jsx';
import FoodSearch from './FoodSearch.jsx';
import AddFoodModal from './AddFoodModal.jsx';
import Icon from './Icon.jsx';
import { fmtNum, fmtInt } from './format.js';
const NaturalFoodModal = lazy(() => import('./NaturalFoodModal.jsx'));
const CameraFoodModal = lazy(() => import('./CameraFoodModal.jsx'));

// Origem do dado: contorno sólido = base de dados (TBCA, rótulo) ou valor manual;
// contorno tracejado + texto = estimativa feita pela IA.
export const SOURCE_INFO = {
  tbca: { label: 'TBCA', ai: false },
  openfoodfacts: { label: 'Rótulo', ai: false },
  off: { label: 'Rótulo', ai: false },
  manual: { label: 'Manual', ai: false },
  gemini: { label: 'Estimativa IA', ai: true },
  'gemini-vision': { label: 'Estimativa IA', ai: true },
};

export function SourceChip({ source }) {
  if (!source) return null;
  const info = SOURCE_INFO[source] || { label: source, ai: false };
  return <span className={`source-chip ${info.ai ? 'estimate' : ''}`}>{info.label}</span>;
}

export default function FoodSection({ meal, entries, onChange, initialAction = null, dayKcal = 0, kcalGoal = 0 }) {
  const { user } = useAuth();
  const [modalItem, setModalItem] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [showNatural, setShowNatural] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (initialAction === 'natural') setShowNatural(true);
    if (initialAction === 'manual') setShowManual(true);
    if (initialAction === 'camera') setShowCamera(true);
  }, [initialAction, meal]);

  const remove = async (id) => {
    try { await deleteFood(id); await onChange(); }
    catch (e) { toast(e.message || 'Falha ao remover', { type: 'error' }); }
  };

  const clearMeal = async () => {
    if (!entries.length) return;
    if (!confirm(`Apagar todos os registros de ${MEAL_LABELS[meal]}?`)) return;
    try {
      await clearFoodMeal(user.id, entries[0]?.day || new Date().toISOString().slice(0, 10), meal);
      await onChange();
    } catch (e) { toast(e.message || 'Falha ao limpar', { type: 'error' }); }
  };

  const total = entries.reduce((s, e) => s + Number(e.kcal || 0), 0);
  const macros = sumMacros(entries);

  return (
    <div className="meal-body">
      <FoodSearch onPick={(item) => setModalItem(item)} />

      <div className="entry-actions" role="group" aria-label="Formas de registrar alimento">
        <button type="button" className="entry-action" onClick={() => setShowCamera(true)} title="Fotografe a refeição e a IA estima os alimentos">
          <Icon name="camera" size={19} />
          <span className="entry-action-label">Fotografar</span>
          <span className="source-chip estimate">IA</span>
        </button>
        <button type="button" className="entry-action" onClick={() => setShowNatural(true)} title="Descreva o que comeu em uma frase e a IA separa os itens">
          <Icon name="sparkles" size={19} />
          <span className="entry-action-label">Descrever por texto</span>
          <span className="source-chip estimate">IA</span>
        </button>
        <button type="button" className="entry-action" onClick={() => setShowManual(true)}>
          <Icon name="plus" size={19} />
          <span className="entry-action-label">Adicionar manualmente</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="meal-empty">Nenhum alimento registrado. Use a busca ou uma das opções acima.</p>
      ) : (
        <ul className="food-items">
          {[...entries].reverse().map((e) => {
            const macro = entryMacros(e);
            return (
              <li key={e.id}>
                <div className="food-item-main">
                  <div className="food-item-name">{e.name}</div>
                  <div className="food-item-meta num">
                    {e.grams ? `${fmtNum(e.grams, 0)} g · ` : ''}P {fmtNum(macro.protein)} · C {fmtNum(macro.carbs)} · G {fmtNum(macro.fat)}
                  </div>
                </div>
                <SourceChip source={e.source} />
                <span className="food-item-kcal num">{fmtInt(e.kcal)} kcal</span>
                <button type="button" className="icon-btn" onClick={() => remove(e.id)} title={`Remover ${e.name}`} aria-label={`Remover ${e.name}`}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="meal-total">
          <span className="meal-total-name">Total de {MEAL_LABELS[meal].toLowerCase()}</span>
          <span className="meal-total-macros num">P {fmtNum(macros.protein)} g · C {fmtNum(macros.carbs)} g · G {fmtNum(macros.fat)} g</span>
          <span className="meal-total-kcal num">{fmtInt(total)} kcal</span>
          <button type="button" className="btn-quiet" onClick={clearMeal}>Limpar refeição</button>
        </div>
      )}

      {modalItem && <AddFoodModal item={modalItem} meal={meal} onClose={() => setModalItem(null)} onSaved={onChange} />}
      {showManual && <AddFoodModal item={null} meal={meal} onClose={() => setShowManual(false)} onSaved={onChange} />}
      <Suspense fallback={null}>
        {showNatural && <NaturalFoodModal meal={meal} dayKcal={dayKcal} kcalGoal={kcalGoal} onClose={() => setShowNatural(false)} onSaved={onChange} />}
        {showCamera && <CameraFoodModal meal={meal} onClose={() => setShowCamera(false)} onSaved={onChange} />}
      </Suspense>
    </div>
  );
}
