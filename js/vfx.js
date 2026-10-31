// v0.11: Pipeline de Post-Procesamiento y VFX (EffectComposer).
//
// Cadena: RenderPass (escena base) -> UnrealBloomPass (resplandor
// sutil) -> OutputPass (tone mapping ACES + sRGB, para que el
// compositor no rompa el pipeline PBR: sin OutputPass, renderizar
// a un render target perdería el tone mapping y la conversión de
// color que renderer.render() aplica al renderizar a pantalla).
//
// Configuración sutil por defecto, para que solo los metales muy
// iluminados o colores puros resplandezcan:
//   threshold: 0.8, strength: 0.3, radius: 0.5
// El constructor de UnrealBloomPass es (resolución, strength,
// radius, threshold), en ese orden.
//
// Toggle: bloomPass.enabled = false deja RenderPass + OutputPass,
// con el mismo tono PBR que sin compositor. El bucle principal
// siempre usa composer.render() cuando el compositor existe;
// si initVFX falla (CDN), main.js cae a renderer.render() directo
// y la app no se rompe.
//
// Snapshot sync: snapshot.js usa renderVFX() y syncVFXSize() para
// que la captura 2x/4x imprima los efectos en el PNG final.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let composer = null;
let renderPass = null;
let bloomPass = null;
let outputPass = null;

export const BLOOM_DEFAULTS = { threshold: 0.8, strength: 0.3, radius: 0.5 };

export function initVFX(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);
  renderPass = new RenderPass(scene, camera);
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    BLOOM_DEFAULTS.strength,
    BLOOM_DEFAULTS.radius,
    BLOOM_DEFAULTS.threshold,
  );
  bloomPass.enabled = true;
  outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  return composer;
}

export function isVFXReady() {
  return Boolean(composer);
}

export function getBloomState() {
  if (!bloomPass) return { enabled: false, ...BLOOM_DEFAULTS };
  return {
    enabled: bloomPass.enabled,
    strength: bloomPass.strength,
    radius: bloomPass.radius,
    threshold: bloomPass.threshold,
  };
}

export function setBloomEnabled(enabled) {
  if (!bloomPass) return false;
  bloomPass.enabled = Boolean(enabled);
  return bloomPass.enabled;
}

export function setBloomStrength(value) {
  if (!bloomPass) return null;
  bloomPass.strength = Math.max(0, Math.min(2, Number(value) || 0));
  return bloomPass.strength;
}

export function syncVFXSize() {
  if (!composer) return;
  // El renderer ya tiene el tamaño actual (normal o supersampling
  // en snapshot); el compositor debe seguirlo, con su pixelRatio.
  const renderer = composer.renderer;
  const size = renderer.getSize(new THREE.Vector2());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);
}

export function renderVFX(renderer, scene, camera) {
  if (composer) {
    composer.render();
    return 'composer';
  }
  renderer.render(scene, camera);
  return 'renderer';
}
