import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  getProfile,
  getWaterForDay,
  getFoodForDay,
  getWaterRange,
  getFoodRange,
} from '../lib/supabase.js';
import { today, fmtDateLabel, lastNDays } from '../lib/dates.js';
import { prefetchTBCA } from '../lib/foods.js';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import WaterTracker from '../components/WaterTracker.jsx';
import FoodSection from '../components/FoodSection.jsx';
import GoalsSettings from '../components/GoalsSettings.jsx';
import HistoryChart from '../components/HistoryChart.jsx';
import DailyInsight from '../components/DailyInsight.jsx';

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];

const MEAL_META = {
  breakfast: { label: 'Café da manhã', icon: '☀' },
  lunch: { label: 'Almoço', icon: '◐' },
  snack: { label: 'Lanche', icon: '◇' },
  dinner: { label: 'Jantar', icon: '☾' },
};

function suggestedMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

function DashboardHeader({ day, kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealsLogged }) {
  const kcalRemaining = Math.max(0, kcalGoal - kcalConsumed);
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterConsumed / waterGoal) * 100)) : 0;
  const kcalPct = kcalGoal > 0 ? Math.min(100, Math.round((kcalConsumed / kcalGoal) * 100)) : 0;

  return (
    <section className="product-dashboard-header">
      <div className="product-dashboard-heading">
        <span className="product-dashboard-date">{fmtDateLabel(day)}</span>
        <h1>Hoje</h1>
        <p>Acompanhe o que importa e registre sua próxima refeição.</p>
      </div>

      <div className="product-summary-grid">
        <div className="product-summary-item primary">
          <span>Calorias restantes</span>
          <strong>{kcalRemaining.toLocaleString('pt-BR')}</strong>
          <small>de {kcalGoal.toLocaleString('pt-BR')} kcal</small>
        </div>
        <div className="product-summary-item">
          <span>Consumido</span>
          <strong>{kcalPct}%</strong>
          <small>{kcalConsumed.toLocaleString('pt-BR')} kcal</small>
        </div>
        <div className="product-summary-item">
          <span>Água</span>
          <strong>{waterPct}%</strong>
          <small>{waterConsumed.toLocaleString('pt-BR')} ml</small>
        </div>
        <div className="product-summary-item">
          <span>Refeições</span>
          <strong>{mealsLogged}/4</strong>
          <small>registradas hoje</small>
        </div>
      </div>
    </section>
  );
}

function CompactStreaks({ waterStreak, kcalStreak, waterDone, kcalDone }) {
  const streak = Math.min(waterStreak, kcalStreak);
  return (
    <section className="compact-streak-card">
      <div className="compact-streak-main">
        <span className="product-section-label">Consistência</span>
        <strong>{streak}</strong>
        <small>dias de sequência</small>
      </div>
      <div className="compact-streak-status">
        <span className={waterDone ? 'done' : ''}><i /> Água <b>{waterStreak}d</b></span>
        <span className={kcalDone ? 'done' : ''}><i /> Calorias <b>{kcalStreak}d</b></span>
      </div>
    </section>
  );
}

