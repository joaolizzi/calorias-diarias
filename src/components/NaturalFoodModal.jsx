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

// Modal de linguagem natural + histórico opcional de rotinas feitas com IA.
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
        // O histórico é opcional: não bloqueia o uso normal da IA.
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

  const useHistory = async (entry) => {
    setText(entry.description);
    setItems((entry.items || []).map((it) => ({ ...it, selected: true })));
    setSavedCurrent(true);
    try {
      await markAiFoodHistoryUsed(entry.id);
      setHistory((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
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
            onChange={(e) => { setText(e.target.value); setSavedCurrent(false); }}
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
            <div className="actions" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setItems(null)} disabled={saving}>
                Voltar
              </button>
              <button
                className="btn"
                onClick={saveCurrentHistory}
                disabled={saving || savedCurrent || !user?.id}
                title="Guarda esta descrição e os itens para repetir depois"
              >
                {savedCurrent ? '✓ Rotina salva' : saving ? 'Salvando…' : '💾 Salvar rotina'}
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

        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong>🔄 Suas rotinas salvas</strong>
            <span className="muted" style={{ fontSize: 12 }}>até 30</span>
          </div>

          {historyBusy ? (
            <div className="muted" style={{ fontSize: 13 }}>Carregando histórico…</div>
          ) : history.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Ainda não há rotinas salvas. Depois de interpretar uma refeição, clique em “💾 Salvar rotina”.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 7, maxHeight: 180, overflowY: 'auto' }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--panel-2)',
                  }}
                >
                  <button
                    className="btn"
                    onClick={() => useHistory(entry)}
                    style={{ flex: 1, textAlign: 'left', minWidth: 0, padding: '7px 9px' }}
                    title="Usar esta rotina sem chamar a IA novamente"
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.description}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {(entry.items || []).length} {(entry.items || []).length === 1 ? 'item' : 'itens'} · {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </button>
                  <button className="btn" onClick={() => editHistory(entry)} title="Editar e interpretar novamente">✏️</button>
                  <button className="btn" onClick={() => removeHistory(entry)} title="Excluir rotina">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
