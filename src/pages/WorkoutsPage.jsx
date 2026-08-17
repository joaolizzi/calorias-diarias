import { useEffect, useMemo, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  WORKOUT_PLAN_DAYS,
  emptyWorkoutPlan,
  getExerciseCatalog,
  getWorkoutPlan,
  saveWorkoutPlan,
} from '../lib/workouts.js';
import './WorkoutPlans.css';

const makeSet = (source = {}) => ({ kg: source.kg ?? '', reps: source.reps ?? '', done: Boolean(source.done) });
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
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

function ImportWorkoutModal({ catalog, onImport, onClose }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
      };
      image.onerror = () => reject(new Error('Imagem inválida.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    if (file.type.startsWith('image/')) {
      try { setText(''); const image = await resizeImage(file); window.__nutrixWorkoutImportImage = image; } catch (e) { setError(e.message); }
      return;
    }
    try {
      const content = await file.text();
      setText(content.slice(0, 30000));
      window.__nutrixWorkoutImportImage = null;
    } catch { setError('Não foi possível ler o arquivo. Use TXT ou JSON.'); }
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Entre novamente no aplicativo.');
      const body = { intent: 'workout_import', text: text.trim() };
      if (window.__nutrixWorkoutImportImage) body.image = window.__nutrixWorkoutImportImage;
      const response = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Não foi possível interpretar o treino.');
      onImport(payload.data, catalog);
    } catch (e) {
      setError(e?.message || 'Falha ao importar treino.');
    } finally { setBusy(false); }
  };

  return (
    <div className="exercise-picker-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="import-workout-modal card">
        <div className="exercise-picker-head">
          <div><span className="eyebrow">IA · IMPORTAR TREINO</span><h2>Seu treino já está pronto?</h2><p className="muted">Cole o texto ou envie uma foto do treino. A IA organiza os dias automaticamente.</p></div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </div>
        <label className="import-file-drop">
          <input type="file" accept="image/*,.txt,.json" onChange={(e) => handleFile(e.target.files?.[0])} />
          <strong>📎 Importar arquivo ou foto</strong>
          <span>{fileName || 'PNG, JPG, TXT ou JSON'}</span>
        </label>
        <textarea className="input import-textarea" placeholder={`Exemplo:\nSEGUNDA — Push A\nVoador 3x10\nSupino inclinado máquina 3x8-12\nTríceps máquina 3x10 — descanso 90s\n\nTERÇA — Pull A\nPuxada alta 3x10`} value={text} onChange={(e) => { setText(e.target.value); window.__nutrixWorkoutImportImage = null; }} />
        {error && <div className="workout-error import-error">{error}</div>}
        <div className="import-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={busy || (!text.trim() && !window.__nutrixWorkoutImportImage)}>{busy ? 'Lendo treino…' : '✨ Importar e organizar'}</button></div>
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
        <div className="exercise-title-wrap"><span className="exercise-order">{index + 1}</span><div><h2>{exercise.name}</h2><span className="muted">{exercise.muscle} · {exercise.equipment}</span></div></div>
        <button type="button" className="card-remove" onClick={onRemove} title="Remover exercício" aria-label="Remover exercício">×</button>
      </div>
      <div className="workout-set-labels"><span>Série</span><span>kg</span><span>reps</span><span></span></div>
      {exercise.sets.map((set, setIndex) => <div className={`workout-set ${set.done ? 'done' : ''}`} key={setIndex}>
        <span className="set-number">{setIndex + 1}</span>
        <input className="input" inputMode="decimal" placeholder="0" value={set.kg} onChange={(e) => updateSet(setIndex, { kg: e.target.value })} />
        <input className="input" inputMode="text" placeholder="8-12" value={set.reps} onChange={(e) => updateSet(setIndex, { reps: e.target.value })} />
        <button type="button" className="set-check" onClick={() => updateSet(setIndex, { done: !set.done })}>{set.done ? '✓' : '○'}</button>
      </div>)}
      <div className="exercise-footer-row">
        <button type="button" className="btn btn-ghost add-set" onClick={addSet}>+ Adicionar série</button>
        <label className="notes-field"><span>Observação <em>opcional</em></span><textarea className="input" rows="2" placeholder="Ex.: última série até a falha, controlar a descida..." value={exercise.notes || ''} onChange={(e) => onChange({ ...exercise, notes: e.target.value })} /></label>
      </div>
    </section>
  );
}

