import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deleteFood, clearFoodMeal } from '../lib/supabase.js';
import { fmtTime, MEAL_LABELS } from '../lib/dates.js';
import { toast } from './Toast.jsx';
import FoodSearch from './FoodSearch.jsx';
import AddFoodModal from './AddFoodModal.jsx';
import NaturalFoodModal from './NaturalFoodModal.jsx';

export default function FoodSection({ meal, entries, onChange }) {
  const { user } = useAuth();
  const [modalItem, setModalItem] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [showNatural, setShowNatural] = useState(false);

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

  // pode ter items de dias diferentes se ocorrer rollover — agrupar por dia
  const total = entries.reduce((s, e) => s + e.kcal, 0);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2>{MEAL_LABELS[meal]}</h2>
        <span className="num" style={{ color: 'var(--food)', fontWeight: 700 }}>
          {total} kcal
        </span>
      </div>

      <FoodSearch onPick={(item) => setModalItem(item)} />

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className="btn ghost"
          onClick={() => setShowManual(true)}
          style={{ width: '100%' }}
        >
          Não achei — adicionar manualmente
        </button>
        <button
          className="btn ghost"
          onClick={() => setShowNatural(true)}
          style={{ width: '100%' }}
          title="Descreva o que comeu em uma frase e a IA separa os itens"
        >
          <span className="pill ai" style={{ marginRight: 6 }}>IA</span>
          Descrever refeição em texto
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty" style={{ marginTop: 10 }}>
          Nenhum alimento registrado.
        </div>
      ) : (
        <ul className="log" style={{ marginTop: 14 }}>
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
              <button
                className="x"
                onClick={() => remove(e.id)}
                title="Remover"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn danger" onClick={clearMeal}>
            Limpar refeição
          </button>
        </div>
      )}

      {modalItem && (
        <AddFoodModal
          item={modalItem}
          meal={meal}
          onClose={() => setModalItem(null)}
          onSaved={onChange}
        />
      )}
      {showManual && (
        <AddFoodModal
          item={null}
          meal={meal}
          onClose={() => setShowManual(false)}
          onSaved={onChange}
        />
      )}
      {showNatural && (
        <NaturalFoodModal
          meal={meal}
          onClose={() => setShowNatural(false)}
          onSaved={onChange}
        />
      )}
    </div>
  );
}