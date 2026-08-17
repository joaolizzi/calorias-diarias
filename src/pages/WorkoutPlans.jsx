import { useEffect, useState } from 'react';
import { DEFAULT_EXERCISES, WORKOUT_STORAGE_KEY } from '../lib/workouts.js';

const PLANS_KEY = 'nutrix-workout-plans-v1';
const read = () => { try { return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); } catch { return []; } };

export default function WorkoutPlans() {
  const [plans, setPlans] = useState(read);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const save = () => { if (!name.trim() || !selected.length) return; const next = { id: Date.now().toString(), name: name.trim(), exercises: selected }; const all = [...plans, next]; setPlans(all); localStorage.setItem(PLANS_KEY, JSON.stringify(all)); setName(''); setSelected([]); };
  const toggle = e => setSelected(v => v.some(x => x.id === e.id) ? v.filter(x => x.id !== e.id) : [...v, e]);
  return <div className="card workout-plans"><h2>Rotinas de treino</h2><p className="muted">Monte seus treinos e use-os para iniciar uma sessão rapidamente.</p><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da rotina · ex.: Push" /> <div className="exercise-picker-grid">{DEFAULT_EXERCISES.map(e => <button key={e.id} className={`exercise-option ${selected.some(x=>x.id===e.id)?'selected':''}`} onClick={()=>toggle(e)}><strong>{e.name}</strong><span>{e.muscle}</span></button>)}</div><button className="btn primary" onClick={save}>Salvar rotina</button>{plans.map(p=><div className="history-row" key={p.id}><strong>{p.name}</strong><span>{p.exercises.length} exercícios</span></div>)}</div>;
}
