import { useEffect, useRef, useState } from 'react';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { searchFoodsGemini } from '../lib/gemini.js';
import { toast } from './Toast.jsx';
import Icon from './Icon.jsx';

const SOURCE_LABEL = {
  off: 'Open Food Facts',
  openfoodfacts: 'Open Food Facts',
  tbca: 'TBCA',
  gemini: 'Estimativa IA',
};

export default function FoodSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debRef = useRef(null);
  const ctrlRef = useRef(null);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }

    debRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current?.abort();
      ctrlRef.current = ctrl;
      setLoading(true);
      setError('');

      const merged = [];
      const seen = new Set();
      const pushUnique = (items) => {
        for (const it of items || []) {
          const key = `${norm(it.name)}|${it.kcalPer100g}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
      };

      if (!ctrl.signal.aborted) { try { pushUnique(await searchTBCA(q, { limit: 6 })); } catch {} }
      if (!ctrl.signal.aborted) {
        try { pushUnique(await searchFoods(q, { limit: 5, signal: ctrl.signal })); }
        catch (e) { if (e.name !== 'AbortError') console.warn('OFF falhou:', e?.message); }
      }

      if (!ctrl.signal.aborted && merged.length < 3) {
        try { pushUnique(await searchFoodsGemini(q, { signal: ctrl.signal })); }
        catch (e) {
          if (e.name !== 'AbortError' && e.status === 429) toast('A IA está ocupada; tente novamente em alguns segundos', { type: 'error' });
        }
      }

      if (!ctrl.signal.aborted) { setResults(merged.slice(0, 8)); setLoading(false); }
    }, 320);

    return () => clearTimeout(debRef.current);
  }, [q]);

  return (
    <div className="food-search">
      <div className="search-field">
        <Icon name="search" size={18} />
        <label htmlFor="food-search-input" className="sr-only">Buscar alimento</label>
        <input id="food-search-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento, por exemplo arroz, banana ou frango" autoComplete="off" />
      </div>
      {error && <div className="err search-note">{error}</div>}
      {loading && <div className="muted search-note" role="status">Buscando…</div>}
      {!loading && q.trim().length >= 2 && results.length === 0 && !error && <div className="muted search-note">Nada encontrado. Use “Adicionar manualmente” abaixo.</div>}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li className="item" key={`${r.source}:${r.id}`}>
              <div className="info">
                <div className="name">{r.name}</div>
                <div className="meta num">
                  {r.kcalPer100g} kcal / 100 g{r.portionSuggestionG ? ` · porção ~${r.portionSuggestionG} g` : ''} · P {Number(r.proteinPer100g || 0).toFixed(1)} · C {Number(r.carbsPer100g || 0).toFixed(1)} · G {Number(r.fatPer100g || 0).toFixed(1)}
                </div>
              </div>
              <span className={`source-chip ${r.source === 'gemini' ? 'estimate' : ''}`}>{SOURCE_LABEL[r.source] || r.brand || r.source}</span>
              <button type="button" className="btn primary icon-add" aria-label={`Adicionar ${r.name}`} title={`Adicionar ${r.name}`} onClick={() => { onPick(r); setQ(''); setResults([]); }}>
                <Icon name="plus" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
