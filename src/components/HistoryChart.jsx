import { useEffect, useState } from 'react';
import { getWaterRange, getFoodRange } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { lastNDays, shortDay } from '../lib/dates.js';
import { macroGoalsFromProfile } from '../lib/macros.js';
import { DayChart, ChartLegend, ConsistencyStrip } from './charts.jsx';
import { fmtNum, fmtInt } from './format.js';
import { toast } from './Toast.jsx';

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

// Agrupa os registros do banco por dia (somente leitura, mesmas consultas de antes).
function aggregate(days, water, food) {
  const waterByDay = Object.create(null);
  const foodByDay = Object.create(null);
  water.forEach((r) => { waterByDay[r.day] = (waterByDay[r.day] || 0) + Number(r.ml || 0); });
  food.forEach((r) => {
    const current = foodByDay[r.day] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    current.kcal += Number(r.kcal || 0);
    current.protein += Number(r.protein_g || 0);
    current.carbs += Number(r.carbs_g || 0);
    current.fat += Number(r.fat_g || 0);
    foodByDay[r.day] = current;
  });
  return {
    days,
    kcal: days.map((d) => foodByDay[d]?.kcal || 0),
    water: days.map((d) => waterByDay[d] || 0),
    protein: days.map((d) => round1(foodByDay[d]?.protein || 0)),
    carbs: days.map((d) => round1(foodByDay[d]?.carbs || 0)),
    fat: days.map((d) => round1(foodByDay[d]?.fat || 0)),
  };
}

const avg = (values, count) => (count > 0 ? values.reduce((s, v) => s + v, 0) / count : 0);

function Delta({ now, before, unit, lower }) {
  if (!before) return null;
  const diff = Math.round(now - before);
  if (diff === 0) return <small className="delta">igual ao período anterior</small>;
  const better = lower ? diff < 0 : diff > 0;
  return (
    <small className={`delta ${better ? 'up' : ''}`}>
      {diff > 0 ? '+' : '−'}{fmtInt(Math.abs(diff))} {unit} vs. período anterior
    </small>
  );
}

