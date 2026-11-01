// Test Node de la v0.20 (Escala AR con botones).
// Comprueba: botones + / − en la capa AR, que los toques
// sobre botones no colocan el modelo, que el pellizco actualiza
// el texto de escala (diagnóstico visible), tamaños
// predefinidos 10/30/50 cm y 1 m antes de AR, y cache busting
// ?v=0.20. El pellizco y los botones reales solo se pueden
// probar en el teléfono del usuario.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.20: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const ar = read('js/ar.js');
if (!ar.includes('scaleSelectedBy')) fail('ar.js no tiene scaleSelectedBy');
if (!ar.includes("closest('button')")) fail('ar.js no ignora toques sobre botones para colocar');
if (!ar.includes('Escala:')) fail('ar.js no muestra la escala al pellizcar');
if (!ar.includes('arScaleUp') || !ar.includes('arScaleDown')) fail('ar.js no conecta los botones de escala');

const html = read('index.html');
if (!html.includes('v0.20')) fail('index.html no marca v0.20');
if (!html.includes('id="arScaleUp"') || !html.includes('id="arScaleDown"')) fail('index.html no tiene botones de escala en AR');
if (!html.includes('data-fit-ar="0.1"') || !html.includes('data-fit-ar="1"')) fail('index.html no tiene tamaños predefinidos');
if (!html.includes('src="js/main.js?v=0.20"')) fail('index.html no tiene src="js/main.js?v=0.20"');

const ui = read('js/ui.js');
if (!ui.includes('data-fit-ar')) fail('ui.js no conecta tamaños predefinidos');

const css = read('styles.css');
if (!css.includes('.ar-controls')) fail('styles.css no tiene .ar-controls');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  if (file === 'scan.js') continue; // borrador local sin conectar, fuera de v0.20
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.20')) fail(`${file} tiene importación local sin ?v=0.20: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.20 OK: botones + / - en AR, pellizco con texto de escala, tamaños predefinidos, cache busting ?v=0.20 (${versioned} importaciones).`);
