// Test Node de la v0.7 (sin navegador, sin token).
// Comprueba: Outliner, raycasting a Mesh hijo, BoxHelper,
// inspector granular y no destructivo. La prueba con el GLB
// compuesto real está en /tmp/glbtest/verify.mjs (Three real,
// GLTFLoader real) y se ejecuta aparte por ser binaria.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.7: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const outliner = read('js/outliner.js');
if (!outliner.includes('refreshOutliner')) fail('outliner.js no exporta refreshOutliner');
if (!outliner.includes('state.objects')) fail('Outliner no se basa en state.objects (interactivos)');
if (!outliner.includes('isGridHelper') || !outliner.includes('GridHelper')) fail('Outliner no excluye helpers/grillas');
if (!outliner.includes('select(obj)')) fail('Outliner no selecciona al hacer clic en un nodo');
if (!outliner.includes('state.selected === obj')) fail('Outliner no marca el activo');

const scene = read('js/scene.js');
if (!scene.includes('intersectObjects(state.objects, true)')) fail('scene.js no hace raycasting recursivo');
if (!scene.includes('if (hit.isMesh) select(hit)')) fail('scene.js no selecciona exclusivamente el Mesh hijo');
if (scene.includes('while (o.parent && !state.objects.includes(o))')) fail('scene.js conserva la subida al Group padre');
if (!scene.includes('BoxHelper')) fail('scene.js no usa BoxHelper temporal');
if (!scene.includes('0xff2e88')) fail('BoxHelper no es magenta');
if (!scene.includes('state.selected.isMesh')) fail('applyMaterial no distingue Mesh de Group');
if (!scene.includes('targets.push(state.selected)')) fail('applyMaterial no aplica solo a la Mesh seleccionada');
// No destructivo: applyMaterial no debe asignar nunca a .map
const applySection = scene.slice(scene.indexOf('export function applyMaterial'));
if (/\.map\s*=/.test(applySection)) fail('applyMaterial toca material.map');
if (!applySection.includes('tinte')) fail('applyMaterial no documenta que el color actúa como tinte sobre la textura');
if (!scene.includes('matMetal') || !scene.includes('matRough')) fail('select() no refleja metalness/roughness en el inspector');
if (!scene.includes('matInfo')) fail('select() no actualiza #matInfo');
if (!scene.includes('onSelectChange')) fail('scene.js no notifica el cambio de selección al Outliner');

const ui = read('js/ui.js');
if (!ui.includes('outliner.js')) fail('ui.js no importa outliner.js');
if (!ui.includes('refreshOutliner')) fail('ui.js no redibuja el Outliner');

const html = read('index.html');
if (!html.includes('id="outliner"')) fail('index.html no tiene #outliner');
if (!html.includes('id="matInfo"')) fail('index.html no tiene #matInfo');
if (!html.includes('v0.7')) fail('index.html no marca v0.7');
if (!html.includes('no la reemplaza')) fail('index.html no advierte que el color no reemplaza la textura');

const glbPath = join(root, 'test/composite-2-meshes.glb');
const glbSize = statSync(glbPath).size;
if (glbSize < 1000) fail('GLB compuesto demasiado pequeño: ' + glbSize);
const glbJson = execSync(`python3 -c "import struct,json,sys; d=open('${glbPath}','rb').read(); cl=struct.unpack('<I', d[12:16])[0]; j=json.loads(d[20:20+cl]); print([n.get('name') for n in j['nodes']]); print([m['pbrMetallicRoughness']['roughnessFactor'] for m in j['materials']])"`, { encoding: 'utf8' });
if (!glbJson.includes('HijoA') || !glbJson.includes('HijoB')) fail('GLB compuesto no tiene HijoA/HijoB');
if (!glbJson.includes('0.5') || !glbJson.includes('0.2')) fail('GLB compuesto no tiene rugosidades distintas 0.5/0.2');

console.log(`v0.7 OK: Outliner, Mesh hijo, BoxHelper, inspector granular no destructivo, GLB compuesto (${glbSize} bytes, HijoA 0.5 / HijoB 0.2).`);
