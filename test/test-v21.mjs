// Test Node de la v0.21 (Escaneo de objeto, fase 1).
// Comprueba: módulo scan.js con captura guiada de 8 ángulos,
// miniaturas, descarga, mejor foto y limpieza; sección de
// escaneo en index.html con cámara, importación múltiple y
// botones; ui.js conecta el escaneo y reutiliza la generación
// gratuita; estilos de miniaturas; cache busting ?v=0.21.
// La cámara real y la generación solo se pueden probar en el
// teléfono del usuario (con su token HF).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.21: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const scan = read('js/scan.js');
for (const fn of ['openScanCamera', 'captureScanPhoto', 'importScanPhotos', 'downloadScanPhotos', 'getBestScanPhotoFile', 'clearScan', 'renderScanUI']) {
  if (!scan.includes(`export function ${fn}`) && !scan.includes(`export async function ${fn}`)) fail(`scan.js no exporta ${fn}`);
}
if (!scan.includes('facingMode')) fail('scan.js no pide cámara trasera');
if (!scan.includes('ANGLES')) fail('scan.js no tiene guía de ángulos');

const html = read('index.html');
if (!html.includes('v0.21')) fail('index.html no marca v0.21');
for (const id of ['scanVideo', 'scanOpenCamera', 'scanCapture', 'scanStopCamera', 'scanImport', 'scanCount', 'scanStrip', 'scanDownload', 'scanUseBest', 'scanClear']) {
  if (!html.includes(`id="${id}"`)) fail(`index.html no tiene #${id}`);
}
if (!html.includes('src="js/main.js?v=0.21"')) fail('index.html no tiene src="js/main.js?v=0.21"');

const ui = read('js/ui.js');
if (!ui.includes("from './scan.js")) fail('ui.js no importa scan.js');
if (!ui.includes('startScanGeneration')) fail('ui.js no conecta la generación desde la mejor foto');

const css = read('styles.css');
if (!css.includes('.scan-thumb')) fail('styles.css no tiene miniaturas de escaneo');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  for (const spec of [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1])) {
    if (!spec.endsWith('.js?v=0.21')) fail(`${file} tiene importación local sin ?v=0.21: ${spec}`);
    versioned++;
  }
}
if (versioned < 35) fail(`solo ${versioned} importaciones locales versionadas`);

console.log(`v0.21 OK: escaneo fase 1 (cámara, 8 ángulos, miniaturas, descarga, mejor foto a 3D), cache busting ?v=0.21 (${versioned} importaciones).`);
