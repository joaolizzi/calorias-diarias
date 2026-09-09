import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deleteFood, clearFoodMeal } from '../lib/supabase.js';
import { fmtTime, MEAL_LABELS } from '../lib/dates.js';
import { toast } from './Toast.jsx';
import FoodSearch from './FoodSearch.jsx';
import AddFoodModal from './AddFoodModal.jsx';
import NaturalFoodModal from './NaturalFoodModal.jsx';
import CameraFoodModal from './CameraFoodModal.jsx';

export default function FoodSection({ meal, entries, onChange }) {
  const { user } = useAuth();
  const [modalItem, setModalItem] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [showNatural, setShowNatural] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const remove = async (id) => {
    try {
      await deleteFood(id);
      await onChange();
    } catch (e) {
      toast(e.message || 'Falha ao remover', { type: 'error' });
    }
  };

  const clearMeal = async () => {
    if (!entries.length) return;
    if (!confirm(`Apagar todos os registros de ${MEAL_LABELS[meal]}?`)) return;
    try {
      await clearFoodMeal(user.id, entries[0]?.day || new Date().toISOString().slice(0, 10), meal);
      await onChange();
    } catch (e) {
      toast(e.message || 'Falha ao limpar', { type: 'error' });
    }
  };

  const total = entries.reduce((s, e) => s + e.kcal, 0);

  return (
    <div className="card food-section-card">
      <div className="card-head food-section-head">
        <div>
          <span className="food-section-eyebrow">Refeição</span>
          <h2>{MEAL_LABELS[meal]}</h2>
        </div>
        <span className="meal-total num">{total.toLocaleString('pt-BR')} kcal</span>
      </div>

      <div className="food-section-search">
        <FoodSearch onPick={(item) => setModalItem(item)} />
      </div>

      <div className="food-entry-actions" aria-label="Formas de registrar alimento">
        <button
          type="button"
          className="food-entry-action"
          onClick={() => setShowCamera(true)}
          title="Fotografe a refeição e deixe a IA estimar os alimentos"
        >
          <span className="food-entry-action-icon">▣</span>
          <span>
            <strong>Fotografar</strong>
            <small>Identificar alimentos pela imagem</small>
          </span>
        </button>

        <button
          type="button"
          className="food-entry-action"
          onClick={() => setShowManual(true)}
        >
          <span className="food-entry-action-icon">＋</span>
          <span>
            <strong>Adicionar manualmente</strong>
            <small>Informar alimento e quantidade</small>
          </span>
        </button>

        <button
          type="button"
          className="food-entry-action"
          onClick={() => setShowNatural(true)}
          title="Descreva o que comeu em uma frase e a IA separa os itens"
        >
          <span className="food-entry-action-icon">✦</span>
          <span>
            <strong>Descrever por texto</strong>
            <small>Registrar uma refeição em uma frase</small>
          </span>
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="food-empty-state">
          <span className="food-empty-icon">○</span>
          <strong>Nenhum alimento registrado</strong>
          <small>Use a busca ou uma das opções acima para começar.</small>
        </div>
      ) : (
        <ul className="log food-log">
          {[...entries].reverse().map((e) => (
            <li key={e.id}>
              <div>
                <div className="amt">
                  {e.name}{' '}
                  <span className="meal-tag">{e.kcal} kcal</span>
                  {e.grams ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      {' '}({e.grams} g)
                    </span>
                  ) : null}
                </div>
                <div className="when">
                  {fmtTime(e.consumed_at)}
                  {e.day ? ` · ${e.day}` : ''}
                </div>
              </div>
              <button className="x" onClick={() => remove(e.id)} title="Remover">×</button>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="food-section-footer">
          <button className="btn danger" onClick={clearMeal}>Limpar refeição</button>
        </div>
      )}

      {modalItem && (
        <AddFoodModal item={modalItem} meal={meal} onClose={() => setModalItem(null)} onSaved={onChange} />
      )}
      {showManual && (
        <AddFoodModal item={null} meal={meal} onClose={() => setShowManual(false)} onSaved={onChange} />
      )}
      {showNatural && (
        <NaturalFoodModal meal={meal} onClose={() => setShowNatural(false)} onSaved={onChange} />
      )}
      {showCamera && (
        <CameraFoodModal meal={meal} onClose={() => setShowCamera(false)} onSaved={onChange} />
      )}
    </div>
  );
}
