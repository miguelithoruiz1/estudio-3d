import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { state, log, notifyObjectsChange } from './store.js?v=0.15';

export let renderer, scene, camera, controls, transform, gridHelper;
export let initialEnvironment = null;
export const DARK_BACKGROUND = 0x0b0e14;
let selectionHelper = null;

export function initScene(canvas) {
  // v0.10: preserveDrawingBuffer:true para que toDataURL() no
  // devuelva una imagen negra, y alpha:true para que el canal
  // alfa (fondo transparente) sea extraíble en el PNG.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(DARK_BACKGROUND);
  // v0.9: entorno por defecto (RoomEnvironment) guardado para
  // poder restaurarlo si se quita un HDRI. No es el HDRI.
  initialEnvironment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = initialEnvironment;

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(5, 4, 7);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);

  gridHelper = new THREE.GridHelper(20, 20, 0x00e5ff, 0x243044);
  scene.add(gridHelper);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 8, 4);
  dir.castShadow = true;
  scene.add(dir);

  transform = new TransformControls(camera, renderer.domElement);
  transform.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
  // v0.8: el gizmo dispara 'change' en cada traslación, rotación
  // o escala; ahí se sincroniza el BoxHelper en tiempo real.
  transform.addEventListener('change', () => { syncSelectionHelper(); });
  scene.add(transform);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    // v0.7: raycasting recursivo, pero selección exclusivamente
    // del THREE.Mesh hijo interceptado, no del Group padre. En un
    // .glb, hits[0].object ya es la sub-malla tocada.
    const hits = ray.intersectObjects(state.objects, true);
    if (!hits.length) {
      // v0.8: clic en el fondo = deselección, con limpieza del
      // BoxHelper en select(null). No se deselecciona mientras el
      // gizmo está siendo arrastrado (su propio pointerdown corre
      // antes que este y ya marcó transform.dragging).
      if (!transform.dragging) select(null);
      return;
    }
    const hit = hits[0].object;
    if (hit.isMesh) select(hit);
    else {
      let o = hit;
      while (o.parent && !o.isMesh) o = o.parent;
      if (o.isMesh) select(o);
    }
  });
  return { renderer, scene, camera };
}

export function resize() {
  if (!renderer) return;
  const parent = renderer.domElement.parentElement;
  const w = parent.clientWidth;
  const h = Math.max(520, parent.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function standardMaterial(color = 0x00e5ff) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.5 });
}

export function register(obj, name) {
  obj.name = name;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(obj);
  state.objects.push(obj);
  select(obj);
  log('Añadido: ' + name);
  notifyObjectsChange();
  return obj;
}

// v0.6: normalización geométrica y encuadre de cámara adaptativo.
// 1) Bounding Box con THREE.Box3().setFromObject().
// 2) Escala para que el eje más largo mida exactamente 2 unidades
//    y centro de la geometría en el origen absoluto (0, 0, 0).
// 3) Encuadre trigonométrico: target de OrbitControls al centro del
//    modelo y cámara hacia atrás a lo largo del vector de visión
//    actual, con distancia = radio / (0.8 * sin(FOV_efectivo / 2)),
//    de modo que la malla ocupe el 80% del viewport. El FOV efectivo
//    es el menor entre el vertical y el horizontal (este último
//    derivado del aspect), para que la esfera encaje también en
//    viewports verticales. La dirección de vista se conserva: no se
//    salta a un ángulo por defecto, solo se retrocede.
// Devuelve { dimensions, center, radius, distance } o null si la
// caja está vacía o la cámara aún no está inicializada.
export function normalizeAndFrame(obj, { targetSize = 2, fill = 0.8 } = {}) {
  if (!obj) return null;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / longest;
  obj.scale.multiplyScalar(scale);
  obj.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(obj);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  // Llevar el centro mundial a (0, 0, 0): restar el centro escalado
  // de la posición del objeto (su padre es la escena).
  obj.position.sub(scaledCenter);
  obj.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(obj);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);
  const finalCenter = new THREE.Vector3();
  finalBox.getCenter(finalCenter);
  const sphere = new THREE.Sphere();
  finalBox.getBoundingSphere(sphere);
  let distance = null;
  if (camera && controls) {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const effectiveFov = Math.min(vFov, hFov);
    distance = sphere.radius / (fill * Math.sin(effectiveFov / 2));
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(1, 0.7, 1);
    direction.normalize();
    controls.target.copy(finalCenter);
    camera.position.copy(finalCenter).add(direction.multiplyScalar(distance));
    controls.update();
  }
  // v0.8: el BoxHelper que llega a pantalla es siempre el
  // post-normalización. register() crea uno transitorio al
  // seleccionar, pero normalizeAndFrame() lo recrea aquí, en el
  // mismo tick síncrono y antes del siguiente render, así que el
  // usuario nunca ve una caja con la escala o el centro viejos.
  if (state.selected) refreshSelectionHelper();
  return { dimensions: finalSize, center: finalCenter, radius: sphere.radius, distance };
}

