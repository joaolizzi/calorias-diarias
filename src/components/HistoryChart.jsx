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
  const [chartReady, setChartReady] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const macroGoals = macroGoalsFromProfile(profile);

  useEffect(() => {
    const load = async () => {
      const days = lastNDays(range);
      const [w, f] = await Promise.all([getWaterRange(user.id, days[0], days[days.length - 1]), getFoodRange(user.id, days[0], days[days.length - 1])]);
      const waterByDay = Object.create(null);
      const foodByDay = Object.create(null);
      w.forEach((r) => { waterByDay[r.day] = (waterByDay[r.day] || 0) + Number(r.ml || 0); });
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
        protein: days.map((d) => foodByDay[d]?.protein || 0),
        carbs: days.map((d) => foodByDay[d]?.carbs || 0),
        fat: days.map((d) => foodByDay[d]?.fat || 0),
      });
    };
    load().catch((e) => toast(e.message || 'Falha ao buscar histórico', { type: 'error' }));
  }, [user.id, range, profile?.daily_kcal_goal, profile?.daily_water_goal_ml, profile?.daily_protein_goal_g, profile?.daily_carbs_goal_g, profile?.daily_fat_goal_g]);

  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (!window.Chart) { setChartReady(false); return; }
    setChartReady(true);

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--saas-text').trim() || '#e7ecf2';
    const mutedColor = styles.getPropertyValue('--saas-muted').trim() || '#8a96a8';
    const foodColor = styles.getPropertyValue('--food').trim() || '#ff8a65';
    const waterColor = styles.getPropertyValue('--water').trim() || '#38bdf8';
    const gridColor = 'rgba(148,163,184,.10)';

    if (chartInstance.current) {
      chartInstance.current.data.labels = data.days.map(shortDay);
      chartInstance.current.data.datasets[0].data = data.kcal;
      chartInstance.current.data.datasets[1].data = data.water;
      chartInstance.current.data.datasets[0].backgroundColor = `color-mix(in srgb, ${foodColor} 64%, transparent)`;
      chartInstance.current.data.datasets[0].borderColor = foodColor;
      chartInstance.current.data.datasets[1].backgroundColor = `color-mix(in srgb, ${waterColor} 55%, transparent)`;
      chartInstance.current.data.datasets[1].borderColor = waterColor;
      chartInstance.current.update();
      return;
    }

    chartInstance.current = new window.Chart(chartRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.days.map(shortDay),
        datasets: [
          { label: 'Calorias (kcal)', data: data.kcal, backgroundColor: foodColor, borderColor: foodColor, borderWidth: 1, borderRadius: 5, yAxisID: 'y' },
          { label: 'Água (ml)', data: data.water, backgroundColor: waterColor, borderColor: waterColor, borderWidth: 1, borderRadius: 5, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: textColor } }, tooltip: { backgroundColor: '#111827', borderColor: '#293548', borderWidth: 1, padding: 10, titleColor: textColor, bodyColor: textColor } },
        scales: {
          x: { ticks: { color: mutedColor }, grid: { color: gridColor } },
          y: { position: 'left', beginAtZero: true, ticks: { color: mutedColor, precision: 0 }, grid: { color: gridColor }, title: { display: true, text: `kcal (meta ${kcalGoal})`, color: mutedColor } },
          y1: { position: 'right', beginAtZero: true, ticks: { color: mutedColor, precision: 0 }, grid: { drawOnChartArea: false }, title: { display: true, text: `ml (meta ${waterGoal})`, color: mutedColor } },
        },
      },
    });

    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [data, kcalGoal, waterGoal]);

  const hits = data ? data.kcal.filter((v) => v >= kcalGoal * 0.9 && v <= kcalGoal * 1.15).length : 0;
  const totalKcal = data ? data.kcal.reduce((s, v) => s + v, 0) : 0;
  const totalWater = data ? data.water.reduce((s, v) => s + v, 0) : 0;
  const macroRecordedIndexes = data ? data.days.map((_, i) => i).filter((i) => data.protein[i] > 0 || data.carbs[i] > 0 || data.fat[i] > 0) : [];
  const macroAverage = (key) => {
    if (!data || !macroRecordedIndexes.length) return 0;
    return round1(macroRecordedIndexes.reduce((sum, i) => sum + Number(data[key][i] || 0), 0) / macroRecordedIndexes.length);
  };
  const avgProtein = macroAverage('protein');
  const avgCarbs = macroAverage('carbs');
  const avgFat = macroAverage('fat');

  return (
    <div className="card history-card-v2">
      <div className="row history-title-row"><div><h2>Histórico</h2><p className="muted">Tendência de consumo e média dos seus macros.</p></div><div className="range-toggle" role="tablist" aria-label="Período"><button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 dias</button><button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 dias</button></div></div>

      <div className="stats"><StatTile value={`${hits}/${range}`} label="Dias próximos da meta kcal" /><StatTile value={`${Math.round(totalKcal / Math.max(1, range))} kcal`} label="Média diária" /><StatTile value={`${Math.round(totalWater / Math.max(1, range))} ml`} label="Média de água" /></div>

      <div className="history-macro-grid">
        <div className="history-macro-card macro-protein"><span>Proteína média</span><strong>{avgProtein}g</strong><small>meta {Math.round(macroGoals.protein)}g · {macroRecordedIndexes.length}d com macros</small></div>
        <div className="history-macro-card macro-carbs"><span>Carbo média</span><strong>{avgCarbs}g</strong><small>meta {Math.round(macroGoals.carbs)}g · {macroRecordedIndexes.length}d com macros</small></div>
        <div className="history-macro-card macro-fat"><span>Gordura média</span><strong>{avgFat}g</strong><small>meta {Math.round(macroGoals.fat)}g · {macroRecordedIndexes.length}d com macros</small></div>
      </div>

      <div className="chart-wrap"><canvas ref={chartRef} />{!chartReady && <div className="muted" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 8 }}>{data ? 'Gráfico indisponível (Chart.js não carregou).' : 'Carregando…'}</div>}</div>
      {macroRecordedIndexes.length < range && <p className="history-macro-note muted">Os registros antigos não tinham macros. As médias acima consideram somente os dias que já possuem proteína, carboidratos ou gorduras registrados.</p>}
    </div>
  );
}
