import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  addFood,
  deleteAiFoodHistory,
  getAiFoodHistory,
  markAiFoodHistoryUsed,
  saveAiFoodHistory,
} from '../lib/supabase.js';
import { today, MEAL_LABELS } from '../lib/dates.js';
import { parseNaturalFood } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

export default function NaturalFoodModal({ meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(true);
  const [savedCurrent, setSavedCurrent] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadHistory = async () => {
      if (!user?.id) {
        setHistoryBusy(false);
        return;
      }
      try {
        const data = await getAiFoodHistory(user.id);
        if (alive) setHistory(data);
      } catch (e) {
        console.error('[ai-history] load error', e);
      } finally {
        if (alive) setHistoryBusy(false);
      }
    };
    loadHistory();
    return () => { alive = false; };
  }, [user?.id]);

  const interpret = async () => {
    const q = text.trim();
    if (q.length < 3) {
      toast('Descreva o que comeu (ao menos 3 letras)', { type: 'error' });
      return;
    }
    setBusy(true);
    setSavedCurrent(false);
    try {
      const parsed = await parseNaturalFood(q, defaultMeal);
      setItems(parsed.map((it) => ({ ...it, selected: true })));
      if (parsed.length === 0) toast('Não consegui identificar alimentos. Tente de outro jeito.', { type: 'error' });
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 429) toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
      else toast(e.message || 'Falha ao interpretar', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const useHistory = async (entry) => {
    setText(entry.description);
    setItems((entry.items || []).map((it) => ({ ...it, meal: defaultMeal, selected: true })));
    setSavedCurrent(true);
    try {
      await markAiFoodHistoryUsed(entry.id);
      setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    } catch (e) {
      console.error('[ai-history] mark used error', e);
    }
  };

  const editHistory = (entry) => {
    setText(entry.description);
    setItems(null);
    setSavedCurrent(true);
  };

  const removeHistory = async (entry) => {
    try {
      await deleteAiFoodHistory(entry.id);
      setHistory((current) => current.filter((item) => item.id !== entry.id));
      toast('Rotina removida do histórico');
    } catch (e) {
      toast(e.message || 'Falha ao remover rotina', { type: 'error' });
    }
  };

  const saveCurrentHistory = async () => {
    if (!user?.id || !text.trim() || !items?.length || savedCurrent) return;
    setSaving(true);
    try {
      const entry = await saveAiFoodHistory(user.id, text, items);
      setHistory((current) => [entry, ...current]);
      setSavedCurrent(true);
      toast('Rotina salva no histórico');
    } catch (e) {
      toast(e.message || 'Falha ao salvar no histórico', { type: 'error' });
    } finally {
      setSaving(false);
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
          meal: defaultMeal,
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
      <div className="modal natural-food-modal" onClick={(e) => e.stopPropagation()}>
        <div className="natural-modal-head">
          <div>
            <span className="natural-modal-kicker">Registro inteligente</span>
            <h3>Descrever refeição</h3>
            <small>{MEAL_LABELS[defaultMeal] || defaultMeal}</small>
          </div>
          <button className="natural-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="field natural-food-field">
          <label>O que você comeu?</label>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setSavedCurrent(false); }}
            placeholder='ex: "comi 2 ovos mexidos com queijo e uma torrada integral"'
            rows={3}
          />
        </div>

        {!items && (
          <div className="actions natural-modal-actions">
            <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn primary" onClick={interpret} disabled={busy || text.trim().length < 3} title="Interpreta a frase com IA">
              {busy ? 'Interpretando…' : 'Interpretar'}
            </button>
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div className="natural-items-label">Confira os itens antes de salvar</div>
            <ul className="log natural-items-list">
              {items.map((it, idx) => (
                <li key={idx}>
                  <label className="natural-item-check">
                    <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} />
                    <div>
                      <div className="amt">
                        {it.name}
                        <span className="meal-tag">{it.kcal} kcal</span>
                        {it.grams ? <span className="muted"> · {it.grams}g</span> : null}
                        {it.meal && it.meal !== defaultMeal ? <span className="pill">{MEAL_LABELS[it.meal] || it.meal}</span> : null}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="actions natural-modal-actions natural-modal-actions-wrap">
              <button className="btn" onClick={() => setItems(null)} disabled={saving}>Voltar</button>
              <button className="btn" onClick={saveCurrentHistory} disabled={saving || savedCurrent || !user?.id} title="Guarda esta descrição e os itens para repetir depois">
                {savedCurrent ? '✓ Rotina salva' : saving ? 'Salvando…' : 'Salvar rotina'}
              </button>
              <button className="btn primary food" onClick={save} disabled={saving || selected.length === 0}>
                {saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}
              </button>
            </div>
          </>
        )}

        {items && items.length === 0 && (
          <div className="actions natural-modal-actions">
            <button className="btn" onClick={() => setItems(null)}>Voltar</button>
            <button className="btn" onClick={onClose}>Fechar</button>
          </div>
        )}

        <section className="saved-routines-panel">
          <div className="saved-routines-head">
            <div>
              <span className="natural-modal-kicker">Atalhos</span>
              <strong>Suas rotinas salvas</strong>
            </div>
            <span className="saved-routines-count">{history.length}/30</span>
          </div>

          {historyBusy ? (
            <div className="saved-routines-empty">Carregando rotinas…</div>
          ) : history.length === 0 ? (
            <div className="saved-routines-empty">
              <strong>Nenhuma rotina salva</strong>
              <small>Interprete uma refeição e use “Salvar rotina” para repetir depois sem chamar a IA novamente.</small>
            </div>
          ) : (
            <div className="saved-routines-list">
              {history.map((entry) => (
                <article className="saved-routine-card" key={entry.id}>
                  <button className="saved-routine-main" onClick={() => useHistory(entry)} title="Usar esta rotina sem chamar a IA novamente">
                    <strong>{entry.description}</strong>
                    <small>{(entry.items || []).length} {(entry.items || []).length === 1 ? 'item' : 'itens'} · {new Date(entry.created_at).toLocaleDateString('pt-BR')}</small>
                  </button>
                  <div className="saved-routine-actions">
                    <button onClick={() => editHistory(entry)} title="Editar e interpretar novamente" aria-label="Editar rotina">✎</button>
                    <button className="danger" onClick={() => removeHistory(entry)} title="Excluir rotina" aria-label="Excluir rotina">×</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