export default function HistoryChart({ profile }) {
  const { user } = useAuth();
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const macroGoals = macroGoalsFromProfile(profile);

  useEffect(() => {
    let active = true;
    const load = async () => {
      // Busca o dobro do período para comparar com o intervalo imediatamente anterior.
      const all = lastNDays(range * 2);
      const [w, f] = await Promise.all([
        getWaterRange(user.id, all[0], all[all.length - 1]),
        getFoodRange(user.id, all[0], all[all.length - 1]),
      ]);
      if (!active) return;
      const full = aggregate(all, w, f);
      const slice = (from, to) => ({
        days: full.days.slice(from, to),
        kcal: full.kcal.slice(from, to),
        water: full.water.slice(from, to),
        protein: full.protein.slice(from, to),
        carbs: full.carbs.slice(from, to),
        fat: full.fat.slice(from, to),
      });
      setPrevious(slice(0, range));
      setData(slice(range, range * 2));
    };
    setData(null);
    load().catch((e) => toast(e.message || 'Falha ao buscar histórico', { type: 'error' }));
    return () => { active = false; };
  }, [user.id, range]);

  const hasFoodData = Boolean(data?.kcal.some((v) => v > 0));
  const macroIdx = data ? data.days.map((_, i) => i).filter((i) => data.protein[i] > 0 || data.carbs[i] > 0 || data.fat[i] > 0) : [];
  const hasMacroData = macroIdx.length > 0;

  const states = data
    ? data.kcal.map((v) => (v <= 0 ? 'none' : v >= kcalGoal * 0.9 && v <= kcalGoal * 1.15 ? 'hit' : 'miss'))
    : [];
  const hits = states.filter((s) => s === 'hit').length;

  const avgKcal = data ? avg(data.kcal, range) : 0;
  const avgWater = data ? avg(data.water, range) : 0;
  const prevKcal = previous && previous.kcal.some((v) => v > 0) ? avg(previous.kcal, range) : 0;
  const prevWater = previous && previous.water.some((v) => v > 0) ? avg(previous.water, range) : 0;

  const macroAvg = (key) => (macroIdx.length ? round1(macroIdx.reduce((s, i) => s + Number(data[key][i] || 0), 0) / macroIdx.length) : 0);

  const macroSeries = data ? [
    { name: 'Proteína', color: 'var(--protein)', values: data.protein, unit: 'g' },
    { name: 'Carboidratos', color: 'var(--carbs)', values: data.carbs, unit: 'g' },
    { name: 'Gorduras', color: 'var(--fat)', values: data.fat, unit: 'g' },
  ] : [];

  return (
    <div className="history">
      <div className="history-toolbar">
        <div className="segmented" role="group" aria-label="Período">
          <button type="button" aria-pressed={range === 7} className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 dias</button>
          <button type="button" aria-pressed={range === 30} className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 dias</button>
        </div>
        <button type="button" className="btn ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? 'Ver gráficos' : 'Ver como tabela'}
        </button>
      </div>

      {!data && <p className="muted history-loading" role="status">Carregando…</p>}

      {data && (
        <>
          <section className="card history-summary" aria-label="Resumo do período">
            <div className="summary-cell">
              <span className="summary-label">Dias na meta de calorias</span>
              <strong className="num">{hits}<small>/{range}</small></strong>
              <ConsistencyStrip days={data.days} states={states} />
            </div>
            <div className="summary-cell">
              <span className="summary-label">Média diária</span>
              <strong className="num">{fmtInt(avgKcal)}<small> kcal</small></strong>
              <Delta now={avgKcal} before={prevKcal} unit="kcal" />
            </div>
            <div className="summary-cell">
              <span className="summary-label">Água por dia</span>
              <strong className="num">{fmtInt(avgWater)}<small> ml</small></strong>
              <Delta now={avgWater} before={prevWater} unit="ml" />
            </div>
          </section>

          {!asTable && (
            <>
              <section className="card chart-card" aria-labelledby="h-chart-kcal">
                <div className="chart-head"><h2 id="h-chart-kcal">Calorias por dia</h2><span className="muted">Meta de {fmtInt(kcalGoal)} kcal</span></div>
                {hasFoodData ? (
                  <DayChart
                    days={data.days}
                    series={[{ name: 'Calorias', color: 'var(--text-2)', values: data.kcal, unit: 'kcal' }]}
                    goal={kcalGoal}
                    goalLabel={`Meta ${fmtInt(kcalGoal)}`}
                    label={`Calorias por dia nos últimos ${range} dias, média de ${fmtInt(avgKcal)} kcal`}
                  />
                ) : <p className="empty-state muted">Nenhuma refeição registrada neste período.</p>}
              </section>

              <section className="card chart-card" aria-labelledby="h-chart-water">
                <div className="chart-head"><h2 id="h-chart-water">Água por dia</h2><span className="muted">Meta de {fmtInt(waterGoal)} ml</span></div>
                {data.water.some((v) => v > 0) ? (
                  <DayChart
                    days={data.days}
                    series={[{ name: 'Água', color: 'var(--water)', values: data.water, unit: 'ml' }]}
                    goal={waterGoal}
                    goalLabel={`Meta ${fmtInt(waterGoal)}`}
                    label={`Água por dia nos últimos ${range} dias, média de ${fmtInt(avgWater)} ml`}
                  />
                ) : <p className="empty-state muted">Nenhuma água registrada neste período.</p>}
              </section>

              <section className="card chart-card" aria-labelledby="h-chart-macros">
                <div className="chart-head">
                  <h2 id="h-chart-macros">Macronutrientes por dia</h2>
                  <span className="muted num">Média: P {fmtNum(macroAvg('protein'))} g · C {fmtNum(macroAvg('carbs'))} g · G {fmtNum(macroAvg('fat'))} g</span>
                </div>
                <ChartLegend items={macroSeries} />
                {hasMacroData ? (
                  <DayChart
                    days={data.days}
                    series={macroSeries}
                    type={range > 7 ? 'line' : 'bar'}
                    label={`Proteína, carboidratos e gorduras em gramas por dia, últimos ${range} dias`}
                  />
                ) : (
                  <p className="empty-state muted">
                    {hasFoodData ? 'As refeições deste período foram salvas sem proteína, carboidratos e gorduras. Novos registros aparecem aqui.' : 'Nenhuma refeição registrada neste período.'}
                  </p>
                )}
                {hasMacroData && macroIdx.length < range && (
                  <p className="muted chart-note">Registros antigos não têm macros; esses dias aparecem zerados.</p>
                )}
                {hasMacroData && (
                  <p className="muted chart-note num">Metas: P {fmtInt(macroGoals.protein)} g · C {fmtInt(macroGoals.carbs)} g · G {fmtInt(macroGoals.fat)} g</p>
                )}
              </section>
            </>
          )}

          {asTable && (
            <section className="card table-card" aria-label="Histórico em tabela">
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">Calorias, água e macronutrientes por dia</caption>
                  <thead>
                    <tr><th scope="col">Dia</th><th scope="col">kcal</th><th scope="col">Água (ml)</th><th scope="col">P (g)</th><th scope="col">C (g)</th><th scope="col">G (g)</th></tr>
                  </thead>
                  <tbody>
                    {[...data.days].map((d, i) => i).reverse().map((i) => (
                      <tr key={data.days[i]}>
                        <th scope="row">{shortDay(data.days[i])}</th>
                        <td className="num">{fmtInt(data.kcal[i])}</td>
                        <td className="num">{fmtInt(data.water[i])}</td>
                        <td className="num">{fmtNum(data.protein[i])}</td>
                        <td className="num">{fmtNum(data.carbs[i])}</td>
                        <td className="num">{fmtNum(data.fat[i])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
