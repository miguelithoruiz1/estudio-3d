// v0.13: Mapeo Espacial y AR (WebXR, hit-test).
// v0.14: Interacción Espacial y Gestos AR (DOM Overlay + multitáctil).
//
// Flujo estándar de WebXR (ejemplo hit-test de Three.js):
// - ARButton con requiredFeatures: ['hit-test'] crea la sesión
//   inmersiva AR. Sin un dispositivo/navegador AR compatible, el
//   botón muestra "AR NOT SUPPORTED": eso es esperado en escritorio,
//   no un fallo de la app.
// - El retículo es un anillo 3D (RingGeometry) con matrixAutoUpdate
//   en false: su matriz se escribe directamente desde la pose del
//   hit-test, así que se adhiere a la superficie física detectada
//   (suelo, mesa) en el centro de la cámara (espacio 'viewer').
// - Al tocar la pantalla, el controlador WebXR dispara 'select' y
//   el objeto colocable actual se desplaza instantáneamente a la
//   posición del retículo (sin cambiar su escala ni rotación).
//
// Objeto colocable: state.selected si lo hay. Si lo seleccionado
// es una malla hija de un .glb (selección granular v0.7), se sube
// por la jerarquía hasta el objeto de nivel superior en la escena,
// para mover el .glb completo y no desgajar una sola malla.
//
// Guardrails AR:
// - EffectComposer NO es compatible con WebXR (renderiza a sus
//   propios targets y taparía la cámara real / rompería la cámara
//   XR). Por eso main.js usa renderer.render() directo mientras
//   haya sesión XR activa (isARSessionActive()), y vuelve a
//   composer.render() al terminar la sesión.
// - En sesión AR, scene.background debe ser null para que se vea
//   la cámara real (el fondo oscuro #0b0e14 la taparía), y la
//   rejilla se oculta (flotaría en el aire sin anclaje). Ambos se
//   restauran en sessionend.
// - Los paneles HTML (el <aside> contiene Outliner, VFX,
//   Importación y el resto; más header y timeline) se ocultan en
//   sessionstart y se restauran en sessionend, para despejar la
//   pantalla del móvil durante la inmersión.

import * as THREE from 'three';
import { scene, gridHelper, refreshSelectionHelper } from './scene.js?v=0.14';
import { state, log } from './store.js?v=0.14';

let xrRenderer = null;
let reticle = null;
let controller = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let savedBackground = null;
let savedGridVisible = true;
let savedUIDisplays = [];

// v0.14: estado del gesto multitáctil. Se guarda la escala inicial
// del modelo al empezar el pinch, para que el factor sea relativo
// a ese momento y no se acumule error en cada touchmove.
let pinchInitialDistance = null;
let pinchInitialAngle = null;
let pinchPreviousAngle = null;
let pinchInitialScale = null;

function touchDistance(t0, t1) {
  return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
}

function touchAngle(t0, t1) {
  return Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
}

