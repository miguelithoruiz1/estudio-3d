// v0.15: Aviso de compatibilidad AR al abrir el estudio.
//
// Qué comprueba, y solo eso: si la página es segura (HTTPS) y si
// el navegador ofrece una sesión WebXR 'immersive-ar'. No se lee
// ningún otro dato del dispositivo: ni modelo, ni sensores, ni
// ubicación, ni identificadores.
//
// El aviso aparece al cargar, ANTES de pulsar el botón AR y antes
// de cualquier intento de sesión, para que un teléfono sin AR no
// descubra el problema solo tras un fallo. Cuando AR no está
// disponible, el aviso nombra la alternativa concreta que ya
// existe en el estudio: el visor 3D de la misma página (girar,
// acercar y mover el modelo, y descargar una imagen PNG).
//
// La lógica pura (decideARCompat) no toca el DOM, para poder
// probarla en Node con un navegador simulado. renderARCompat
// solo escribe texto y un atributo de estado en el elemento
// que se le pasa.

export const AR_ALTERNATIVE = 'Alternativa en este mismo estudio: usa el visor 3D (gira con un dedo, acerca con dos dedos y mueve el modelo con Mover / Rotar / Escalar) o descarga una imagen con Renderizar Imagen (PNG).';

export function decideARCompat(nav) {
  // nav: { isSecureContext: boolean, xr: { isSessionSupported?: fn } | null | undefined }
  if (!nav || !nav.isSecureContext) {
    return {
      status: 'insecure',
      text: 'AR necesita una página segura (HTTPS). Abre esta misma página con HTTPS para usar AR. ' + AR_ALTERNATIVE,
    };
  }
  if (!nav.xr || typeof nav.xr.isSessionSupported !== 'function') {
    return {
      status: 'unsupported',
      text: 'AR no está disponible en este teléfono o navegador. ' + AR_ALTERNATIVE,
    };
  }
  return nav.xr.isSessionSupported('immersive-ar')
    .then((supported) => supported
      ? {
          status: 'available',
          text: 'AR disponible en este teléfono: pulsa el botón AR, apunta al suelo o a una mesa y toca para colocar el modelo. Con dos dedos lo escalas y lo giras.',
        }
      : {
          status: 'unsupported',
          text: 'AR no está disponible en este teléfono o navegador. ' + AR_ALTERNATIVE,
        })
    .catch(() => ({
      status: 'unknown',
      text: 'No se pudo comprobar si este teléfono puede usar AR. El botón AR te lo confirmará al pulsarlo. ' + AR_ALTERNATIVE,
    }));
}

export function renderARCompat(el, result) {
  if (!el) return null;
  el.textContent = result.text;
  if (el.dataset) el.dataset.status = result.status;
  return el;
}

export function initARCompat(doc) {
  const el = (doc || document).getElementById('arCompat');
  if (!el) return null;
  el.textContent = 'Comprobando si este teléfono puede usar AR…';
  if (el.dataset) el.dataset.status = 'checking';
  const nav = (typeof navigator !== 'undefined') ? navigator : null;
  const result = decideARCompat({
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    xr: nav ? nav.xr : null,
  });
  if (result && typeof result.then === 'function') {
    result.then((r) => renderARCompat(el, r));
  } else {
    renderARCompat(el, result);
  }
  return el;
}
