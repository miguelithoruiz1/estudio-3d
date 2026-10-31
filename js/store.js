// Estado compartido de la v0.2. Ningún módulo guarda claves de API aquí:
// la clave que el usuario escribe en la interfaz vive solo en memoria
// durante la sesión del navegador y nunca se escribe en un archivo.
export const state = {
  objects: [],
  selected: null,
  keyframes: new Map(),
  particles: [],
  texts: [],
  lastArm: null,
  playing: false,
  currentTime: 0,
  duration: 10,
  onObjectsChange: null,
};

let logFn = (msg) => console.log(msg);
export function setLogger(fn) { logFn = fn; }
export function log(msg) { logFn(msg); }
export function notifyObjectsChange() {
  if (typeof state.onObjectsChange === 'function') state.onObjectsChange();
}
