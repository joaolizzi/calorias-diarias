// Leitor de treino em texto, sem IA. Entende o formato mais comum:
//
//   SEGUNDA - PUSH (22 séries)
//   1. Supino inclinado máquina - 3 x 8-12
//   2. Tríceps corda 3x10 (descanso 60s)
//   QUINTA - DESCANSO
//
// Retorna { monday: { name, restSeconds, exercises: [{ name, notes, sets: [{ kg, reps }] }] }, ... }
// ou null quando não encontrar nenhum exercício (aí o app recorre ao Gemini).

const DAY_KEYS = [
  ['monday', /^segunda/], ['tuesday', /^terca/], ['wednesday', /^quarta/], ['thursday', /^quinta/],
  ['friday', /^sexta/], ['saturday', /^sabado/], ['sunday', /^domingo/],
];
const REST_OPTIONS = [45, 60, 90, 120, 180];
const strip = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cleanEdges = (value) => String(value || '').replace(/^[\s\-–—:|.,;]+|[\s\-–—:|.,;]+$/g, '').replace(/\s{2,}/g, ' ').trim();
const nearestRest = (seconds) => REST_OPTIONS.reduce((best, option) => (Math.abs(option - seconds) < Math.abs(best - seconds) ? option : best), 90);

const emptyDays = () => Object.fromEntries(DAY_KEYS.map(([key]) => [key, { name: '', restSeconds: 90, exercises: [] }]));

function parseDayHeader(line) {
  const plain = strip(line).replace(/^[#*\s]+/, '');
  const found = DAY_KEYS.find(([, regex]) => regex.test(plain));
  if (!found) return null;
  // Remove o nome do dia (com ou sem "-feira") e separadores.
  const rest = line.replace(/^[#*\s]*\S+?(-feira)?(?=[\s\-–—:|(]|$)/i, '');
  let name = cleanEdges(rest.replace(/\(\s*\d+\s*s[ée]ries?\s*\)/gi, ''));
  if (/^(descanso|off|folga|livre|rest)\b/i.test(strip(name))) name = '';
  return { key: found[0], name: name.slice(0, 80) };
}

function readRest(text) {
  const match = strip(text).match(/descanso\s*(?:de\s*)?(\d+)\s*(s|seg|segundos|min|m|minutos?)?\b/);
  if (!match) return null;
  const value = Number(match[1]) * (/^m/.test(match[2] || '') ? 60 : 1);
  return value > 0 ? nearestRest(value) : null;
}

function parseExerciseLine(line) {
  let text = line.replace(/^\s*(?:\d+\s*[.)\-–—:]|[-*•●▪◦])\s*/, '').trim();
  if (!/[a-zà-ú]/i.test(text)) return null;

  // "3 x 8-12", "3x10", "4 × 6 a 8", "3 séries de 10", "3 x falha"
  const setsReps = text.match(/(\d{1,2})\s*(?:[x×X*]|s[ée]ries?\s*(?:de|x)?)\s*(\d{1,3}(?:\s*(?:-|–|a|até)\s*\d{1,3})?|falha|max|máx)/i);
  const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  const rest = readRest(text);

  let name = text;
  let after = '';
  if (setsReps) {
    name = text.slice(0, setsReps.index);
    after = text.slice(setsReps.index + setsReps[0].length);
  }
  if (kgMatch) { name = name.replace(kgMatch[0], ' '); after = after.replace(kgMatch[0], ' '); }

  const notes = [];
  name = name.replace(/\(([^)]*)\)/g, (_, inside) => { if (inside.trim()) notes.push(inside.trim()); return ' '; });
  name = cleanEdges(name);
  const extra = cleanEdges(after.replace(/[()]/g, ' ').replace(/descanso\s*(?:de\s*)?\d+\s*\w*/i, ' '));
  if (extra) notes.push(extra);
  if (!name || name.length < 2) return null;

  const count = setsReps ? Math.min(12, Math.max(1, Number(setsReps[1]))) : 3;
  const reps = setsReps ? setsReps[2].replace(/\s*(?:–|a|até)\s*/gi, '-').replace(/\s*-\s*/g, '-') : '';
  const kg = kgMatch ? kgMatch[1].replace(',', '.') : '';

  return {
    exercise: { name: name.slice(0, 120), notes: notes.join(' · ').slice(0, 400), sets: Array.from({ length: count }, () => ({ kg, reps })) },
    rest,
    explicit: Boolean(setsReps),
  };
}

export function parseWorkoutText(text) {
  const days = emptyDays();
  let current = null;
  let total = 0;
  let explicit = 0;

  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const header = parseDayHeader(line);
    if (header) { current = header.key; days[current].name = header.name; continue; }
    if (!current) continue;
    const parsed = parseExerciseLine(line);
    if (!parsed) continue;
    days[current].exercises.push(parsed.exercise);
    if (parsed.rest) days[current].restSeconds = parsed.rest;
    total += 1;
    if (parsed.explicit) explicit += 1;
  }

  // Só confia no leitor quando ele achou exercícios com séries x repetições.
  return total > 0 && explicit > 0 ? days : null;
}
