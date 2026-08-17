import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today, MEAL_LABELS } from '../lib/dates.js';
import { analyzeFoodImage } from '../lib/gemini.js';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { toast } from './Toast.jsx';

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
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Não foi possível processar a imagem'));
  });

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

function scaleItem(item, grams) {
  const safe = Math.max(1, Math.min(2000, Math.round(Number(grams) || item.grams || 1)));
  const base = Math.max(1, Number(item.grams) || 1);
  const factor = safe / base;
  return {
    ...item,
    grams: safe,
    kcal: Math.max(0, Math.round((Number(item.kcal) || 0) * factor)),
    protein: Math.max(0, Math.round((Number(item.protein) || 0) * factor)),
    carbs: Math.max(0, Math.round((Number(item.carbs) || 0) * factor)),
    fat: Math.max(0, Math.round((Number(item.fat) || 0) * factor)),
  };
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

  useEffect(() => () => {
    if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
  }, [image]);

  useEffect(() => {
    if (editingIndex == null || foodQuery.trim().length < 2) {
      setFoodResults([]);
      setFoodLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setFoodLoading(true);
      const merged = [];
      const seen = new Set();
      const push = (arr) => {
        for (const item of arr || []) {
          const key = `${String(item.name).toLowerCase()}|${item.kcalPer100g}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
      };

      try {
        try { push(await searchTBCA(foodQuery, { limit: 5 })); } catch {}
        if (merged.length < 5) {
          try { push(await searchFoods(foodQuery, { limit: 5 })); } catch {}
        }
      } finally {
        if (!cancelled) {
          setFoodResults(merged.slice(0, 8));
          setFoodLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
    } catch (e) {
      toast(e.message || 'Falha ao preparar a imagem', { type: 'error' });
    } finally {
      setBusy(false);
    }
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
      else if (e.status === 429) toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
      else toast(e.message || 'Falha ao analisar a foto', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (idx) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  };

  const startEdit = (idx) => {
    const item = items[idx];
    setEditingIndex(idx);
    setGramDraft(String(item.grams));
    setFoodQuery('');
    setFoodResults([]);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setGramDraft('');
    setFoodQuery('');
    setFoodResults([]);
  };

  const updateGrams = (idx) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? scaleItem(it, gramDraft) : it)));
    cancelEdit();
  };

  const replaceFood = (idx, result) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== idx) return it;
      const grams = Math.max(1, Math.round(Number(it.grams) || 100));
      const kcalPer100g = Number(result.kcalPer100g) || 0;
      const ratio = grams / 100;
      return {
        ...it,
        name: result.name,
        kcal: Math.round(kcalPer100g * ratio),
        // A fonte de busca fornece kcal/100g, mas não macros de forma uniforme.
        // Mantemos os macros estimados da foto até uma futura fonte nutricional completa.
        source: result.source || it.source,
        selected: true,
      };
    }));
    cancelEdit();
  };

  const selected = (items || []).filter((it) => it.selected);
  const totalKcal = selected.reduce((sum, it) => sum + (Number(it.kcal) || 0), 0);

  const save = async () => {
    if (!selected.length) {
      toast('Selecione ao menos um alimento', { type: 'error' });
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
      toast(`${selected.length} ${selected.length === 1 ? 'alimento adicionado' : 'alimentos adicionados'}`);
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
      <div className="modal camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camera-heading">
          <div>
            <span className="eyebrow">IA NUTRICIONAL</span>
            <h3>Fotografar refeição</h3>
            <p className="muted">Tire uma foto, confira o que a IA encontrou e ajuste antes de registrar.</p>
          </div>
          <button className="x camera-close" onClick={onClose} disabled={busy || saving} aria-label="Fechar">×</button>
        </div>

        {!image ? (
          <div className="camera-empty">
            <div className="camera-icon">📷</div>
            <strong>Mostre sua refeição</strong>
            <span>Boa iluminação e o prato inteiro visível ajudam a IA a identificar melhor os alimentos.</span>
            <button className="btn primary food" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? 'Preparando…' : 'Abrir câmera'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={chooseImage} hidden />
          </div>
        ) : (
          <>
            <div className="camera-preview-wrap">
              <img className="camera-preview" src={image} alt="Foto da refeição" />
              <button className="camera-retake" onClick={() => inputRef.current?.click()} disabled={busy || saving}>Trocar foto</button>
            </div>

            {!items && (
              <div className="camera-actions">
                <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
                <button className="btn primary food" onClick={analyze} disabled={busy}>{busy ? 'Analisando…' : 'Analisar com IA'}</button>
              </div>
            )}

            {items && items.length > 0 && (
              <>
                <div className="camera-result-head">
                  <div>
                    <strong>Resultado da análise</strong>
                    <span>Confira cada alimento e ajuste o que for necessário.</span>
                  </div>
                  <div className="camera-total">{totalKcal} kcal</div>
                </div>

                <ul className="log camera-results">
                  {items.map((it, idx) => (
                    <li key={`${it.name}-${idx}`} className={!it.selected ? 'camera-item-off' : ''}>
                      <label className="camera-item-label">
                        <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} />
                        <div className="camera-item-content">
                          <div className="amt">{it.name} <span className="meal-tag">{it.kcal} kcal</span></div>
                          <div className="when">{it.grams} g · P {it.protein} g · C {it.carbs} g · G {it.fat} g</div>
                        </div>
                      </label>

                      {editingIndex === idx ? (
                        <div className="camera-editor">
                          <div className="camera-edit-row">
                            <label>
                              <span>Quantidade</span>
                              <div className="camera-grams-input">
                                <input type="number" min="1" max="2000" value={gramDraft} onChange={(e) => setGramDraft(e.target.value)} />
                                <b>g</b>
                              </div>
                            </label>
                            <button className="btn primary food" onClick={() => updateGrams(idx)}>Aplicar</button>
                          </div>

                          <div className="camera-replace">
                            <span>Trocar alimento</span>
                            <input
                              value={foodQuery}
                              onChange={(e) => setFoodQuery(e.target.value)}
                              placeholder="Ex.: banana, arroz, frango…"
                              autoFocus
                            />
                            {foodLoading && <small>Buscando alimentos…</small>}
                            {!foodLoading && foodQuery.trim().length >= 2 && foodResults.length === 0 && <small>Nenhum alimento encontrado.</small>}
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

                          <button className="btn ghost camera-edit-cancel" onClick={cancelEdit}>Cancelar edição</button>
                        </div>
                      ) : (
                        <button className="camera-edit-btn" onClick={() => startEdit(idx)}>Editar quantidade ou alimento</button>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="camera-disclaimer">Os valores são estimativas. Se a IA não tiver certeza da variedade, prefira o nome genérico e ajuste a quantidade manualmente.</div>
                <div className="camera-actions">
                  <button className="btn" onClick={() => setItems(null)} disabled={saving}>Refazer análise</button>
                  <button className="btn primary food" onClick={save} disabled={saving || !selected.length}>{saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}</button>
                </div>
              </>
            )}

            {items && items.length === 0 && (
              <div className="camera-actions">
                <button className="btn" onClick={() => setItems(null)}>Tentar novamente</button>
                <button className="btn" onClick={onClose}>Fechar</button>
              </div>
            )}
          </>
        )}

        <div className="camera-meal">Refeição: <strong>{MEAL_LABELS[defaultMeal] || defaultMeal}</strong></div>
      </div>
    </div>
  );
}
