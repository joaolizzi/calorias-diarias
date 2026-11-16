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
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { fmtNum, fmtInt } from './format.js';

const SOURCE_LABEL = { tbca: 'TBCA', gemini: 'Estimativa IA', 'gemini-vision': 'Estimativa IA', openfoodfacts: 'Rótulo', manual: 'Manual' };
const IS_ESTIMATE = (source) => source === 'gemini' || source === 'gemini-vision' || !source;
const CONFIDENCE_LABEL = { high: 'Alta confiança', medium: 'Média confiança', low: 'Baixa confiança' };
const CONFIDENCE_LEVEL = { high: 3, medium: 2, low: 1 };

export default function NaturalFoodModal({ meal: defaultMeal, onClose, onSaved, dayKcal = 0, kcalGoal = 0 }) {
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

  const mealName = MEAL_LABELS[defaultMeal] || defaultMeal;
  const dayAfter = Math.round(dayKcal + selectedTotals.kcal);
  const pctBefore = kcalGoal > 0 ? Math.min(100, (dayKcal / kcalGoal) * 100) : 0;
  const pctAdd = kcalGoal > 0 ? Math.min(100 - pctBefore, (selectedTotals.kcal / kcalGoal) * 100) : 0;

  return (
    <Modal title="Descrever refeição" onClose={onClose} className="natural-food-modal">
      <p className="modal-sub">{mealName} · a IA separa os alimentos e estima as quantidades que você não informar</p>

      <div className="field natural-food-field">
        <label htmlFor="nf-text">O que você comeu?</label>
        <textarea id="nf-text" value={text} onChange={(e) => { setText(e.target.value); setSavedCurrent(false); }} placeholder="Por exemplo: 150 g de arroz, 120 g de frango e uma concha de feijão" rows={3} />
      </div>

      {!items && (
        <div className="actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="btn primary" onClick={interpret} disabled={busy || text.trim().length < 3}>{busy ? 'Interpretando…' : 'Interpretar'}</button>
        </div>
      )}

      {items && items.length > 0 && (
        <section className="ai-result" aria-labelledby="nf-res">
          <div className="ai-result-head">
            <h4 id="nf-res">Confira e ajuste as quantidades</h4>
            <p className="ai-legend">
              <span><i className="legend-swatch" />tabela TBCA</span>
              <span><i className="legend-swatch estimate" />estimativa da IA</span>
            </p>
          </div>

          <div className="ai-table" role="table" aria-label="Alimentos identificados">
            <div className="ai-row ai-row-head" role="row">
              <span role="columnheader"><span className="sr-only">Incluir</span></span>
              <span role="columnheader">Alimento</span>
              <span role="columnheader">Quantidade</span>
              <span role="columnheader" className="r">kcal</span>
              <span role="columnheader" className="r">P (g)</span>
              <span role="columnheader" className="r">C (g)</span>
              <span role="columnheader" className="r">G (g)</span>
            </div>

            {items.map((it, idx) => {
              const estimate = IS_ESTIMATE(it.source);
              const level = CONFIDENCE_LEVEL[it.confidence] || 0;
              return (
                <div key={`${it.name}-${idx}`} className={`ai-row ${!it.selected ? 'off' : ''}`} role="row">
                  <label className="ai-check" role="cell">
                    <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} aria-label={`Incluir ${it.name}`} />
                  </label>
                  <div className="ai-name" role="cell">
                    <div className="ai-name-main">{it.name}</div>
                    <div className="ai-name-meta">
                      <span className={`source-chip ${estimate ? 'estimate' : ''}`}>{SOURCE_LABEL[it.source] || 'Estimativa IA'}</span>
                      {it.confidence ? (
                        <span className="confidence">
                          <span className="conf-bars" role="img" aria-label={CONFIDENCE_LABEL[it.confidence] || it.confidence}>
                            {[1, 2, 3].map((n) => <i key={n} className={n <= level ? 'on' : ''} />)}
                          </span>
                          {CONFIDENCE_LABEL[it.confidence] || it.confidence}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="ai-qty" role="cell">
                    <button type="button" className="step-btn" onClick={() => setGrams(idx, Number(it.grams) - 10)} aria-label={`Diminuir 10 gramas de ${it.name}`}>−</button>
                    <input className={estimate ? 'estimate' : ''} type="number" min="1" max="3000" value={it.grams || ''} onChange={(e) => setGrams(idx, e.target.value)} aria-label={`Gramas de ${it.name}`} />
                    <span className="unit">g</span>
                    <button type="button" className="step-btn" onClick={() => setGrams(idx, Number(it.grams) + 10)} aria-label={`Aumentar 10 gramas de ${it.name}`}>+</button>
                  </div>
                  <span className="r num ai-kcal" role="cell"><span className="cell-label">kcal</span>{fmtInt(it.kcal)}</span>
                  <span className="r num" role="cell"><span className="cell-label">P</span>{fmtNum(it.protein)}</span>
                  <span className="r num" role="cell"><span className="cell-label">C</span>{fmtNum(it.carbs)}</span>
                  <span className="r num" role="cell"><span className="cell-label">G</span>{fmtNum(it.fat)}</span>
                </div>
              );
            })}

            <div className="ai-row ai-row-total" role="row">
              <span role="cell" />
              <span role="cell" className="ai-total-name">Total selecionado</span>
              <span role="cell" />
              <span role="cell" className="r num ai-kcal"><span className="cell-label">kcal</span>{fmtInt(selectedTotals.kcal)}</span>
              <span role="cell" className="r num"><span className="cell-label">P</span>{fmtNum(selectedTotals.protein)}</span>
              <span role="cell" className="r num"><span className="cell-label">C</span>{fmtNum(selectedTotals.carbs)}</span>
              <span role="cell" className="r num"><span className="cell-label">G</span>{fmtNum(selectedTotals.fat)}</span>
            </div>
          </div>

          {kcalGoal > 0 && (
            <div className="day-effect">
              <div className="day-effect-top">
                <span>Com este {mealName.toLowerCase()}, o dia chega a <strong className="num">{fmtInt(dayAfter)} de {fmtInt(kcalGoal)} kcal</strong></span>
                <span className="muted num">{Math.round(((dayKcal + selectedTotals.kcal) / kcalGoal) * 100)}% da meta</span>
              </div>
              <div className="day-effect-bar" role="img" aria-label={`${Math.round(pctBefore)}% da meta já consumida e mais ${Math.round(pctAdd)}% com este ${mealName.toLowerCase()}`}>
                <span style={{ width: `${pctBefore}%` }} className="before" />
                <span style={{ width: `${pctAdd}%` }} className="added" />
              </div>
              <div className="day-effect-legend">
                <span><i className="before" />já registrado</span>
                <span><i className="added" />este {mealName.toLowerCase()}</span>
              </div>
            </div>
          )}

          <div className="actions ai-actions">
            <button type="button" className="btn ghost back" onClick={() => setItems(null)} disabled={saving}>Voltar</button>
            <button type="button" className="btn" onClick={saveCurrentHistory} disabled={saving || savedCurrent || !user?.id}>
              {savedCurrent ? <><Icon name="check" size={16} /> Rotina salva</> : saving ? 'Salvando…' : 'Salvar como rotina'}
            </button>
            <button type="button" className="btn primary" onClick={save} disabled={saving || selected.length === 0}>
              {saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'} ao ${mealName.toLowerCase()}`}
            </button>
          </div>
        </section>
      )}

      {items && items.length === 0 && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => setItems(null)}>Voltar</button>
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
        </div>
      )}

      <section className="saved-routines" aria-labelledby="nf-rot">
        <div className="saved-routines-head">
          <h4 id="nf-rot">Suas rotinas salvas</h4>
          <span className="muted">{history.length} de 30</span>
        </div>
        <p className="saved-routines-sub">Repita uma refeição sem chamar a IA de novo.</p>
        {historyBusy ? (
          <div className="saved-routines-empty">Carregando rotinas…</div>
        ) : history.length === 0 ? (
          <div className="saved-routines-empty">
            <strong>Nenhuma rotina salva</strong>
            <small>Interprete uma refeição e use “Salvar como rotina” para repetir depois.</small>
          </div>
        ) : (
          <ul className="saved-routines-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <button type="button" className="saved-routine-main" onClick={() => useHistory(entry)}>
                  <span className="saved-routine-text">{entry.description}</span>
                  <span className="saved-routine-meta">{(entry.items || []).length} {(entry.items || []).length === 1 ? 'item' : 'itens'} · {new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                </button>
                <button type="button" className="icon-btn" onClick={() => editHistory(entry)} aria-label={`Editar rotina: ${entry.description}`}><Icon name="pencil" size={18} /></button>
                <button type="button" className="icon-btn" onClick={() => removeHistory(entry)} aria-label={`Excluir rotina: ${entry.description}`}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}
