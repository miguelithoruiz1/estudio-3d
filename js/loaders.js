import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { scene, register, normalizeAndFrame } from './scene.js';
import { log } from './store.js';

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

// Carga un .glb desde una URL remota (por ejemplo, la que devuelve
// Meshy o Tripo) y lo inyecta en la escena. La URL firmada no lleva
// la clave de API: el cliente la obtiene del polling, no del navegador
// con credenciales adjuntas en esta llamada.
// v0.6: todo modelo inyectado pasa por la misma normalización
// que la generación gratuita: eje mayor 2, centro en (0,0,0) y
// cámara encuadrada al 80%. El antiguo position.y = 1 queda
// sustituido por ese centrado en el origen.
function frameImported(obj) {
  const framing = normalizeAndFrame(obj);
  if (framing?.dimensions) {
    const d = framing.dimensions;
    log(`Modelo normalizado en (0, 0, 0). Dimensiones finales: ${d.x.toFixed(2)} x ${d.y.toFixed(2)} x ${d.z.toFixed(2)} (eje mayor 2.00). Cámara encuadrada al 80%.`);
  }
  return framing;
}

export function loadGLBFromURL(url, name = 'Modelo IA') {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => {
      const obj = gltf.scene;
      register(obj, name);
      frameImported(obj);
      resolve(obj);
    }, undefined, (err) => reject(new Error(err?.message || 'No se pudo cargar el GLB')));
  });
}

export function loadModelFile(file) {
  const url = URL.createObjectURL(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const done = (o) => { register(o, file.name); frameImported(o); };
  if (ext === 'glb' || ext === 'gltf') {
    new GLTFLoader().load(url, (g) => done(g.scene), undefined, (e) => log('Error GLTF: ' + e.message));
  } else if (ext === 'obj') {
    new OBJLoader().load(url, done, undefined, (e) => log('Error OBJ: ' + e.message));
  } else if (ext === 'fbx') {
    new FBXLoader().load(url, done, undefined, (e) => log('Error FBX: ' + e.message));
  } else {
    log('Formato no soportado: ' + ext);
  }
}

export function exportGLB() {
  new GLTFExporter().parse(scene, (g) => {
    const blob = g instanceof ArrayBuffer
      ? new Blob([g], { type: 'model/gltf-binary' })
      : new Blob([JSON.stringify(g)], { type: 'application/json' });
    download(blob, 'escena.glb');
    log('Exportado escena.glb');
  }, (e) => log('Error al exportar GLB: ' + e.message), { binary: true });
}

export function exportOBJ() {
  const text = new OBJExporter().parse(scene);
  download(new Blob([text], { type: 'text/plain' }), 'escena.obj');
  log('Exportado escena.obj');
}
