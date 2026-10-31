// Test Node de la v0.10 (sin navegador, sin WebGL).
// Comprueba: botón, checkbox, renderer alpha+preserve,
// supersampling 2x/4x con guardar/restaurar, canal alfa sin tocar
// scene.environment, y descarga render_estudio3d.png.
// La ejecución real con WebGL queda para el navegador: aquí se
// verifica el código y, aparte, la misma secuencia con un renderer
// simulado (mock) en /tmp/glbtest/verify-snapshot.mjs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.10: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const scene = read('js/scene.js');
if (!scene.includes('preserveDrawingBuffer: true')) fail('scene.js no tiene preserveDrawingBuffer:true');
if (!scene.includes('alpha: true')) fail('scene.js no tiene alpha:true');
if (!scene.includes('gridHelper')) fail('scene.js no exporta gridHelper');

const snap = read('js/snapshot.js');
if (!snap.includes('renderSnapshot')) fail('snapshot.js no exporta renderSnapshot');
if (!snap.includes('getPixelRatio')) fail('snapshot no guarda el pixelRatio');
if (!snap.includes('getSize')) fail('snapshot no guarda el tamaño');
if (!snap.includes('setSize')) fail('snapshot no cambia/restaura el tamaño');
if (!snap.includes('setPixelRatio')) fail('snapshot no restaura el pixelRatio');
if (!snap.includes("toDataURL('image/png', 1.0)")) fail('snapshot no extrae toDataURL PNG 1.0');
if (!snap.includes('render_estudio3d.png')) fail('snapshot no descarga render_estudio3d.png');
if (!snap.includes('scene.background = null')) fail('snapshot no oculta scene.background en transparente');
if (!snap.includes('gridHelper.visible = false')) fail('snapshot no oculta la grilla en transparente');
if (!snap.includes('scene.background = originalBackground')) fail('snapshot no restaura scene.background');
if (!snap.includes('gridHelper.visible = gridWasVisible')) fail('snapshot no restaura la grilla');
if (!snap.includes('setClearAlpha(0)')) fail('snapshot no pone clearAlpha 0 en transparente');
if (!snap.includes('setClearAlpha(originalClearAlpha)')) fail('snapshot no restaura clearAlpha');
// scene.environment nunca debe tocarse en snapshot.js
if (/scene\.environment\s*=/.test(snap)) fail('snapshot toca scene.environment, debe mantenerlo intacto');
if (!snap.includes('finally')) fail('snapshot no restaura en finally');
if (!snap.includes('factor') || !snap.includes('scale === 4 ? 4 : 2')) fail('snapshot no soporta 2x/4x');

const ui = read('js/ui.js');
if (!ui.includes('snapshot.js')) fail('ui.js no importa snapshot.js');
if (!ui.includes("bind('renderImage'")) fail('ui.js no enlaza #renderImage');
if (!ui.includes('renderTransparent')) fail('ui.js no lee #renderTransparent');
if (!ui.includes('renderScale')) fail('ui.js no lee #renderScale');

const html = read('index.html');
if (!html.includes('id="renderImage"')) fail('index.html no tiene #renderImage');
if (!html.includes('Renderizar Imagen (PNG)')) fail('index.html no tiene el botón con el texto exacto');
if (!html.includes('id="renderTransparent"')) fail('index.html no tiene #renderTransparent');
if (!html.includes('Fondo Transparente')) fail('index.html no tiene la casilla Fondo Transparente');
if (!html.includes('id="renderScale"')) fail('index.html no tiene #renderScale');
if (!html.includes('v0.10')) fail('index.html no marca v0.10');

console.log('v0.10 OK: botón PNG, checkbox transparente, alpha+preserve, supersampling 2x/4x con restaurar, fondo/grilla ocultos y environment intacto.');
