import { useEffect, useRef, useState } from 'react';
import { getWaterRange, getFoodRange } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { lastNDays, shortDay } from '../lib/dates.js';
import { macroGoalsFromProfile } from '../lib/macros.js';
import StatTile from './StatTile.jsx';
import { toast } from './Toast.jsx';

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

export default function HistoryChart({ profile }) {
  const { user } = useAuth();
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [overviewChartReady, setOverviewChartReady] = useState(false);
  const [macroChartReady, setMacroChartReady] = useState(false);
  const overviewChartRef = useRef(null);
  const macroChartRef = useRef(null);
  const overviewChartInstance = useRef(null);
  const macroChartInstance = useRef(null);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const macroGoals = macroGoalsFromProfile(profile);

  useEffect(() => {
    const load = async () => {
      const days = lastNDays(range);
      const [w, f] = await Promise.all([
        getWaterRange(user.id, days[0], days[days.length - 1]),
        getFoodRange(user.id, days[0], days[days.length - 1]),
      ]);

      const waterByDay = Object.create(null);
      const foodByDay = Object.create(null);

      w.forEach((r) => {
        waterByDay[r.day] = (waterByDay[r.day] || 0) + Number(r.ml || 0);
      });

      f.forEach((r) => {
        const current = foodByDay[r.day] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        current.kcal += Number(r.kcal || 0);
        current.protein += Number(r.protein_g || 0);
        current.carbs += Number(r.carbs_g || 0);
        current.fat += Number(r.fat_g || 0);
        foodByDay[r.day] = current;
      });

      setData({
        days,
        kcal: days.map((d) => foodByDay[d]?.kcal || 0),
        water: days.map((d) => waterByDay[d] || 0),
        protein: days.map((d) => round1(foodByDay[d]?.protein || 0)),
        carbs: days.map((d) => round1(foodByDay[d]?.carbs || 0)),
        fat: days.map((d) => round1(foodByDay[d]?.fat || 0)),
      });
    };

    load().catch((e) => toast(e.message || 'Falha ao buscar histórico', { type: 'error' }));
  }, [user.id, range, profile?.daily_kcal_goal, profile?.daily_water_goal_ml, profile?.daily_protein_goal_g, profile?.daily_carbs_goal_g, profile?.daily_fat_goal_g]);

  useEffect(() => {
    if (!data || !overviewChartRef.current || !macroChartRef.current) return undefined;
    if (!window.Chart) {
      setOverviewChartReady(false);
      setMacroChartReady(false);
      return undefined;
    }

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--saas-text').trim() || '#e7ecf2';
    const mutedColor = styles.getPropertyValue('--saas-muted').trim() || '#8a96a8';
    const foodColor = styles.getPropertyValue('--food').trim() || '#ff8a65';
    const waterColor = styles.getPropertyValue('--water').trim() || '#38bdf8';
    const proteinColor = styles.getPropertyValue('--macro-protein').trim() || '#7c8cff';
    const carbsColor = styles.getPropertyValue('--macro-carbs').trim() || '#38bdf8';
    const fatColor = styles.getPropertyValue('--macro-fat').trim() || '#f6c453';
    const gridColor = 'rgba(148,163,184,.10)';
    const labels = data.days.map(shortDay);

    if (overviewChartInstance.current) overviewChartInstance.current.destroy();
    if (macroChartInstance.current) macroChartInstance.current.destroy();

    overviewChartInstance.current = new window.Chart(overviewChartRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Calorias (kcal)', data: data.kcal, backgroundColor: foodColor, borderColor: foodColor, borderWidth: 1, borderRadius: 5, yAxisID: 'y' },
          { label: 'Água (ml)', data: data.water, backgroundColor: waterColor, borderColor: waterColor, borderWidth: 1, borderRadius: 5, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: { backgroundColor: '#111827', borderColor: '#293548', borderWidth: 1, padding: 10, titleColor: textColor, bodyColor: textColor },
        },
        scales: {
          x: { ticks: { color: mutedColor }, grid: { color: gridColor } },
          y: { position: 'left', beginAtZero: true, ticks: { color: mutedColor, precision: 0 }, grid: { color: gridColor }, title: { display: true, text: `kcal (meta ${kcalGoal})`, color: mutedColor } },
          y1: { position: 'right', beginAtZero: true, ticks: { color: mutedColor, precision: 0 }, grid: { drawOnChartArea: false }, title: { display: true, text: `ml (meta ${waterGoal})`, color: mutedColor } },
        },
      },
    });

    macroChartInstance.current = new window.Chart(macroChartRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Proteína (g)', data: data.protein, backgroundColor: proteinColor, borderColor: proteinColor, borderWidth: 1, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Carboidratos (g)', data: data.carbs, backgroundColor: carbsColor, borderColor: carbsColor, borderWidth: 1, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Gorduras (g)', data: data.fat, backgroundColor: fatColor, borderColor: fatColor, borderWidth: 1, borderRadius: 6, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor, usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: '#293548',
            borderWidth: 1,
            padding: 10,
            titleColor: textColor,
            bodyColor: textColor,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${round1(ctx.parsed.y)} g` },
          },
        },
        scales: {
          x: { stacked: false, ticks: { color: mutedColor }, grid: { color: gridColor } },
          y: { beginAtZero: true, suggestedMax: Math.max(50, macroGoals.protein, macroGoals.carbs, macroGoals.fat), ticks: { color: mutedColor, precision: 0 }, grid: { color: gridColor }, title: { display: true, text: 'gramas por dia', color: mutedColor } },
        },
      },
    });

    setOverviewChartReady(true);
    setMacroChartReady(true);

    return () => {
      if (overviewChartInstance.current) { overviewChartInstance.current.destroy(); overviewChartInstance.current = null; }
      if (macroChartInstance.current) { macroChartInstance.current.destroy(); macroChartInstance.current = null; }
    };
  }, [data, kcalGoal, waterGoal, macroGoals.protein, macroGoals.carbs, macroGoals.fat]);

  const hits = data ? data.kcal.filter((v) => v >= kcalGoal * 0.9 && v <= kcalGoal * 1.15).length : 0;
  const totalKcal = data ? data.kcal.reduce((s, v) => s + v, 0) : 0;
  const totalWater = data ? data.water.reduce((s, v) => s + v, 0) : 0;
  const hasFoodData = Boolean(data?.kcal.some((v) => v > 0));
  const macroRecordedIndexes = data ? data.days.map((_, i) => i).filter((i) => data.protein[i] > 0 || data.carbs[i] > 0 || data.fat[i] > 0) : [];
  const hasMacroData = macroRecordedIndexes.length > 0;

  const macroAverage = (key) => {
    if (!data || !macroRecordedIndexes.length) return 0;
    return round1(macroRecordedIndexes.reduce((sum, i) => sum + Number(data[key][i] || 0), 0) / macroRecordedIndexes.length);
  };

  const avgProtein = macroAverage('protein');
  const avgCarbs = macroAverage('carbs');
  const avgFat = macroAverage('fat');

  return (
    <div className="card history-card-v2">
      <div className="row history-title-row">
        <div><h2>Histórico</h2><p className="muted">Tendência de calorias, água e macronutrientes.</p></div>
        <div className="range-toggle" role="tablist" aria-label="Período"><button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 dias</button><button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 dias</button></div>
      </div>

      <div className="stats"><StatTile value={`${hits}/${range}`} label="Dias próximos da meta kcal" /><StatTile value={`${Math.round(totalKcal / Math.max(1, range))} kcal`} label="Média diária" /><StatTile value={`${Math.round(totalWater / Math.max(1, range))} ml`} label="Média de água" /></div>

      <div className="history-macro-grid">
        <div className="history-macro-card macro-protein"><span>Proteína média</span><strong>{avgProtein}g</strong><small>meta {Math.round(macroGoals.protein)}g · {macroRecordedIndexes.length}d com macros</small></div>
        <div className="history-macro-card macro-carbs"><span>Carbo média</span><strong>{avgCarbs}g</strong><small>meta {Math.round(macroGoals.carbs)}g · {macroRecordedIndexes.length}d com macros</small></div>
        <div className="history-macro-card macro-fat"><span>Gordura média</span><strong>{avgFat}g</strong><small>meta {Math.round(macroGoals.fat)}g · {macroRecordedIndexes.length}d com macros</small></div>
      </div>

      {hasFoodData && !hasMacroData && (
        <div className="history-macro-diagnostic">
          <strong>Calorias encontradas, mas macros zerados</strong>
          <span>Esses registros foram salvos sem proteína, carboidratos e gorduras. Registros novos com P/C/G aparecem no gráfico automaticamente.</span>
        </div>
      )}

      <section className="history-chart-section">
        <div className="history-chart-head"><div><span>Consumo diário</span><strong>Calorias e água</strong></div><small>Escalas separadas para kcal e ml.</small></div>
        <div className="chart-wrap"><canvas ref={overviewChartRef} />{!overviewChartReady && <div className="muted history-chart-empty">{data ? 'Gráfico indisponível (Chart.js não carregou).' : 'Carregando…'}</div>}</div>
      </section>

      <section className="history-chart-section history-chart-section-macros">
        <div className="history-chart-head"><div><span>Macronutrientes</span><strong>Proteína, carboidratos e gorduras</strong></div><small>Meta: P {Math.round(macroGoals.protein)}g · C {Math.round(macroGoals.carbs)}g · G {Math.round(macroGoals.fat)}g</small></div>
        <div className="chart-wrap history-macro-chart-wrap">
          <canvas ref={macroChartRef} />
          {!macroChartReady && <div className="muted history-chart-empty">{data ? 'Gráfico de macros indisponível.' : 'Carregando…'}</div>}
          {macroChartReady && !hasMacroData && <div className="history-macro-zero-overlay"><strong>Sem macros neste período</strong><span>Adicione uma refeição nova com P/C/G para começar o gráfico.</span></div>}
        </div>
      </section>

      {macroRecordedIndexes.length < range && hasMacroData && <p className="history-macro-note muted">Registros antigos não possuem macros. O gráfico mostra 0 nesses dias e passa a preencher normalmente nos novos registros.</p>}
    </div>
  );
}
