import { useEffect, useMemo, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  WORKOUT_PLAN_DAYS,
  emptyWorkoutPlan,
  getExerciseCatalog,
  getWorkoutPlan,
  saveWorkoutPlan,
  localizeExerciseName,
  addCustomExercise,
  findExerciseByName,
  matchExercise,
} from '../lib/workouts.js';
import { parseWorkoutText } from '../lib/workoutParser.js';

const makeSet = (source = {}) => ({ kg: source.kg ?? '', reps: source.reps ?? '', done: Boolean(source.done) });
const clone = (value) => JSON.parse(JSON.stringify(value));
const prepareWorkoutText = (value) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/[•●▪◦]/g, '-')
  .replace(/\t+/g, ' ')
  .replace(/[ ]{2,}/g, ' ')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line)
  .join('\n')
  .slice(0, 30000);

const EQUIPMENT_OPTIONS = ['Máquina', 'Polia', 'Barra', 'Barra W', 'Halteres', 'Smith', 'Kettlebell', 'Anilha', 'Elástico', 'TRX', 'Peso corporal', 'Barra fixa', 'Paralelas', 'Aparelho de cardio', 'Diversos'];

function CustomExerciseForm({ initialName, muscles, catalog, onCreate, onCancel }) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState(muscles[0] || 'Geral');
  const [equipment, setEquipment] = useState('Máquina');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) { setError('Digite o nome do exercício.'); return; }
    if (findExerciseByName(catalog, clean)) { setError('Esse exercício já existe na lista. Use a busca para encontrá-lo.'); return; }
    onCreate({ name: clean, muscle, equipment });
  };

  return (
    <form className="custom-exercise-form card" onSubmit={submit}>
      <h3>Criar exercício</h3>
      <div className="field"><label htmlFor="cx-name">Nome</label><input id="cx-name" autoFocus maxLength={80} placeholder="Por exemplo: Remada articulada unilateral" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} /></div>
      <div className="custom-exercise-row">
        <div className="field"><label htmlFor="cx-muscle">Músculo</label><select id="cx-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>{muscles.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="field"><label htmlFor="cx-equip">Equipamento</label><select id="cx-equip" value={equipment} onChange={(e) => setEquipment(e.target.value)}>{EQUIPMENT_OPTIONS.map((eq) => <option key={eq}>{eq}</option>)}</select></div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary"><Icon name="plus" size={16} /> Criar e adicionar</button>
      </div>
    </form>
  );
}

