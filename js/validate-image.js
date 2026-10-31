// Validación pura, sin DOM, para poder probarla en Node.
// Reglas de Stable Fast 3D: JPG/PNG/WebP, cada lado >= 64 px,
// total de píxeles entre 4.096 y 4.194.304.
export function validateImageMeta({ type, width, height }) {
  if (!/^image\/(jpeg|png|webp)$/.test(type || '')) {
    return 'Formato no aceptado: usa JPG, PNG o WebP.';
  }
  if (!width || !height) {
    return 'No se pudieron leer las dimensiones de la imagen.';
  }
  if (width < 64 || height < 64) {
    return `Imagen demasiado pequeña: ${width}x${height}. Cada lado debe tener al menos 64 px.`;
  }
  const pixels = width * height;
  if (pixels < 4096 || pixels > 4194304) {
    return `Tamaño en píxeles fuera de rango: ${pixels} px. Debe estar entre 4.096 y 4.194.304.`;
  }
  return null;
}

// Solo navegador: lee dimensiones reales de un File sin subirlo.
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen en el navegador.')); };
    img.src = url;
  });
}
