// v0.23: Escáner multi-vista (nube) — NO fotogrametría local.
// Restricción respetada: el navegador NO reconstruye el modelo
// en WebGL. Este módulo solo captura, empaqueta y prepara el
// envío a un endpoint REST externo de reconstrucción 3D
// (multi-view stereo). Sin endpoint configurado por el usuario,
// no se envía nada: solo se descargan las fotos y el manifiesto.
// Diferencia con scan.js (v0.21, captura guiada de 8 ángulos
// para generar 3D desde la mejor foto): scanner.js es la serie
// completa para nube, con ráfaga controlada de 30 fotos,
// archivos Blob/File reales (no solo data URL) y un manifiesto
// JSON estructurado que acompaña a cada envío.
// Cámara: getUserMedia con cámara trasera y resolución ideal
// alta (2560x1440 ideal, no exacta, para que funcione aunque
// el teléfono no llegue a esa resolución). Las fotos se
// capturan a JPEG 0,9, con un máximo de 1920 px en el lado mayor.

import { log } from './store.js?v=0.23';

export const BURST_TARGET = 30;
export const BURST_INTERVAL_MS = 2000;

export const scannerState = { photos: [], stream: null, burstTimer: null, bursting: false };

function updateCount() {
  const el = document.getElementById('scannerCount');
  if (el) {
    el.textContent = scannerState.photos.length === 0
      ? 'Sin fotos de escáner todavía.'
      : `${scannerState.photos.length} / ${BURST_TARGET} foto(s) de escáner. ${scannerState.bursting ? 'Ráfaga en curso: camina despacio alrededor del objeto.' : ''}`;
  }
}

export function renderScannerUI() { updateCount(); }

export async function openScannerCamera() {
  const video = document.getElementById('scannerVideo');
  if (!video) return;
  try {
    if (scannerState.stream) stopScannerCamera();
    scannerState.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 2560 }, height: { ideal: 1440 } },
      audio: false,
    });
    video.srcObject = scannerState.stream;
    await video.play();
    video.style.display = 'block';
    const settings = scannerState.stream.getVideoTracks()[0]?.getSettings?.() || {};
    log(`Escáner: cámara trasera abierta (${settings.width || '?'}x${settings.height || '?'}). Captura foto a foto o inicia la ráfaga de ${BURST_TARGET}.`);
  } catch (err) {
    log(`Escáner: no se pudo abrir la cámara (${err?.message || err}). Alternativa: usa la sección Escaneo (v0.21) para importar fotos ya tomadas.`);
  }
}

export function stopScannerCamera() {
  const video = document.getElementById('scannerVideo');
  stopBurst();
  if (scannerState.stream) {
    for (const track of scannerState.stream.getTracks()) track.stop();
    scannerState.stream = null;
  }
  if (video) { video.srcObject = null; video.style.display = 'none'; }
}

