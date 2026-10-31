// v0.13: Mapeo Espacial y AR (WebXR, hit-test).
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
import { scene, gridHelper, refreshSelectionHelper } from './scene.js?v=0.13';
import { state, log } from './store.js?v=0.13';

let xrRenderer = null;
let reticle = null;
let controller = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let savedBackground = null;
let savedGridVisible = true;
let savedUIDisplays = [];

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
