// v0.20: Escaneo de objeto, fase 1 (captura guiada).
// Alcance honesto: esto NO es fotogrametría real desde varias
// fotos en el navegador. Ningún navegador web hace eso solo:
// reconstruir un modelo a partir de muchas fotos exige un
// servicio externo de fotogrametría o un backend con COLMAP /
// NeRF, que no está conectado aquí. Lo que sí hace esta fase,
// y es útil hoy en el teléfono, es:
//  1. Capturar una serie guiada de fotos alrededor del objeto
//     (cámara trasera en vivo, o importar fotos ya tomadas).
//  2. Guardar la serie en el teléfono (descarga de las fotos).
//  3. Elegir la mejor foto y enviarla a la generación 3D que
//     ya existe (gratis HF o de pago Meshy/Tripo), para tener
//     un modelo en la escena que luego se coloca en AR.
// La guía es de 8 ángulos (cada 45°): frente, diagonal, lado,
// diagonal trasera, atrás, diagonal trasera, otro lado y
// diagonal. No es obligatoria: con menos fotos también se
// puede generar, pero con más ángulos el usuario elige mejor
// la vista frontal para la generación de una sola imagen.
// Las fotos viven solo en memoria de esta página: si se cierra
// la pestaña sin descargarlas, se pierden. Por eso el botón de
// descarga está junto a la captura, no al final del flujo.

import { log } from './store.js?v=0.23';

const ANGLES = ['Frente (0°)', 'Diagonal (45°)', 'Lado (90°)', 'Diagonal trasera (135°)', 'Atrás (180°)', 'Diagonal trasera (225°)', 'Otro lado (270°)', 'Diagonal (315°)'];

export const scanState = { photos: [], selected: 0, stream: null };

function dataUrlToFile(dataUrl, name) {
  const [header, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(header)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function renderScanUI() {
  const count = document.getElementById('scanCount');
  if (count) {
    count.textContent = scanState.photos.length === 0
      ? 'Sin fotos todavía. Abre la cámara o importa fotos.'
      : `${scanState.photos.length} foto(s). Siguiente ángulo sugerido: ${ANGLES[scanState.photos.length % 8]}.`;
  }
  const strip = document.getElementById('scanStrip');
  if (strip) {
    strip.innerHTML = '';
    scanState.photos.forEach((p, i) => {
      const img = document.createElement('img');
      img.src = p.dataUrl;
      img.alt = `Foto de escaneo ${i + 1}`;
      img.className = i === scanState.selected ? 'scan-thumb selected' : 'scan-thumb';
      img.onclick = () => { scanState.selected = i; renderScanUI(); log(`Escaneo: mejor foto elegida: ${i + 1} (${p.angle}).`); };
      strip.appendChild(img);
    });
  }
}

export async function openScanCamera() {
  const video = document.getElementById('scanVideo');
  if (!video) return;
  try {
    if (scanState.stream) stopScanCamera();
    scanState.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = scanState.stream;
    await video.play();
    video.style.display = 'block';
    log('Escaneo: cámara trasera abierta. Da la vuelta al objeto y captura una foto por ángulo.');
  } catch (err) {
    log(`Escaneo: no se pudo abrir la cámara (${err?.message || err}). Alternativa: usa "Importar fotos" con fotos ya tomadas en la app de cámara.`);
  }
}

export function stopScanCamera() {
  const video = document.getElementById('scanVideo');
  if (scanState.stream) {
    for (const track of scanState.stream.getTracks()) track.stop();
    scanState.stream = null;
  }
  if (video) { video.srcObject = null; video.style.display = 'none'; }
}

export function captureScanPhoto() {
  const video = document.getElementById('scanVideo');
  if (!video || !scanState.stream || video.readyState < 2) {
    log('Escaneo: primero abre la cámara para capturar, o importa fotos ya tomadas.');
    return;
  }
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const index = scanState.photos.length;
  scanState.photos.push({ dataUrl, angle: ANGLES[index % 8], name: `escaneo-${String(index + 1).padStart(2, '0')}.jpg` });
  scanState.selected = index;
  renderScanUI();
  log(`Escaneo: foto ${index + 1} guardada (${ANGLES[index % 8]}).`);
}

export async function importScanPhotos(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer ' + file.name));
      reader.readAsDataURL(file);
    });
    const index = scanState.photos.length;
    scanState.photos.push({ dataUrl, angle: ANGLES[index % 8], name: file.name });
  }
  if (scanState.photos.length) scanState.selected = scanState.photos.length - 1;
  renderScanUI();
  log(`Escaneo: ${scanState.photos.length} foto(s) en total.`);
}

export function downloadScanPhotos() {
  if (!scanState.photos.length) { log('Escaneo: no hay fotos para descargar.'); return; }
  // Descarga una por una: el navegador puede pedir confirmación
  // para varias descargas, eso es normal y se acepta una vez.
  scanState.photos.forEach((p, i) => {
    const a = document.createElement('a');
    a.href = p.dataUrl;
    a.download = p.name;
    a.click();
    if (i === 0) log(`Escaneo: descargando ${scanState.photos.length} foto(s). Guarda esta serie: es la única copia si cierras la página.`);
  });
}

export function getBestScanPhotoFile() {
  if (!scanState.photos.length) return null;
  const p = scanState.photos[scanState.selected] || scanState.photos[0];
  return dataUrlToFile(p.dataUrl, p.name);
}

export function clearScan() {
  stopScanCamera();
  scanState.photos = [];
  scanState.selected = 0;
  renderScanUI();
  log('Escaneo limpiado. Las fotos descargadas antes siguen en tu teléfono.');
}
