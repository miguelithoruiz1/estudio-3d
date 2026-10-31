import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, register, normalizeAndFrame } from './scene.js?v=0.13';
import { log } from './store.js?v=0.13';
import { validateImageMeta, getImageDimensions } from './validate-image.js?v=0.13';
import { getHfToken } from './hf-token.js?v=0.13';

// v0.4: @gradio/client YA NO se importa en la cabecera.
// En v0.3 un fallo de ese CDN rompía todo el grafo de módulos y la
// interfaz quedaba muerta sin ningún mensaje en #log. Ahora se carga
// de forma perezosa dentro de try/catch, y cualquier fallo (CDN,
// CORS, timeout, Space dormido o API cambiada) se devuelve como
// error visible en #log y en #hfStatus, no solo en la consola.
//
// Espacio principal: stabilityai/stable-fast-3d
//   /requires_bg_remove: { image, fr }
//   /run_button: { input_image, foreground_ratio, remesh_option, vertex_count, texture_size }
// Espacio alternativo: VAST-AI/TripoSR, /predict.

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: tiempo agotado tras ${Math.round(ms / 1000)} s (Space en cola, dormido o sin respuesta)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadGradioClient(onProgress) {
  try {
    onProgress('Cargando cliente de Hugging Face…');
    const mod = await withTimeout(import('@gradio/client'), 30000, 'Carga de @gradio/client');
    if (!mod?.Client || !mod?.handle_file) throw new Error('El cliente de Gradio cargó, pero no expone Client/handle_file.');
    return mod;
  } catch (err) {
    throw new Error(`No se pudo cargar @gradio/client desde CDN: ${err?.message || err}. Revisa la conexión y vuelve a intentarlo.`);
  }
}

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
  let res;
  try {
    res = await withTimeout(fetch(url), 60000, 'Descarga del .glb');
  } catch (err) {
    throw new Error(`No se pudo descargar el .glb: ${err?.message || err} (puede ser CORS del Space)`);
  }
  if (!res.ok) throw new Error(`No se pudo descargar el .glb (HTTP ${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load(objectUrl, resolve, undefined, (e) => reject(new Error(e?.message || 'GLTFLoader no pudo leer el .glb')));
    });
    const model = gltf.scene;
    const group = new THREE.Group();
    group.add(model);
    group.position.set(0, 0, 0);
    register(group, name);
    // v0.6: la normalización (eje mayor 2, centro en (0,0,0)) y el
    // encuadre de cámara al 80% viven en scene.normalizeAndFrame,
    // compartido con los modelos importados en loaders.js.
    const framing = normalizeAndFrame(group);
    return { group, framing };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function generateWithStableFast3D(file, onProgress, gradio, hfToken) {
  const { Client, handle_file } = gradio;
  onProgress('Conectando con stabilityai/stable-fast-3d…');
  const client = await withTimeout(Client.connect('stabilityai/stable-fast-3d', { hf_token: hfToken }), 60000, 'Conexión con Stable Fast 3D');
  const image = await handle_file(file);
  try {
    await withTimeout(client.predict('/requires_bg_remove', { image, fr: 0.85 }), 60000, 'Stable Fast 3D /requires_bg_remove');
  } catch (err) {
    onProgress('Aviso: /requires_bg_remove no respondió, se intenta /run_button directo.');
    log('HF /requires_bg_remove: ' + (err?.message || err));
  }
  onProgress('Generando malla 3D, esto puede tardar unos segundos...');
  let result;
  try {
    result = await withTimeout(client.predict('/run_button', {
      input_image: image,
      foreground_ratio: 0.85,
      remesh_option: 'None',
      vertex_count: -1,
      texture_size: 1024,
    }), 300000, 'Stable Fast 3D /run_button');
  } catch (err) {
    throw new Error(`Stable Fast 3D falló: ${err?.message || err}`);
  }
  const fileObj = findFileObject(result.data);
  const glbUrl = fileObj ? resolveSpaceFileUrl('stabilityai/stable-fast-3d', fileObj) : findGlbString(result.data);
  if (!glbUrl) throw new Error('Stable Fast 3D respondió, pero no se encontró un archivo .glb en la respuesta');
  return glbUrl;
}

async function generateWithTripoSR(file, onProgress, gradio, hfToken) {
  const { Client, handle_file } = gradio;
  onProgress('Conectando con VAST-AI/TripoSR…');
  const client = await withTimeout(Client.connect('VAST-AI/TripoSR', { hf_token: hfToken }), 60000, 'Conexión con TripoSR');
  const image = await handle_file(file);
  onProgress('Generando malla 3D, esto puede tardar unos segundos...');
  let result = null;
  let lastError = null;
  const attempts = [
    ['/predict', { input_image: image, do_remove_background: true, foreground_ratio: 0.9, mc_resolution: 256 }],
    ['/predict', [image, true, 0.9, 256]],
  ];
  for (const [endpoint, payload] of attempts) {
    try {
      result = await withTimeout(client.predict(endpoint, payload), 300000, `TripoSR ${endpoint}`);
      break;
    } catch (err) { lastError = err; }
  }
  if (!result) throw new Error(`TripoSR falló: ${lastError?.message || lastError}`);
  const fileObj = findFileObject(result.data);
  const glbUrl = fileObj ? resolveSpaceFileUrl('VAST-AI/TripoSR', fileObj) : findGlbString(result.data);
  if (!glbUrl) throw new Error('TripoSR respondió, pero no se encontró un archivo .glb en la respuesta');
  return glbUrl;
}

// Entrada única desde la interfaz gratuita. Todo error se propaga
// para que la UI lo imprima en #log y #hfStatus.
export async function generateFree3DFromImage({ file, space = 'sf3d', onProgress = log }) {
  if (!file) throw new Error('Elige una imagen JPG o PNG en el campo de importación.');
  const typeError = validateImageMeta({ type: file.type, width: 1, height: 1 });
  // La comprobación de tipo se hace aquí; las dimensiones reales se
  // comprueban justo después, antes de llamar a ningún Space.
  if (typeError && !typeError.includes('dimensiones') && !typeError.includes('pequeña') && !typeError.includes('píxeles')) throw new Error(typeError);
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Formato no aceptado: usa JPG, PNG o WebP.');
  let dims;
  try {
    dims = await getImageDimensions(file);
  } catch (err) {
    throw new Error(`No se pudo leer la imagen importada: ${err?.message || err}`);
  }
  const dimError = validateImageMeta({ type: file.type, width: dims.width, height: dims.height });
  if (dimError) throw new Error(dimError);
  // v0.5: sin token no se llama a ningún Space. La advertencia sale
  // por #log y #hfStatus a través de la UI, y nunca incluye el token.
  const hfToken = getHfToken();
  if (!hfToken) {
    throw new Error('Falta el Hugging Face Token (Read). Ingrésalo en el campo de contraseña de la sección de generación gratuita: se guarda solo en el localStorage de tu navegador y nunca se escribe en el repositorio.');
  }
  onProgress(`Imagen importada: ${file.name} (${dims.width}x${dims.height}). Generando malla 3D, esto puede tardar unos segundos...`);
  const gradio = await loadGradioClient(onProgress);
  let glbUrl;
  try {
    glbUrl = space === 'triposr'
      ? await generateWithTripoSR(file, onProgress, gradio, hfToken)
      : await generateWithStableFast3D(file, onProgress, gradio, hfToken);
  } catch (err) {
    if (space === 'triposr') throw err;
    onProgress('Stable Fast 3D falló, intentando TripoSR como alternativa gratuita…');
    log('HF SF3D: ' + (err?.message || err));
    glbUrl = await generateWithTripoSR(file, onProgress, gradio, hfToken);
  }
  onProgress('Malla lista. Cargando el .glb en (0, 0, 0)…');
  const { group, framing } = await loadGlbFromUrlAtOrigin(glbUrl, 'Modelo IA gratuito (HF)');
  if (framing?.dimensions) {
    const d = framing.dimensions;
    onProgress(`Modelo IA gratuito añadido en (0, 0, 0). Dimensiones finales: ${d.x.toFixed(2)} x ${d.y.toFixed(2)} x ${d.z.toFixed(2)} (eje mayor 2.00). Cámara encuadrada al 80%.`);
  } else {
    onProgress('Modelo IA gratuito añadido en (0, 0, 0).');
  }
  return group;
}
