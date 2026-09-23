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
import { nutritionForGrams } from '../lib/macros.js';
import { toast } from './Toast.jsx';

const SOURCE_LABEL = { tbca: 'TBCA', gemini: 'Estimativa IA', 'gemini-vision': 'IA por foto', openfoodfacts: 'Rótulo' };
const CONFIDENCE_LABEL = { high: 'Alta confiança', medium: 'Média confiança', low: 'Baixa confiança' };

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
      if (!user?.id) { setHistoryBusy(false); return; }
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
    if (q.length < 3) { toast('Descreva o que comeu (ao menos 3 letras)', { type: 'error' }); return; }
    setBusy(true);
    setSavedCurrent(false);
    try {
      const parsed = await parseNaturalFood(q, defaultMeal);
      setItems(parsed.map((it) => ({ ...it, selected: true })));
      if (parsed.length === 0) toast('Não consegui identificar alimentos. Tente de outro jeito.', { type: 'error' });
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 429) toast('A IA está ocupada; tente novamente em alguns segundos', { type: 'error' });
      else toast(e.message || 'Falha ao interpretar', { type: 'error' });
    } finally { setBusy(false); }
  };

  const useHistory = async (entry) => {
    setText(entry.description);
    setItems((entry.items || []).map((it) => ({ ...it, meal: defaultMeal, selected: true })));
    setSavedCurrent(true);
    try {
      await markAiFoodHistoryUsed(entry.id);
      setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    } catch (e) { console.error('[ai-history] mark used error', e); }
  };

  const editHistory = (entry) => { setText(entry.description); setItems(null); setSavedCurrent(true); };
  const removeHistory = async (entry) => {
    try {
      await deleteAiFoodHistory(entry.id);
      setHistory((current) => current.filter((item) => item.id !== entry.id));
      toast('Rotina removida do histórico');
    } catch (e) { toast(e.message || 'Falha ao remover rotina', { type: 'error' }); }
  };

  const saveCurrentHistory = async () => {
    if (!user?.id || !text.trim() || !items?.length || savedCurrent) return;
    setSaving(true);
    try {
      const entry = await saveAiFoodHistory(user.id, text, items);
      setHistory((current) => [entry, ...current]);
      setSavedCurrent(true);
      toast('Rotina salva no histórico');
    } catch (e) { toast(e.message || 'Falha ao salvar no histórico', { type: 'error' }); }
    finally { setSaving(false); }
  };

  const toggle = (idx) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  const setGrams = (idx, value) => {
    const grams = Math.max(1, Math.min(3000, Math.round(Number(value) || 1)));
    setItems((arr) => arr.map((it, i) => i === idx ? { ...it, ...nutritionForGrams(it, grams) } : it));
    setSavedCurrent(false);
  };

  const selected = (items || []).filter((it) => it.selected);
  const selectedTotals = selected.reduce((acc, it) => ({
    kcal: acc.kcal + (Number(it.kcal) || 0),
    protein: acc.protein + (Number(it.protein) || 0),
    carbs: acc.carbs + (Number(it.carbs) || 0),
    fat: acc.fat + (Number(it.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const save = async () => {
    if (selected.length === 0) { toast('Selecione ao menos um item', { type: 'error' }); return; }
    setSaving(true);
    try {
      const day = today();
      for (const it of selected) {
        await addFood(user.id, day, {
          meal: defaultMeal,
          name: it.name,
          kcal: it.kcal,
          grams: it.grams,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          source: it.source || 'gemini',
          confidence: it.confidence || null,
        });
      }
      toast(`${selected.length} ${selected.length === 1 ? 'item adicionado' : 'itens adicionados'}`);
      await onSaved();
      onClose();
    } catch (e) { toast(e.message || 'Falha ao salvar', { type: 'error' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal natural-food-modal" onClick={(e) => e.stopPropagation()}>
        <div className="natural-modal-head">
          <div><span className="natural-modal-kicker">Registro inteligente</span><h3>Descrever refeição</h3><small>{MEAL_LABELS[defaultMeal] || defaultMeal}</small></div>
          <button className="natural-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="field natural-food-field">
          <label>O que você comeu?</label>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setSavedCurrent(false); }} placeholder='ex: "150g de arroz, 120g de frango e uma concha de feijão"' rows={3} />
        </div>

        {!items && <div className="actions natural-modal-actions"><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn primary" onClick={interpret} disabled={busy || text.trim().length < 3}>{busy ? 'Interpretando…' : 'Interpretar'}</button></div>}

        {items && items.length > 0 && (
          <>
            <div className="natural-items-label">Confira e ajuste as quantidades</div>
            <ul className="log natural-items-list macro-ai-list">
              {items.map((it, idx) => (
                <li key={`${it.name}-${idx}`} className={!it.selected ? 'macro-item-disabled' : ''}>
                  <label className="natural-item-check"><input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} /><div className="macro-ai-item-main"><div className="amt">{it.name} <span className="meal-tag">{it.kcal} kcal</span></div><div className="macro-source-row"><span className={`ai-source-badge ${it.source === 'tbca' ? 'tbca' : 'gemini'}`}>{SOURCE_LABEL[it.source] || 'Estimativa'}</span>{it.confidence ? <span>{CONFIDENCE_LABEL[it.confidence] || it.confidence}</span> : null}</div></div></label>
                  <div className="macro-ai-controls">
                    <label><span>Quantidade</span><div className="macro-grams-control"><button type="button" onClick={() => setGrams(idx, Number(it.grams) - 10)}>−</button><input type="number" min="1" max="3000" value={it.grams || ''} onChange={(e) => setGrams(idx, e.target.value)} /><b>g</b><button type="button" onClick={() => setGrams(idx, Number(it.grams) + 10)}>+</button></div></label>
                    <div className="macro-inline-stats"><span><b>{Number(it.protein || 0).toFixed(1)}</b> P</span><span><b>{Number(it.carbs || 0).toFixed(1)}</b> C</span><span><b>{Number(it.fat || 0).toFixed(1)}</b> G</span></div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="macro-ai-total"><span>Total selecionado</span><strong>{Math.round(selectedTotals.kcal)} kcal</strong><small>P {selectedTotals.protein.toFixed(1)}g · C {selectedTotals.carbs.toFixed(1)}g · G {selectedTotals.fat.toFixed(1)}g</small></div>

            <div className="actions natural-modal-actions natural-modal-actions-wrap">
              <button className="btn" onClick={() => setItems(null)} disabled={saving}>Voltar</button>
              <button className="btn" onClick={saveCurrentHistory} disabled={saving || savedCurrent || !user?.id}>{savedCurrent ? '✓ Rotina salva' : saving ? 'Salvando…' : 'Salvar rotina'}</button>
              <button className="btn primary food" onClick={save} disabled={saving || selected.length === 0}>{saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}</button>
            </div>
          </>
        )}

        {items && items.length === 0 && <div className="actions natural-modal-actions"><button className="btn" onClick={() => setItems(null)}>Voltar</button><button className="btn" onClick={onClose}>Fechar</button></div>}

        <section className="saved-routines-panel">
          <div className="saved-routines-head"><div><span className="natural-modal-kicker">Atalhos</span><strong>Suas rotinas salvas</strong></div><span className="saved-routines-count">{history.length}/30</span></div>
          {historyBusy ? <div className="saved-routines-empty">Carregando rotinas…</div> : history.length === 0 ? <div className="saved-routines-empty"><strong>Nenhuma rotina salva</strong><small>Interprete uma refeição e use “Salvar rotina” para repetir depois sem chamar a IA novamente.</small></div> : (
            <div className="saved-routines-list">{history.map((entry) => <article className="saved-routine-card" key={entry.id}><button className="saved-routine-main" onClick={() => useHistory(entry)}><strong>{entry.description}</strong><small>{(entry.items || []).length} {(entry.items || []).length === 1 ? 'item' : 'itens'} · {new Date(entry.created_at).toLocaleDateString('pt-BR')}</small></button><div className="saved-routine-actions"><button onClick={() => editHistory(entry)} aria-label="Editar rotina">✎</button><button className="danger" onClick={() => removeHistory(entry)} aria-label="Excluir rotina">×</button></div></article>)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
