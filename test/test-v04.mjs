// Test v0.4 ejecutable con Node, sin navegador.
// Comprueba: validación de imagen, IDs del DOM, bindings y errores visibles.
import fs from 'node:fs';
import assert from 'node:assert';
import { validateImageMeta } from '../js/validate-image.js';

const root = new URL('..', import.meta.url).pathname;
const html = fs.readFileSync(root + 'index.html', 'utf8');
const ui = fs.readFileSync(root + 'js/ui.js', 'utf8');
const hf = fs.readFileSync(root + 'js/hf3d.js', 'utf8');
const main = fs.readFileSync(root + 'js/main.js', 'utf8');

// 1. Validación pura
assert.strictEqual(validateImageMeta({ type: 'image/png', width: 256, height: 256 }), null, '256x256 PNG debe pasar');
assert.match(validateImageMeta({ type: 'image/gif', width: 256, height: 256 }), /JPG, PNG/);
assert.match(validateImageMeta({ type: 'image/png', width: 10, height: 10 }), /64 px/);
assert.match(validateImageMeta({ type: 'image/png', width: 5000, height: 5000 }), /píxeles/);

// 2. #importImage existe en HTML y tiene change en ui.js
assert.ok(html.includes('id="importImage"'), 'index.html debe tener id="importImage"');
assert.ok(!html.includes('id="hfImageFile"'), 'hfImageFile debe haber sido sustituido por importImage');
assert.ok(/importImage.*change|bind\('importImage', 'change'/.test(ui), 'ui.js debe enlazar change de #importImage');
assert.ok(ui.includes('startFreeGeneration'), 'ui.js debe compartir la función de inicio entre change y botón');
assert.ok(ui.includes("bind('generateFreeAI', 'click'"), 'el botón debe seguir enlazado');

// 3. Gradio ya no es import estático y todo fallo va a #log
assert.ok(!/^import .*@gradio\/client/m.test(hf), 'hf3d.js no debe importar @gradio/client en cabecera');
assert.ok(hf.includes("import('@gradio/client')"), 'hf3d.js debe cargar @gradio/client de forma perezosa');
assert.ok(hf.includes('try') && hf.includes('catch'), 'hf3d.js debe tener try/catch');
assert.ok(ui.includes("window.addEventListener('error'") || ui.includes('unhandledrejection'), 'ui.js debe mostrar errores no controlados en #log');
assert.ok(html.includes('id="log"'), 'index.html debe tener #log');
assert.ok(main.includes('DOMContentLoaded') && main.includes('__estudioReady'), 'main.js debe usar DOMContentLoaded y marcar arranque listo');

// 4. Todos los ids referenciados en ui.js existen en HTML
const ids = [...new Set([...ui.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]))];
const missing = ids.filter((id) => !html.includes(`id="${id}"`));
assert.deepStrictEqual(missing, [], `ids referenciados en ui.js que faltan en HTML: ${missing.join(', ')}`);

// 5. No queda io.js local
assert.ok(!fs.existsSync(root + 'js/io.js'), 'js/io.js no debe existir en local');
assert.ok(fs.existsSync(root + 'js/loaders.js'), 'js/loaders.js debe existir');
assert.ok(fs.existsSync(root + 'test/test-image-256.png'), 'imagen de prueba local debe existir');

console.log(`v0.4 OK: validación, #importImage+change, gradio lazy, errores en #log, ${ids.length} ids verificados, sin io.js local.`);
