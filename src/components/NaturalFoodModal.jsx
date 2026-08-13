import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today, MEAL_LABELS } from '../lib/dates.js';
import { parseNaturalFood } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

// Modal de "linguagem natural": usuário digita o que comeu em uma frase e o
// Gemini extrai uma lista de alimentos com porção e kcal. Permite desmarcar
// itens antes de salvar. Reaproveita o modal.css existente.
export default function NaturalFoodModal({ meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [items, setItems] = useState(null); // null = não interpretado ainda
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const interpret = async () => {
    const q = text.trim();
    if (q.length < 3) {
      toast('Descreva o que comeu (ao menos 3 letras)', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const parsed = await parseNaturalFood(q, defaultMeal);
      // marca todos como selecionados por padrão
      setItems(parsed.map((it) => ({ ...it, selected: true })));
      if (parsed.length === 0) {
        toast('Não consegui identificar alimentos. Tente de outro jeito.', { type: 'error' });
      }
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 429) toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
      else toast(e.message || 'Falha ao interpretar', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (idx) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  };

  const selected = (items || []).filter((it) => it.selected);

  const save = async () => {
    if (selected.length === 0) {
      toast('Selecione ao menos um item', { type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const day = today();
      for (const it of selected) {
        await addFood(user.id, day, {
          meal: it.meal || defaultMeal,
          name: it.name,
          kcal: it.kcal,
          grams: it.grams,
        });
      }
      toast(`${selected.length} ${selected.length === 1 ? 'item adicionado' : 'itens adicionados'}`);
      await onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Falha ao salvar', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Descrever refeição — {MEAL_LABELS[defaultMeal] || defaultMeal}</h3>

        <div className="field">
          <label>O que você comeu?</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='ex: "comi 2 ovos mexidos com queijo e uma torrada integral"'
            rows={3}
            style={{
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {!items && (
          <div className="actions">
            <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button
              className="btn primary"
              onClick={interpret}
              disabled={busy || text.trim().length < 3}
              title="Interpreta a frase com IA"
            >
              {busy ? 'Interpretando…' : 'Interpretar com IA'}
            </button>
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div className="muted" style={{ marginBottom: 8 }}>
              Confira os itens antes de salvar:
            </div>
            <ul className="log" style={{ maxHeight: 200, marginBottom: 10 }}>
              {items.map((it, idx) => (
                <li key={idx} style={{ alignItems: 'flex-start' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => toggle(idx)}
                      style={{ marginTop: 4 }}
                    />
                    <div>
                      <div className="amt">
                        {it.name}
                        <span className="meal-tag">{it.kcal} kcal</span>
                        {it.grams ? (
                          <span className="muted" style={{ fontSize: 12 }}> · {it.grams}g</span>
                        ) : null}
                        {it.meal && it.meal !== defaultMeal ? (
                          <span className="pill" style={{ marginLeft: 6 }}>
                            {MEAL_LABELS[it.meal] || it.meal}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button className="btn" onClick={() => setItems(null)} disabled={saving}>
                Voltar
              </button>
              <button
                className="btn primary food"
                onClick={save}
                disabled={saving || selected.length === 0}
              >
                {saving
                  ? 'Salvando…'
                  : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}
              </button>
            </div>
          </>
        )}

        {items && items.length === 0 && (
          <div className="actions">
            <button className="btn" onClick={() => setItems(null)}>Voltar</button>
            <button className="btn" onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
