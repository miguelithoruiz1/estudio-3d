// Test Node de la v0.17 (Cámara AR sin capa).
// Comprueba: main.js ya NO pide dom-overlay, ar.js mantiene
// colocación por 'select' y el respaldo frente a cámara de
// v0.16, el aviso v0.15 sigue intacto, y cache busting
// ?v=0.17 con log v0.17. La cámara real solo se puede probar
// en el teléfono del usuario.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.17: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const main = read('js/main.js');
if (main.includes("optionalFeatures: ['dom-overlay']") || main.includes('domOverlay:')) fail('main.js todavía pide dom-overlay en ARButton');
if (!main.includes("requiredFeatures: ['hit-test']")) fail('main.js no pide hit-test');
if (!main.includes('Listo v0.17')) fail('main.js no marca v0.17');

const ar = read('js/ar.js');
if (!ar.includes("addEventListener('select'")) fail('ar.js perdió el select de colocación');
if (!ar.includes('colocado frente a ti')) fail('ar.js perdió el respaldo frente a cámara v0.16');
if (!ar.includes('#arCompat')) fail('ar.js no oculta #arCompat en sesión (v0.15)');

const html = read('index.html');
if (!html.includes('v0.17')) fail('index.html no marca v0.17');
if (!html.includes('src="js/main.js?v=0.17"')) fail('index.html no tiene src="js/main.js?v=0.17"');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.17')) fail(`${file} tiene importación local sin ?v=0.17: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.17 OK: sin dom-overlay, hit-test + select + respaldo frente a cámara, aviso v0.15 intacto, cache busting ?v=0.17 (${versioned} importaciones).`);
