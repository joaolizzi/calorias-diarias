import { useEffect, useRef, useState } from 'react';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { searchFoodsGemini } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

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
    <div>
      <div className="custom" style={{ marginTop: 0 }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento (ex: arroz, banana, frango)..." aria-label="Buscar alimento" /></div>
      {error && <div className="muted" style={{ marginTop: 6, color: 'var(--bad)' }}>{error}</div>}
      {loading && <div className="muted" style={{ marginTop: 6 }}>Buscando…</div>}
      {!loading && q.trim().length >= 2 && results.length === 0 && !error && <div className="muted" style={{ marginTop: 6 }}>Nada encontrado. Use “Adicionar manualmente” abaixo.</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div className="item" key={`${r.source}:${r.id}`}>
              <div className="info">
                <div className="name">{r.name}</div>
                <div className="meta">{r.kcalPer100g} kcal / 100g{r.portionSuggestionG ? ` · porção ~${r.portionSuggestionG}g` : ''} · <span className={`pill ${r.source === 'gemini' ? 'ai' : ''}`}>{SOURCE_LABEL[r.source] || r.brand || r.source}</span></div>
                <div className="search-macro-meta">P {Number(r.proteinPer100g || 0).toFixed(1)}g · C {Number(r.carbsPer100g || 0).toFixed(1)}g · G {Number(r.fatPer100g || 0).toFixed(1)}g por 100g</div>
              </div>
              <button type="button" className="btn primary food" aria-label={`Adicionar ${r.name}`} title={`Adicionar ${r.name}`} onClick={() => { onPick(r); setQ(''); setResults([]); }}>+</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
