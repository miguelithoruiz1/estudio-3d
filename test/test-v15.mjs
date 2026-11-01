// Test Node de la v0.15 (Aviso de compatibilidad AR al abrir).
// Comprueba: aviso #arCompat en HTML/CSS, initARCompat en main.js
// antes de la sesión AR, lógica pura con navegador simulado
// (compatible -> disponible; sin XR -> no disponible + alternativa
// concreta en el visor 3D; sin HTTPS -> aviso de HTTPS +
// alternativa), que ar.js oculta #arCompat en sesión, que los
// gestos v0.14 siguen intactos, y cache busting ?v=0.15 con log.
// Un resultado de escritorio NO se presenta como resultado del
// teléfono: aquí se verifica el código y las dos ramas con
// navegadores simulados; la prueba real en el teléfono del
// usuario queda pendiente y se dice así.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.15: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const { decideARCompat, renderARCompat, AR_ALTERNATIVE } = await import('../js/ar-compat.js');

// Rama compatible simulada.
const ok = await decideARCompat({ isSecureContext: true, xr: { isSessionSupported: async () => true } });
if (ok.status !== 'available' || !ok.text.includes('AR disponible')) fail('rama compatible no dice AR disponible');
// Rama no compatible simulada (sin XR).
const no = await decideARCompat({ isSecureContext: true, xr: null });
if (no.status !== 'unsupported' || !no.text.includes('AR no está disponible')) fail('rama sin XR no dice AR no disponible');
if (!no.text.includes('visor 3D')) fail('rama no disponible no nombra la alternativa del visor 3D');
if (!no.text.includes('Renderizar Imagen')) fail('rama no disponible no nombra la alternativa PNG');
// Rama sin HTTPS.
const http = await decideARCompat({ isSecureContext: false, xr: null });
if (http.status !== 'insecure' || !http.text.includes('HTTPS')) fail('rama sin HTTPS no avisa de HTTPS');
if (!http.text.includes('visor 3D')) fail('rama sin HTTPS no nombra la alternativa');
// Solo se usan XR + contexto seguro: el módulo no menciona otros datos del dispositivo.
const compatSrc = read('js/ar-compat.js');
for (const banned of ['geolocation', 'userAgent', 'platform', 'deviceMemory', 'hardwareConcurrency']) {
  if (compatSrc.includes(banned)) fail(`ar-compat.js usa dato innecesario: ${banned}`);
}
if (!AR_ALTERNATIVE.includes('visor 3D')) fail('AR_ALTERNATIVE no nombra el visor 3D');
// Render sobre elemento simulado.
const fakeEl = { textContent: '', dataset: {} };
renderARCompat(fakeEl, no);
if (fakeEl.dataset.status !== 'unsupported' || !fakeEl.textContent.includes('AR no está disponible')) fail('renderARCompat no escribe texto/estado');

const main = read('js/main.js');
if (!main.includes("from './ar-compat.js?v=0.15'")) fail('main.js no importa ar-compat con ?v=0.15');
if (!main.includes('initARCompat()')) fail('main.js no llama a initARCompat');
if (!main.includes('Listo v0.15')) fail('main.js no marca v0.15');

const ar = read('js/ar.js');
// Gestos v0.14 intactos.
if (!ar.includes("addEventListener('touchstart'")) fail('ar.js perdió touchstart v0.14');
if (!ar.includes('THREE.MathUtils.clamp(')) fail('ar.js perdió clamp v0.14');
if (!ar.includes('#arCompat')) fail('ar.js no oculta #arCompat en sesión AR');

const html = read('index.html');
if (!html.includes('id="arCompat"')) fail('index.html no tiene #arCompat');
if (!html.includes('src="js/main.js?v=0.15"')) fail('index.html no tiene src="js/main.js?v=0.15"');
if (!html.includes('href="styles.css?v=0.15"')) fail('index.html no tiene href="styles.css?v=0.15"');
if (!html.includes('v0.15')) fail('index.html no marca v0.15');

const css = read('styles.css');
if (!css.includes('#arCompat')) fail('styles.css no define #arCompat');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.15')) fail(`${file} tiene importación local sin ?v=0.15: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.15 OK: aviso AR al abrir (compatible / no compatible + alternativa visor 3D / sin HTTPS), #arCompat oculto en sesión, gestos v0.14 intactos, cache busting ?v=0.15 (${versioned} importaciones).`);
