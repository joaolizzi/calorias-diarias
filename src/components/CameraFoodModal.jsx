import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addFood } from '../lib/supabase.js';
import { today, MEAL_LABELS } from '../lib/dates.js';
import { analyzeFoodImage } from '../lib/gemini.js';
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

export default function CameraFoodModal({ meal: defaultMeal, onClose, onSaved }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
  }, [image]);

  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setImage(dataUrl);
      setItems(null);
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
      if (!parsed.length) {
        toast('A IA não identificou alimentos. Tente uma foto mais clara.', { type: 'error' });
      }
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

  const selected = (items || []).filter((it) => it.selected);
  const totalKcal = selected.reduce((sum, it) => sum + it.kcal, 0);

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
            <p className="muted">Tire uma foto do prato e confira a estimativa antes de registrar.</p>
          </div>
          <button className="x camera-close" onClick={onClose} disabled={busy || saving} aria-label="Fechar">×</button>
        </div>

        {!image ? (
          <div className="camera-empty">
            <div className="camera-icon">⌁</div>
            <strong>Mostre sua refeição</strong>
            <span>Funciona melhor com boa iluminação e o prato inteiro visível.</span>
            <button className="btn primary food" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? 'Preparando…' : '📷 Abrir câmera'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={chooseImage}
              hidden
            />
          </div>
        ) : (
          <>
            <div className="camera-preview-wrap">
              <img className="camera-preview" src={image} alt="Foto da refeição" />
              <button className="camera-retake" onClick={() => inputRef.current?.click()} disabled={busy || saving}>
                Trocar foto
              </button>
            </div>

            {!items && (
              <div className="camera-actions">
                <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
                <button className="btn primary food" onClick={analyze} disabled={busy}>
                  {busy ? 'Analisando…' : '✨ Analisar com IA'}
                </button>
              </div>
            )}

            {items && items.length > 0 && (
              <>
                <div className="camera-result-head">
                  <div>
                    <strong>Alimentos identificados</strong>
                    <span>Confira as porções. A estimativa pode variar.</span>
                  </div>
                  <div className="camera-total">{totalKcal} kcal</div>
                </div>
                <ul className="log camera-results">
                  {items.map((it, idx) => (
                    <li key={`${it.name}-${idx}`} className={!it.selected ? 'camera-item-off' : ''}>
                      <label className="camera-item-label">
                        <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} />
                        <div>
                          <div className="amt">{it.name} <span className="meal-tag">{it.kcal} kcal</span></div>
                          <div className="when">~{it.grams} g · P {it.protein} g · C {it.carbs} g · G {it.fat} g</div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="camera-disclaimer">⚠️ Valores estimados pela IA. Confirme e ajuste quando souber a quantidade real.</div>
                <div className="camera-actions">
                  <button className="btn" onClick={() => setItems(null)} disabled={saving}>Refazer análise</button>
                  <button className="btn primary food" onClick={save} disabled={saving || !selected.length}>
                    {saving ? 'Salvando…' : `Adicionar ${selected.length} ${selected.length === 1 ? 'item' : 'itens'}`}
                  </button>
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
