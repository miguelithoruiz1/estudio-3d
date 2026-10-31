import * as THREE from 'three';
import { initScene, renderer, scene, camera, controls, resize } from './scene.js';
import { state, log } from './store.js';
import { initUI } from './ui.js';
import { updateEffects, addPrimitive } from './effects.js';
import { updateTracks } from './timeline.js';

const canvas = document.getElementById('viewport');
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
  renderer.render(scene, camera);
}

addPrimitive('box');
state.objects[state.objects.length - 1].name = 'Cubo inicial';
updateTracks();
log('Listo v0.3. Añade objetos, importa un modelo o genera uno gratis con Hugging Face.');
animate();
