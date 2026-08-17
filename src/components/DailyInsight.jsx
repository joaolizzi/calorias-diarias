import { useEffect, useState } from 'react';
import { getDailyInsight } from '../lib/gemini.js';
import { MEAL_LABELS } from '../lib/dates.js';
import { today } from '../lib/dates.js';
import { toast } from './Toast.jsx';

// Card de insight diário. Pega o resumo do dia (já em estado no Dashboard)
// e pede um texto curto ao Gemini. Cacheia o último resultado por dia em
// localStorage — não incomoda o usuário a cada reload.

const LS_KEY = (day) => `kcal-insight:${day}`;
const LS_COOLDOWN = 'kcal-insight-cooldown'; // ISO timestamp até quando IA está desabilitada

function buildMealSummary(foodEntries) {
  if (!foodEntries || foodEntries.length === 0) return 'sem registros';
  const byMeal = new Map();
  for (const e of foodEntries) {
    const k = MEAL_LABELS[e.meal] || e.meal;
    byMeal.set(k, (byMeal.get(k) || 0) + e.kcal);
  }
  return [...byMeal.entries()].map(([m, k]) => `${m} ${k}kcal`).join(', ');
}

export default function DailyInsight({
  foodEntries,
  waterEntries,
  kcalGoal,
  waterGoal,
}) {
  const day = today();
  const [insight, setInsight] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    const v = localStorage.getItem(LS_COOLDOWN);
    return v ? Number(v) || 0 : 0;
  });

  useEffect(() => {
    // carrega insight cacheado do dia, se existir
    try {
      const raw = localStorage.getItem(LS_KEY(day));
      if (raw) setInsight(JSON.parse(raw));
    } catch {}
  }, [day]);

  const onCooldown = Date.now() < cooldownUntil;

  const ask = async () => {
    if (onCooldown) {
      const mins = Math.ceil((cooldownUntil - Date.now()) / 60000);
      toast(`IA em espera, tente em ${mins} min`, { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await getDailyInsight({
        day,
        kcalConsumed: foodEntries.reduce((s, e) => s + e.kcal, 0),
        kcalGoal,
        waterConsumed: waterEntries.reduce((s, e) => s + e.ml, 0),
        waterGoal,
        mealSummary: buildMealSummary(foodEntries),
      });
      if (!result) {
        toast('IA não retornou insight', { type: 'error' });
      } else {
        setInsight(result);
        try { localStorage.setItem(LS_KEY(day), JSON.stringify(result)); } catch {}
      }
    } catch (e) {
      if (e.status === 429) {
        const until = Date.now() + 60 * 60 * 1000; // 1h
        localStorage.setItem(LS_COOLDOWN, String(until));
        setCooldownUntil(until);
        toast('Limite de IA atingido, tente em 1h', { type: 'error' });
      } else if (e.status === 401) {
        toast('Faça login para usar IA', { type: 'error' });
      } else {
        toast(e.message || 'Falha ao gerar insight', { type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="card-head-title">
          <span className="pill ai">IA</span>
          Insight do dia
        </h2>
        {insight ? (
          <button className="btn ghost" onClick={ask} disabled={busy || onCooldown} title="Pedir novo insight">
            ↻
          </button>
        ) : null}
      </div>

      {!insight && (
        <>
          <p className="card-desc muted">
            Receba um resumo do seu dia com uma sugestão prática e objetiva.
          </p>
          <button
            className="btn primary"
            onClick={ask}
            disabled={busy || onCooldown}
            style={{ width: '100%' }}
          >
            {busy ? 'Gerando…' : 'Pedir insight'}
          </button>
        </>
      )}

      {insight && (
        <div className="insight-content">
          <div className="insight-title">{insight.title}</div>
          <p className="insight-body">{insight.body}</p>
        </div>
      )}
    </div>
  );
}
