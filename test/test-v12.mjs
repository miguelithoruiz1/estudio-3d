// Test Node de la v0.12 (Cache Busting).
// Comprueba: entrada y CSS con ?v=0.12, TODAS las importaciones
// locales con ?v=0.12 (sin excepción), ninguna importación local
// sin versión, ninguna importación externa (three/@gradio) con
// versión local, y log de inicio con la frase exacta.
// Razón: en ES Modules, una importación relativa './scene.js'
// resuelta desde 'js/main.js?v=0.12' pierde el query string y
// queda como 'js/scene.js', así que versionar solo la entrada
// NO rompe la caché de los módulos internos. Por eso la versión
// debe ir en cada importación local.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.12: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
if (!html.includes('src="js/main.js?v=0.12"')) fail('index.html no tiene src="js/main.js?v=0.12"');
if (!html.includes('href="styles.css?v=0.12"')) fail('index.html no tiene href="styles.css?v=0.12"');
if (!html.includes('v0.12')) fail('index.html no marca v0.12');

const main = read('js/main.js');
if (!main.includes('Listo v0.12. Motor VFX activo.')) fail('main.js no imprime "Listo v0.12. Motor VFX activo."');

let versioned = 0;
for (const file of readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const text = read('js/' + file);
  const localImports = [...text.matchAll(/from\s+'(\.\/[^']+)'/g)].map((m) => m[1]);
  for (const spec of localImports) {
    if (!spec.endsWith('.js?v=0.12')) fail(`${file} tiene importación local sin ?v=0.12: ${spec}`);
    versioned++;
  }
  // Ninguna importación externa debe llevar la versión local.
  if (/from\s+'(three|@gradio)[^']*\?v=/.test(text)) fail(`${file} versiona una importación externa (three/@gradio)`);
  // Importación dinámica local, si la hubiera, también debe versionarse.
  const dynLocal = [...text.matchAll(/import\(['"](\.\/[^'"]+)['"]\)/g)].map((m) => m[1]);
  for (const spec of dynLocal) {
    if (!spec.endsWith('.js?v=0.12')) fail(`${file} tiene importación dinámica local sin ?v=0.12: ${spec}`);
  }
}
if (versioned < 30) fail(`solo ${versioned} importaciones locales versionadas, se esperaban 36`);
console.log(`v0.12 OK: entrada + CSS con ?v=0.12, ${versioned} importaciones locales con ?v=0.12, 0 sin versión, log "Listo v0.12. Motor VFX activo.".`);