export default function WorkoutsPage({ theme, accent, setTheme, setAccent }) {
  const { user } = useAuth();
  const [days, setDays] = useState(emptyWorkoutPlan);
  const [activeDay, setActiveDay] = useState('monday');
  const [catalog, setCatalog] = useState([]);
  const [picker, setPicker] = useState(false);
  const [importer, setImporter] = useState(false);
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
  const volume = currentDay.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => sum + (Number(set.kg) || 0) * (Number(String(set.reps).replace(',', '.')) || 0), 0), 0);
  const totalSets = currentDay.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  const updateDay = (patch) => setDays((previous) => ({ ...previous, [activeDay]: { ...previous[activeDay], ...patch } }));
  const addExercise = (exercise) => {
    if (selectedIds.has(exercise.id)) return;
    updateDay({ exercises: [...currentDay.exercises, { ...exercise, notes: '', sets: [makeSet(), makeSet(), makeSet()] }] });
  };
  const removeExercise = (index) => updateDay({ exercises: currentDay.exercises.filter((_, i) => i !== index) });
  const updateExercise = (index, next) => updateDay({ exercises: currentDay.exercises.map((exercise, i) => i === index ? next : exercise) });

  const importPlan = (importedDays, exerciseCatalog) => {
    const next = emptyWorkoutPlan();
    for (const day of WORKOUT_PLAN_DAYS) {
      const incoming = importedDays?.[day.id] || {};
      next[day.id] = {
        name: incoming.name || '',
        restSeconds: incoming.restSeconds || 90,
        exercises: (incoming.exercises || []).map((incomingExercise, index) => {
          const key = normalize(incomingExercise.name);
          const match = exerciseCatalog.find((item) => normalize(item.name) === key)
            || exerciseCatalog.find((item) => normalize(item.name).includes(key) || key.includes(normalize(item.name)));
          return {
            ...(match || { id: `import-${day.id}-${index}-${Date.now()}`, name: incomingExercise.name, muscle: incomingExercise.muscle || 'Geral', equipment: incomingExercise.equipment || 'Diversos' }),
            notes: incomingExercise.notes || '',
            sets: (incomingExercise.sets?.length ? incomingExercise.sets : [makeSet(), makeSet(), makeSet()]).map(makeSet),
          };
        }),
      };
    }
    setDays(next); setActiveDay('monday'); setImporter(false); setSavedAt(null); setError('');
  };

  const save = async () => {
    setSaving(true); setError('');
    try { await saveWorkoutPlan(user.id, clone(days)); setSavedAt(new Date()); }
    catch (e) { setError(`Não foi possível salvar: ${e?.message || 'verifique o Supabase.'}`); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="app"><ProfessionalHeader subtitle="Treinos · academia" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} /><div className="route-loading">Carregando banco de exercícios e seus treinos…</div></div>;

  return (
    <div className="app">
      <ProfessionalHeader subtitle="Treinos · academia" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} />
      <main className="workouts-page">
        <div className="workouts-hero card">
          <div><div className="eyebrow">🏋️ PLANO SEMANAL</div><h1>Monte seus treinos</h1><p className="muted">Escolha o dia, dê um nome ao treino e adicione os exercícios que você realiza.</p></div>
          <div className="hero-actions"><button type="button" className="btn btn-import" onClick={() => setImporter(true)}>✨ Importar treino</button><button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar semana'}</button></div>
        </div>

        {error && <div className="card workout-error">{error}</div>}
        {savedAt && <div className="workout-saved">Salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}

        <div className="workout-day-tabs">
          {WORKOUT_PLAN_DAYS.map((day) => {
            const configured = days[day.id]?.exercises?.length > 0 || days[day.id]?.name;
            return <button type="button" key={day.id} className={`workout-day-tab ${activeDay === day.id ? 'active' : ''}`} onClick={() => setActiveDay(day.id)}><strong>{day.label}</strong><span>{days[day.id]?.name || 'Sem treino'}{configured && ` · ${days[day.id].exercises.length}`}</span></button>;
          })}
        </div>

        <section className="workout-plan-editor card">
          <div className="workout-plan-heading"><div><span className="eyebrow">{WORKOUT_PLAN_DAYS.find((d) => d.id === activeDay)?.label.toUpperCase()}</span><h2>Configuração do treino</h2></div><button type="button" className="btn" onClick={() => setPicker(true)}>+ Adicionar exercício</button></div>
          <div className="workout-name-row"><label>Nome do treino<input className="input" placeholder="Ex.: Push A, Peito + Tríceps..." value={currentDay.name} onChange={(e) => updateDay({ name: e.target.value })} /></label><label>Descanso padrão<select className="input" value={currentDay.restSeconds} onChange={(e) => updateDay({ restSeconds: Number(e.target.value) })}><option value={45}>45s</option><option value={60}>60s</option><option value={90}>90s</option><option value={120}>120s</option><option value={180}>180s</option></select></label></div>
        </section>

        <div className="workout-summary"><div><strong>{currentDay.exercises.length}</strong><span>exercícios</span></div><div><strong>{totalSets}</strong><span>séries</span></div><div><strong>{volume.toLocaleString('pt-BR')} kg</strong><span>volume planejado</span></div><div><strong>{currentDay.restSeconds}s</strong><span>descanso padrão</span></div></div>

        {currentDay.exercises.length === 0 ? <div className="card empty-state">Nenhum exercício nesse dia. Clique em <strong>+ Adicionar exercício</strong> para montar seu treino.</div> : currentDay.exercises.map((exercise, index) => <ExerciseCard key={`${exercise.id}-${index}`} exercise={exercise} index={index} onChange={(next) => updateExercise(index, next)} onRemove={() => removeExercise(index)} />)}
      </main>
      {picker && <ExercisePicker catalog={catalog} selectedIds={selectedIds} onAdd={addExercise} onClose={() => setPicker(false)} />}
      {importer && <ImportWorkoutModal catalog={catalog} onImport={importPlan} onClose={() => setImporter(false)} />}
    </div>
  );
}
