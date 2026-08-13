import { useEffect, useRef, useState } from 'react';
import {
  getWaterRange,
  getFoodRange,
} from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { lastNDays, shortDay } from '../lib/dates.js';
import StatTile from './StatTile.jsx';
import { toast } from './Toast.jsx';

export default function HistoryChart({ profile }) {
  const { user } = useAuth();
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null); // { kcal:[], water:[], goals:{kcal,water} }
  const [chartReady, setChartReady] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;

  useEffect(() => {
    const load = async () => {
      const days = lastNDays(range);
      const [w, f] = await Promise.all([
        getWaterRange(user.id, days[0], days[days.length - 1]),
        getFoodRange(user.id, days[0], days[days.length - 1]),
      ]);
      // agrega por dia
      const waterByDay = Object.create(null);
      w.forEach((r) => { waterByDay[r.day] = (waterByDay[r.day] || 0) + r.ml; });
      const kcalByDay = Object.create(null);
      f.forEach((r) => { kcalByDay[r.day] = (kcalByDay[r.day] || 0) + r.kcal; });
      const water = days.map((d) => waterByDay[d] || 0);
      const kcal = days.map((d) => kcalByDay[d] || 0);
      setData({ days, kcal, water });
    };
    load().catch((e) => toast(e.message || 'Falha ao buscar histórico', { type: 'error' }));
  }, [user.id, range, profile?.daily_kcal_goal, profile?.daily_water_goal_ml]);

  // cria/atualiza o gráfico quando dados ficam prontos
  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (!window.Chart) {
      setChartReady(false);
      return;
    }
    setChartReady(true);

    // configuração de tema escuro consistente com --text/--muted
    const textColor = '#e7ecf2';
    const mutedColor = '#8a96a8';
    const gridColor = 'rgba(255,255,255,0.06)';

    if (chartInstance.current) {
      // update incremental
      chartInstance.current.data.labels = data.days.map(shortDay);
      chartInstance.current.data.datasets[0].data = data.kcal;
      chartInstance.current.data.datasets[1].data = data.water;
      chartInstance.current.options.scales.y.title.text = `kcal (meta ${kcalGoal})`;
      chartInstance.current.options.scales.y1.title.text = `ml (meta ${waterGoal})`;
      chartInstance.current.update();
      return;
    }

    chartInstance.current = new window.Chart(chartRef.current.getContext('2d'), {
      type: 'bar', // bar permite múltiplas séries com cores distintas por barra
      data: {
        labels: data.days.map(shortDay),
        datasets: [
          {
            label: 'Calorias (kcal)',
            data: data.kcal,
            backgroundColor: 'rgba(235,104,52,.65)',
            borderColor: '#eb6834',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
            // marcador da meta (linha horizontal simulada via plugin)
          },
          {
            label: 'Água (ml)',
            data: data.water,
            backgroundColor: 'rgba(56,189,248,.55)',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: textColor } },
          tooltip: {
            backgroundColor: '#1f2937',
            borderColor: '#2a323d',
            borderWidth: 1,
            padding: 10,
            titleColor: textColor,
            bodyColor: textColor,
          },
        },
        scales: {
          x: {
            ticks: { color: mutedColor },
            grid: { color: gridColor },
          },
          y: {
            position: 'left',
            beginAtZero: true,
            ticks: { color: mutedColor, precision: 0 },
            grid: { color: gridColor },
            title: {
              display: true,
              text: `kcal (meta ${kcalGoal})`,
              color: mutedColor,
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            ticks: { color: mutedColor, precision: 0 },
            grid: { drawOnChartArea: false },
            title: {
              display: true,
              text: `ml (meta ${waterGoal})`,
              color: mutedColor,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [data, kcalGoal, waterGoal]);

  // stats simples: metas batidas, média, total
  const hits = data
    ? data.kcal.filter((v, i) => v >= kcalGoal * 0.9 && v <= kcalGoal * 1.5).length +
      data.water.filter((v) => v >= waterGoal && v <= waterGoal * 1.5).length
    : 0;
  const totalKcal = data ? data.kcal.reduce((s, v) => s + v, 0) : 0;
  const totalWater = data ? data.water.reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="card">
      <div className="row">
        <h2>Histórico</h2>
        <div className="range-toggle" role="tablist" aria-label="Período">
          <button
            className={range === 7 ? 'active' : ''}
            onClick={() => setRange(7)}
          >
            7 dias
          </button>
          <button
            className={range === 30 ? 'active' : ''}
            onClick={() => setRange(30)}
          >
            30 dias
          </button>
        </div>
      </div>

      <div className="stats">
        <StatTile value={`${hits}`} label={`Metas batidas / ${data ? data.kcal.length : range}`} />
        <StatTile value={`${totalKcal} kcal`} label={`Total kcal`} />
        <StatTile value={`${totalWater} ml`} label={`Total água`} />
      </div>

      <div className="chart-wrap">
        <canvas ref={chartRef} />
        {!chartReady && (
          <div
            className="muted"
            style={{
              position: 'absolute', inset: 0,
              display: 'grid', placeItems: 'center', textAlign: 'center',
              padding: 8,
            }}
          >
            {data ? 'Gráfico indisponível (Chart.js não carregou). Verifique sua internet.' : 'Carregando…'}
          </div>
        )}
      </div>
    </div>
  );
}