// v0.8: ciclo de vida robusto del BoxHelper.
// - disposeSelectionHelper: removeFromParent() + dispose() de
//   geometría y material, para no dejar cajas fantasma ni fugas.
// - createSelectionHelper: destruye el anterior y crea el nuevo.
// - refreshSelectionHelper: recrea el helper de la selección
//   actual con sus matrices finales (tras normalizeAndFrame).
// - syncSelectionHelper: helper.update() en cada frame y en cada
//   evento 'change' del gizmo, para que siga a la malla en vivo.
export function disposeSelectionHelper() {
  if (!selectionHelper) return;
  selectionHelper.removeFromParent();
  selectionHelper.geometry?.dispose?.();
  selectionHelper.material?.dispose?.();
  selectionHelper = null;
}

export function createSelectionHelper(obj) {
  disposeSelectionHelper();
  if (!obj || !scene) return null;
  selectionHelper = new THREE.BoxHelper(obj, 0xff2e88);
  scene.add(selectionHelper);
  return selectionHelper;
}

export function refreshSelectionHelper() {
  if (!state.selected) return null;
  return createSelectionHelper(state.selected);
}

export function syncSelectionHelper() {
  if (selectionHelper) selectionHelper.update();
}

export function select(obj) {
  state.selected = obj;
  if (obj) transform.attach(obj);
  else transform.detach();
  // v0.7/v0.8: BoxHelper temporal magenta para la selección,
  // nunca registrado en state.objects, así que no aparece en el
  // Outliner ni se puede raycastear como objeto interactivo.
  // Cambiar de nodo o deseleccionar destruye el anterior.
  if (obj) createSelectionHelper(obj);
  else disposeSelectionHelper();
  const el = document.getElementById('selName');
  if (el) el.textContent = obj ? obj.name + ' (' + obj.type + ')' : 'Ninguno';
  // v0.7: el inspector refleja los valores actuales de la malla
  // seleccionada, no valores por defecto. Para un Group, no se
  // inventa un material: se pide elegir una malla hija.
  const colorInput = document.getElementById('matColor');
  const metalInput = document.getElementById('matMetal');
  const roughInput = document.getElementById('matRough');
  const infoEl = document.getElementById('matInfo');
  const mat = obj?.isMesh
    ? (Array.isArray(obj.material) ? obj.material[0] : obj.material)
    : null;
  if (mat) {
    if (mat.color && colorInput) colorInput.value = '#' + mat.color.getHexString();
    if (typeof mat.metalness === 'number' && metalInput) metalInput.value = String(mat.metalness);
    if (typeof mat.roughness === 'number' && roughInput) roughInput.value = String(mat.roughness);
    if (infoEl) {
      infoEl.textContent = `Material: ${mat.type || 'desconocido'}. Textura: ${mat.map ? 'sí, preservada (el color solo actúa como tinte)' : 'no'}.`;
    }
  } else if (infoEl) {
    infoEl.textContent = obj
      ? 'Grupo seleccionado: elige una malla hija en el Outliner o en el viewport para editar su material.'
      : 'Elige una malla para ver su material.';
  }
  if (typeof state.onSelectChange === 'function') state.onSelectChange(obj);
}

export function setTransformMode(mode) { transform.setMode(mode); }

export function removeSelected() {
  if (!state.selected) return;
  scene.remove(state.selected);
  state.objects = state.objects.filter((o) => o !== state.selected);
  select(null);
  notifyObjectsChange();
  log('Objeto eliminado.');
}

export function duplicateSelected() {
  if (!state.selected) return;
  const copy = state.selected.clone(true);
  copy.position.x += 1.2;
  register(copy, state.selected.name + ' copia');
}

export function applyMaterial(color, metalness, roughness) {
  if (!state.selected) return;
  // v0.7, granular y no destructivo: si lo seleccionado es una
  // Mesh, el ajuste afecta SOLO a esa malla, nunca a sus hermanas.
  // Solo un Group seleccionado en el Outliner aplica a todos sus
  // hijos, como ajuste de grupo explícito. En ningún caso se toca
  // material.map, no se reemplaza el material ni se elimina la
  // textura original: el color solo muta material.color, que en
  // PBR actúa como tinte multiplicador sobre la textura.
  const targets = [];
  if (state.selected.isMesh) {
    targets.push(state.selected);
  } else {
    state.selected.traverse((o) => { if (o.isMesh) targets.push(o); });
  }
  for (const mesh of targets) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      if (color !== undefined && m.color) m.color.set(color);
      if (metalness !== undefined && typeof m.metalness === 'number') m.metalness = metalness;
      if (roughness !== undefined && typeof m.roughness === 'number') m.roughness = roughness;
    }
  }
}
