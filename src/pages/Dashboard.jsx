import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getProfile, getWaterForDay, getFoodForDay, getWaterRange, getFoodRange } from '../lib/supabase.js';
import { today, fmtDateLabel, lastNDays } from '../lib/dates.js';
import { prefetchTBCA } from '../lib/foods.js';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import ProgressCard from '../components/ProgressCard.jsx';
import WaterTracker from '../components/WaterTracker.jsx';
import FoodSection from '../components/FoodSection.jsx';
import GoalsSettings from '../components/GoalsSettings.jsx';
import HistoryChart from '../components/HistoryChart.jsx';
import DailyInsight from '../components/DailyInsight.jsx';
import Toast from '../components/Toast.jsx';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function Streaks({ waterStreak, kcalStreak, waterDone, kcalDone }) {
  return <section className="streak-card" aria-label="Sequência de metas">
    <div className="streak-head"><div><div className="streak-title">🔥 Sequência de metas</div><div className="muted" style={{marginTop:3}}>Mantenha suas metas em dia</div></div><div className="streak-count">{Math.min(waterStreak, kcalStreak)} <span className="muted" style={{fontSize:11}}>dias</span></div></div>
    <div className="streak-grid">
      <div className={`streak-item ${waterDone ? 'done' : ''}`}><div className="streak-icon">💧</div><div><strong>{waterStreak} dias de água</strong><span>{waterDone ? 'Meta de hoje batida!' : 'Bata a meta hoje para continuar'}</span></div></div>
      <div className={`streak-item ${kcalDone ? 'done' : ''}`}><div className="streak-icon">🔥</div><div><strong>{kcalStreak} dias de kcal</strong><span>{kcalDone ? 'Meta de hoje batida!' : 'Bata a meta hoje para continuar'}</span></div></div>
    </div>
  </section>;
}

export default function Dashboard({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth(); const day = today();
  const [profile, setProfile] = useState(null); const [waterEntries, setWaterEntries] = useState([]); const [foodEntries, setFoodEntries] = useState([]);
  const [waterStreak, setWaterStreak] = useState(0); const [kcalStreak, setKcalStreak] = useState(0);

  const reloadProfile = useCallback(async () => { try { setProfile(await getProfile(user.id)); } catch (e) { console.warn('getProfile falhou:', e?.message); } }, [user.id]);
  const reloadToday = useCallback(async () => { try { const [w,f] = await Promise.all([getWaterForDay(user.id,day),getFoodForDay(user.id,day)]); setWaterEntries(w); setFoodEntries(f); } catch(e) { console.warn('reloadToday falhou:',e?.message); } }, [user.id,day]);
  const reloadStreaks = useCallback(async () => {
    if (!profile) return;
    try {
      const days = lastNDays(60); const [water,food] = await Promise.all([getWaterRange(user.id,days[0],day),getFoodRange(user.id,days[0],day)]);
      const wm={},fm={}; water.forEach(e=>wm[e.day]=(wm[e.day]||0)+Number(e.ml||0)); food.forEach(e=>fm[e.day]=(fm[e.day]||0)+Number(e.kcal||0));
      const count=(map,goal)=>{let n=0; for(let i=days.length-1;i>=0;i--){if(Number(map[days[i]]||0)>=Number(goal)){n++;}else break;} return n;};
      setWaterStreak(count(wm,profile.daily_water_goal_ml||2000)); setKcalStreak(count(fm,profile.daily_kcal_goal||2000));
    } catch(e) { console.warn('streaks falharam:',e?.message); }
  },[user.id,day,profile]);

  useEffect(()=>{reloadProfile();reloadToday();prefetchTBCA();},[reloadProfile,reloadToday]);
  useEffect(()=>{reloadStreaks();},[reloadStreaks,waterEntries,foodEntries]);
  const kcalGoal=profile?.daily_kcal_goal||2000, waterGoal=profile?.daily_water_goal_ml||2000;
  const waterConsumed=waterEntries.reduce((s,e)=>s+e.ml,0), kcalConsumed=foodEntries.reduce((s,e)=>s+e.kcal,0);
  return <div className="app">
    <ProfessionalHeader subtitle={`${fmtDateLabel(day)} · hoje`} theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent}/><Toast/>
    <ProgressCard title="Calorias" unit="kcal" consumed={kcalConsumed} goal={kcalGoal} variant="food"/>
    <ProgressCard title="Água" unit="ml" consumed={waterConsumed} goal={waterGoal} variant="water"><WaterTracker entries={waterEntries} onChange={reloadToday}/></ProgressCard>
    <Streaks waterStreak={waterStreak} kcalStreak={kcalStreak} waterDone={waterConsumed>=waterGoal} kcalDone={kcalConsumed>=kcalGoal}/>
    {MEALS.map(meal=><FoodSection key={meal} meal={meal} entries={foodEntries.filter(e=>e.meal===meal)} onChange={reloadToday}/>)}
    <GoalsSettings profile={profile} onSaved={reloadProfile}/><DailyInsight foodEntries={foodEntries} waterEntries={waterEntries} kcalGoal={kcalGoal} waterGoal={waterGoal}/><HistoryChart profile={profile}/>
  </div>;
}