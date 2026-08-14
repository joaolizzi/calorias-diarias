export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentário', factor: 1.2 },
  { value: 'light', label: 'Levemente ativo', factor: 1.375 },
  { value: 'moderate', label: 'Moderadamente ativo', factor: 1.55 },
  { value: 'high', label: 'Muito ativo', factor: 1.725 },
];

export const GOALS = [
  { value: 'lose', label: 'Perder peso', adjustment: -400 },
  { value: 'maintain', label: 'Manter peso', adjustment: 0 },
  { value: 'gain', label: 'Ganhar massa', adjustment: 300 },
];

export function calculateGoals({ weightKg, heightCm, age, sex, activity, goal }) {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  const years = Number(age);
  const activityFactor = ACTIVITY_LEVELS.find((item) => item.value === activity)?.factor || 1.2;
  const goalAdjustment = GOALS.find((item) => item.value === goal)?.adjustment || 0;

  if (![weight, height, years].every(Number.isFinite) || weight <= 0 || height <= 0 || years <= 0) {
    return { kcal: 2000, water: Math.max(1500, Math.round(weight * 35) || 2000) };
  }

  // Mifflin-St Jeor. Sexo é usado apenas para estimativa energética inicial.
  const bmr = sex === 'female'
    ? (10 * weight) + (6.25 * height) - (5 * years) - 161
    : (10 * weight) + (6.25 * height) - (5 * years) + 5;

  const maintenance = bmr * activityFactor;
  const kcal = Math.round((maintenance + goalAdjustment) / 50) * 50;
  const safeKcal = Math.min(5000, Math.max(1200, kcal));
  const water = Math.min(6000, Math.max(1500, Math.round(weight * 35 / 50) * 50));

  return { kcal: safeKcal, water };
}