function normalizeAngleDelta(delta) {
  // Llevar el delta a [-PI, PI] para no saltar al cruzar -PI/PI.
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function resetPinchState() {
  pinchInitialDistance = null;
  pinchInitialAngle = null;
  pinchPreviousAngle = null;
  pinchInitialScale = null;
}

function onTouchStart(e) {
  if (!isARSessionActive()) return;
  if (e.touches.length === 2) {
    const placeable = getPlaceableObject(state.selected);
    if (!placeable) return;
    pinchInitialDistance = touchDistance(e.touches[0], e.touches[1]);
    pinchInitialAngle = touchAngle(e.touches[0], e.touches[1]);
    pinchPreviousAngle = pinchInitialAngle;
    pinchInitialScale = placeable.scale.clone();
    e.preventDefault();
  } else if (e.touches.length === 1) {
    // 1 toque: colocar / arrastrar al retículo (ver touchmove).
    placeSelectedAtReticle();
  }
}

function onTouchMove(e) {
  if (!isARSessionActive()) return;
  // touch-action:none en CSS + preventDefault con passive:false
  // evitan que el navegador robe el gesto con su zoom/scroll.
  e.preventDefault();
  if (e.touches.length === 2) {
    const placeable = getPlaceableObject(state.selected);
    if (!placeable) return;
    if (pinchInitialDistance === null) {
      // Segundo dedo añadido sin un touchstart de 2: inicializar aquí.
      pinchInitialDistance = touchDistance(e.touches[0], e.touches[1]);
      pinchInitialAngle = touchAngle(e.touches[0], e.touches[1]);
      pinchPreviousAngle = pinchInitialAngle;
      pinchInitialScale = placeable.scale.clone();
      return;
    }
    const currentDistance = touchDistance(e.touches[0], e.touches[1]);
    if (pinchInitialDistance > 0) {
      const factor = currentDistance / pinchInitialDistance;
      // Guardrail v0.14: clamp por eje entre 0.1 y 10, para que un
      // gesto brusco no deje el modelo microscópico ni titánico.
      placeable.scale.set(
        THREE.MathUtils.clamp(pinchInitialScale.x * factor, 0.1, 10),
        THREE.MathUtils.clamp(pinchInitialScale.y * factor, 0.1, 10),
        THREE.MathUtils.clamp(pinchInitialScale.z * factor, 0.1, 10),
      );
    }
    const currentAngle = touchAngle(e.touches[0], e.touches[1]);
    placeable.rotation.y += normalizeAngleDelta(currentAngle - pinchPreviousAngle);
    pinchPreviousAngle = currentAngle;
    placeable.updateMatrixWorld(true);
    if (state.selected) refreshSelectionHelper();
  } else if (e.touches.length === 1) {
    // 1 toque en movimiento: reposicionar dinámicamente mientras
    // el retículo siga visible sobre una superficie física.
    placeSelectedAtReticle();
  }
}

function onTouchEnd(e) {
  if (e.touches.length < 2) resetPinchState();
}

export function createReticle(targetScene) {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  targetScene.add(reticle);
  return reticle;
}

export function isARSessionActive() {
  try {
    return Boolean(xrRenderer && xrRenderer.xr && xrRenderer.xr.getSession());
  } catch {
    return false;
  }
}

export function getReticle() {
  return reticle;
}

function getPlaceableObject(obj) {
  if (!obj) return null;
  let current = obj;
  // Subir hasta el objeto cuyo padre es la escena (o sin padre).
  while (current.parent && current.parent !== scene) {
    current = current.parent;
  }
  return current;
}

export function placeSelectedAtReticle() {
  if (!reticle || !reticle.visible) return null;
  const placeable = getPlaceableObject(state.selected);
  if (!placeable) {
    log('AR: no hay un modelo seleccionado para colocar. Selecciona uno antes de tocar la pantalla.');
    return null;
  }
  const position = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
  placeable.position.copy(position);
  placeable.updateMatrixWorld(true);
  if (state.selected) refreshSelectionHelper();
  log(`AR: ${placeable.name || 'modelo'} colocado en (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}).`);
  return placeable;
}

function onARSelect() {
  placeSelectedAtReticle();
}

function hidePanelsForAR() {
  savedUIDisplays = [];
  for (const el of document.querySelectorAll('aside, header, .timeline')) {
    savedUIDisplays.push([el, el.style.display]);
    el.style.display = 'none';
  }
}

function restorePanelsAfterAR() {
  for (const [el, display] of savedUIDisplays) {
    el.style.display = display;
  }
  savedUIDisplays = [];
}

function onSessionStart() {
  const overlay = document.getElementById('arOverlay');
  if (overlay) overlay.style.display = 'block';
  hidePanelsForAR();
  savedBackground = scene.background;
  scene.background = null;
  savedGridVisible = gridHelper ? gridHelper.visible : true;
  if (gridHelper) gridHelper.visible = false;
  hitTestSource = null;
  hitTestSourceRequested = false;
  log('Sesión AR iniciada: apunta al suelo o a una mesa y toca la pantalla para colocar el modelo seleccionado en el retículo.');
}

function onSessionEnd() {
  const overlay = document.getElementById('arOverlay');
  if (overlay) overlay.style.display = 'none';
  resetPinchState();
  restorePanelsAfterAR();
  scene.background = savedBackground;
  if (gridHelper) gridHelper.visible = savedGridVisible;
  if (reticle) reticle.visible = false;
  hitTestSource = null;
  hitTestSourceRequested = false;
  log('Sesión AR terminada: paneles, fondo y rejilla restaurados.');
}

export function initAR(renderer, targetScene) {
  xrRenderer = renderer;
  createReticle(targetScene);
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onARSelect);
  targetScene.add(controller);
  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);
  // v0.14: gestos multitáctiles sobre la capa DOM Overlay. Sin
  // overlay, los toques irían al controlador XR (select) y el
  // navegador podría bloquearlos; con overlay, llegan como
  // eventos táctiles tradicionales. El 'select' de v0.13 se
  // mantiene como respaldo para dispositivos sin dom-overlay.
  // passive:false es obligatorio para que preventDefault funcione.
  const overlay = document.getElementById('arOverlay');
  if (overlay) {
    overlay.addEventListener('touchstart', onTouchStart, { passive: false });
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });
    overlay.addEventListener('touchend', onTouchEnd);
    overlay.addEventListener('touchcancel', onTouchEnd);
  }
  return { reticle, controller };
}

export function updateARHitTest(frame) {
  if (!frame || !xrRenderer) return;
  const session = xrRenderer.xr.getSession();
  if (!session) return;
  if (!hitTestSourceRequested) {
    session.requestReferenceSpace('viewer')
      .then((refSpace) => session.requestHitTestSource({ space: refSpace }))
      .then((source) => { hitTestSource = source; })
      .catch((err) => console.warn('Hit-test no disponible:', err));
    hitTestSourceRequested = true;
    return;
  }
  if (!hitTestSource) return;
  const referenceSpace = xrRenderer.xr.getReferenceSpace();
  if (!referenceSpace) return;
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const hit = results[0];
    const pose = hit.getPose(referenceSpace);
    if (pose) {
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      return;
    }
  }
  reticle.visible = false;
}