export function captureScannerPhoto() {
  const video = document.getElementById('scannerVideo');
  if (!video || !scannerState.stream || video.readyState < 2) {
    log('Escáner: primero abre la cámara del escáner.');
    return null;
  }
  const maxSide = 1920;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { log('Escáner: no se pudo capturar la foto.'); resolve(null); return; }
      const index = scannerState.photos.length;
      const file = new File([blob], `scan-${String(index + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' });
      scannerState.photos.push({ file, width: canvas.width, height: canvas.height, capturedAt: new Date().toISOString(), angleIndex: index });
      updateCount();
      log(`Escáner: foto ${index + 1} / ${BURST_TARGET} guardada (${canvas.width}x${canvas.height}).`);
      resolve(file);
    }, 'image/jpeg', 0.9);
  });
}

export function startBurst() {
  if (scannerState.bursting) { log('Escáner: la ráfaga ya está en curso.'); return; }
  if (!scannerState.stream) { log('Escáner: primero abre la cámara del escáner.'); return; }
  if (scannerState.photos.length >= BURST_TARGET) { log(`Escáner: ya tienes ${BURST_TARGET} fotos. Descarga el manifiesto o limpia el escáner para otra serie.`); return; }
  scannerState.bursting = true;
  log(`Escáner: ráfaga iniciada, 1 foto cada ${BURST_INTERVAL_MS / 1000} s hasta ${BURST_TARGET}. Camina despacio alrededor del objeto, sin moverlo.`);
  updateCount();
  scannerState.burstTimer = setInterval(async () => {
    await captureScannerPhoto();
    if (scannerState.photos.length >= BURST_TARGET) {
      stopBurst();
      log(`Escáner: ráfaga completa (${BURST_TARGET} fotos). Descarga el manifiesto y las fotos, o envía el payload a tu endpoint.`);
    }
  }, BURST_INTERVAL_MS);
}

export function stopBurst() {
  if (scannerState.burstTimer) clearInterval(scannerState.burstTimer);
  scannerState.burstTimer = null;
  if (scannerState.bursting) {
    scannerState.bursting = false;
    updateCount();
    log(`Escáner: ráfaga detenida con ${scannerState.photos.length} foto(s).`);
  }
}

export function buildScannerManifest() {
  return {
    app: 'Estudio 3D',
    version: 'v0.23',
    type: 'multi-view-scan',
    createdAt: new Date().toISOString(),
    photoCount: scannerState.photos.length,
    burstTarget: BURST_TARGET,
    notes: 'Payload preparado para endpoint REST externo de reconstrucción 3D (multi-view stereo). No se procesó fotogrametría en el navegador. Envía este manifiesto junto a los archivos photo-*.jpg con el mismo orden.',
    photos: scannerState.photos.map((p, i) => ({
      order: i + 1,
      filename: p.file.name,
      sizeBytes: p.file.size,
      width: p.width,
      height: p.height,
      capturedAt: p.capturedAt,
      angleIndex: p.angleIndex,
    })),
  };
}

export function buildScannerPayload() {
  const manifest = buildScannerManifest();
  const form = new FormData();
  form.append('manifest', new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), 'scan-manifest.json');
  scannerState.photos.forEach((p) => form.append('photos', p.file, p.file.name));
  return { manifest, formData: form };
}

export function downloadScannerManifest() {
  if (!scannerState.photos.length) { log('Escáner: no hay fotos para el manifiesto.'); return; }
  const manifest = buildScannerManifest();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));
  a.download = 'scan-manifest.json';
  a.click();
  log(`Escáner: manifiesto descargado (${manifest.photoCount} foto(s)). Descarga también las fotos con el botón siguiente.`);
}

export function downloadScannerPhotos() {
  if (!scannerState.photos.length) { log('Escáner: no hay fotos para descargar.'); return; }
  scannerState.photos.forEach((p) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(p.file);
    a.download = p.file.name;
    a.click();
  });
  log(`Escáner: descargando ${scannerState.photos.length} foto(s).`);
}

export function clearScanner() {
  stopScannerCamera();
  scannerState.photos = [];
  updateCount();
  log('Escáner limpiado. Las fotos descargadas antes siguen en tu teléfono.');
}

// Envío real, solo si el usuario escribe su propio endpoint.
// La clave, si la escribe, se usa solo en este fetch y no se
// guarda en ningún archivo ni en localStorage. Sin endpoint,
// esta función no envía nada (el flujo queda en preparar y
// descargar, que es el comportamiento por defecto).
export async function sendScannerPayload(endpoint, apiKey) {
  const url = (endpoint || '').trim();
  if (!url) throw new Error('Escribe primero la URL de tu endpoint REST de reconstrucción 3D.');
  if (!scannerState.photos.length) throw new Error('No hay fotos para enviar.');
  const { formData } = buildScannerPayload();
  const headers = {};
  if ((apiKey || '').trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const text = await res.text();
  if (!res.ok) throw new Error(`Endpoint HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text;
}
