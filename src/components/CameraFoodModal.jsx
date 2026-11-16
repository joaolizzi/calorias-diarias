import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today, MEAL_LABELS } from '../lib/dates.js';
import { analyzeFoodImage } from '../lib/gemini.js';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { nutritionForGrams } from '../lib/macros.js';
import { toast } from './Toast.jsx';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { fmtNum, fmtInt } from './format.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1600;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Imagem muito grande. Use uma foto de até 8 MB.');
  const dataUrl = await fileToDataUrl(file);
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Não foi possível processar a imagem')); });
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function CameraFoodModal({ meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [gramDraft, setGramDraft] = useState('');
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState([]);
  const [foodLoading, setFoodLoading] = useState(false);

  useEffect(() => () => { if (image?.startsWith('blob:')) URL.revokeObjectURL(image); }, [image]);

  useEffect(() => {
    if (editingIndex == null || foodQuery.trim().length < 2) { setFoodResults([]); setFoodLoading(false); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setFoodLoading(true);
      const merged = [];
      const seen = new Set();
      const push = (arr) => {
        for (const item of arr || []) {
          const key = `${String(item.name).toLowerCase()}|${item.kcalPer100g}`;
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
      };
      try {
        try { push(await searchTBCA(foodQuery, { limit: 5 })); } catch {}
        if (merged.length < 5) { try { push(await searchFoods(foodQuery, { limit: 5 })); } catch {} }
      } finally {
        if (!cancelled) { setFoodResults(merged.slice(0, 8)); setFoodLoading(false); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [editingIndex, foodQuery]);

  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setImage(dataUrl);
      setItems(null);
      setEditingIndex(null);
      setGramDraft('');
      setFoodQuery('');
      setFoodResults([]);
    } catch (e) { toast(e.message || 'Falha ao preparar a imagem', { type: 'error' }); }
    finally { setBusy(false); }
  };

  const openPicker = () => {
    if (busy || saving) return;
    inputRef.current?.click();
  };

  const analyze = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const parsed = await analyzeFoodImage(image, defaultMeal);
      setItems(parsed.map((it) => ({ ...it, selected: true })));
      if (!parsed.length) toast('A IA não identificou alimentos. Tente uma foto mais clara.', { type: 'error' });
    } catch (e) {
      if (e.status === 401) toast('Faça login para usar IA', { type: 'error' });
      else if (e.status === 413) toast('Imagem muito grande', { type: 'error' });
      else if (e.status === 429) toast('A IA está ocupada; tente novamente em alguns segundos', { type: 'error' });
      else toast(e.message || 'Falha ao analisar a foto', { type: 'error' });
    } finally { setBusy(false); }
  };

  const toggle = (idx) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  const startEdit = (idx) => { const item = items[idx]; setEditingIndex(idx); setGramDraft(String(item.grams)); setFoodQuery(''); setFoodResults([]); };
  const cancelEdit = () => { setEditingIndex(null); setGramDraft(''); setFoodQuery(''); setFoodResults([]); };
  const updateGrams = (idx) => { setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...nutritionForGrams(it, gramDraft) } : it))); cancelEdit(); };

  const replaceFood = (idx, result) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const grams = Math.max(1, Math.round(Number(it.grams) || 100));
      const replacement = { ...it, ...result, grams, source: result.source || it.source, confidence: result.confidence || null, selected: true };
      return { ...replacement, ...nutritionForGrams(replacement, grams) };
    }));
    cancelEdit();
  };

  const selected = (items || []).filter((it) => it.selected);
  const totals = selected.reduce((acc, it) => ({ kcal: acc.kcal + (Number(it.kcal) || 0), protein: acc.protein + (Number(it.protein) || 0), carbs: acc.carbs + (Number(it.carbs) || 0), fat: acc.fat + (Number(it.fat) || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const save = async () => {
    if (!selected.length) { toast('Selecione ao menos um alimento', { type: 'error' }); return; }
    setSaving(true);
    try {
      const day = today();
      for (const it of selected) {
        await addFood(user.id, day, {
          meal: it.meal || defaultMeal,
          name: it.name,
          kcal: it.kcal,
          grams: it.grams,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          source: it.source || 'gemini-vision',
          confidence: it.confidence || null,
        });
      }
      toast(`${selected.length} ${selected.length === 1 ? 'alimento adicionado' : 'alimentos adicionados'}`);
      await onSaved();
      onClose();
    } catch (e) { toast(e.message || 'Falha ao salvar', { type: 'error' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Fotografar refeição" onClose={onClose} className="camera-modal">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={chooseImage} hidden />
      <p className="modal-sub">{MEAL_LABELS[defaultMeal] || defaultMeal} · tire uma foto, confira o que a IA encontrou e ajuste antes de registrar</p>

      {!image ? (
        <div className="camera-empty">
          <Icon name="camera" size={36} />
          <strong>Mostre sua refeição</strong>
          <span>Boa iluminação e o prato inteiro visível ajudam a IA a identificar melhor os alimentos.</span>
          <button type="button" className="btn primary" onClick={openPicker} disabled={busy}>{busy ? 'Preparando…' : 'Abrir câmera'}</button>
        </div>
      ) : (
        <>
          <div className="camera-preview-wrap">
            <img className="camera-preview" src={image} alt="Foto da refeição" />
            <button type="button" className="btn camera-retake" onClick={openPicker} disabled={busy || saving}>Trocar foto</button>
          </div>

          {!items && (
            <div className="actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="button" className="btn primary" onClick={analyze} disabled={busy}>{busy ? 'Analisando…' : 'Analisar com IA'}</button>
            </div>
          )}

          {items && items.length > 0 && (
            <>
              <div className="camera-result-head">
                <h4>Resultado da análise</h4>
                <div className="camera-total num"><strong>{fmtInt(totals.kcal)} kcal</strong><small>P {fmtNum(totals.protein)} · C {fmtNum(totals.carbs)} · G {fmtNum(totals.fat)}</small></div>
              </div>
              <p className="ai-legend-note"><span className="source-chip estimate">Estimativa IA</span> Confira cada alimento e ajuste o que for necessário.</p>
              <ul className="camera-results">
                {items.map((it, idx) => (
                  <li key={`${it.name}-${idx}`} className={!it.selected ? 'off' : ''}>
                    <label className="camera-item-label">
                      <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} aria-label={`Incluir ${it.name}`} />
                      <span className="camera-item-content">
                        <span className="camera-item-name">{it.name} <span className="muted num">{fmtInt(it.kcal)} kcal</span></span>
                        <span className="camera-item-meta num">{it.grams} g · P {fmtNum(it.protein)} · C {fmtNum(it.carbs)} · G {fmtNum(it.fat)}</span>
                      </span>
                    </label>
                    {editingIndex === idx ? (
                      <div className="camera-editor">
                        <div className="camera-edit-row">
                          <div className="goal-field">
                            <label htmlFor={`cam-g-${idx}`}>Quantidade</label>
                            <div className="goal-field-row"><input id={`cam-g-${idx}`} type="number" min="1" max="3000" value={gramDraft} onChange={(e) => setGramDraft(e.target.value)} /><span className="goal-field-unit muted">g</span></div>
                          </div>
                          <button type="button" className="btn primary" onClick={() => updateGrams(idx)}>Aplicar</button>
                        </div>
                        <div className="camera-replace">
                          <label htmlFor={`cam-q-${idx}`}>Trocar alimento</label>
                          <input id={`cam-q-${idx}`} value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder="Por exemplo: banana, arroz, frango" autoFocus />
                          {foodLoading && <small className="muted">Buscando alimentos…</small>}
                          {!foodLoading && foodQuery.trim().length >= 2 && foodResults.length === 0 && <small className="muted">Nenhum alimento encontrado.</small>}
                          {foodResults.length > 0 && (
                            <div className="camera-food-results">
                              {foodResults.map((result) => (
                                <button key={`${result.source}:${result.id}`} type="button" onClick={() => replaceFood(idx, result)}>
                                  <span>{result.name}</span>
                                  <small>{result.kcalPer100g} kcal / 100 g · {result.source === 'tbca' ? 'TBCA' : 'Open Food Facts'}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button type="button" className="btn ghost" onClick={cancelEdit}>Cancelar edição</button>
                      </div>
                    ) : (
                      <button type="button" className="btn ghost camera-edit-btn" onClick={() => startEdit(idx)}>Editar quantidade ou alimento</button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="camera-disclaimer">Os valores são estimativas. Ajuste a quantidade quando souber o peso real.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={() => setItems(null)} disabled={saving}>Refazer análise</button>
                <button type="button" className="btn primary" onClick={save} disabled={saving || !selected.length}>{saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}</button>
              </div>
            </>
          )}
          {items && items.length === 0 && (
            <div className="actions">
              <button type="button" className="btn" onClick={() => setItems(null)}>Tentar novamente</button>
              <button type="button" className="btn" onClick={onClose}>Fechar</button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
