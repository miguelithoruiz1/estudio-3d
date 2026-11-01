// Test Node de la v0.18 (Tamaño AR 30 cm).
// Comprueba: scene.js exporta fitSelectedToSize y
// restoreSelectedScale, index.html tiene los dos botones y la
// explicación de 1 unidad = 1 metro, ui.js los conecta, y el
// cache busting es ?v=0.18. El tamaño real en AR solo se puede
// probar en el teléfono del usuario.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.18: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const scene = read('js/scene.js');
if (!scene.includes('export function fitSelectedToSize')) fail('scene.js no exporta fitSelectedToSize');
if (!scene.includes('export function restoreSelectedScale')) fail('scene.js no exporta restoreSelectedScale');
if (!scene.includes('arOriginalScale')) fail('scene.js no guarda la escala original');
if (!scene.includes('1 unidad = 1 metro')) fail('scene.js no documenta 1 unidad = 1 metro');

const html = read('index.html');
if (!html.includes('v0.18')) fail('index.html no marca v0.18');
if (!html.includes('id="fitAR30"')) fail('index.html no tiene botón fitAR30');
if (!html.includes('id="restoreARScale"')) fail('index.html no tiene botón restoreARScale');
if (!html.includes('src="js/main.js?v=0.18"')) fail('index.html no tiene src="js/main.js?v=0.18"');

const ui = read('js/ui.js');
if (!ui.includes('fitSelectedToSize(0.3)')) fail('ui.js no conecta el ajuste a 30 cm');
if (!ui.includes('restoreSelectedScale()')) fail('ui.js no conecta restaurar tamaño');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.18')) fail(`${file} tiene importación local sin ?v=0.18: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.18 OK: ajuste a 30 cm + restaurar, explicación 1 unidad = 1 metro, cache busting ?v=0.18 (${versioned} importaciones).`);
