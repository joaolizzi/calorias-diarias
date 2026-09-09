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

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function PremiumDataObject({ kcalPct, waterPct, mealsLogged }) {
  return (
    <div className="premium-data-object" aria-hidden="true">
      <div className="pdo-glow" />
      <div className="pdo-platform">
        <div className="pdo-platform-edge" />
        <div className="pdo-screen">
          <div className="pdo-screen-topline">
            <span>NUTRIX</span>
            <i />
          </div>
          <div className="pdo-ring" style={{ '--pdo-value': `${Math.max(kcalPct, 8)}%` }}>
            <div>
              <strong>{kcalPct}%</strong>
              <span>energia</span>
            </div>
          </div>
          <div className="pdo-mini-metrics">
            <span><b>{waterPct}%</b> água</span>
            <span><b>{mealsLogged}</b> refeições</span>
          </div>
        </div>
        <div className="pdo-reflection" />
      </div>
      <div className="pdo-float-tag pdo-tag-one">LIVE</div>
      <div className="pdo-float-tag pdo-tag-two">AI READY</div>
    </div>
  );
}

function DashboardHero({ kcalConsumed, kcalGoal, waterConsumed, waterGoal, mealsLogged }) {
  const kcalRemaining = Math.max(0, kcalGoal - kcalConsumed);
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterConsumed / waterGoal) * 100)) : 0;
  const kcalPct = kcalGoal > 0 ? Math.min(100, Math.round((kcalConsumed / kcalGoal) * 100)) : 0;

  return (
    <section className="dashboard-hero dashboard-hero-v3">
      <div className="dashboard-hero-copy">
        <span className="dashboard-kicker">NUTRIX DAILY</span>
        <h1>Seu dia, sem ruído.</h1>
        <p>
          Calorias, hidratação, refeições e consistência em uma visão mais direta e inteligente.
        </p>
        <div className="dashboard-hero-badges" aria-hidden="true">
          <span><i /> Sincronizado</span>
          <span>Nutrix Intelligence</span>
        </div>
      </div>

      <PremiumDataObject kcalPct={kcalPct} waterPct={waterPct} mealsLogged={mealsLogged} />

      <div className="dashboard-hero-stats dashboard-hero-stats-v3">
        <div className="hero-stat hero-stat-primary">
          <span>Restante</span>
          <strong>{kcalRemaining.toLocaleString('pt-BR')}</strong>
          <small>kcal disponíveis</small>
        </div>
        <div className="hero-stat">
          <span>Hidratação</span>
          <strong>{waterPct}%</strong>
          <small>da meta diária</small>
        </div>
        <div className="hero-stat">
          <span>Calorias</span>
          <strong>{kcalPct}%</strong>
          <small>da meta diária</small>
        </div>
        <div className="hero-stat">
          <span>Registros</span>
          <strong>{mealsLogged}</strong>
          <small>refeições com itens</small>
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
        <span className="dashboard-kicker">CONSISTÊNCIA</span>
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

export default function Dashboard({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth();
  const day = today();
  const [profile, setProfile] = useState(null);
  const [waterEntries, setWaterEntries] = useState([]);
  const [foodEntries, setFoodEntries] = useState([]);
  const [waterStreak, setWaterStreak] = useState(0);
  const [kcalStreak, setKcalStreak] = useState(0);
  const [activePanel, setActivePanel] = useState('meals');

  const reloadProfile = useCallback(async () => {
    try {
      setProfile(await getProfile(user.id));
    } catch (e) {
      console.warn('getProfile falhou:', e?.message);
    }
  }, [user.id]);

  const reloadToday = useCallback(async () => {
    try {
      const [w, f] = await Promise.all([
        getWaterForDay(user.id, day),
        getFoodForDay(user.id, day),
      ]);
      setWaterEntries(w);
      setFoodEntries(f);
    } catch (e) {
      console.warn('reloadToday falhou:', e?.message);
    }
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
      water.forEach((e) => {
        wm[e.day] = (wm[e.day] || 0) + Number(e.ml || 0);
      });
      food.forEach((e) => {
        fm[e.day] = (fm[e.day] || 0) + Number(e.kcal || 0);
      });
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
    } catch (e) {
      console.warn('streaks falharam:', e?.message);
    }
  }, [user.id, day, profile]);

  useEffect(() => {
    reloadProfile();
    reloadToday();
    prefetchTBCA();
  }, [reloadProfile, reloadToday]);

  useEffect(() => {
    reloadStreaks();
  }, [reloadStreaks, waterEntries, foodEntries]);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const waterConsumed = waterEntries.reduce((s, e) => s + e.ml, 0);
  const kcalConsumed = foodEntries.reduce((s, e) => s + e.kcal, 0);
  const mealsLogged = MEALS.filter((meal) => foodEntries.some((entry) => entry.meal === meal)).length;

  return (
    <div className="app premium-dashboard dashboard-v3">
      <ProfessionalHeader
        subtitle={`${fmtDateLabel(day)} — Hoje`}
        theme={theme}
        accent={accent}
        setTheme={setTheme}
        setAccent={setAccent}
      />

      <DashboardHero
        kcalConsumed={kcalConsumed}
        kcalGoal={kcalGoal}
        waterConsumed={waterConsumed}
        waterGoal={waterGoal}
        mealsLogged={mealsLogged}
      />

      <section className="dashboard-overview-grid">
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

      <section className="dashboard-workspace">
        <div className="dashboard-workspace-head">
          <div>
            <span className="dashboard-kicker">WORKSPACE</span>
            <h2>Seu painel diário</h2>
          </div>
          <div className="dashboard-tabs" role="tablist" aria-label="Painéis do dashboard">
            <button className={activePanel === 'meals' ? 'active' : ''} onClick={() => setActivePanel('meals')}>Refeições</button>
            <button className={activePanel === 'insights' ? 'active' : ''} onClick={() => setActivePanel('insights')}>Insights</button>
            <button className={activePanel === 'history' ? 'active' : ''} onClick={() => setActivePanel('history')}>Histórico</button>
          </div>
        </div>

        <div className="dashboard-workspace-body">
          {activePanel === 'meals' && (
            <div className="dashboard-panel dashboard-panel-meals">
              <div className="dashboard-panel-meta">{foodEntries.length} itens registrados hoje</div>
              <div className="dashboard-meals-grid dashboard-meals-grid-v3">
                {MEALS.map((meal) => (
                  <FoodSection
                    key={meal}
                    meal={meal}
                    entries={foodEntries.filter((e) => e.meal === meal)}
                    onChange={reloadToday}
                  />
                ))}
              </div>
            </div>
          )}

          {activePanel === 'insights' && (
            <div className="dashboard-panel dashboard-panel-insights">
              <div className="dashboard-lower-grid dashboard-lower-grid-v3">
                <GoalsSettings profile={profile} onSaved={reloadProfile} />
                <DailyInsight
                  foodEntries={foodEntries}
                  waterEntries={waterEntries}
                  kcalGoal={kcalGoal}
                  waterGoal={waterGoal}
                />
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
