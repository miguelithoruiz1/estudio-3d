// Test Node de la v0.19 (Pellizco AR de vuelta).
// Comprueba el cambio clave frente a v0.17/v0.18: la capa
// #arOverlay ya NO está en display:none cuando se pide la
// sesión (eso coincidió con la cámara negra en v0.14-0.16),
// sino visible con pointer-events:none y texto en opacity 0;
// en sessionstart se activan toques y texto, y en sessionend
// se vuelven a desactivar. También comprueba que ARButton
// vuelve a pedir dom-overlay y que el cache busting es ?v=0.19.
// La cámara y el pellizco reales solo se pueden probar en el
// teléfono del usuario.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.19: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const main = read('js/main.js');
if (!main.includes("optionalFeatures: ['dom-overlay']")) fail('main.js no pide dom-overlay');
if (!main.includes('domOverlay:')) fail('main.js no pasa domOverlay root');
if (!main.includes('Listo v0.19')) fail('main.js no marca v0.19');

const css = read('styles.css');
if (!css.includes('#arOverlay{position:fixed;inset:0;z-index:20;touch-action:none;display:block;pointer-events:none}')) fail('styles.css: #arOverlay debe estar visible con pointer-events:none antes de la sesión');
if (!css.includes('opacity:0')) fail('styles.css: el hint debe empezar en opacity 0');

const ar = read('js/ar.js');
if (!ar.includes("overlay.style.pointerEvents = 'auto'")) fail('ar.js no activa toques en sessionstart');
if (!ar.includes("overlay.style.pointerEvents = 'none'")) fail('ar.js no desactiva toques en sessionend');
if (!ar.includes('pinchInitialScale')) fail('ar.js perdió el estado de pellizco');
if (!ar.includes("addEventListener('touchstart'")) fail('ar.js no conecta touchstart de la capa');

const html = read('index.html');
if (!html.includes('v0.19')) fail('index.html no marca v0.19');
if (!html.includes('src="js/main.js?v=0.19"')) fail('index.html no tiene src="js/main.js?v=0.19"');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.19')) fail(`${file} tiene importación local sin ?v=0.19: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.19 OK: dom-overlay corregido (visible antes, toques solo en sesión), pellizco + giro, cache busting ?v=0.19 (${versioned} importaciones).`);
