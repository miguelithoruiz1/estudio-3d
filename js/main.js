import * as THREE from 'three';
import { initScene, renderer, scene, camera, controls, resize, syncSelectionHelper } from './scene.js';
import { state, log } from './store.js';
import { initUI } from './ui.js';
import { updateEffects, addPrimitive } from './effects.js';
import { updateTracks } from './timeline.js';

function start() {
  try {
    const canvas = document.getElementById('viewport');
    if (!canvas) throw new Error('No se encontró el canvas #viewport.');
    initScene(canvas);
    initUI();
    new ResizeObserver(resize).observe(canvas.parentElement);
    resize();

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
      renderer.render(scene, camera);
    }

    addPrimitive('box');
    state.objects[state.objects.length - 1].name = 'Cubo inicial';
    updateTracks();
    log('Listo v0.10. Añade objetos, importa un modelo o genera uno gratis con Hugging Face (necesita tu token Read, guardado solo en tu navegador).');
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
