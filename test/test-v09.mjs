// Test Node de la v0.9 (sin navegador, sin WebGL).
// Comprueba: panel .hdr, RGBELoader, PMREM a scene.environment,
// toggle de fondo, dispose previo en VRAM. El parse real del HDR
// está en /tmp/glbtest/verify-hdr.mjs (RGBELoader real, 4x4).
// PMREM real exige WebGL y no se puede ejecutar en Node sin GPU:
// se verifica su llamada en código, y la confirmación visual de
// reflejos queda para la prueba en navegador con un objeto metálico.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.9: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const env = read('js/environment.js');
if (!env.includes('RGBELoader')) fail('environment.js no importa RGBELoader');
if (!env.includes('PMREMGenerator')) fail('environment.js no usa PMREMGenerator');
if (!env.includes('fromEquirectangular')) fail('environment.js no filtra con fromEquirectangular');
if (!env.includes('scene.environment = pmremTexture')) fail('environment.js no asigna scene.environment');
if (!env.includes('EquirectangularReflectionMapping')) fail('environment.js no marca el HDRI como equirectangular');
if (!env.includes('currentHdrTexture.dispose')) fail('environment.js no hace dispose() de la textura HDR anterior');
if (!env.includes('currentPmremTexture.dispose')) fail('environment.js no hace dispose() de la textura PMREM anterior');
if (!env.includes('setEnvironmentBackground')) fail('environment.js no exporta el toggle de fondo');
if (!env.includes('DARK_BACKGROUND')) fail('environment.js no restaura el fondo sólido oscuro');

const ui = read('js/ui.js');
if (!ui.includes('environment.js')) fail('ui.js no importa environment.js');
if (!ui.includes("bind('envHdr'")) fail('ui.js no enlaza #envHdr');
if (!ui.includes("bind('envBackground'")) fail('ui.js no enlaza #envBackground');

const html = read('index.html');
if (!html.includes('id="envHdr"')) fail('index.html no tiene #envHdr');
if (!html.includes('accept=".hdr"')) fail('index.html no acepta .hdr');
if (!html.includes('id="envBackground"')) fail('index.html no tiene #envBackground');
if (!html.includes('type="checkbox"')) fail('index.html no tiene checkbox de fondo');
if (!html.includes('id="envStatus"')) fail('index.html no tiene #envStatus');
if (!html.includes('Entorno / Iluminación')) fail('index.html no tiene el sub-panel Entorno / Iluminación');
if (!html.includes('v0.9')) fail('index.html no marca v0.9');

const hdrPath = join(root, 'test/test-env.hdr');
const hdr = readFileSync(hdrPath);
if (!hdr.slice(0, 20).toString().includes('#?RADIANCE')) fail('test-env.hdr no es Radiance HDR');
if (hdr.length < 100) fail('test-env.hdr demasiado pequeño');
console.log(`v0.9 OK: RGBELoader, PMREM a scene.environment, toggle fondo, dispose VRAM, HDR test (${hdr.length} bytes, 4x4).`);
