// Test Node de la v0.11 (sin navegador, sin WebGL).
// Comprueba: EffectComposer + RenderPass + UnrealBloomPass con la
// configuración sutil exacta, OutputPass para no romper el PBR,
// bucle con composer.render(), panel VFX con toggle y slider, y
// Snapshot Sync (captura con composer.render() si VFX activo).
// El render real con GPU y la medición de FPS quedan para el
// navegador: aquí se verifica el código y, aparte, la misma
// secuencia con un compositor simulado (mock) en
// /tmp/glbtest/verify-vfx.mjs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fail = (msg) => { console.error('FAIL v0.11: ' + msg); process.exit(1); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const vfx = read('js/vfx.js');
if (!vfx.includes('three/addons/postprocessing/EffectComposer.js')) fail('vfx.js no importa EffectComposer');
if (!vfx.includes('three/addons/postprocessing/RenderPass.js')) fail('vfx.js no importa RenderPass');
if (!vfx.includes('three/addons/postprocessing/UnrealBloomPass.js')) fail('vfx.js no importa UnrealBloomPass');
if (!vfx.includes('three/addons/postprocessing/OutputPass.js')) fail('vfx.js no importa OutputPass (necesario para no perder tone mapping/sRGB al renderizar a un render target)');
if (!vfx.includes('new EffectComposer')) fail('vfx.js no crea EffectComposer');
if (!vfx.includes('new RenderPass')) fail('vfx.js no crea RenderPass');
if (!vfx.includes('new UnrealBloomPass')) fail('vfx.js no crea UnrealBloomPass');
if (!vfx.includes('new OutputPass')) fail('vfx.js no crea OutputPass');
if (!vfx.includes('threshold: 0.8')) fail('vfx.js no tiene threshold 0.8');
if (!vfx.includes('strength: 0.3')) fail('vfx.js no tiene strength 0.3');
if (!vfx.includes('radius: 0.5')) fail('vfx.js no tiene radius 0.5');
// Constructor UnrealBloomPass: (resolución, strength, radius, threshold)
if (!vfx.includes('BLOOM_DEFAULTS.strength,\n    BLOOM_DEFAULTS.radius,\n    BLOOM_DEFAULTS.threshold')) fail('vfx.js no pasa (strength, radius, threshold) en el orden del constructor');
if (!vfx.includes('composer.addPass(renderPass)')) fail('vfx.js no añade RenderPass al compositor');
if (!vfx.includes('composer.addPass(bloomPass)')) fail('vfx.js no añade BloomPass al compositor');
if (!vfx.includes('composer.addPass(outputPass)')) fail('vfx.js no añade OutputPass al compositor');
if (!vfx.includes('bloomPass.enabled')) fail('vfx.js no controla bloomPass.enabled');
if (!vfx.includes('setBloomEnabled')) fail('vfx.js no exporta setBloomEnabled');
if (!vfx.includes('setBloomStrength')) fail('vfx.js no exporta setBloomStrength');
if (!vfx.includes('composer.render()')) fail('vfx.js no llama a composer.render()');
if (!vfx.includes('syncVFXSize')) fail('vfx.js no exporta syncVFXSize');

const main = read('js/main.js');
if (!main.includes('initVFX')) fail('main.js no inicializa VFX');
if (!main.includes('renderVFX(renderer, scene, camera)')) fail('main.js no usa renderVFX() en el bucle');
if (main.includes('      renderer.render(scene, camera);')) fail('main.js todavía usa renderer.render() directo en el bucle');
if (!main.includes('syncVFXSize()')) fail('main.js no sincroniza el tamaño del compositor al redimensionar');
if (!main.includes('Listo v0.11')) fail('main.js no marca v0.11');

const snap = read('js/snapshot.js');
if (!snap.includes('renderVFX')) fail('snapshot.js no usa renderVFX() (Snapshot Sync)');
if (!snap.includes('isVFXReady()')) fail('snapshot.js no comprueba isVFXReady()');
if (!snap.includes('syncVFXSize()')) fail('snapshot.js no sincroniza el compositor en supersampling');
if (!snap.includes("via: isVFXReady() ? 'composer' : 'renderer'")) fail('snapshot.js no reporta la vía (composer/renderer)');

const ui = read('js/ui.js');
if (!ui.includes('vfx.js')) fail('ui.js no importa vfx.js');
if (!ui.includes("bind('vfxBloom'")) fail('ui.js no enlaza #vfxBloom');
if (!ui.includes("bind('vfxBloomStrength'")) fail('ui.js no enlaza #vfxBloomStrength');

const html = read('index.html');
if (!html.includes('Efectos Visuales (Post-Procesamiento)')) fail('index.html no tiene el panel VFX');
if (!html.includes('id="vfxBloom"')) fail('index.html no tiene #vfxBloom');
if (!html.includes('id="vfxBloomStrength"')) fail('index.html no tiene #vfxBloomStrength');
if (!html.includes('id="vfxStatus"')) fail('index.html no tiene #vfxStatus');
if (!html.includes('v0.11')) fail('index.html no marca v0.11');

console.log('v0.11 OK: EffectComposer + RenderPass + UnrealBloomPass (0.8/0.3/0.5) + OutputPass, bucle con composer.render(), panel VFX con toggle y slider, Snapshot Sync con composer.');
