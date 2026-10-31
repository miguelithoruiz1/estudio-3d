// Test Node de la v0.5 (sin navegador, sin token real).
// Comprueba: campo password #hfToken, persistencia solo en
// localStorage, Client.connect con hf_token, advertencia si falta,
// y que ningún archivo del proyecto contenga un token hardcodeado
// ni registre el valor del token.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.5: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
if (!html.includes('id="hfToken"')) fail('falta #hfToken en index.html');
if (!/type="password"[^>]*id="hfToken"|id="hfToken"[^>]*type="password"/.test(html)) fail('#hfToken no es type="password"');
if (!html.includes('id="clearHfToken"')) fail('falta botón #clearHfToken');
if (!html.includes('v0.5')) fail('index.html no marca v0.5');

const hf = read('js/hf3d.js');
if (!hf.includes("getHfToken()")) fail('hf3d.js no lee el token');
if (!hf.includes('Falta el Hugging Face Token')) fail('hf3d.js no advierte si falta el token');
if (!hf.includes("Client.connect('stabilityai/stable-fast-3d', { hf_token: hfToken })")) fail('SF3D no pasa hf_token');
if (!hf.includes("Client.connect('VAST-AI/TripoSR', { hf_token: hfToken })")) fail('TripoSR no pasa hf_token');
if (/log\([^)]*hfToken/.test(hf)) fail('hf3d.js registra el token en #log');

const tokenMod = read('js/hf-token.js');
if (!tokenMod.includes('localStorage')) fail('hf-token.js no usa localStorage');
if (!tokenMod.includes('estudio3d_hf_token')) fail('hf-token.js no define la clave localStorage');

const ui = read('js/ui.js');
if (!ui.includes('hf-token.js')) fail('ui.js no importa hf-token.js');
if (!ui.includes("bind('hfToken'")) fail('ui.js no enlaza #hfToken');
if (!ui.includes("bind('clearHfToken'")) fail('ui.js no enlaza #clearHfToken');
if (/log\([^)]*hfTokenEl\.value|log\([^)]*getHfToken\(\)/.test(ui)) fail('ui.js registra el valor del token');

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (name === 'index-v01.html') continue; // v0.1 solo local, nunca se sube al repo.
    if (!/\.(html|js|md|css)$/.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    // Un token real empieza por hf_ y tiene decenas de caracteres.
    // La mención "hf_…" del placeholder y "hf_token" como nombre de
    // parámetro no son credenciales.
    const cleaned = text.replace('hf_…', '').replaceAll('hf_token', '');
    if (/hf_[A-Za-z0-9]{20,}/.test(cleaned)) fail('posible token hardcodeado en ' + p);
    if (/HF_TOKEN\s*=|process\.env/.test(text)) fail('credencial simulada o variable de entorno en ' + p);
  }
}
walk(root);

const main = read('js/main.js');
if (!main.includes('v0.5')) fail('main.js no marca v0.5');
console.log('v0.5 OK: campo password, localStorage, hf_token en Client.connect, advertencia sin token, sin token hardcodeado.');
