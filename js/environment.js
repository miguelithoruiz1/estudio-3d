// v0.9: Iluminación Basada en Imagen (IBL) con HDRI (.hdr).
//
// Flujo: RGBELoader lee el .hdr, PMREMGenerator pre-calcula los
// niveles de irradiancia (filtrado PBR) y la textura resultante
// se asigna a scene.environment, que ilumina todos los materiales
// PBR de la escena (un objeto metálico con metalness alto y
// rugosidad baja refleja ese entorno).
//
// Fondo: un checkbox decide si el HDRI también es el fondo
// visible (scene.background = textura HDRI equirectangular) o si
// el fondo permanece en color sólido oscuro (0x0b0e14), mientras
// la iluminación del entorno sigue activa en ambos casos.
//
// VRAM estricta: antes de cargar un nuevo HDRI, se hace dispose()
// de la textura HDRI anterior y de la textura PMREM anterior.
// El generador PMREM se reutiliza (no se destruye en cada carga,
// porque su dispose() liberaría recursos compartidos y obligaría
// a recrearlo); lo que se libera siempre son las dos texturas
// de cada HDRI. El HDRI nunca se sube al repositorio: solo vive
// en la memoria del navegador del usuario, como su token.

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { scene, renderer, DARK_BACKGROUND } from './scene.js?v=0.16';
import { log } from './store.js?v=0.16';

let pmremGenerator = null;
let currentHdrTexture = null;
let currentPmremTexture = null;
let showBackground = false;
let currentFileName = null;

export function disposeEnvironmentTextures() {
  if (currentHdrTexture) {
    currentHdrTexture.dispose();
    currentHdrTexture = null;
  }
  if (currentPmremTexture) {
    currentPmremTexture.dispose();
    currentPmremTexture = null;
  }
}

function applyBackground() {
  if (!scene) return;
  if (showBackground && currentHdrTexture) {
    scene.background = currentHdrTexture;
  } else {
    scene.background = new THREE.Color(DARK_BACKGROUND);
  }
}

export function setEnvironmentBackground(show) {
  showBackground = Boolean(show);
  applyBackground();
  log(showBackground
    ? 'Entorno: fondo HDRI visible (la iluminación del entorno sigue activa).'
    : 'Entorno: fondo sólido oscuro (la iluminación del entorno sigue activa).');
}

export function getEnvironmentState() {
  return {
    fileName: currentFileName,
    hasHdr: Boolean(currentHdrTexture),
    hasPmrem: Boolean(currentPmremTexture),
    showBackground,
  };
}

export async function loadEnvironmentFile(file) {
  if (!file) throw new Error('Elige un archivo .hdr en el panel de Entorno.');
  if (!/\.hdr$/i.test(file.name)) throw new Error('Formato no aceptado: usa un archivo .hdr.');
  if (!renderer || !scene) throw new Error('La escena aún no está inicializada.');
  // v0.9 VRAM: liberar el HDRI anterior ANTES de cargar el nuevo.
  // Primero se desengancha scene.environment de la textura PMREM
  // vieja, y luego se hace dispose() de ambas texturas, para que
  // un fallo de carga no deje la escena apuntando a una textura
  // ya liberada.
  const oldPmrem = currentPmremTexture;
  if (scene.environment === oldPmrem) scene.environment = null;
  disposeEnvironmentTextures();
  const url = URL.createObjectURL(file);
  try {
    const hdrTexture = await new RGBELoader().loadAsync(url);
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    // Sin colorSpace sRGB: el HDRI es lineal, PMREM lo filtra así.
    if (!pmremGenerator) {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
    }
    const pmremTexture = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    currentHdrTexture = hdrTexture;
    currentPmremTexture = pmremTexture;
    currentFileName = file.name;
    scene.environment = pmremTexture;
    applyBackground();
    return { fileName: file.name, hdrTexture, pmremTexture };
  } finally {
    URL.revokeObjectURL(url);
  }
}
