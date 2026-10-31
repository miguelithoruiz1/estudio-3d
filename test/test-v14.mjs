// Test Node de la v0.14 (Gestos AR multitáctiles).
// Comprueba: dom-overlay opcional en ARButton, capa #arOverlay,
// listeners touchstart/touchmove, pinch con distancia y twist con
// ángulo sobre el eje Y, 1 toque que reposiciona al retículo,
// clamp de escala con THREE.MathUtils.clamp entre 0.1 y 10, y
// cache busting ?v=0.14 con log v0.14.
// Los gestos reales exigen un móvil con WebXR + dom-overlay y no
// se pueden probar en Node ni en escritorio: aquí se verifica el
// código y, aparte, la misma secuencia con toques simulados en
// /tmp/artest/verify-gestures.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.14: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const main = read('js/main.js');
if (!main.includes("optionalFeatures: ['dom-overlay']")) fail('main.js no pide dom-overlay opcional');
if (!main.includes('domOverlay: { root:')) fail('main.js no pasa domOverlay root a ARButton');
if (!main.includes("document.getElementById('arOverlay')")) fail('main.js no usa #arOverlay como raíz dom-overlay');
if (!main.includes('Listo v0.14')) fail('main.js no marca v0.14');

const ar = read('js/ar.js');
if (!ar.includes("addEventListener('touchstart'")) fail('ar.js no escucha touchstart');
if (!ar.includes("addEventListener('touchmove'")) fail('ar.js no escucha touchmove');
if (!ar.includes('e.touches.length === 2')) fail('ar.js no detecta 2 toques simultáneos');
if (!ar.includes('e.touches.length === 1')) fail('ar.js no detecta 1 toque');
if (!ar.includes('touchDistance') && !ar.includes('Math.hypot')) fail('ar.js no calcula distancia entre toques');
if (!ar.includes('touchAngle') && !ar.includes('Math.atan2')) fail('ar.js no calcula ángulo entre toques');
if (!ar.includes('placeable.scale.set')) fail('ar.js no modifica la escala del modelo activo');
if (!ar.includes('placeable.rotation.y += ')) fail('ar.js no rota sobre el eje Y');
if (!ar.includes('THREE.MathUtils.clamp(')) fail('ar.js no usa THREE.MathUtils.clamp para la escala');
if (!ar.includes('0.1, 10')) fail('ar.js no limita la escala entre 0.1 y 10');
if (!ar.includes('placeSelectedAtReticle()')) fail('ar.js no reposiciona con 1 toque al retículo');
if (!ar.includes("getElementById('arOverlay')")) fail('ar.js no muestra/oculta #arOverlay en sesión');
if (!ar.includes("overlay.style.display = 'block'")) fail('ar.js no muestra el overlay en sessionstart');
if (!ar.includes("overlay.style.display = 'none'")) fail('ar.js no oculta el overlay en sessionend');
if (!ar.includes('passive: false')) fail('ar.js no usa passive:false para poder hacer preventDefault en toques');

const html = read('index.html');
if (!html.includes('id="arOverlay"')) fail('index.html no tiene #arOverlay');
if (!html.includes('src="js/main.js?v=0.14"')) fail('index.html no tiene src="js/main.js?v=0.14"');
if (!html.includes('href="styles.css?v=0.14"')) fail('index.html no tiene href="styles.css?v=0.14"');
if (!html.includes('v0.14')) fail('index.html no marca v0.14');

const css = read('styles.css');
if (!css.includes('#arOverlay')) fail('styles.css no define #arOverlay');
if (!css.includes('touch-action:none')) fail('styles.css no pone touch-action:none en el overlay');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.14')) fail(`${file} tiene importación local sin ?v=0.14: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.14 OK: dom-overlay + #arOverlay, touchstart/touchmove, pinch escala + twist Y, 1 toque al retículo, clamp 0.1-10, cache busting ?v=0.14 (${versioned} importaciones).`);
