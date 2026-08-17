import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  getProfile,
  getWaterForDay,
  getFoodForDay,
} from '../lib/supabase.js';
import { today, fmtDateLabel } from '../lib/dates.js';
import { prefetchTBCA } from '../lib/foods.js';

import Header from '../components/Header.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import WaterTracker from '../components/WaterTracker.jsx';
import FoodSection from '../components/FoodSection.jsx';
import GoalsSettings from '../components/GoalsSettings.jsx';
import HistoryChart from '../components/HistoryChart.jsx';
import DailyInsight from '../components/DailyInsight.jsx';
import Toast from '../components/Toast.jsx';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Dashboard({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth();
  const day = today();

  const [profile, setProfile] = useState(null);
  const [waterEntries, setWaterEntries] = useState([]);
  const [foodEntries, setFoodEntries] = useState([]);

  const reloadProfile = useCallback(async () => {
    try {
      const p = await getProfile(user.id);
      setProfile(p);
    } catch (e) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.warn('reloadToday falhou:', e?.message);
    }
  }, [user.id, day]);

  useEffect(() => {
    reloadProfile();
    reloadToday();
    prefetchTBCA();
  }, [reloadProfile, reloadToday]);

  const kcalGoal = profile?.daily_kcal_goal || 2000;
  const waterGoal = profile?.daily_water_goal_ml || 2000;
  const waterConsumed = waterEntries.reduce((s, e) => s + e.ml, 0);
  const kcalConsumed = foodEntries.reduce((s, e) => s + e.kcal, 0);

  return (
    <div className="app">
      <Header subtitle={`${fmtDateLabel(day)} · hoje`} theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />
      <Toast />

      <ProgressCard title="Calorias" unit="kcal" consumed={kcalConsumed} goal={kcalGoal} variant="food" />
      <ProgressCard title="Água" unit="ml" consumed={waterConsumed} goal={waterGoal} variant="water">
        <WaterTracker entries={waterEntries} onChange={reloadToday} />
      </ProgressCard>

      {MEALS.map((meal) => (
        <FoodSection key={meal} meal={meal} entries={foodEntries.filter((e) => e.meal === meal)} onChange={reloadToday} />
      ))}

      <GoalsSettings profile={profile} onSaved={reloadProfile} />
      <DailyInsight foodEntries={foodEntries} waterEntries={waterEntries} kcalGoal={kcalGoal} waterGoal={waterGoal} />
      <HistoryChart profile={profile} />
    </div>
  );
}