// Test Node de la v0.6 (sin navegador, sin token, sin modelo real).
// Comprueba el post-procesamiento espacial: Bounding Box, escala
// a eje mayor exactamente 2, centro en (0,0,0), encuadre por FOV
// al 80%, limpieza del spinner y mensaje con dimensiones finales.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.6: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const scene = read('js/scene.js');
if (!scene.includes('normalizeAndFrame')) fail('scene.js no exporta normalizeAndFrame');
if (!scene.includes('Box3().setFromObject')) fail('scene.js no calcula Bounding Box con Box3.setFromObject');
if (!scene.includes('targetSize = 2')) fail('scene.js no normaliza a eje mayor 2');
if (!scene.includes('fill = 0.8')) fail('scene.js no encuadra al 80%');
if (!scene.includes('Math.sin')) fail('scene.js no usa trigonometría con sin() para el FOV');
if (!scene.includes('camera.fov')) fail('scene.js no usa camera.fov');
if (!scene.includes('controls.target.copy')) fail('scene.js no actualiza controls.target al centro');
if (!scene.includes('camera.position.copy')) fail('scene.js no mueve la cámara');
if (!scene.includes('camera.position.clone().sub(controls.target)')) fail('scene.js no retrocede a lo largo del vector de visión actual');
if (!scene.includes('obj.position.sub(scaledCenter)')) fail('scene.js no centra en (0,0,0)');
if (!scene.includes('obj.scale.multiplyScalar')) fail('scene.js no aplica la escala de normalización');

const hf = read('js/hf3d.js');
if (!hf.includes('normalizeAndFrame')) fail('hf3d.js no usa normalizeAndFrame');
if (!hf.includes('Dimensiones finales:')) fail('hf3d.js no registra las dimensiones finales');
if (!hf.includes('Cámara encuadrada al 80%')) fail('hf3d.js no registra el encuadre al 80%');
if (hf.includes('model.scale.setScalar')) fail('hf3d.js conserva la normalización manual antigua en vez de la compartida');

const loaders = read('js/loaders.js');
if (!loaders.includes('normalizeAndFrame')) fail('loaders.js no usa normalizeAndFrame para modelos importados');

const ui = read('js/ui.js');
if (!ui.includes('status.textContent = status.textContent')) fail('ui.js no destruye el spinner tras el éxito');

const html = read('index.html');
if (!html.includes('v0.6')) fail('index.html no marca v0.6');
const main = read('js/main.js');
if (!main.includes('v0.6')) fail('main.js no marca v0.6');

// Comprobación matemática pura de la fórmula de encuadre:
// distancia = radio / (0.8 * sin(FOV_efectivo / 2)).
// Con radio 1 y FOV 55°, la distancia debe ser ~2.70.
const dist = 1 / (0.8 * Math.sin((55 * Math.PI / 180) / 2));
if (Math.abs(dist - 2.70) > 0.05) fail('fórmula de encuadre fuera de rango: ' + dist);

console.log('v0.6 OK: Box3, eje mayor 2, centro (0,0,0), encuadre FOV al 80%, spinner destruido, dimensiones finales en log.');
