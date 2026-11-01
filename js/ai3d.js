import { loadGLBFromURL } from './loaders.js?v=0.17';
import { log } from './store.js?v=0.17';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Busca la primera URL .glb dentro de un objeto JSON, en cualquier
// profundidad. Sirve como extractor tolerante entre proveedores, sin
// depender de un solo nombre de campo que pueda cambiar.
function findGlbUrl(value, seen = new Set()) {
  if (typeof value === 'string' && value.includes('.glb')) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  for (const v of Object.values(value)) {
    const found = findGlbUrl(v, seen);
    if (found) return found;
  }
  return null;
}

function normalizeStatus(raw) {
  return String(raw || '').toLowerCase();
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    const detail = data?.message || data?.error || data?.detail || text.slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return data;
}

function fileToDataURI(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

// --- Meshy (documentación oficial verificada) ---
// POST https://api.meshy.ai/openapi/v1/image-to-3d
//   body: { image_url, ai_model: 'latest', should_texture: true, target_formats: ['glb'] }
//   respuesta: { result: '<task-id>' }
// GET https://api.meshy.ai/openapi/v1/image-to-3d/<id>
//   estado SUCCEEDED y model_urls.glb con el archivo final.
// La clave va solo en el header Authorization y solo en memoria.
async function meshyGenerate({ apiKey, imageInput, onProgress }) {
  const created = await fetchJson('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      image_url: imageInput, ai_model: 'latest', should_texture: true, target_formats: ['glb'],
    }),
  });
  const taskId = created?.result;
  if (!taskId) throw new Error('Meshy no devolvió un ID de tarea');
  onProgress(`Meshy: tarea ${taskId} creada. Generando (puede tardar minutos)…`);
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(10000);
    const task = await fetchJson(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const status = normalizeStatus(task?.status);
    onProgress(`Meshy: ${task?.status || 'sin estado'} · progreso ${task?.progress ?? ''}`);
    if (status === 'succeeded') {
      const glb = task?.model_urls?.glb || findGlbUrl(task);
      if (!glb) throw new Error('Meshy terminó, pero no devolvió una URL .glb');
      return glb;
    }
    if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
      throw new Error(`Meshy terminó con estado ${task.status}`);
    }
  }
  throw new Error('Meshy: tiempo de espera agotado tras 10 minutos de polling');
}

// --- Tripo v3 (rutas oficiales v3, no la v2 retirada el 2026-10-31) ---
// Base global: https://openapi.tripo3d.ai/v3
// POST /v3/generation/image-to-model con { input } (URL pública o file_token)
// POST /v3/files (multipart) para subir un archivo local y obtener file_token
// GET  /v3/tasks/<task-id> para el estado, hasta success / failed.
async function tripoUploadFile(apiKey, file) {
  const form = new FormData();
  form.append('file', file);
  const data = await fetchJson('https://openapi.tripo3d.ai/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const token = data?.data?.file_token || data?.file_token || data?.data?.token || data?.token;
  if (!token) throw new Error('Tripo no devolvió un file_token al subir la imagen');
  return token;
}

async function tripoGenerate({ apiKey, imageInput, imageFile, onProgress }) {
  let input = imageInput;
  if (!input && imageFile) input = await tripoUploadFile(apiKey, imageFile);
  if (!input) throw new Error('Tripo necesita una URL pública de imagen o un archivo para subir');
  const created = await fetchJson('https://openapi.tripo3d.ai/v3/generation/image-to-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input, model_version: 'v3.0' }),
  });
  const taskId = created?.data?.task_id || created?.task_id || created?.data?.id || created?.id;
  if (!taskId) throw new Error('Tripo no devolvió un ID de tarea');
  onProgress(`Tripo: tarea ${taskId} creada. Generando…`);
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(10000);
    const task = await fetchJson(`https://openapi.tripo3d.ai/v3/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const inner = task?.data || task;
    const status = normalizeStatus(inner?.status);
    onProgress(`Tripo: ${inner?.status || 'sin estado'}`);
    if (status === 'success' || status === 'succeeded') {
      const glb = findGlbUrl(inner);
      if (!glb) throw new Error('Tripo terminó, pero no se encontró una URL .glb en la respuesta');
      return glb;
    }
    if (status === 'failed' || status === 'error' || status === 'cancelled' || status === 'canceled') {
      throw new Error(`Tripo terminó con estado ${inner.status}`);
    }
  }
  throw new Error('Tripo: tiempo de espera agotado tras 10 minutos de polling');
}

// Punto de entrada único desde la interfaz. La clave nunca se guarda:
// llega como argumento, se usa en los headers y se descarta al terminar.
export async function generate3DFromImage({ provider, apiKey, imageUrl, imageFile, onProgress = log }) {
  if (!apiKey) throw new Error('Falta la clave de API. Escríbela en el campo (no se guarda en ningún archivo).');
  let imageInput = (imageUrl || '').trim();
  if (!imageInput && imageFile && provider === 'meshy') {
    // Meshy acepta data URI base64 directamente, así que un archivo local
    // funciona sin subirlo antes a una URL pública.
    imageInput = await fileToDataURI(imageFile);
  }
  if (!imageInput && !imageFile) throw new Error('Falta la imagen: escribe una URL pública o elige un archivo.');
  if (imageInput && imageInput.length > 20 * 1024 * 1024 && provider === 'meshy') {
    throw new Error('La imagen supera el límite de 20 MB de Meshy.');
  }
  const glbUrl = provider === 'tripo'
    ? await tripoGenerate({ apiKey, imageInput, imageFile, onProgress })
    : await meshyGenerate({ apiKey, imageInput, onProgress });
  onProgress('Modelo listo. Cargando el .glb en la escena…');
  const obj = await loadGLBFromURL(glbUrl, 'Modelo IA (' + provider + ')');
  onProgress('Modelo IA añadido a la escena.');
  return obj;
}
