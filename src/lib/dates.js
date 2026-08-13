// Helpers de data (portado de agua-diaria/index.html)

export const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

export const fmtTime = (iso) => {
  const d = new Date(iso);
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
};

export const fmtDateLabel = (d) => {
  const dd = new Date(d + 'T00:00:00');
  const weekdays = [
    'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
  ];
  return weekdays[dd.getDay()] + ', ' + dd.getDate() + '/' + (dd.getMonth() + 1);
};

// Retorna últimos N dias como ['YYYY-MM-DD', ...] do mais antigo para o mais novo
export const lastNDays = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(
      d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
  }
  return out;
};

export const shortDay = (d) => {
  const dd = new Date(d + 'T00:00:00');
  return dd.getDate() + '/' + (dd.getMonth() + 1);
};

// status: 'Começando…' | 'No caminho' | 'Quase lá' | 'Meta batida!'
export const statusFor = (consumed, goal) => {
  if (goal <= 0) return { label: '—', cls: 'warn' };
  if (consumed === 0) return { label: 'Começando…', cls: 'warn' };
  if (consumed > goal) return { label: 'Meta batida!', cls: 'over' };
  if (consumed >= goal * 0.75) return { label: 'Quase lá', cls: 'good' };
  if (consumed >= goal * 0.4) return { label: 'No caminho', cls: 'good' };
  return { label: 'Precisa repor', cls: 'warn' };
};

export const MEAL_LABELS = {
  breakfast: 'Café',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};