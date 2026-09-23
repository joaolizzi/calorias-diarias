export function calculateMacroGoals(kcalGoal = 2000, weightKg = 70) {
  const kcal = Math.max(500, Number(kcalGoal) || 2000);
  const weight = Math.max(35, Number(weightKg) || 70);
  const protein = Math.round(weight * 2);
  const fat = Math.round(weight * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

export function macroGoalsFromProfile(profile) {
  const fallback = calculateMacroGoals(profile?.daily_kcal_goal || 2000, profile?.weight_kg || 70);
  return {
    protein: Math.max(0, Number(profile?.daily_protein_goal_g) || fallback.protein),
    carbs: Math.max(0, Number(profile?.daily_carbs_goal_g) || fallback.carbs),
    fat: Math.max(0, Number(profile?.daily_fat_goal_g) || fallback.fat),
  };
}

export function entryMacros(entry) {
  return {
    protein: Math.max(0, Number(entry?.protein_g ?? entry?.protein) || 0),
    carbs: Math.max(0, Number(entry?.carbs_g ?? entry?.carbs) || 0),
    fat: Math.max(0, Number(entry?.fat_g ?? entry?.fat) || 0),
  };
}

export function sumMacros(entries = []) {
  return entries.reduce((totals, entry) => {
    const macro = entryMacros(entry);
    totals.protein += macro.protein;
    totals.carbs += macro.carbs;
    totals.fat += macro.fat;
    return totals;
  }, { protein: 0, carbs: 0, fat: 0 });
}

export function nutritionForGrams(item, grams) {
  const g = Math.max(1, Math.min(3000, Math.round(Number(grams) || 1)));
  const fromPer100 = (value) => Math.round(((Number(value) || 0) * g / 100) * 10) / 10;
  const baseGrams = Math.max(1, Number(item?.grams) || g);
  const scaleExisting = (value) => Math.round(((Number(value) || 0) * g / baseGrams) * 10) / 10;

  const hasDensity = [item?.kcalPer100g, item?.proteinPer100g, item?.carbsPer100g, item?.fatPer100g].some((v) => Number.isFinite(Number(v)));
  if (hasDensity) {
    return {
      grams: g,
      kcal: Math.max(0, Math.round((Number(item?.kcalPer100g) || 0) * g / 100)),
      protein: fromPer100(item?.proteinPer100g),
      carbs: fromPer100(item?.carbsPer100g),
      fat: fromPer100(item?.fatPer100g),
    };
  }

  return {
    grams: g,
    kcal: Math.max(0, Math.round((Number(item?.kcal) || 0) * g / baseGrams)),
    protein: scaleExisting(item?.protein),
    carbs: scaleExisting(item?.carbs),
    fat: scaleExisting(item?.fat),
  };
}