function MealRoutineSelector({ activeMeal, setActiveMeal, foodEntries }) {
  return (
    <div className="meal-routine product-meal-routine">
      <div className="meal-routine-copy">
        <span className="product-section-label">Próxima refeição</span>
        <strong>O que você quer registrar?</strong>
        <small>Selecione uma refeição para abrir o registro.</small>
      </div>

      <div className="meal-routine-options" role="tablist" aria-label="Escolher refeição para registrar">
        {MEALS.map((meal) => {
          const meta = MEAL_META[meal];
          const entries = foodEntries.filter((entry) => entry.meal === meal);
          const kcal = entries.reduce((sum, entry) => sum + Number(entry.kcal || 0), 0);
          return (
            <button
              key={meal}
              type="button"
              role="tab"
              aria-selected={activeMeal === meal}
              className={`meal-routine-option ${activeMeal === meal ? 'active' : ''} ${entries.length ? 'logged' : ''}`}
              onClick={() => setActiveMeal(meal)}
            >
              <span className="meal-routine-icon">{meta.icon}</span>
              <span className="meal-routine-option-copy">
                <strong>{meta.label}</strong>
                <small>{entries.length ? `${entries.length} ${entries.length === 1 ? 'item' : 'itens'} · ${kcal} kcal` : 'Sem registro'}</small>
              </span>
              <span className="meal-routine-state">{entries.length ? '✓' : '›'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth();
  const day = today();
  const [profile, setProfile] = useState(null);
  const [waterEntries, setWaterEntries] = useState([]);
  const [foodEntries, setFoodEntries] = useState([]);
  const [waterStreak, setWaterStreak] = useState(0);
  const [kcalStreak, setKcalStreak] = useState(0);
  const [activePanel, setActivePanel] = useState('meals');
  const [activeMeal, setActiveMeal] = useState(() => suggestedMeal());

  const reloadProfile = useCallback(async () => {
    try { setProfile(await getProfile(user.id)); }
    catch (e) { console.warn('getProfile falhou:', e?.message); }
  }, [user.id]);

  const reloadToday = useCallback(async () => {
    try {
      const [w, f] = await Promise.all([
        getWaterForDay(user.id, day),
        getFoodForDay(user.id, day),
      ]);
      setWaterEntries(w);
      setFoodEntries(f);
    } catch (e) { console.warn('reloadToday falhou:', e?.message); }
  }, [user.id, day]);

  const reloadStreaks = useCallback(async () => {
    if (!profile) return;
    try {
      const days = lastNDays(60);
      const [water, food] = await Promise.all([
        getWaterRange(user.id, days[0], day),
        getFoodRange(user.id, days[0], day),
      ]);
      const wm = {};
      const fm = {};
      water.forEach((e) => { wm[e.day] = (wm[e.day] || 0) + Number(e.ml || 0); });
      food.forEach((e) => { fm[e.day] = (fm[e.day] || 0) + Number(e.kcal || 0); });
      const count = (map, goal) => {
        let n = 0;
        for (let i = days.length - 1; i >= 0; i--) {
          if (Number(map[days[i]] || 0) >= Number(goal)) n++;
          else break;
        }
        return n;
      };
      setWaterStreak(count(wm, profile.daily_water_goal_ml || 2000));
      setKcalStreak(count(fm, profile.daily_kcal_goal || 2000));
    } catch (e) { console.warn('streaks falharam:', e?.message); }
  }, [user.id, day, profile]);

  useEffect(() => {
    reloadProfile();
    reloadToday();
    prefetchTBCA();
  }, [reloadProfile, reloadToday]);

  useEffect(() => { reloadStreaks(); }, [reloadStreaks, waterEntries, foodEntries]);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const waterConsumed = waterEntries.reduce((s, e) => s + e.ml, 0);
  const kcalConsumed = foodEntries.reduce((s, e) => s + e.kcal, 0);
  const mealsLogged = MEALS.filter((meal) => foodEntries.some((entry) => entry.meal === meal)).length;
  const activeMealEntries = foodEntries.filter((entry) => entry.meal === activeMeal);

  return (
    <div className="app premium-dashboard dashboard-v3 product-dashboard">
      <ProfessionalHeader
        subtitle={`${fmtDateLabel(day)} — Hoje`}
        theme={theme}
        accent={accent}
        setTheme={setTheme}
        setAccent={setAccent}
      />

      <DashboardHeader
        day={day}
        kcalConsumed={kcalConsumed}
        kcalGoal={kcalGoal}
        waterConsumed={waterConsumed}
        waterGoal={waterGoal}
        mealsLogged={mealsLogged}
      />

      <section className="dashboard-overview-grid product-overview-grid">
        <div className="dashboard-progress-grid dashboard-progress-grid-v3">
          <ProgressCard title="Calorias" unit="kcal" consumed={kcalConsumed} goal={kcalGoal} variant="food" />
          <ProgressCard title="Água" unit="ml" consumed={waterConsumed} goal={waterGoal} variant="water">
            <WaterTracker entries={waterEntries} onChange={reloadToday} />
          </ProgressCard>
        </div>
        <CompactStreaks
          waterStreak={waterStreak}
          kcalStreak={kcalStreak}
          waterDone={waterConsumed >= waterGoal}
          kcalDone={kcalConsumed >= kcalGoal}
        />
      </section>

      <section className="dashboard-workspace product-workspace">
        <div className="dashboard-workspace-head">
          <div>
            <span className="product-section-label">Painel diário</span>
            <h2>Detalhes</h2>
          </div>
          <div className="dashboard-tabs" role="tablist" aria-label="Painéis do dashboard">
            <button className={activePanel === 'meals' ? 'active' : ''} onClick={() => setActivePanel('meals')}>Rotina</button>
            <button className={activePanel === 'insights' ? 'active' : ''} onClick={() => setActivePanel('insights')}>Metas</button>
            <button className={activePanel === 'history' ? 'active' : ''} onClick={() => setActivePanel('history')}>Histórico</button>
          </div>
        </div>

        <div className="dashboard-workspace-body">
          {activePanel === 'meals' && (
            <div className="dashboard-panel dashboard-panel-meals dashboard-routine-panel">
              <MealRoutineSelector activeMeal={activeMeal} setActiveMeal={setActiveMeal} foodEntries={foodEntries} />
              <div className="active-meal-panel">
                <div className="active-meal-panel-head">
                  <div>
                    <span>Registrando</span>
                    <strong>{MEAL_META[activeMeal].label}</strong>
                  </div>
                  <small>{activeMealEntries.length ? `${activeMealEntries.length} ${activeMealEntries.length === 1 ? 'item' : 'itens'}` : 'Nenhum item'}</small>
                </div>
                <FoodSection key={activeMeal} meal={activeMeal} entries={activeMealEntries} onChange={reloadToday} />
              </div>
            </div>
          )}

          {activePanel === 'insights' && (
            <div className="dashboard-panel dashboard-panel-insights">
              <div className="dashboard-lower-grid dashboard-lower-grid-v3">
                <GoalsSettings profile={profile} onSaved={reloadProfile} />
                <DailyInsight foodEntries={foodEntries} waterEntries={waterEntries} kcalGoal={kcalGoal} waterGoal={waterGoal} />
              </div>
            </div>
          )}

          {activePanel === 'history' && (
            <div className="dashboard-panel dashboard-panel-history">
              <HistoryChart profile={profile} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
