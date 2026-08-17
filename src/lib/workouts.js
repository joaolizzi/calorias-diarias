export const WORKOUT_STORAGE_KEY = 'nutrix-workouts-v1';

export const DEFAULT_EXERCISES = [
  { id: 'chest-fly', name: 'Voador', muscle: 'Peito' },
  { id: 'incline-press', name: 'Supino inclinado máquina', muscle: 'Peito' },
  { id: 'chest-press', name: 'Supino reto máquina', muscle: 'Peito' },
  { id: 'lat-pulldown', name: 'Puxada alta', muscle: 'Costas' },
  { id: 'low-row', name: 'Remada baixa máquina', muscle: 'Costas' },
  { id: 'tbar-row', name: 'T-Bar máquina', muscle: 'Costas' },
  { id: 'lateral-raise', name: 'Elevação lateral', muscle: 'Ombros' },
  { id: 'shoulder-press', name: 'Desenvolvimento de ombros máquina', muscle: 'Ombros' },
  { id: 'reverse-fly', name: 'Reverse fly máquina', muscle: 'Ombros' },
  { id: 'leg-press', name: 'Leg press', muscle: 'Pernas' },
  { id: 'leg-extension', name: 'Cadeira extensora', muscle: 'Pernas' },
  { id: 'leg-curl', name: 'Mesa/cadeira flexora', muscle: 'Pernas' },
  { id: 'calf', name: 'Panturrilha máquina', muscle: 'Pernas' },
  { id: 'scott', name: 'Rosca Scott máquina', muscle: 'Bíceps' },
  { id: 'biceps-machine', name: 'Bíceps articulado', muscle: 'Bíceps' },
  { id: 'triceps-machine', name: 'Tríceps máquina', muscle: 'Tríceps' },
  { id: 'triceps-rope', name: 'Tríceps corda', muscle: 'Tríceps' },
];

const read = () => {
  try { return JSON.parse(localStorage.getItem(WORKOUT_STORAGE_KEY) || '[]'); }
  catch { return []; }
};
const write = (value) => localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(value));

export const getWorkoutHistory = () => read();
export const saveWorkout = (workout) => {
  const history = read();
  const next = { ...workout, id: workout.id || `${Date.now()}`, finishedAt: workout.finishedAt || new Date().toISOString() };
  write([next, ...history].slice(0, 200));
  return next;
};

export const getExerciseHistory = (exerciseId) => read().flatMap(w => (w.exercises || []).filter(e => e.exerciseId === exerciseId).map(e => ({ ...e, date: w.date, workoutId: w.id })));

export const calculateWorkoutStats = (workout) => {
  const sets = (workout.exercises || []).flatMap(e => e.sets || []);
  return {
    exercises: workout.exercises?.length || 0,
    sets: sets.length,
    volume: Math.round(sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)),
    duration: workout.startedAt && workout.finishedAt ? Math.max(1, Math.round((new Date(workout.finishedAt) - new Date(workout.startedAt)) / 60000)) : 0,
  };
};

export const getPersonalBest = (exerciseId) => {
  const sets = getExerciseHistory(exerciseId).flatMap(e => e.sets || []);
  return sets.reduce((best, s) => (Number(s.weight) || 0) > (Number(best?.weight) || 0) ? s : best, null);
};
