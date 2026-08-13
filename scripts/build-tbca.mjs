// scripts/build-tbca.mjs
// Baixa o JSON Lines da TBCA (Tabela Brasileira de Composição de Alimentos)
// do scraper comunitário DiegoLins10/web-scrapping-alimentos e gera um JSON
// slim em public/tbca.json com apenas { id, name, kcalPer100g, category }.
//
// Uso:  npm run build:tbca
//
// Não requer dependências externas — usa apenas Node built-ins (https, fs, path).

import { writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW_URL =
  'https://raw.githubusercontent.com/DiegoLins10/web-scrapping-alimentos/main/alimentos.txt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'tbca.json');

function download(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    request(url, (r) => {
      // seguir redirects (github raw redireciona http -> https)
      if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
        if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
        const next = r.headers.location;
        if (!next) return reject(new Error('redirect without Location'));
        r.resume();
        return download(next, redirectsLeft - 1).then(resolve, reject);
      }
      if (r.statusCode !== 200) {
        return reject(new Error('HTTP ' + r.statusCode + ' for ' + url));
      }
      const chunks = [];
      r.setEncoding('utf8');
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve(chunks.join('')));
      r.on('error', reject);
    }).on('error', reject).end();
  });
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
  try { o = JSON.parse(line); }
  catch { skippedInvalid++; continue; }
  parsed++;

  const kcalNutrient = (o.nutrientes || []).find(
    (n) => n.Componente === 'Energia' && n.Unidades === 'kcal'
  );
  if (!kcalNutrient) { skippedNoKcal++; continue; }

  const raw = String(kcalNutrient['Valor por 100g'] || '').replace(',', '.');
  const kcal = parseFloat(raw);
  if (!Number.isFinite(kcal) || kcal <= 0) { skippedNoKcal++; continue; }

  slim.push({
    id: o.codigo,
    name: o.descricao,
    kcalPer100g: Math.round(kcal),
    category: o.classe || '',
  });
}

// ordenar alfabeticamente, preservando acentos
slim.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

writeFileSync(OUT, JSON.stringify(slim), 'utf8');

const sizeKb = (Buffer.byteLength(JSON.stringify(slim)) / 1024).toFixed(1);
console.log(`OK ${slim.length} entries → ${OUT}`);
console.log(`Tamanho: ${sizeKb} KB`);
console.log(`Linhas: ${parsed} parsed, ${skippedNoKcal} sem kcal, ${skippedInvalid} inválidas`);
