import { useEffect, useRef, useState } from 'react';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { searchFoodsGemini } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

// Ordem pensada para um app brasileiro de dieta:
//   1) TBCA local: alimentos in natura e preparações comuns no Brasil
//   2) Open Food Facts: industrializados e produtos de marca
//   3) Gemini: último recurso para termos vagos ou pratos não encontrados
const SOURCE_LABEL = {
  off: 'Open Food Facts',
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
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    debRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current?.abort();
      ctrlRef.current = ctrl;
      setLoading(true);
      setError('');

      const merged = [];
      const seen = new Set();
      const pushUnique = (items) => {
        for (const it of items) {
          const key = `${norm(it.name)}|${it.kcalPer100g}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
      };

      // 1) TBCA primeiro: melhor referência para alimentos comuns no Brasil.
      if (!ctrl.signal.aborted) {
        try {
          const tbca = await searchTBCA(q, { limit: 6 });
          pushUnique(tbca);
        } catch {
          // Se a base local falhar, seguimos normalmente.
        }
      }

      // 2) Open Food Facts complementa com produtos industrializados/marcas.
      if (!ctrl.signal.aborted) {
        try {
          const off = await searchFoods(q, { limit: 5, signal: ctrl.signal });
          pushUnique(off);
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('OFF falhou:', e?.message);
        }
      }

      // Se as bases reais já responderam bem, não gastamos IA.
      if (!ctrl.signal.aborted && merged.length >= 3) {
        setResults(merged.slice(0, 8));
        setLoading(false);
        return;
      }

      // 3) IA apenas como fallback.
      if (!ctrl.signal.aborted) {
        try {
          const gem = await searchFoodsGemini(q, { signal: ctrl.signal });
          pushUnique(gem);
        } catch (e) {
          if (e.name === 'AbortError') {
            // ignorado
          } else if (e.status === 401) {
            // usuário não autenticado
          } else if (e.status === 429) {
            toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
          }
        }
      }

      if (!ctrl.signal.aborted) {
        setResults(merged.slice(0, 8));
        setLoading(false);
      }
    }, 320);

    return () => clearTimeout(debRef.current);
  }, [q]);

  return (
    <div>
      <div className="custom" style={{ marginTop: 0 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar alimento (ex: arroz, banana, frango)..."
        />
      </div>

      {error && (
        <div className="muted" style={{ marginTop: 6, color: 'var(--bad)' }}>
          {error}
        </div>
      )}
      {loading && <div className="muted" style={{ marginTop: 6 }}>Buscando…</div>}

      {!loading && q.trim().length >= 2 && results.length === 0 && !error && (
        <div className="muted" style={{ marginTop: 6 }}>
          Nada encontrado. Use o botão "Não achei" abaixo para adicionar manualmente.
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div className="item" key={`${r.source}:${r.id}`}>
              <div className="info">
                <div className="name">{r.name}</div>
                <div className="meta">
                  {r.kcalPer100g} kcal / 100g
                  {r.portionSuggestionG ? ` · porção ~${r.portionSuggestionG}g` : ''}
                  {' · '}
                  <span className={`pill ${r.source === 'gemini' ? 'ai' : ''}`}>
                    {SOURCE_LABEL[r.source] || r.brand || r.source}
                  </span>
                </div>
              </div>
              <button
                className="btn primary food"
                onClick={() => {
                  onPick(r);
                  setQ('');
                  setResults([]);
                }}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
