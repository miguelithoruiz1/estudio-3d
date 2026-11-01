// Test Node de la v0.16 (AR sin atasco).
// Comprueba: estado AR en sesión (setARHint), reintento del
// hit-test tras fallo (hitTestRetryAt), colocación de respaldo
// frente a la cámara cuando no hay retículo (lastViewerMatrix),
// que los gestos v0.14 y el aviso v0.15 siguen intactos, y
// cache busting ?v=0.16 con log v0.16.
// La sesión AR real exige un móvil con WebXR y no se puede
// probar en Node: aquí se verifica el código.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.16: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const ar = read('js/ar.js');
if (!ar.includes('setARHint(')) fail('ar.js no actualiza el texto de ayuda en sesión');
if (!ar.includes('hitTestRetryAt')) fail('ar.js no reintenta el hit-test tras fallo');
if (!ar.includes('lastViewerMatrix')) fail('ar.js no guarda la pose del visor para el respaldo');
if (!ar.includes('colocado frente a ti')) fail('ar.js no tiene colocación de respaldo frente a la cámara');
if (!ar.includes('THREE.MathUtils.clamp(')) fail('ar.js perdió clamp v0.14');
if (!ar.includes("addEventListener('touchstart'")) fail('ar.js perdió touchstart v0.14');
if (!ar.includes('#arCompat')) fail('ar.js no oculta #arCompat en sesión (v0.15)');

const main = read('js/main.js');
if (!main.includes('Listo v0.16')) fail('main.js no marca v0.16');
if (!main.includes("from './ar-compat.js?v=0.16'")) fail('main.js no importa ar-compat con ?v=0.16');

const html = read('index.html');
if (!html.includes('v0.16')) fail('index.html no marca v0.16');
if (!html.includes('src="js/main.js?v=0.16"')) fail('index.html no tiene src="js/main.js?v=0.16"');
if (!html.includes('href="styles.css?v=0.16"')) fail('index.html no tiene href="styles.css?v=0.16"');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.16')) fail(`${file} tiene importación local sin ?v=0.16: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.16 OK: estado AR en sesión, reintento hit-test, respaldo frente a cámara, gestos v0.14 + aviso v0.15 intactos, cache busting ?v=0.16 (${versioned} importaciones).`);
