import * as THREE from 'three';
import { state, setLogger, log } from './store.js?v=0.23';
import { scene, renderer, register, setTransformMode, removeSelected, duplicateSelected, applyMaterial, fitSelectedToSize, restoreSelectedScale } from './scene.js?v=0.23';
import { loadModelFile, exportGLB, exportOBJ, download } from './loaders.js?v=0.23';
import { addPrimitive, addParticles, addTextMotion, addArm, setShoulder, setElbow, inflateSelected } from './effects.js?v=0.23';
import { recordKeyframe, applyKeyframes, updateTracks, createVideoRecorder } from './timeline.js?v=0.23';
import { generate3DFromImage } from './ai3d.js?v=0.23';
import { generateFree3DFromImage } from './hf3d.js?v=0.23';
import { getHfToken, saveHfToken, clearHfToken } from './hf-token.js?v=0.23';
import { refreshOutliner } from './outliner.js?v=0.23';
import { loadEnvironmentFile, setEnvironmentBackground } from './environment.js?v=0.23';
import { renderSnapshot } from './snapshot.js?v=0.23';
import { renderScanUI, openScanCamera, stopScanCamera, captureScanPhoto, importScanPhotos, downloadScanPhotos, getBestScanPhotoFile, clearScan } from './scan.js?v=0.23';
import { renderScannerUI, openScannerCamera, stopScannerCamera, captureScannerPhoto, startBurst, stopBurst, downloadScannerManifest, downloadScannerPhotos, clearScanner, sendScannerPayload } from './scanner.js?v=0.23';
import { exportDetectedMeshesGLB, clearDetectedMeshes } from './ar.js?v=0.23';
import { setBloomEnabled, setBloomStrength, getBloomState, isVFXReady } from './vfx.js?v=0.23';

const $ = (id) => document.getElementById(id);
// Enlace seguro: si falta un id, se deja constancia en #log en
// lugar de romper initUI() entero con un TypeError en consola.
function bind(id, event, handler) {
  const el = $(id);
  if (!el) { log('UI: falta el elemento #' + id + ', su control queda sin enlazar.'); return null; }
  el.addEventListener(event, handler);
  return el;
}
function required(id) {
  const el = $(id);
  if (!el) throw new Error('UI: falta el elemento #' + id + ' en index.html.');
  return el;
}

