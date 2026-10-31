// v0.5: token de Hugging Face, solo en el navegador del usuario.
//
// Guardrail absoluto: este módulo NUNCA escribe el token en ningún
// archivo, en la consola, en #log, en #hfStatus ni en ninguna
// petición que no sea la conexión de @gradio/client con el Space
// elegido. El único almacenamiento es localStorage del navegador
// del usuario, con la clave de abajo. Borrar el campo o pulsar
// "Borrar token guardado" lo elimina de localStorage.
//
// El token nunca se hardcodea: no existe ningún valor hf_ en el
// repositorio, y el código solo lee lo que el usuario escribió
// en el campo de contraseña #hfToken.

export const HF_TOKEN_KEY = 'estudio3d_hf_token';

export function getHfToken() {
  try {
    const value = localStorage.getItem(HF_TOKEN_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function saveHfToken(token) {
  try {
    if (!token || !token.trim()) {
      localStorage.removeItem(HF_TOKEN_KEY);
      return false;
    }
    localStorage.setItem(HF_TOKEN_KEY, token.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearHfToken() {
  try {
    localStorage.removeItem(HF_TOKEN_KEY);
  } catch {
    // Sin acceso a localStorage, no hay nada persistido que borrar.
  }
}
