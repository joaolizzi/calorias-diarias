import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getProfile, getWaterForDay, getFoodForDay, getWaterRange, getFoodRange } from '../lib/supabase.js';
import { today, fmtDateLabel, lastNDays } from '../lib/dates.js';
import { prefetchTBCA } from '../lib/foods.js';
import { macroGoalsFromProfile, sumMacros } from '../lib/macros.js';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import WaterTracker from '../components/WaterTracker.jsx';
import FoodSection from '../components/FoodSection.jsx';
import GoalsSettings from '../components/GoalsSettings.jsx';
import HistoryChart from '../components/HistoryChart.jsx';
import DailyInsight from '../components/DailyInsight.jsx';
import Icon from '../components/Icon.jsx';
import useGrow from '../components/useGrow.js';
import { fmtNum, fmtInt, pctOf } from '../components/format.js';

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];
const VALID_PANELS = new Set(['meals', 'insights', 'history']);
const MEAL_META = {
  breakfast: { label: 'Café da manhã' },
  lunch: { label: 'Almoço' },
  snack: { label: 'Lanche' },
  dinner: { label: 'Jantar' },
};
const PANEL_TITLES = { meals: 'Hoje', insights: 'Metas', history: 'Histórico' };

function suggestedMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

function reportTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function buildDailyReport({
  day,
  kcalConsumed,
  kcalGoal,
  waterConsumed,
  waterGoal,
  macroTotals,
  macroGoals,
  foodEntries,
  waterEntries,
  waterStreak,
  kcalStreak,
}) {
  const kcalRemaining = Math.max(0, kcalGoal - kcalConsumed);
  const waterRemaining = Math.max(0, waterGoal - waterConsumed);
  const lines = [];

  lines.push('NUTRIX — RELATÓRIO DIÁRIO');
  lines.push('='.repeat(42));
  lines.push(`Data: ${fmtDateLabel(day)} (${day})`);
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  lines.push('');

  lines.push('RESUMO DO DIA');
  lines.push('-'.repeat(42));
  lines.push(`Calorias: ${Math.round(kcalConsumed)} / ${Math.round(kcalGoal)} kcal`);
  lines.push(`Calorias restantes: ${Math.round(kcalRemaining)} kcal`);
  lines.push(`Água: ${Math.round(waterConsumed)} / ${Math.round(waterGoal)} ml`);
  lines.push(`Água restante: ${Math.round(waterRemaining)} ml`);
  lines.push(`Sequência de água: ${waterStreak} dia(s)`);
  lines.push(`Sequência de calorias: ${kcalStreak} dia(s)`);
  lines.push('');

  lines.push('MACRONUTRIENTES');
  lines.push('-'.repeat(42));
  lines.push(`Proteína: ${round1(macroTotals.protein)} / ${Math.round(macroGoals.protein)} g`);
  lines.push(`Carboidratos: ${round1(macroTotals.carbs)} / ${Math.round(macroGoals.carbs)} g`);
  lines.push(`Gorduras: ${round1(macroTotals.fat)} / ${Math.round(macroGoals.fat)} g`);
  lines.push('');

  lines.push('REFEIÇÕES');
  lines.push('-'.repeat(42));
  for (const meal of MEALS) {
    const mealEntries = foodEntries
      .filter((entry) => entry.meal === meal)
      .sort((a, b) => new Date(a.consumed_at || 0) - new Date(b.consumed_at || 0));
    const mealKcal = mealEntries.reduce((sum, entry) => sum + Number(entry.kcal || 0), 0);
    const mealMacros = sumMacros(mealEntries);

    lines.push(`${MEAL_META[meal].label.toUpperCase()} — ${Math.round(mealKcal)} kcal`);
    if (!mealEntries.length) {
      lines.push('  Nenhum alimento registrado.');
    } else {
      for (const entry of mealEntries) {
        const grams = Number(entry.grams || 0);
        const protein = Number(entry.protein_g ?? entry.protein ?? 0);
        const carbs = Number(entry.carbs_g ?? entry.carbs ?? 0);
        const fat = Number(entry.fat_g ?? entry.fat ?? 0);
        lines.push(
          `  ${reportTime(entry.consumed_at)} · ${entry.name}` +
          `${grams > 0 ? ` · ${Math.round(grams)} g` : ''}` +
          ` · ${Math.round(Number(entry.kcal || 0))} kcal` +
          ` · P ${round1(protein)}g | C ${round1(carbs)}g | G ${round1(fat)}g`,
        );
      }
      lines.push(`  Total: P ${round1(mealMacros.protein)}g | C ${round1(mealMacros.carbs)}g | G ${round1(mealMacros.fat)}g`);
    }
    lines.push('');
  }

  lines.push('HIDRATAÇÃO');
  lines.push('-'.repeat(42));
  const orderedWater = [...waterEntries].sort((a, b) => new Date(a.consumed_at || 0) - new Date(b.consumed_at || 0));
  if (!orderedWater.length) {
    lines.push('Nenhum registro de água.');
  } else {
    for (const entry of orderedWater) {
      lines.push(`${reportTime(entry.consumed_at)} · +${Math.round(Number(entry.ml || 0))} ml`);
    }
    lines.push(`Total: ${Math.round(waterConsumed)} ml`);
  }

  lines.push('');
  lines.push('Relatório gerado pelo Nutrix.');
  return lines.join('\r\n');
}

