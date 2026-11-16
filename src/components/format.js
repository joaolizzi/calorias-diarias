// Formatação de números no padrão brasileiro (apenas apresentação).
export const fmtNum = (value, maxDigits = 1) =>
  (Number(value) || 0).toLocaleString('pt-BR', { maximumFractionDigits: maxDigits });

export const fmtInt = (value) => fmtNum(Math.round(Number(value) || 0), 0);

export const pctOf = (value, goal) => {
  const g = Number(goal) || 0;
  if (g <= 0) return 0;
  return Math.min(100, Math.round(((Number(value) || 0) / g) * 100));
};

// 3000 ml -> "3 L"; 1250 ml -> "1,25 L"; 500 -> "500 ml"
export const fmtLitres = (ml) => `${fmtNum((Number(ml) || 0) / 1000, 2)} L`;

// 1250 ml -> "1,25" (sempre com duas casas, como no rótulo)
export const fmtLitresNum = (ml) => ((Number(ml) || 0) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