function ExercisePicker({ catalog, selectedIds, onAdd, onCreate, onClose }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('Todos');
  const [creating, setCreating] = useState(false);
  const muscleList = useMemo(() => Array.from(new Set(catalog.map((e) => e.muscle).filter(Boolean))).sort(), [catalog]);
  const muscles = useMemo(() => ['Todos', ...muscleList], [muscleList]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => (!q || `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q)) && (muscle === 'Todos' || e.muscle === muscle));
  }, [catalog, muscle, query]);

  return (
    <Modal title="Escolha os exercícios" onClose={onClose} className="exercise-picker-modal">
      <p className="modal-sub">Pesquise por nome ou músculo. Não achou? Crie o seu.</p>
      {creating ? (
        <CustomExerciseForm
          initialName={query.trim()}
          muscles={muscle !== 'Todos' ? [muscle, ...muscleList.filter((m) => m !== muscle)] : muscleList}
          catalog={catalog}
          onCreate={(data) => { onCreate(data); setCreating(false); setQuery(''); }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button type="button" className="btn ghost create-exercise-btn" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Criar exercício que não está na lista</button>
      )}
      <div className="exercise-picker-filters">
        <label className="sr-only" htmlFor="ex-q">Buscar exercício</label>
        <input id="ex-q" placeholder="Por exemplo: supino, tríceps, costas" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="sr-only" htmlFor="ex-m">Grupo muscular</label>
        <select id="ex-m" value={muscle} onChange={(e) => setMuscle(e.target.value)}>{muscles.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
      <div className="exercise-picker-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum exercício encontrado{query.trim() ? <> para <strong>{query.trim()}</strong></> : ''}.</p>
            {!creating && <button type="button" className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Criar {query.trim() ? `"${query.trim()}"` : 'exercício'}</button>}
          </div>
        ) : filtered.map((exercise) => {
          const selected = selectedIds.has(exercise.id);
          return (
            <button type="button" className={`exercise-option ${selected ? 'selected' : ''}`} key={exercise.id} onClick={() => onAdd(exercise)} aria-pressed={selected}>
              <span className="exercise-option-name">{exercise.name}</span>
              <span className="muted">{exercise.muscle} · {exercise.equipment}{exercise.custom ? ' · criado por você' : ''}</span>
              {selected && <strong className="exercise-added"><Icon name="check" size={14} /> Adicionado</strong>}
            </button>
          );
        })}
      </div>
    </Modal>
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
      setText(prepareWorkoutText(content));
      window.__nutrixWorkoutImportImage = null;
    } catch { setError('Não foi possível ler o arquivo. Use TXT ou JSON.'); }
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      // Texto no formato "SEGUNDA - PUSH / 1. Exercício - 3 x 8-12" é lido direto, sem IA.
      if (!window.__nutrixWorkoutImportImage) {
        const local = parseWorkoutText(text);
        if (local) { onImport(local, catalog); return; }
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Entre novamente no aplicativo.');
      const body = { intent: 'workout_import', text: prepareWorkoutText(text) };
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
    <Modal title="Importar treino" onClose={() => { if (!busy) onClose(); }} className="import-workout-modal">
      <p className="modal-sub">Cole o texto ou envie uma foto do treino. A IA organiza os dias automaticamente.</p>
      <label className="import-file-drop">
        <input type="file" accept="image/*,.txt,.json" onChange={(e) => handleFile(e.target.files?.[0])} />
        <Icon name="upload" size={22} />
        <strong>Importar arquivo ou foto</strong>
        <span>{fileName || 'PNG, JPG, TXT ou JSON'}</span>
      </label>
      <div className="field">
        <label htmlFor="imp-text">Ou cole o treino</label>
        <textarea id="imp-text" className="import-textarea" rows={8} placeholder={`Exemplo:\nSEGUNDA — Push A\nVoador 3x10\nSupino inclinado máquina 3x8-12\nTríceps máquina 3x10 — descanso 90s\n\nTERÇA — Pull A\nPuxada alta 3x10`} value={text} onChange={(e) => { setText(e.target.value); window.__nutrixWorkoutImportImage = null; }} />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy || (!text.trim() && !window.__nutrixWorkoutImportImage)}>{busy ? 'Lendo treino…' : 'Importar e organizar'}</button>
      </div>
    </Modal>
  );
}

function ExerciseCard({ exercise, index, onChange, onRemove }) {
  const updateSet = (setIndex, patch) => onChange({ ...exercise, sets: exercise.sets.map((set, i) => i === setIndex ? { ...set, ...patch } : set) });
  const addSet = () => onChange({ ...exercise, sets: [...exercise.sets, makeSet()] });
  return (
    <section className="card workout-card" aria-label={exercise.name}>
      <div className="workout-card-head">
        <div className="exercise-title-wrap">
          <span className="exercise-order num">{index + 1}</span>
          <div><h2>{exercise.name}</h2><span className="muted">{exercise.muscle} · {exercise.equipment}</span></div>
        </div>
        <button type="button" className="icon-btn" onClick={onRemove} title="Remover exercício" aria-label={`Remover ${exercise.name}`}><Icon name="trash" size={18} /></button>
      </div>
      <div className="workout-set-labels" aria-hidden="true"><span>Série</span><span>kg</span><span>reps</span><span /></div>
      {exercise.sets.map((set, setIndex) => (
        <div className={`workout-set ${set.done ? 'done' : ''}`} key={setIndex}>
          <span className="set-number num">{setIndex + 1}</span>
          <input inputMode="decimal" placeholder="0" value={set.kg} onChange={(e) => updateSet(setIndex, { kg: e.target.value })} aria-label={`Carga da série ${setIndex + 1} em quilos`} />
          <input inputMode="text" placeholder="8-12" value={set.reps} onChange={(e) => updateSet(setIndex, { reps: e.target.value })} aria-label={`Repetições da série ${setIndex + 1}`} />
          <button type="button" className={`set-check ${set.done ? 'on' : ''}`} onClick={() => updateSet(setIndex, { done: !set.done })} aria-pressed={set.done} aria-label={`Série ${setIndex + 1} concluída`}>
            {set.done ? <Icon name="check" size={18} /> : null}
          </button>
        </div>
      ))}
      <div className="exercise-footer-row">
        <button type="button" className="btn ghost add-set" onClick={addSet}><Icon name="plus" size={16} /> Adicionar série</button>
        <label className="notes-field"><span>Observação <small className="muted">(opcional)</small></span><textarea rows="2" placeholder="Por exemplo: última série até a falha, controlar a descida" value={exercise.notes || ''} onChange={(e) => onChange({ ...exercise, notes: e.target.value })} /></label>
      </div>
    </section>
  );
}

export default function WorkoutsPage({ theme, setTheme }) {
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
  const [confirmClear, setConfirmClear] = useState(null); // 'day' | 'week' | null
  const [clearing, setClearing] = useState(false);

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
  const createExercise = (data) => {
    const exercise = addCustomExercise(data);
    setCatalog((previous) => [exercise, ...previous]);
    addExercise(exercise);
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
          const localizedName = localizeExerciseName(incomingExercise.name);
          const match = matchExercise(exerciseCatalog, localizedName);
          return {
            ...(match || { id: `import-${day.id}-${index}-${Date.now()}`, name: localizedName, muscle: incomingExercise.muscle || 'Geral', equipment: incomingExercise.equipment || 'Diversos' }),
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

  // Apaga o treino do dia selecionado ou a semana inteira e já salva.
  const clearWorkout = async () => {
    const scope = confirmClear;
    const empty = emptyWorkoutPlan();
    const next = scope === 'week' ? empty : { ...days, [activeDay]: empty[activeDay] };
    setClearing(true); setError('');
    try {
      await saveWorkoutPlan(user.id, clone(next));
      setDays(next);
      if (scope === 'week') setActiveDay('monday');
      setSavedAt(new Date());
      setConfirmClear(null);
    } catch (e) {
      setError(`Não foi possível apagar: ${e?.message || 'verifique o Supabase.'}`);
    } finally { setClearing(false); }
  };

  const shell = (content) => (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />
      <main className="page" id="conteudo"><div className="page-inner">{content}</div></main>
    </div>
  );

  if (loading) return shell(<div className="route-loading">Carregando banco de exercícios e seus treinos…</div>);

  const dayLabel = WORKOUT_PLAN_DAYS.find((d) => d.id === activeDay)?.label;
  const dayHasWorkout = currentDay.exercises.length > 0 || Boolean(currentDay.name);
  const weekHasWorkout = WORKOUT_PLAN_DAYS.some((d) => days[d.id]?.exercises?.length > 0 || days[d.id]?.name);

  return (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />
      <main className="page" id="conteudo">
        <div className="page-inner">
          <header className="page-head">
            <div>
              <p className="page-date">Plano semanal</p>
              <h1>Treinos</h1>
            </div>
            <div className="page-head-actions">
              <button type="button" className="btn danger" onClick={() => setConfirmClear('week')} disabled={!weekHasWorkout}><Icon name="trash" size={17} /> Apagar semana</button>
              <button type="button" className="btn" onClick={() => setImporter(true)}><Icon name="sparkles" size={17} /> Importar treino</button>
              <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar semana'}</button>
            </div>
          </header>

          {error && <div className="card err" role="alert">{error}</div>}
          {savedAt && <div className="workout-saved" role="status">Salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}

          <div className="workout-day-tabs" role="group" aria-label="Dia da semana">
            {WORKOUT_PLAN_DAYS.map((day) => {
              const configured = days[day.id]?.exercises?.length > 0 || days[day.id]?.name;
              return (
                <button type="button" key={day.id} aria-pressed={activeDay === day.id} className={`workout-day-tab ${activeDay === day.id ? 'active' : ''}`} onClick={() => setActiveDay(day.id)}>
                  <strong>{day.label}</strong>
                  <span>{days[day.id]?.name || 'Sem treino'}{configured && ` · ${days[day.id].exercises.length}`}</span>
                </button>
              );
            })}
          </div>

          <section className="card workout-plan-editor" aria-labelledby="h-treino">
            <div className="workout-plan-heading">
              <div><p className="page-date">{dayLabel}</p><h2 id="h-treino">Configuração do treino</h2></div>
              <div className="page-head-actions">
                <button type="button" className="btn danger" onClick={() => setConfirmClear('day')} disabled={!dayHasWorkout}><Icon name="trash" size={17} /> Apagar treino</button>
                <button type="button" className="btn" onClick={() => setPicker(true)}><Icon name="plus" size={17} /> Adicionar exercício</button>
              </div>
            </div>
            <div className="workout-name-row">
              <div className="field"><label htmlFor="w-name">Nome do treino</label><input id="w-name" placeholder="Por exemplo: Push A, Peito e tríceps" value={currentDay.name} onChange={(e) => updateDay({ name: e.target.value })} /></div>
              <div className="field"><label htmlFor="w-rest">Descanso padrão</label><select id="w-rest" value={currentDay.restSeconds} onChange={(e) => updateDay({ restSeconds: Number(e.target.value) })}><option value={45}>45 s</option><option value={60}>60 s</option><option value={90}>90 s</option><option value={120}>120 s</option><option value={180}>180 s</option></select></div>
            </div>
          </section>

          <dl className="workout-summary">
            <div><dd className="num">{currentDay.exercises.length}</dd><dt>exercícios</dt></div>
            <div><dd className="num">{totalSets}</dd><dt>séries</dt></div>
            <div><dd className="num">{volume.toLocaleString('pt-BR')} kg</dd><dt>volume planejado</dt></div>
            <div><dd className="num">{currentDay.restSeconds} s</dd><dt>descanso padrão</dt></div>
          </dl>

          {currentDay.exercises.length === 0
            ? <div className="card empty-state"><p>Nenhum exercício neste dia. Use <strong>Adicionar exercício</strong> para montar o treino.</p></div>
            : currentDay.exercises.map((exercise, index) => <ExerciseCard key={`${exercise.id}-${index}`} exercise={exercise} index={index} onChange={(next) => updateExercise(index, next)} onRemove={() => removeExercise(index)} />)}
        </div>
      </main>
      {picker && <ExercisePicker catalog={catalog} selectedIds={selectedIds} onAdd={addExercise} onCreate={createExercise} onClose={() => setPicker(false)} />}
      {confirmClear && (
        <ConfirmDialog
          title={confirmClear === 'week' ? 'Apagar a semana inteira?' : `Apagar o treino de ${dayLabel}?`}
          message={confirmClear === 'week'
            ? 'Todos os treinos de segunda a domingo serão removidos. Você poderá montar ou importar um treino novo em seguida.'
            : `O nome e todos os exercícios de ${dayLabel} serão removidos. Os outros dias continuam como estão.`}
          confirmLabel={clearing ? 'Apagando…' : (confirmClear === 'week' ? 'Apagar semana' : 'Apagar treino')}
          busy={clearing}
          onConfirm={clearWorkout}
          onCancel={() => { if (!clearing) setConfirmClear(null); }}
        />
      )}
      {importer && <ImportWorkoutModal catalog={catalog} onImport={importPlan} onClose={() => setImporter(false)} />}
    </div>
  );
}
