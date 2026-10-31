// Test Node de la v0.13 (WebXR AR).
// Comprueba: renderer.xr.enabled, ARButton con hit-test, retículo
// anillo, hit-testing con espacio 'viewer', anclaje al tocar
// (select) del objeto seleccionable, ocultar/restaurar paneles en
// sessionstart/sessionend, bucle con setAnimationLoop (no
// requestAnimationFrame recursivo), render directo en sesión XR
// (EffectComposer no es compatible con WebXR), y cache busting
// ?v=0.13 en entrada, CSS y todas las importaciones locales.
// La sesión AR real exige un móvil con WebXR + cámara y no se
// puede probar en Node ni en el navegador de escritorio: aquí se
// verifica el código y, aparte, la misma secuencia con un XR
// simulado (mock) en /tmp/glbtest/verify-ar.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.13: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const main = read('js/main.js');
if (!main.includes('renderer.xr.enabled = true')) fail('main.js no habilita renderer.xr.enabled');
if (!main.includes('three/addons/webxr/ARButton.js')) fail('main.js no importa ARButton');
if (!main.includes("ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })")) fail('main.js no crea ARButton con requiredFeatures hit-test');
if (!main.includes('document.body.appendChild(ARButton.createButton')) fail('main.js no añade ARButton al DOM');
if (!main.includes('initAR(renderer, scene)')) fail('main.js no inicializa AR');
if (!main.includes('setAnimationLoop(animate)')) fail('main.js no usa setAnimationLoop (exigido por WebXR)');
if (main.includes('requestAnimationFrame(animate)')) fail('main.js todavía usa requestAnimationFrame recursivo en el bucle');
if (!main.includes('updateARHitTest(frame)')) fail('main.js no llama a updateARHitTest con el XRFrame');
if (!main.includes('isARSessionActive()')) fail('main.js no comprueba sesión AR para el render');
if (!main.includes('Listo v0.13')) fail('main.js no marca v0.13');

const ar = read('js/ar.js');
if (!ar.includes('RingGeometry(0.15, 0.2, 32)')) fail('ar.js no crea el retículo anillo 0.15/0.2');
if (!ar.includes('matrixAutoUpdate = false')) fail('ar.js no pone matrixAutoUpdate=false en el retículo');
if (!ar.includes("requestReferenceSpace('viewer')")) fail('ar.js no pide espacio viewer para hit-test');
if (!ar.includes('requestHitTestSource')) fail('ar.js no pide hit-test source');
if (!ar.includes('getHitTestResults')) fail('ar.js no lee hit-test results');
if (!ar.includes('reticle.matrix.fromArray')) fail('ar.js no escribe la matriz del hit en el retículo');
if (!ar.includes("addEventListener('select'")) fail('ar.js no escucha select del controlador');
if (!ar.includes('placeSelectedAtReticle')) fail('ar.js no tiene anclaje al retículo');
if (!ar.includes('setFromMatrixPosition(reticle.matrix)')) fail('ar.js no desplaza el objeto a la posición del retículo');
if (!ar.includes("addEventListener('sessionstart'")) fail('ar.js no escucha sessionstart');
if (!ar.includes("addEventListener('sessionend'")) fail('ar.js no escucha sessionend');
if (!ar.includes("querySelectorAll('aside, header, .timeline')")) fail('ar.js no oculta aside/header/timeline en AR');
if (!ar.includes('scene.background = null')) fail('ar.js no pone fondo null en AR para ver la cámara real');
if (!ar.includes('gridHelper.visible = false')) fail('ar.js no oculta la rejilla en AR');

const html = read('index.html');
if (!html.includes('src="js/main.js?v=0.13"')) fail('index.html no tiene src="js/main.js?v=0.13"');
if (!html.includes('href="styles.css?v=0.13"')) fail('index.html no tiene href="styles.css?v=0.13"');
if (!html.includes('v0.13')) fail('index.html no marca v0.13');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.13')) fail(`${file} tiene importación local sin ?v=0.13: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.13 OK: XR enabled + ARButton hit-test, retículo anillo, hit-test viewer, anclaje select, paneles sessionstart/end, setAnimationLoop con render directo en XR, cache busting ?v=0.13 (${versioned} importaciones).`);