function longDateLabel(day) {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function MacroRows({ totals, goals }) {
  const rows = [
    { key: 'protein', name: 'Proteína', value: totals.protein, goal: goals.protein },
    { key: 'carbs', name: 'Carboidratos', value: totals.carbs, goal: goals.carbs },
    { key: 'fat', name: 'Gorduras', value: totals.fat, goal: goals.fat },
  ];
  return (
    <div className="macro-table">
      <div className="macro-rule" aria-hidden="true" />
      <div className="macro-table-head">
        <h3>Macronutrientes</h3>
        <span>consumido / meta</span>
      </div>
      {rows.map((row) => {
        const pct = pctOf(row.value, row.goal);
        const label = `${row.name}: ${fmtNum(row.value, 0)} de ${fmtNum(row.goal, 0)} gramas, ${pct}%`;
        return (
          <div className={`macro-row macro-${row.key}`} key={row.key}>
            <span className="macro-name">{row.name}</span>
            <MacroBar pct={pct} label={label} />
            <span className="macro-values num">{fmtNum(row.value, 0)} / {fmtNum(row.goal, 0)} g</span>
            <span className="macro-pct num">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function MacroBar({ pct, label }) {
  const shown = useGrow(pct);
  return <div className="macro-bar" role="img" aria-label={label}><i style={{ width: `${shown}%` }} /></div>;
}

function MealAccordion({ meals, openMeal, onToggle, foodEntries, onChange, focusAction, dayKcal, kcalGoal }) {
  return (
    <div className="meal-list">
      {meals.map((meal) => {
        const entries = foodEntries.filter((entry) => entry.meal === meal);
        const label = MEAL_META[meal].label;
        const isOpen = openMeal === meal;
        const kcal = entries.reduce((sum, entry) => sum + Number(entry.kcal || 0), 0);
        const macros = sumMacros(entries);
        const count = `${entries.length} ${entries.length === 1 ? 'item' : 'itens'}`;
        const empty = entries.length === 0;
        const panelId = `meal-panel-${meal}`;

        return (
          <div className={`meal-row ${isOpen ? 'open' : ''}`} key={meal}>
            {empty && !isOpen ? (
              <div className="meal-head meal-head-empty">
                <span className="meal-name">{label}</span>
                <span className="meal-summary">Nada registrado ainda</span>
                <button type="button" className="btn meal-add" onClick={() => onToggle(meal)}>
                  <Icon name="plus" size={17} />
                  Registrar {label.toLowerCase()}
                </button>
              </div>
            ) : (
              <button type="button" className="meal-head" aria-expanded={isOpen} aria-controls={panelId} onClick={() => onToggle(meal)}>
                <span className="meal-name">{label}</span>
                <span className="meal-summary num">
                  {empty ? 'Nada registrado ainda' : `${count} · P ${fmtNum(macros.protein)} · C ${fmtNum(macros.carbs)} · G ${fmtNum(macros.fat)}`}
                </span>
                <span className="meal-kcal num">{fmtInt(kcal)} kcal</span>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} className="meal-chevron" />
              </button>
            )}
            {isOpen && (
              <div className="active-meal-panel" id={panelId}>
                <FoodSection key={`${meal}-${focusAction || 'default'}`} meal={meal} entries={entries} onChange={onChange} initialAction={focusAction} dayKcal={dayKcal} kcalGoal={kcalGoal} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ theme, accent, preset, setTheme, setAccent, setPreset }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const day = today();
  const [profile, setProfile] = useState(null);
  const [waterEntries, setWaterEntries] = useState([]);
  const [foodEntries, setFoodEntries] = useState([]);
  const [waterStreak, setWaterStreak] = useState(0);
  const [kcalStreak, setKcalStreak] = useState(0);
  const requestedPanel = searchParams.get('panel');
  const [activePanel, setActivePanel] = useState(() => VALID_PANELS.has(requestedPanel) ? requestedPanel : 'meals');
  const [activeMeal, setActiveMeal] = useState(() => suggestedMeal());
  const toggleMeal = (meal) => setActiveMeal((current) => (current === meal ? null : meal));

  const reloadProfile = useCallback(async () => { try { setProfile(await getProfile(user.id)); } catch (e) { console.warn('getProfile falhou:', e?.message); } }, [user.id]);
  const reloadToday = useCallback(async () => { try { const [w, f] = await Promise.all([getWaterForDay(user.id, day), getFoodForDay(user.id, day)]); setWaterEntries(w); setFoodEntries(f); } catch (e) { console.warn('reloadToday falhou:', e?.message); } }, [user.id, day]);

  const reloadStreaks = useCallback(async () => {
    if (!profile) return;
    try {
      const days = lastNDays(60);
      const [water, food] = await Promise.all([getWaterRange(user.id, days[0], day), getFoodRange(user.id, days[0], day)]);
      const wm = {}; const fm = {};
      water.forEach((e) => { wm[e.day] = (wm[e.day] || 0) + Number(e.ml || 0); });
      food.forEach((e) => { fm[e.day] = (fm[e.day] || 0) + Number(e.kcal || 0); });
      const count = (map, goal) => { let n = 0; for (let i = days.length - 1; i >= 0; i--) { if (Number(map[days[i]] || 0) >= Number(goal)) n++; else break; } return n; };
      setWaterStreak(count(wm, profile.daily_water_goal_ml || 2000));
      setKcalStreak(count(fm, profile.daily_kcal_goal || 2000));
    } catch (e) { console.warn('streaks falharam:', e?.message); }
  }, [user.id, day, profile]);

  useEffect(() => { reloadProfile(); reloadToday(); prefetchTBCA(); }, [reloadProfile, reloadToday]);
  useEffect(() => { reloadStreaks(); }, [reloadStreaks, waterEntries, foodEntries]);
  useEffect(() => { const panel = searchParams.get('panel'); setActivePanel(VALID_PANELS.has(panel) ? panel : 'meals'); }, [searchParams]);
  useEffect(() => {
    const focus = searchParams.get('focus');
    if ((focus === 'register' || focus === 'ai') && activePanel === 'meals') setActiveMeal((current) => current || suggestedMeal());
    if (focus === 'register' && activePanel === 'meals') { const timer = window.setTimeout(() => document.querySelector('.active-meal-panel input')?.focus(), 120); return () => window.clearTimeout(timer); }
    if (focus === 'water') { const timer = window.setTimeout(() => document.querySelector('.dashboard-vitals-water .progress-card-water')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); return () => window.clearTimeout(timer); }
    return undefined;
  }, [activePanel, searchParams]);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const macroGoals = macroGoalsFromProfile(profile);
  const macroTotals = sumMacros(foodEntries);
  const waterConsumed = waterEntries.reduce((s, e) => s + Number(e.ml || 0), 0);
  const kcalConsumed = foodEntries.reduce((s, e) => s + Number(e.kcal || 0), 0);
  const mealsLogged = MEALS.filter((meal) => foodEntries.some((entry) => entry.meal === meal)).length;
  const focusAction = searchParams.get('focus') === 'ai' ? 'natural' : null;

  const downloadDailyReport = () => {
    const content = buildDailyReport({
      day,
      kcalConsumed,
      kcalGoal,
      waterConsumed,
      waterGoal,
      macroTotals,
      macroGoals,
      foodEntries,
      waterEntries,
      waterStreak,
      kcalStreak,
    });
    const blob = new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nutrix-relatorio-${day}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const streak = Math.min(waterStreak, kcalStreak);
  const streakLabel = streak > 0 ? `${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'} na meta` : 'Sequência: comece hoje';
  const title = PANEL_TITLES[activePanel] || 'Hoje';

  return (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />
      <main className="page" id="conteudo">
        <div className="page-inner">
          <header className="page-head">
            <div>
              <p className="page-date">{longDateLabel(day)}</p>
              <h1>{title}</h1>
            </div>
            {activePanel === 'meals' && (
              <div className="page-head-actions">
                <span className={`streak-pill ${streak > 0 ? 'on' : ''}`} title={`Água: ${waterStreak} dia(s) · Calorias: ${kcalStreak} dia(s)`}>
                  <Icon name="check" size={16} />
                  {streakLabel}
                </span>
                <button type="button" className="btn" onClick={downloadDailyReport} title="Baixar o relatório do dia em TXT">
                  <Icon name="download" size={17} />
                  Relatório do dia
                </button>
              </div>
            )}
          </header>

          {activePanel === 'meals' && (
            <>
              <div className="vitals-grid">
                <div className="vitals-left">
                  <ProgressCard title="Calorias" unit="kcal" consumed={kcalConsumed} goal={kcalGoal} variant="food">
                    <MacroRows totals={macroTotals} goals={macroGoals} />
                  </ProgressCard>
                </div>
                <div className="dashboard-vitals-water vitals-right">
                  <ProgressCard title="Água" unit="ml" consumed={waterConsumed} goal={waterGoal} variant="water">
                    <WaterTracker entries={waterEntries} onChange={reloadToday} />
                  </ProgressCard>
                </div>
              </div>

              <section className="meals-section" aria-labelledby="h-refeicoes">
                <div className="section-head">
                  <h2 id="h-refeicoes">Refeições</h2>
                  <span className="muted">{mealsLogged} de {MEALS.length} registradas</span>
                </div>
                <MealAccordion meals={MEALS} openMeal={activeMeal} onToggle={toggleMeal} foodEntries={foodEntries} onChange={reloadToday} focusAction={focusAction} dayKcal={kcalConsumed} kcalGoal={kcalGoal} />
              </section>
            </>
          )}

          {activePanel === 'insights' && (
            <div className="goals-grid">
              <GoalsSettings profile={profile} onSaved={reloadProfile} />
              <DailyInsight foodEntries={foodEntries} waterEntries={waterEntries} kcalGoal={kcalGoal} waterGoal={waterGoal} />
            </div>
          )}

          {activePanel === 'history' && <HistoryChart profile={profile} />}
        </div>
      </main>
    </div>
  );
}
