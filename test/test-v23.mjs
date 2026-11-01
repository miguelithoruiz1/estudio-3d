// Test Node de la v0.23 (Fotogrametría y Mapeo).
// Comprueba los 5 puntos de la especificación, con dos
// correcciones documentadas: (1) el paso 5 pedía ?v=0.16, pero
// v0.16 ya existe (AR sin atasco), así que la versión es v0.23
// como pide el cierre del mensaje; (2) el nombre estándar
// WebXR es 'mesh-detection', no 'mesh-tracking', así que se
// piden ambos como opcionales (las no soportadas se ignoran).
// La cámara, la ráfaga, el endpoint y el mesh real solo se
// pueden probar en el teléfono del usuario.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.23: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

// 1. scanner.js: getUserMedia alta resolución + ráfaga 30
const scanner = read('js/scanner.js');
if (!scanner.includes('getUserMedia')) fail('scanner.js no usa getUserMedia');
if (!scanner.includes('2560')) fail('scanner.js no pide alta resolución ideal');
if (!scanner.includes('BURST_TARGET = 30')) fail('scanner.js no tiene ráfaga de 30');
if (!scanner.includes('2000')) fail('scanner.js no tiene intervalo de ráfaga');
// 2. Payload: FormData + manifiesto, sin procesar localmente
if (!scanner.includes('FormData')) fail('scanner.js no construye FormData');
if (!scanner.includes('scan-manifest.json')) fail('scanner.js no genera manifiesto');
if (!scanner.includes('sendScannerPayload')) fail('scanner.js no tiene envío a endpoint');
if (scanner.includes('COLMAP') === false && scanner.includes('fotogrametría en el navegador') === false) fail('scanner.js no documenta que no procesa localmente');
// 3. Mapeo WebXR en ar.js + main.js
const ar = read('js/ar.js');
if (!ar.includes('detectedMeshes')) fail('ar.js no lee frame.detectedMeshes');
if (!ar.includes('Wireframe') && !ar.includes('wireframe: true')) fail('ar.js no dibuja wireframe');
if (!ar.includes('exportDetectedMeshesGLB')) fail('ar.js no exporta la malla');
const main = read('js/main.js');
if (!main.includes('mesh-detection')) fail('main.js no pide mesh-detection');
if (!main.includes('mesh-tracking')) fail('main.js no pide mesh-tracking (compatibilidad con la especificación)');
if (!main.includes('depth-sensing')) fail('main.js no pide depth-sensing');
if (!main.includes('updateDetectedMeshes')) fail('main.js no actualiza mallas por frame');
// 4. Persistencia .glb conectada en UI (no solo en snapshot.js,
// que sigue siendo el render PNG; la exportación de malla vive
// en ar.js y se dispara desde la interfaz)
const html = read('index.html');
if (!html.includes('v0.23')) fail('index.html no marca v0.23');
for (const id of ['scannerVideo', 'scannerBurst', 'scannerManifest', 'scannerSend', 'scannerEndpoint', 'exportMeshGLB', 'clearMeshGLB']) {
  if (!html.includes(`id="${id}"`)) fail(`index.html no tiene #${id}`);
}
if (!html.includes('src="js/main.js?v=0.23"')) fail('index.html no tiene src="js/main.js?v=0.23"');
const ui = read('js/ui.js');
if (!ui.includes("from './scanner.js")) fail('ui.js no importa scanner.js');
if (!ui.includes('exportDetectedMeshesGLB')) fail('ui.js no conecta la exportación de malla');
// 5. Cache busting ?v=0.23 en todas las importaciones locales
let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.23')) fail(`${file} tiene importación local sin ?v=0.23: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.23 OK: scanner (ráfaga 30 + payload + manifiesto), mapeo WebXR (mesh-detection/depth-sensing + wireframe + .glb), cache busting ?v=0.23 (${versioned} importaciones).`);
