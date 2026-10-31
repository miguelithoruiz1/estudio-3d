import * as THREE from 'three';
import { register, standardMaterial } from './scene.js';
import { state, log } from './store.js';

export function addPrimitive(kind) {
  let geo;
  if (kind === 'box') geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  if (kind === 'sphere') geo = new THREE.SphereGeometry(1, 48, 32);
  if (kind === 'cylinder') geo = new THREE.CylinderGeometry(0.7, 0.7, 2, 32);
  if (kind === 'torus') geo = new THREE.TorusGeometry(1, 0.35, 20, 48);
  const mesh = new THREE.Mesh(geo, standardMaterial());
  mesh.position.y = 1;
  return register(mesh, kind);
}

export function addParticles() {
  const count = 1200;
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 6;
    pos[i * 3 + 1] = Math.random() * 4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    vel.push((Math.random() - 0.5) * 0.8, Math.random() * 0.8 + 0.3, (Math.random() - 0.5) * 0.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x00e5ff, size: 0.06, transparent: true, opacity: 0.9 }));
  pts.userData.vel = vel;
  state.particles.push(pts);
  return register(pts, 'Partículas');
}

export function addTextMotion(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, 1024, 256);
  ctx.font = 'bold 84px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 24; ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 512, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 1.25),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  mesh.position.y = 2.2;
  mesh.userData.baseY = 2.2;
  state.texts.push(mesh);
  return register(mesh, 'Texto: ' + text);
}

export function addArm() {
  const group = new THREE.Group();
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), standardMaterial(0xff2e88));
  m1.position.y = -0.8; upper.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), standardMaterial(0x00e5ff));
  m2.position.y = -0.7; lower.add(m2);
  lower.position.y = -1.6; upper.add(lower); upper.position.y = 2; group.add(upper);
  group.userData = { upper, lower };
  state.lastArm = group;
  return register(group, 'Brazo articulado');
}

export function setShoulder(deg) {
  if (state.lastArm) state.lastArm.userData.upper.rotation.z = THREE.MathUtils.degToRad(deg);
}
export function setElbow(deg) {
  if (state.lastArm) state.lastArm.userData.lower.rotation.z = THREE.MathUtils.degToRad(-deg);
}

export function inflateSelected() {
  const selected = state.selected;
  if (!selected || !selected.isMesh) return;
  const p = selected.geometry.attributes.position;
  const n = selected.geometry.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * 0.08, p.getY(i) + n.getY(i) * 0.08, p.getZ(i) + n.getZ(i) * 0.08);
  }
  p.needsUpdate = true;
  selected.geometry.computeVertexNormals();
  log('Inflado aplicado al objeto seleccionado.');
}

export function updateEffects(dt, t) {
  for (const pts of state.particles) {
    const p = pts.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + pts.userData.vel[i * 3 + 1] * dt;
      if (y > 5) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + pts.userData.vel[i * 3] * dt);
    }
    p.needsUpdate = true;
  }
  for (const txt of state.texts) {
    txt.position.y = txt.userData.baseY + Math.sin(t * 2) * 0.15;
    txt.rotation.y = Math.sin(t * 0.6) * 0.15;
  }
}
