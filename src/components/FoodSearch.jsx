import { useEffect, useRef, useState } from 'react';
import { searchFoods, searchTBCA } from '../lib/foods.js';
import { searchFoodsGemini } from '../lib/gemini.js';
import { toast } from './Toast.jsx';

// Encadeia 3 fontes para a busca do usuário:
//   1) Open Food Facts (industrializados, em qualquer idioma)
//   2) TBCA local (public/tbca.json — pt-BR, ~6k alimentos, offline)
//   3) Gemini (estimativa via IA — pratos caseiros, frases vagas)
//
// Cada item carrega `source` ('off' | 'tbca' | 'gemini') para UI saber
// destacar a origem sem reinventar a forma do retorno.

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
          // dedup pelo par (name normalizado, kcalPer100g)
          const key = `${norm(it.name)}|${it.kcalPer100g}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
      };

      // 1) OFF primeiro (industrializados são o caso comum)
      try {
        const off = await searchFoods(q, { limit: 6, signal: ctrl.signal });
        pushUnique(off);
        // OFF já retornou algo razoável: encerra cedo para não chamar Gemini à toa
        if (merged.length >= 3) {
          setResults(merged.slice(0, 8));
          setLoading(false);
          return;
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          // OFF pode falhar offline — não trava, segue para TBCA/Gemini
          // eslint-disable-next-line no-console
          console.warn('OFF falhou:', e?.message);
        }
      }

      // 2) TBCA local (rápido, sem rede, sem custo)
      if (!ctrl.signal.aborted) {
        try {
          const tbca = await searchTBCA(q, { limit: 6 });
          pushUnique(tbca);
          if (merged.length >= 3) {
            setResults(merged.slice(0, 8));
            setLoading(false);
            return;
          }
        } catch (e) {
          // TBCA pode não existir (build sem o JSON) — segue
        }
      }

      // 3) Gemini como último recurso (custa cota gratuita)
      if (!ctrl.signal.aborted) {
        try {
          const gem = await searchFoodsGemini(q, { signal: ctrl.signal });
          pushUnique(gem);
        } catch (e) {
          if (e.name === 'AbortError') {
            // ignorado
          } else if (e.status === 401) {
            // não logado — não tenta de novo
          } else if (e.status === 429) {
            toast('Limite de IA atingido; tente mais tarde', { type: 'error' });
          } else {
            // silencioso: OFF/TBCA já populou a lista, ou fallback manual existe
          }
        }
      }

      if (!ctrl.signal.aborted) {
        setResults(merged.slice(0, 8));
        setLoading(false);
      }
    }, 400);
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
          Nada encontrado. Use o botão "Não achei" abaixo para adicionar manual.
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
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
