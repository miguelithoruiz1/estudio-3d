// Test Node de la v0.8 (sin navegador).
// Comprueba el ciclo de vida del BoxHelper: refresh tras
// normalizeAndFrame, sync en gizmo change y en animación,
// cleanup con removeFromParent+dispose y deselección al fondo.
// La prueba dinámica real con Three está en
// /tmp/glbtest/verify-v08.mjs (GLB compuesto real, mover HijoA).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.8: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const scene = read('js/scene.js');
if (!scene.includes('refreshSelectionHelper')) fail('scene.js no tiene refreshSelectionHelper');
if (!scene.includes('disposeSelectionHelper')) fail('scene.js no tiene disposeSelectionHelper');
if (!scene.includes('syncSelectionHelper')) fail('scene.js no tiene syncSelectionHelper');
if (!scene.includes('removeFromParent')) fail('cleanup no usa removeFromParent');
if (!scene.includes('selectionHelper.material?.dispose')) fail('cleanup no dispone el material del helper');
if (!scene.includes('selectionHelper.geometry?.dispose')) fail('cleanup no dispone la geometría del helper');
if (!scene.includes("transform.addEventListener('change'")) fail('gizmo no enlaza helper.update() en change');
if (!scene.includes('selectionHelper.update()')) fail('sync no llama a helper.update()');
// Refresh dentro de normalizeAndFrame, tras el encuadre
const normSection = scene.slice(scene.indexOf('export function normalizeAndFrame'));
if (!normSection.includes('refreshSelectionHelper')) fail('normalizeAndFrame no refresca el helper al final');
if (!scene.includes('if (!transform.dragging) select(null)')) fail('clic en fondo no deselecciona (con guarda anti-gizmo)');

const main = read('js/main.js');
if (!main.includes('syncSelectionHelper')) fail('main.js no sincroniza el helper en el bucle de animación');
if (!main.includes('v0.8')) fail('main.js no marca v0.8');

const html = read('index.html');
if (!html.includes('v0.8')) fail('index.html no marca v0.8');

console.log('v0.8 OK: refresh post-normalización, sync en gizmo change y animación, cleanup removeFromParent+dispose, deselección en fondo.');
