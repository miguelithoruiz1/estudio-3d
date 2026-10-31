import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { state, log, notifyObjectsChange } from './store.js';

export let renderer, scene, camera, controls, transform;

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(5, 4, 7);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);

  scene.add(new THREE.GridHelper(20, 20, 0x00e5ff, 0x243044));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 8, 4);
  dir.castShadow = true;
  scene.add(dir);

  transform = new TransformControls(camera, renderer.domElement);
  transform.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
  scene.add(transform);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(state.objects, true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o.parent && !state.objects.includes(o)) o = o.parent;
    select(o);
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

export function select(obj) {
  state.selected = obj;
  if (obj) transform.attach(obj);
  else transform.detach();
  const el = document.getElementById('selName');
  if (el) el.textContent = obj ? obj.name + ' (' + obj.type + ')' : 'Ninguno';
  const colorInput = document.getElementById('matColor');
  if (obj && obj.isMesh && obj.material && obj.material.color && colorInput) {
    colorInput.value = '#' + obj.material.color.getHexString();
  }
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
  state.selected.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (color !== undefined) o.material.color.set(color);
    if (metalness !== undefined) o.material.metalness = metalness;
    if (roughness !== undefined) o.material.roughness = roughness;
  });
}
