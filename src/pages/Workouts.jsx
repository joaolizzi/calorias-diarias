import { useEffect, useMemo, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { DEFAULT_EXERCISES, calculateWorkoutStats, getWorkoutHistory, saveWorkout } from '../lib/workouts.js';

const plans = ['Treino livre', 'Push', 'Pull', 'Legs', 'Upper', 'Lower'];

function ExerciseEditor({ item, onChange, onRemove }) {
  const [rest, setRest] = useState(90);
  const addSet = () => onChange({ ...item, sets: [...item.sets, { weight: '', reps: '', done: false }] });
  const updateSet = (i, patch) => onChange({ ...item, sets: item.sets.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  return <div className="workout-exercise card">
    <div className="row">
      <div><strong>{item.name}</strong><div className="muted">{item.muscle}</div></div>
      <button className="icon-btn" onClick={onRemove} aria-label="Remover exercício">×</button>
    </div>
    <div className="workout-sets-head"><span>Série</span><span>kg</span><span>reps</span><span></span></div>
    {item.sets.map((s, i) => <div className={`workout-set ${s.done ? 'done' : ''}`} key={i}>
      <span>{i + 1}</span>
      <input inputMode="decimal" value={s.weight} placeholder="0" onChange={e => updateSet(i, { weight: e.target.value })} />
      <input inputMode="numeric" value={s.reps} placeholder="0" onChange={e => updateSet(i, { reps: e.target.value })} />
      <button className={s.done ? 'btn success' : 'btn'} onClick={() => updateSet(i, { done: !s.done })}>{s.done ? '✓' : 'Concluir'}</button>
    </div>)}
    <div className="workout-exercise-actions"><button className="btn" onClick={addSet}>+ Série</button><label className="rest-select">Descanso <select value={rest} onChange={e => setRest(Number(e.target.value))}><option value={60}>60s</option><option value={90}>90s</option><option value={120}>120s</option><option value={180}>180s</option></select></label></div>
  </div>;
}

export default function Workouts({ theme, accent, setTheme, setAccent }) {
  const [plan, setPlan] = useState('Treino livre');
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [picker, setPicker] = useState(false);

  useEffect(() => setHistory(getWorkoutHistory()), []);
  const stats = useMemo(() => calculateWorkoutStats({ exercises: items, startedAt, finishedAt: new Date().toISOString() }), [items, startedAt]);

  const start = () => { setActive(true); setStartedAt(new Date().toISOString()); if (!items.length) setItems([{ ...DEFAULT_EXERCISES[0], sets: [{ weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }] }]); };
  const addExercise = (exercise) => { setItems([...items, { ...exercise, sets: [{ weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }] }]); setPicker(false); };
  const finish = () => {
    const workout = saveWorkout({ date: new Date().toISOString().slice(0, 10), plan, startedAt, finishedAt: new Date().toISOString(), exercises: items.map(({ id, name, muscle, sets }) => ({ exerciseId: id, name, muscle, sets })) });
    setHistory([workout, ...history]); setActive(false); setStartedAt(null); setItems([]);
  };

  return <div className="app">
    <ProfessionalHeader subtitle="Treinos · academia" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />
    <div className="workout-page">
      <div className="workout-hero card"><div><div className="eyebrow">🏋️ TREINO</div><h1>{active ? plan : 'Seu treino'}</h1><p className="muted">Registre cargas, repetições e evolução em poucos toques.</p></div>{active ? <button className="btn primary" onClick={finish}>🏁 Finalizar</button> : <button className="btn primary" onClick={start}>▶ Iniciar treino</button>}</div>
      {active && <div className="workout-live-stats"><div><strong>{stats.exercises}</strong><span>exercícios</span></div><div><strong>{stats.sets}</strong><span>séries</span></div><div><strong>{stats.volume} kg</strong><span>volume</span></div><div><strong>{stats.duration} min</strong><span>duração</span></div></div>}
      {active && <div className="workout-plan-select"><select value={plan} onChange={e => setPlan(e.target.value)}>{plans.map(p => <option key={p}>{p}</option>)}</select><button className="btn" onClick={() => setPicker(!picker)}>+ Exercício</button></div>}
      {picker && <div className="card exercise-picker"><h3>Adicionar exercício</h3><div className="exercise-picker-grid">{DEFAULT_EXERCISES.map(e => <button key={e.id} className="exercise-option" onClick={() => addExercise(e)}><strong>{e.name}</strong><span>{e.muscle}</span></button>)}</div></div>}
      {active && items.map((item, i) => <ExerciseEditor key={`${item.id}-${i}`} item={item} onChange={next => setItems(items.map((x, idx) => idx === i ? next : x))} onRemove={() => setItems(items.filter((_, idx) => idx !== i))} />)}
      {!active && <><div className="section-title"><h2>Histórico</h2><span className="muted">{history.length} treinos</span></div>{history.length === 0 ? <div className="card empty-state">Você ainda não registrou nenhum treino. Comece agora. 💪</div> : <div className="workout-history">{history.slice(0, 10).map(w => { const s = calculateWorkoutStats(w); return <div className="card history-row" key={w.id}><div><strong>{w.plan}</strong><span>{w.date} · {s.exercises} exercícios · {s.sets} séries</span></div><strong>{s.volume} kg</strong></div>; })}</div>}</>}
    </div>
  </div>;
}
