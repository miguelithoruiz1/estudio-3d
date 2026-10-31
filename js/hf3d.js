import * as THREE from 'three';
import { Client, handle_file } from '@gradio/client';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, register } from './scene.js';
import { log } from './store.js';

// Pipeline gratuito (sin clave, sin créditos) vía Hugging Face Spaces.
// Espacio principal: stabilityai/stable-fast-3d
//   /requires_bg_remove: { image, fr }
//   /run_button: { input_image, foreground_ratio, remesh_option, vertex_count, texture_size }
// Espacio alternativo: VAST-AI/TripoSR
//   /predict con imagen, quitar fondo, ratio y resolución de marching cubes.
// Los nombres de endpoint se intentan en orden y el último error se
// muestra tal cual: un Space público puede estar en cola, pausado o
// haber cambiado su API, y eso no debe disfrazarse como éxito.

function findFileObject(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (typeof value.url === 'string' && value.url) return value;
  if (typeof value.path === 'string' && value.path) return value;
  for (const v of Object.values(value)) {
    const found = findFileObject(v, seen);
    if (found) return found;
  }
  return null;
}

function findGlbString(value, seen = new Set()) {
  if (typeof value === 'string' && value.includes('.glb')) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  for (const v of Object.values(value)) {
    const found = findGlbString(v, seen);
    if (found) return found;
  }
  return null;
}

function resolveSpaceFileUrl(space, file) {
  const base = `https://${space.replace('/', '-').toLowerCase()}.hf.space`;
  if (file.url) {
    if (file.url.startsWith('http')) return file.url;
    return base + (file.url.startsWith('/') ? file.url : '/' + file.url);
  }
  if (file.path) {
    if (file.path.startsWith('http')) return file.path;
    return `${base}/gradio_api/file=${encodeURIComponent(file.path)}`;
  }
  return null;
}

async function loadGlbFromUrlAtOrigin(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el .glb (HTTP ${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(objectUrl, resolve, undefined, (e) => reject(new Error(e?.message || 'GLTFLoader no pudo leer el .glb')));
  });
  const model = gltf.scene;
  // Centrar en el origen y normalizar a unos 2 m para que quepa en
  // el viewport, manteniendo la posición final exactamente en (0,0,0).
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = maxDim > 0 ? 2 / maxDim : 1;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  const group = new THREE.Group();
  group.add(model);
  group.position.set(0, 0, 0);
  scene.add(group);
  register(group, name);
  // register() ya añadió el grupo; evitar doble alta en escena:
  // scene.add() anterior es idempotente en Three.js si ya es hijo,
  // pero register() vuelve a hacer scene.add(), así que el grupo
  // queda una sola vez como hijo de la escena.
  URL.revokeObjectURL(objectUrl);
  return group;
}

async function tryPredict(client, endpoint, payload, label) {
  try {
    return await client.predict(endpoint, payload);
  } catch (err) {
    throw new Error(`${label} (${endpoint}): ${err?.message || err}`);
  }
}

async function generateWithStableFast3D(file, onProgress) {
  onProgress('Conectando con stabilityai/stable-fast-3d…');
  const client = await Client.connect('stabilityai/stable-fast-3d');
  const image = await handle_file(file);
  // Paso opcional del demo: comprobar si hay que quitar el fondo.
  // Si este endpoint ya no existe, se sigue directo a /run_button.
  try {
    await client.predict('/requires_bg_remove', { image, fr: 0.85 });
  } catch (err) {
    onProgress('Aviso: /requires_bg_remove no respondió, se intenta /run_button directo.');
    log('HF /requires_bg_remove: ' + (err?.message || err));
  }
  onProgress('Generando malla 3D, esto puede tardar unos segundos...');
  const result = await tryPredict(client, '/run_button', {
    input_image: image,
    foreground_ratio: 0.85,
    remesh_option: 'None',
    vertex_count: -1,
    texture_size: 1024,
  }, 'Stable Fast 3D');
  const fileObj = findFileObject(result.data);
  const glbUrl = fileObj ? resolveSpaceFileUrl('stabilityai/stable-fast-3d', fileObj) : findGlbString(result.data);
  if (!glbUrl) throw new Error('Stable Fast 3D respondió, pero no se encontró un archivo .glb en la respuesta');
  return glbUrl;
}

async function generateWithTripoSR(file, onProgress) {
  onProgress('Conectando con VAST-AI/TripoSR…');
  const client = await Client.connect('VAST-AI/TripoSR');
  const image = await handle_file(file);
  onProgress('Generando malla 3D, esto puede tardar unos segundos...');
  let result = null;
  let lastError = null;
  const attempts = [
    ['/predict', { input_image: image, do_remove_background: true, foreground_ratio: 0.9, mc_resolution: 256 }],
    ['/predict', [image, true, 0.9, 256]],
  ];
  for (const [endpoint, payload] of attempts) {
    try { result = await client.predict(endpoint, payload); break; }
    catch (err) { lastError = err; }
  }
  if (!result) throw new Error('TripoSR: ' + (lastError?.message || lastError));
  const fileObj = findFileObject(result.data);
  const glbUrl = fileObj ? resolveSpaceFileUrl('VAST-AI/TripoSR', fileObj) : findGlbString(result.data);
  if (!glbUrl) throw new Error('TripoSR respondió, pero no se encontró un archivo .glb en la respuesta');
  return glbUrl;
}

// Entrada única desde la interfaz gratuita. No pide clave ni paga
// créditos: el coste es la cola compartida del Space público.
export async function generateFree3DFromImage({ file, space = 'sf3d', onProgress = log }) {
  if (!file) throw new Error('Elige una imagen JPG o PNG.');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('Formato no aceptado para este pipeline: usa JPG, PNG o WebP.');
  }
  onProgress('Generando malla 3D, esto puede tardar unos segundos...');
  let glbUrl;
  try {
    glbUrl = space === 'triposr'
      ? await generateWithTripoSR(file, onProgress)
      : await generateWithStableFast3D(file, onProgress);
  } catch (err) {
    // Si el espacio principal falla, se intenta el alternativo una vez,
    // salvo que el usuario ya haya elegido TripoSR explícitamente.
    if (space === 'triposr') throw err;
    onProgress('Stable Fast 3D falló, intentando TripoSR como alternativa gratuita…');
    log('HF SF3D: ' + (err?.message || err));
    glbUrl = await generateWithTripoSR(file, onProgress);
  }
  onProgress('Malla lista. Cargando el .glb en (0, 0, 0)…');
  const obj = await loadGlbFromUrlAtOrigin(glbUrl, 'Modelo IA gratuito (HF)');
  onProgress('Modelo IA gratuito añadido en (0, 0, 0).');
  return obj;
}
