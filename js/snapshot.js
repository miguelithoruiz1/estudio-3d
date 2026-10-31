// v0.10: Motor de Renderizado Final (Snapshot PNG).
//
// Pasos exactos, en orden:
// a) Guardar pixelRatio y tamaño actuales.
// b) Aumentar temporalmente el tamaño del renderizador al factor
//    elegido (2x o 4x) para supersampling / anti-aliasing.
// c) Forzar un renderer.render(scene, camera).
// d) Extraer canvas.toDataURL('image/png', 1.0) y descargar
//    render_estudio3d.png.
// e) Restaurar la resolución y el ratio originales
//    inmediatamente, en finally, para no asfixiar la GPU.
//
// Canal alfa: si "Fondo Transparente" está marcado, se oculta
// temporalmente scene.background y la grilla (GridHelper) justo
// antes del render, y se restauran al finalizar. scene.environment
// NO se toca en ningún caso, así que la iluminación PBR/IBL no
// cambia entre la vista normal y el snapshot transparente.
// El renderer ya se instancia con preserveDrawingBuffer:true y
// alpha:true en scene.js; sin preserveDrawingBuffer, toDataURL()
// devolvería una imagen negra.

import * as THREE from 'three';
import { renderer, scene, camera, gridHelper } from './scene.js';

export function renderSnapshot({ scale = 2, transparent = false } = {}) {
  if (!renderer || !scene || !camera) throw new Error('La escena aún no está inicializada.');
  const factor = scale === 4 ? 4 : 2;
  const canvas = renderer.domElement;
  const originalPixelRatio = renderer.getPixelRatio();
  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalAspect = camera.aspect;
  const originalBackground = scene.background;
  const originalClearAlpha = renderer.getClearAlpha();
  const gridWasVisible = gridHelper ? gridHelper.visible : false;
  try {
    if (transparent) {
      scene.background = null;
      if (gridHelper) gridHelper.visible = false;
      renderer.setClearAlpha(0);
    }
    const w = Math.round(originalSize.x * factor);
    const h = Math.round(originalSize.y * factor);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png', 1.0);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'render_estudio3d.png';
    a.click();
    return { dataURL, width: w, height: h, scale: factor, transparent };
  } finally {
    // Restauración inmediata, incluso si la captura falló.
    if (transparent) {
      scene.background = originalBackground;
      if (gridHelper) gridHelper.visible = gridWasVisible;
      renderer.setClearAlpha(originalClearAlpha);
    }
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalSize.x, originalSize.y, false);
    camera.aspect = originalAspect;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
}
