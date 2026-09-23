// scripts/build-tbca.mjs
// Baixa a base comunitária derivada da TBCA e gera um JSON slim usado no app.
// Mantém kcal + proteína + carboidratos + gordura por 100 g.

import { writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW_URL = 'https://raw.githubusercontent.com/DiegoLins10/web-scrapping-alimentos/main/alimentos.txt';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'tbca.json');

function download(url, redirectsLeft = 5) {
  return new Promise((resolvePromise, reject) => {
    request(url, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
        if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
        const next = r.headers.location;
        if (!next) return reject(new Error('redirect without Location'));
        r.resume();
        return download(next, redirectsLeft - 1).then(resolvePromise, reject);
      }
      if (r.statusCode !== 200) return reject(new Error('HTTP ' + r.statusCode + ' for ' + url));
      const chunks = [];
      r.setEncoding('utf8');
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolvePromise(chunks.join('')));
      r.on('error', reject);
    }).on('error', reject).end();
  });
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseValue(nutrient) {
  const raw = String(nutrient?.['Valor por 100g'] || '').replace(',', '.').replace(/[<>]/g, '').trim();
  const value = parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function findNutrient(list, matcher) {
  return (list || []).find((n) => matcher(normalize(n?.Componente), normalize(n?.Unidades)));
}

const text = await download(RAW_URL);
console.log(`Baixado: ${(text.length / 1024 / 1024).toFixed(2)} MB`);

const slim = [];
let parsed = 0;
let skippedNoKcal = 0;
let skippedInvalid = 0;

for (const line of text.split('\n')) {
  if (!line.trim()) continue;
  let o;
  try { o = JSON.parse(line); } catch { skippedInvalid++; continue; }
  parsed++;

  const nutrients = o.nutrientes || [];
  const kcalNutrient = findNutrient(nutrients, (name, unit) => name === 'energia' && unit === 'kcal');
  const kcal = parseValue(kcalNutrient);
  if (!kcal) { skippedNoKcal++; continue; }

  const protein = findNutrient(nutrients, (name, unit) => unit === 'g' && name.includes('proteina'));
  const carbs = findNutrient(nutrients, (name, unit) => unit === 'g' && (name.includes('carboidrato total') || name.includes('carboidratos totais')))
    || findNutrient(nutrients, (name, unit) => unit === 'g' && name.includes('carboidrato disponivel'))
    || findNutrient(nutrients, (name, unit) => unit === 'g' && name.includes('carboidrato'));
  const fat = findNutrient(nutrients, (name, unit) => unit === 'g' && (name.includes('lipidio') || name.includes('gordura total')));

  slim.push({
    id: o.codigo,
    name: o.descricao,
    kcalPer100g: Math.round(kcal),
    proteinPer100g: Math.round(parseValue(protein) * 10) / 10,
    carbsPer100g: Math.round(parseValue(carbs) * 10) / 10,
    fatPer100g: Math.round(parseValue(fat) * 10) / 10,
    category: o.classe || '',
  });
}

slim.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
writeFileSync(OUT, JSON.stringify(slim), 'utf8');

const sizeKb = (Buffer.byteLength(JSON.stringify(slim)) / 1024).toFixed(1);
console.log(`OK ${slim.length} entries → ${OUT}`);
console.log(`Tamanho: ${sizeKb} KB`);
console.log(`Linhas: ${parsed} parsed, ${skippedNoKcal} sem kcal, ${skippedInvalid} inválidas`);
