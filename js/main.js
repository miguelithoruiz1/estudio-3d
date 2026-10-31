import * as THREE from 'three';
import { initScene, renderer, scene, camera, controls, resize, syncSelectionHelper } from './scene.js?v=0.13';
import { state, log } from './store.js?v=0.13';
import { initUI } from './ui.js?v=0.13';
import { initVFX, renderVFX, syncVFXSize, isVFXReady, getBloomState } from './vfx.js?v=0.13';
import { updateEffects, addPrimitive } from './effects.js?v=0.13';
import { updateTracks } from './timeline.js?v=0.13';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { initAR, updateARHitTest, isARSessionActive } from './ar.js?v=0.13';

function start() {
  try {
    const canvas = document.getElementById('viewport');
    if (!canvas) throw new Error('No se encontró el canvas #viewport.');
    initScene(canvas);
    // v0.13: WebXR AR. renderer.xr.enabled = true es obligatorio
    // para sesiones inmersivas; ARButton con hit-test crea la
    // sesión. En escritorio sin AR, el botón muestra
    // "AR NOT SUPPORTED": esperado, no un fallo. No fatal: si
    // ARButton falla, la app sigue funcionando sin AR.
    try {
      renderer.xr.enabled = true;
      document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));
      initAR(renderer, scene);
    } catch (arErr) {
      console.warn('AR no disponible:', arErr);
    }
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
    // v0.13: setAnimationLoop en lugar de requestAnimationFrame:
    // es el bucle que WebXR exige (recibe el XRFrame como segundo
    // argumento) y funciona igual sin XR. Por eso animate ya no
    // se llama a sí misma con requestAnimationFrame.
    function animate(_time, frame) {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (typeof state.tickPlayback === 'function') state.tickPlayback();
      updateEffects(dt, t);
      // En AR, la cámara la controla WebXR: no se aplica
      // OrbitControls, para no pelear con la cámara XR.
      if (!isARSessionActive()) controls.update();
      // v0.13: hit-testing cada frame, con el XRFrame de la sesión.
      updateARHitTest(frame);
      // v0.8: sincronización por frame del BoxHelper, además del
      // evento 'change' del gizmo, para que siga a la malla en vivo.
      syncSelectionHelper();
      // v0.13: en sesión AR, render directo (EffectComposer no es
      // compatible con WebXR y taparía la cámara real). Sin AR,
      // v0.11: renderVFX() llama a composer.render() (RenderPass +
      // UnrealBloomPass + OutputPass) y, solo si el compositor
      // no se pudo inicializar, cae a renderer.render().
      if (isARSessionActive()) {
        renderer.render(scene, camera);
      } else {
        renderVFX(renderer, scene, camera);
      }
    }

    addPrimitive('box');
    state.objects[state.objects.length - 1].name = 'Cubo inicial';
    updateTracks();
    // v0.13: log de inicio con la versión y el estado AR/VFX.
    log(isVFXReady()
      ? `Listo v0.13. Motor VFX activo, AR WebXR listo (botón AR con hit-test). (Bloom ${getBloomState().enabled ? 'activo' : 'inactivo'}, strength ${getBloomState().strength}). Añade objetos, importa un modelo o genera uno gratis con Hugging Face (necesita tu token Read, guardado solo en tu navegador).`
      : 'Listo v0.13. Motor VFX no disponible, render directo, AR WebXR listo (botón AR con hit-test). Añade objetos, importa un modelo o genera uno gratis con Hugging Face (necesita tu token Read, guardado solo en tu navegador).');
    window.__estudioReady = true;
    renderer.setAnimationLoop(animate);
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