export function initUI() {
  setLogger((msg) => { const el = $('log'); if (el) el.textContent = msg; console.log(msg); });
  // Errores no controlados también visibles en #log, no solo en consola.
  window.addEventListener('error', (e) => { log('Error: ' + (e?.message || 'error desconocido')); });
  window.addEventListener('unhandledrejection', (e) => { log('Error no controlado: ' + (e?.reason?.message || e?.reason || 'desconocido')); });
  // v0.7: el Outliner se redibuja tras cada importación o
  // generación (onObjectsChange) y tras cada selección
  // (onSelectChange, para marcar el activo).
  state.onObjectsChange = () => { updateTracks(); refreshOutliner(); };
  state.onSelectChange = () => refreshOutliner();

  $('addBox').onclick = () => addPrimitive('box');
  $('addSphere').onclick = () => addPrimitive('sphere');
  $('addCyl').onclick = () => addPrimitive('cylinder');
  $('addTorus').onclick = () => addPrimitive('torus');
  $('addParticles').onclick = addParticles;
  $('addArm').onclick = addArm;
  $('addText').onclick = () => {
    const txt = prompt('Texto para motion graphics:', 'Tu Cambio Empieza Ahora') || 'Motiva-Me';
    addTextMotion(txt);
  };
  $('addDir').onclick = () => {
    const l = new THREE.DirectionalLight(0xffffff, 1);
    l.position.set(3, 6, 2);
    register(l, 'Luz direccional');
  };
  $('addPoint').onclick = () => {
    const l = new THREE.PointLight(0xff2e88, 20, 20);
    l.position.set(0, 3, 0);
    register(l, 'Luz puntual');
  };

  $('importModel').onchange = (e) => { if (e.target.files[0]) loadModelFile(e.target.files[0]); };

  // --- Entorno / Iluminación (HDRI, v0.9) ---
  bind('envHdr', 'change', async (e) => {
    const file = e.target.files?.[0];
    const status = $('envStatus');
    if (!file) return;
    if (status) status.textContent = 'Cargando HDRI…';
    try {
      const result = await loadEnvironmentFile(file);
      if (status) status.textContent = `Entorno cargado: ${result.fileName}. Iluminación IBL activa; el fondo sigue la casilla de abajo.`;
      log(`Entorno HDRI cargado: ${result.fileName} (PMREM en scene.environment).`);
    } catch (err) {
      if (status) status.textContent = 'Error de entorno: ' + (err?.message || err);
      log('Entorno HDRI: ' + (err?.message || err));
    }
  });
  bind('envBackground', 'change', (e) => { setEnvironmentBackground(e.target.checked); });

  // --- Efectos Visuales (VFX, v0.11) ---
  const updateVfxStatus = () => {
    const el = $('vfxStatus');
    if (!el) return;
    if (!isVFXReady()) {
      el.textContent = 'VFX no disponible en este navegador: render directo, sin Bloom.';
      return;
    }
    const s = getBloomState();
    el.textContent = `Bloom ${s.enabled ? 'activo' : 'inactivo'}: strength ${s.strength}, threshold ${s.threshold}, radius ${s.radius}.`;
  };
  bind('vfxBloom', 'change', (e) => { setBloomEnabled(e.target.checked); updateVfxStatus(); });
  bind('vfxBloomStrength', 'input', (e) => { setBloomStrength(e.target.value); updateVfxStatus(); });
  updateVfxStatus();

  // --- Render Final (Snapshot PNG, v0.10, con Snapshot Sync v0.11) ---
  bind('renderImage', 'click', () => {
    try {
      const scale = parseFloat($('renderScale')?.value || '2');
      const transparent = $('renderTransparent')?.checked || false;
      const result = renderSnapshot({ scale, transparent });
      log(`Imagen renderizada: render_estudio3d.png (${result.scale}x, ${result.width}x${result.height}, fondo ${transparent ? 'transparente' : 'como en escena'}, vía ${result.via}).`);
    } catch (err) {
      log('Render: ' + (err?.message || err));
    }
  });
  $('exportGLB').onclick = exportGLB;
  $('exportOBJ').onclick = exportOBJ;

  document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => setTransformMode(b.dataset.mode); });
  // v0.18: ajuste de tamaño para AR, antes de entrar a la sesión.
  $('fitAR30').onclick = () => {
    const r = fitSelectedToSize(0.3);
    if (!r) { log('Elige primero un objeto para ajustar a 30 cm.'); return; }
    log(`Ajustado para AR: de ${r.longest.toFixed(2)} m a 0,30 m (factor ${r.factor.toFixed(3)}). Entra a AR y colócalo con un toque.`);
  };
  $('restoreARScale').onclick = () => {
    if (restoreSelectedScale()) log('Tamaño original restaurado.');
    else log('Este objeto no tiene un tamaño original guardado para restaurar.');
  };
  // v0.20: tamaños predefinidos antes de AR, garantizados
  // aunque el pellizco en sesión no llegue al navegador.
  document.querySelectorAll('[data-fit-ar]').forEach((b) => {
    b.onclick = () => {
      const target = parseFloat(b.dataset.fitAr);
      const r = fitSelectedToSize(target);
      if (!r) { log('Elige primero un objeto para ajustar su tamaño.'); return; }
      log(`Ajustado para AR: de ${r.longest.toFixed(2)} m a ${target.toFixed(2)} m.`);
    };
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'w') setTransformMode('translate');
    if (e.key === 'e') setTransformMode('rotate');
    if (e.key === 'r') setTransformMode('scale');
  });
  $('matColor').oninput = (e) => applyMaterial(e.target.value, undefined, undefined);
  $('matMetal').oninput = (e) => applyMaterial(undefined, +e.target.value, undefined);
  $('matRough').oninput = (e) => applyMaterial(undefined, undefined, +e.target.value);
  $('duplicate').onclick = duplicateSelected;
  $('deleteObj').onclick = removeSelected;
  $('inflate').onclick = inflateSelected;
  $('shoulder').oninput = (e) => setShoulder(+e.target.value);
  $('elbow').oninput = (e) => setElbow(+e.target.value);

  // --- Pipeline IA gratuito (Hugging Face, con token Read) ---
  // v0.5: el token vive solo en localStorage del navegador. Al
  // arrancar se restaura en el campo de contraseña (oculto por
  // type="password"), nunca se registra ni se muestra su valor.
  // Escribir en el campo lo guarda; borrarlo lo elimina.
  const hfTokenEl = $('hfToken');
  if (hfTokenEl) {
    const saved = getHfToken();
    if (saved) hfTokenEl.value = saved;
  }
  bind('hfToken', 'change', (e) => {
    const saved = saveHfToken(e.target.value);
    log(saved
      ? 'Token de Hugging Face guardado solo en tu navegador (localStorage).'
      : 'Token de Hugging Face eliminado del navegador.');
  });
  bind('clearHfToken', 'click', () => {
    clearHfToken();
    if (hfTokenEl) hfTokenEl.value = '';
    log('Token de Hugging Face borrado del navegador.');
  });
  // v0.4: el flujo se dispara desde #importImage (change) y también
  // desde el botón, con la misma función, para que importar una
  // imagen nunca quede sin reacción visible.
  let hfGenerating = false;
  async function startFreeGeneration() {
    const btn = $('generateFreeAI');
    const status = $('hfStatus');
    const file = $('importImage')?.files?.[0] || null;
    if (!file) {
      const msg = 'IA gratuita: elige primero una imagen JPG o PNG en el campo de importación.';
      log(msg);
      if (status) { status.style.display = 'block'; status.textContent = msg; }
      return;
    }
    if (hfGenerating) { log('IA gratuita: ya hay una generación en curso.'); return; }
    hfGenerating = true;
    if (btn) btn.disabled = true;
    if (status) status.style.display = 'block';
    try {
      await generateFree3DFromImage({
        file,
        space: $('hfSpace')?.value || 'sf3d',
        onProgress: (msg) => {
          if (status) status.innerHTML = '<span class="spinner"></span> ' + msg;
          log(msg);
        },
      });
      // v0.6: éxito -> destruir el spinner de #hfStatus (#log es
      // solo texto y ya contiene el mensaje con las dimensiones
      // finales). Asignar textContent sobre sí mismo conserva el
      // texto y elimina el <span class="spinner">.
      if (status) status.textContent = status.textContent;
    } catch (err) {
      const msg = 'IA gratuita: ' + (err?.message || err);
      log(msg);
      if (status) status.textContent = 'Error: ' + (err?.message || err);
    } finally {
      hfGenerating = false;
      if (btn) btn.disabled = false;
    }
  }
  bind('importImage', 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    log(`Imagen importada: ${file.name} (${file.type || 'tipo desconocido'}, ${Math.round(file.size / 1024)} KB). Iniciando generación gratuita…`);
    await startFreeGeneration();
  });
  bind('generateFreeAI', 'click', startFreeGeneration);

  // --- Escaneo de objeto, fase 1 (v0.21) ---
  // La generación desde la mejor foto reutiliza el mismo flujo
  // gratuito (Espacio + token HF de la sección anterior).
  async function startScanGeneration() {
    const file = getBestScanPhotoFile();
    const status = $('hfStatus');
    if (!file) { log('Escaneo: no hay foto para generar. Captura o importa fotos primero.'); return; }
    if (hfGenerating) { log('IA gratuita: ya hay una generación en curso.'); return; }
    hfGenerating = true;
    if (status) status.style.display = 'block';
    try {
      await generateFree3DFromImage({
        file,
        space: $('hfSpace')?.value || 'sf3d',
        onProgress: (msg) => {
          if (status) status.innerHTML = '<span class="spinner"></span> ' + msg;
          log(msg);
        },
      });
      if (status) status.textContent = status.textContent;
    } catch (err) {
      const msg = 'IA gratuita (escaneo): ' + (err?.message || err);
      log(msg);
      if (status) status.textContent = 'Error: ' + (err?.message || err);
    } finally {
      hfGenerating = false;
    }
  }
  bind('scanOpenCamera', 'click', openScanCamera);
  bind('scanStopCamera', 'click', stopScanCamera);
  bind('scanCapture', 'click', captureScanPhoto);
  bind('scanDownload', 'click', downloadScanPhotos);
  bind('scanClear', 'click', clearScan);
  bind('scanUseBest', 'click', startScanGeneration);
  bind('scanImport', 'change', async (e) => { if (e.target.files?.length) await importScanPhotos(e.target.files); });
  renderScanUI();

  // --- Escáner multi-vista y mapeo (v0.23) ---
  bind('scannerOpenCamera', 'click', openScannerCamera);
  bind('scannerStopCamera', 'click', stopScannerCamera);
  bind('scannerCapture', 'click', async () => { await captureScannerPhoto(); });
  bind('scannerBurst', 'click', startBurst);
  bind('scannerStopBurst', 'click', stopBurst);
  bind('scannerClear', 'click', clearScanner);
  bind('scannerManifest', 'click', downloadScannerManifest);
  bind('scannerDownload', 'click', downloadScannerPhotos);
  bind('scannerSend', 'click', async () => {
    const btn = $('scannerSend');
    if (btn) btn.disabled = true;
    try {
      const result = await sendScannerPayload($('scannerEndpoint')?.value || '', $('scannerApiKey')?.value || '');
      log(`Escáner: payload enviado. Respuesta del endpoint: ${String(result).slice(0, 300)}`);
    } catch (err) {
      log('Escáner: ' + (err?.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  bind('exportMeshGLB', 'click', exportDetectedMeshesGLB);
  bind('clearMeshGLB', 'click', clearDetectedMeshes);
  renderScannerUI();

  // --- Pipeline IA de pago (opcional, v0.2) ---
  $('generateAI').onclick = async () => {
    const btn = $('generateAI');
    btn.disabled = true;
    try {
      await generate3DFromImage({
        provider: $('aiProvider').value,
        apiKey: $('aiKey').value.trim(),
        imageUrl: $('aiImageUrl').value,
        imageFile: $('aiImageFile').files[0] || null,
        onProgress: log,
      });
      // La clave queda solo en el campo del navegador; al recargar se pierde.
      // No se escribe en ningún archivo del proyecto.
    } catch (err) {
      log('IA: ' + err.message + ' (si es CORS, el proveedor exige un proxy/backend; ver README).');
    } finally {
      btn.disabled = false;
    }
  };

  // --- Timeline y video ---
  let startTime = 0;
  const slider = $('timeSlider');
  const timeLabel = $('timeLabel');
  const playBtn = $('play');
  playBtn.onclick = () => {
    state.playing = !state.playing;
    if (state.playing) { startTime = performance.now() - state.currentTime * 1000; playBtn.textContent = '⏸ Pausar'; }
    else playBtn.textContent = '▶ Reproducir';
  };
  $('recordKey').onclick = recordKeyframe;
  slider.oninput = () => {
    state.currentTime = +slider.value;
    applyKeyframes(state.currentTime);
    timeLabel.textContent = state.currentTime.toFixed(2) + ' / ' + state.duration + ' s';
  };
  $('duration').onchange = (e) => { state.duration = +e.target.value || 10; slider.max = state.duration; };
  const recorder = createVideoRecorder(renderer.domElement, (blob) => download(blob, 'estudio3d-video.webm'));
  $('recVideo').onclick = () => {
    try {
      recorder.start();
      state.playing = true; startTime = performance.now(); state.currentTime = 0;
      playBtn.textContent = '⏸ Pausar';
      log('Grabando video WebM… pulsa Detener para descargar.');
    } catch (err) { log('No se pudo grabar: ' + err.message); }
  };
  $('stopVideo').onclick = () => { recorder.stop(); state.playing = false; playBtn.textContent = '▶ Reproducir'; };

  refreshOutliner();
  // El bucle de reproducción lo expone main.js mediante este hook.
  state.tickPlayback = () => {
    if (!state.playing) return;
    state.currentTime = (performance.now() - startTime) / 1000;
    if (state.currentTime >= state.duration) { state.currentTime = 0; startTime = performance.now(); }
    slider.value = state.currentTime;
    timeLabel.textContent = state.currentTime.toFixed(2) + ' / ' + state.duration + ' s';
    applyKeyframes(state.currentTime);
  };
  void scene;
}
