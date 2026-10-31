import * as THREE from 'three';
import { initScene, renderer, scene, camera, controls, resize, syncSelectionHelper } from './scene.js?v=0.12';
import { state, log } from './store.js?v=0.12';
import { initUI } from './ui.js?v=0.12';
import { initVFX, renderVFX, syncVFXSize, isVFXReady, getBloomState } from './vfx.js?v=0.12';
import { updateEffects, addPrimitive } from './effects.js?v=0.12';
import { updateTracks } from './timeline.js?v=0.12';

function start() {
  try {
    const canvas = document.getElementById('viewport');
    if (!canvas) throw new Error('No se encontró el canvas #viewport.');
    initScene(canvas);
    // v0.11: post-procesamiento no fatal: si los módulos de
    // postprocessing fallan al cargar, la app sigue con render
    // directo y el panel VFX queda inactivo, sin romper el inicio.
    try {
      initVFX(renderer, scene, camera);
    } catch (vfxErr) {
      console.warn('VFX no disponible, render directo:', vfxErr);
    }
    initUI();
    new ResizeObserver(() => { resize(); syncVFXSize(); }).observe(canvas.parentElement);
    resize();
    syncVFXSize();

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (typeof state.tickPlayback === 'function') state.tickPlayback();
      updateEffects(dt, t);
      controls.update();
      // v0.8: sincronización por frame del BoxHelper, además del
      // evento 'change' del gizmo, para que siga a la malla en vivo.
      syncSelectionHelper();
      // v0.11: el bucle ya no usa renderer.render() directo:
      // renderVFX() llama a composer.render() (RenderPass +
      // UnrealBloomPass + OutputPass) y, solo si el compositor
      // no se pudo inicializar, cae a renderer.render().
      renderVFX(renderer, scene, camera);
    }

    addPrimitive('box');
    state.objects[state.objects.length - 1].name = 'Cubo inicial';
    updateTracks();
    // v0.12: el log de inicio debe decir claramente que el motor
    // VFX está activo; solo si initVFX falló se dice lo contrario,
    // para no afirmar un VFX que no se inicializó.
    log(isVFXReady()
      ? `Listo v0.12. Motor VFX activo. (Bloom ${getBloomState().enabled ? 'activo' : 'inactivo'}, strength ${getBloomState().strength}). Añade objetos, importa un modelo o genera uno gratis con Hugging Face (necesita tu token Read, guardado solo en tu navegador).`
      : 'Listo v0.12. Motor VFX no disponible, render directo. Añade objetos, importa un modelo o genera uno gratis con Hugging Face (necesita tu token Read, guardado solo en tu navegador).');
    window.__estudioReady = true;
    animate();
  } catch (err) {
    const logEl = document.getElementById('log');
    const msg = 'Error al iniciar la app: ' + (err?.message || err);
    if (logEl) logEl.textContent = msg;
    console.error(msg, err);
  }
}

// Los scripts type="module" ya son diferidos, pero este guardado
// explícito garantiza que initUI nunca corra antes de que el DOM
// con #importImage y el resto de controles exista.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
