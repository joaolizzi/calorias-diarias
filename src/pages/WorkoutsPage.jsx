import { useEffect, useMemo, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  WORKOUT_PLAN_DAYS,
  emptyWorkoutPlan,
  getExerciseCatalog,
  getWorkoutPlan,
  saveWorkoutPlan,
} from '../lib/workouts.js';
import './WorkoutPlans.css';

const makeSet = () => ({ kg: '', reps: '', done: false });
const clone = (value) => JSON.parse(JSON.stringify(value));

function ExercisePicker({ catalog, selectedIds, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('Todos');
  const muscles = useMemo(() => ['Todos', ...Array.from(new Set(catalog.map((e) => e.muscle).filter(Boolean))).sort()], [catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => (!q || `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q)) && (muscle === 'Todos' || e.muscle === muscle));
  }, [catalog, muscle, query]);

  return (
    <div className="exercise-picker-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="exercise-picker-modal card">
        <div className="exercise-picker-head">
          <div><span className="eyebrow">BANCO DE EXERCÍCIOS</span><h2>Escolha os exercícios</h2><p className="muted">Pesquise por nome ou músculo.</p></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="exercise-picker-filters">
          <input className="input" autoFocus placeholder="Ex.: supino, tríceps, costas..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>{muscles.map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div className="exercise-picker-grid">
          {filtered.length === 0 ? <div className="empty-state card">Nenhum exercício encontrado.</div> : filtered.map((exercise) => {
            const selected = selectedIds.has(exercise.id);
            return <button type="button" className={`exercise-option ${selected ? 'selected' : ''}`} key={exercise.id} onClick={() => onAdd(exercise)}>
              <span className="exercise-option-name">{exercise.name}</span>
              <span>{exercise.muscle} · {exercise.equipment}</span>
              {selected && <strong>✓ Adicionado</strong>}
            </button>;
          })}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, index, onChange, onRemove }) {
  const updateSet = (setIndex, patch) => onChange({ ...exercise, sets: exercise.sets.map((set, i) => i === setIndex ? { ...set, ...patch } : set) });
  const addSet = () => onChange({ ...exercise, sets: [...exercise.sets, makeSet()] });
  return (
    <section className="workout-card">
      <div className="workout-card-head">
        <div><span className="exercise-order">{index + 1}</span><div><h2>{exercise.name}</h2><span className="muted">{exercise.muscle} · {exercise.equipment}</span></div></div>
        <button className="icon-btn" onClick={onRemove} title="Remover exercício">×</button>
      </div>
      <div className="workout-set-labels"><span>Série</span><span>kg</span><span>reps</span><span></span></div>
      {exercise.sets.map((set, setIndex) => <div className={`workout-set ${set.done ? 'done' : ''}`} key={setIndex}>
        <span className="set-number">{setIndex + 1}</span>
        <input className="input" inputMode="decimal" placeholder="0" value={set.kg} onChange={(e) => updateSet(setIndex, { kg: e.target.value })} />
        <input className="input" inputMode="numeric" placeholder="0" value={set.reps} onChange={(e) => updateSet(setIndex, { reps: e.target.value })} />
        <button className="set-check" onClick={() => updateSet(setIndex, { done: !set.done })}>{set.done ? '✓' : '○'}</button>
      </div>)}
      <button className="btn btn-ghost add-set" onClick={addSet}>+ Adicionar série</button>
    </section>
  );
}

export default function WorkoutsPage({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth();
  const [days, setDays] = useState(emptyWorkoutPlan);
  const [activeDay, setActiveDay] = useState('monday');
  const [catalog, setCatalog] = useState([]);
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getExerciseCatalog(), getWorkoutPlan(user.id)])
      .then(([exerciseCatalog, plan]) => { if (active) { setCatalog(exerciseCatalog); setDays(plan); } })
      .catch((e) => { if (active) setError(`Não foi possível carregar seus treinos: ${e?.message || 'erro no Supabase'}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id]);

  const currentDay = days[activeDay] || emptyWorkoutPlan()[activeDay];
  const selectedIds = new Set(currentDay.exercises.map((e) => e.id));
  const volume = currentDay.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => sum + (Number(set.kg) || 0) * (Number(set.reps) || 0), 0), 0);
  const totalSets = currentDay.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  const updateDay = (patch) => setDays((previous) => ({ ...previous, [activeDay]: { ...previous[activeDay], ...patch } }));
  const addExercise = (exercise) => {
    if (selectedIds.has(exercise.id)) return;
    updateDay({ exercises: [...currentDay.exercises, { ...exercise, sets: [makeSet(), makeSet(), makeSet()] }] });
  };
  const removeExercise = (index) => updateDay({ exercises: currentDay.exercises.filter((_, i) => i !== index) });
  const updateExercise = (index, next) => updateDay({ exercises: currentDay.exercises.map((exercise, i) => i === index ? next : exercise) });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveWorkoutPlan(user.id, clone(days));
      setSavedAt(new Date());
    } catch (e) {
      setError(`Não foi possível salvar: ${e?.message || 'verifique se a migration do Supabase foi executada.'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="app"><ProfessionalHeader subtitle="Treinos · academia" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} /><div className="route-loading">Carregando banco de exercícios e seus treinos…</div></div>;

  return (
    <div className="app">
      <ProfessionalHeader subtitle="Treinos · academia" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />
      <main className="workouts-page">
        <div className="workouts-hero card">
          <div><div className="eyebrow">🏋️ PLANO SEMANAL</div><h1>Monte seus treinos</h1><p className="muted">Escolha o dia, dê um nome ao treino e adicione os exercícios que você realiza.</p></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar semana'}</button>
        </div>

        {error && <div className="card workout-error">{error}</div>}
        {savedAt && <div className="workout-saved">Salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}

        <div className="workout-day-tabs">
          {WORKOUT_PLAN_DAYS.map((day) => {
            const configured = days[day.id]?.exercises?.length > 0 || days[day.id]?.name;
            return <button key={day.id} className={`workout-day-tab ${activeDay === day.id ? 'active' : ''}`} onClick={() => setActiveDay(day.id)}><strong>{day.label}</strong><span>{days[day.id]?.name || 'Sem treino'}{configured && ` · ${days[day.id].exercises.length}`}</span></button>;
          })}
        </div>

        <section className="workout-plan-editor card">
          <div className="workout-plan-heading">
            <div><span className="eyebrow">{WORKOUT_PLAN_DAYS.find((d) => d.id === activeDay)?.label.toUpperCase()}</span><h2>Configuração do treino</h2></div>
            <button className="btn" onClick={() => setPicker(true)}>+ Adicionar exercício</button>
          </div>
          <div className="workout-name-row">
            <label>Nome do treino<input className="input" placeholder="Ex.: Push A, Peito + Tríceps..." value={currentDay.name} onChange={(e) => updateDay({ name: e.target.value })} /></label>
            <label>Descanso padrão<select className="input" value={currentDay.restSeconds} onChange={(e) => updateDay({ restSeconds: Number(e.target.value) })}><option value={45}>45s</option><option value={60}>60s</option><option value={90}>90s</option><option value={120}>120s</option><option value={180}>180s</option></select></label>
          </div>
        </section>

        <div className="workout-summary"><div><strong>{currentDay.exercises.length}</strong><span>exercícios</span></div><div><strong>{totalSets}</strong><span>séries</span></div><div><strong>{volume.toLocaleString('pt-BR')} kg</strong><span>volume planejado</span></div><div><strong>{currentDay.restSeconds}s</strong><span>descanso padrão</span></div></div>

        {currentDay.exercises.length === 0 ? <div className="card empty-state">Nenhum exercício nesse dia. Clique em <strong>+ Adicionar exercício</strong> para montar seu treino.</div> : currentDay.exercises.map((exercise, index) => <ExerciseCard key={`${exercise.id}-${index}`} exercise={exercise} index={index} onChange={(next) => updateExercise(index, next)} onRemove={() => removeExercise(index)} />)}
      </main>
      {picker && <ExercisePicker catalog={catalog} selectedIds={selectedIds} onAdd={addExercise} onClose={() => setPicker(false)} />}
    </div>
  );
}
