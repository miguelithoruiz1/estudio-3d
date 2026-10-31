import * as THREE from 'three';
import { state, setLogger, log } from './store.js';
import { scene, renderer, register, setTransformMode, removeSelected, duplicateSelected, applyMaterial } from './scene.js';
import { loadModelFile, exportGLB, exportOBJ, download } from './io.js';
import { addPrimitive, addParticles, addTextMotion, addArm, setShoulder, setElbow, inflateSelected } from './effects.js';
import { recordKeyframe, applyKeyframes, updateTracks, createVideoRecorder } from './timeline.js';
import { generate3DFromImage } from './ai3d.js';

const $ = (id) => document.getElementById(id);

export function initUI() {
  setLogger((msg) => { $('log').textContent = msg; console.log(msg); });
  state.onObjectsChange = updateTracks;

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
  $('exportGLB').onclick = exportGLB;
  $('exportOBJ').onclick = exportOBJ;

  document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => setTransformMode(b.dataset.mode); });
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

  // --- Pipeline IA (reemplaza al relieve 2D de la v0.1) ---
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
