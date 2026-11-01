# Estudio 3D — v0.20 Escala AR con botones

## Arquitectura

La v0.1 monolítica quedó guardada en local como `index-v01.html` (no se sube a Pages).
La v0.2 separó la lógica en módulos ES6, la v0.3 añadió el pipeline gratuito,
la v0.4 es la revisión QA que repara su integración, la v0.5 añade
autenticación segura con token de Hugging Face, la v0.6 añade
post-procesamiento espacial para las mallas inyectadas, la v0.7
añade Outliner e inspector de materiales granular, la v0.8
sincroniza dinámicamente el BoxHelper de selección, la v0.9
añade iluminación HDRI (IBL), la v0.10 añade render final PNG
la v0.11 añade post-procesamiento VFX con Bloom, la v0.12
añade cache busting con query string de versión y la v0.13
añade AR WebXR con hit-test, la v0.14 añade gestos
multitáctiles en AR y la v0.15 añade el aviso de
compatibilidad AR al abrir:

```
index.html        # Solo estructura y paneles
styles.css        # Estilos, incluido el spinner de carga
js/main.js        # Arranque y bucle de animación
js/store.js       # Estado compartido (sin claves)
js/scene.js       # Renderer, cámara, controles, selección, materiales
js/loaders.js     # Importar .glb/.gltf/.obj/.fbx y exportar .glb/.obj
js/effects.js     # Primitivas, partículas, texto, rig simple, inflado
js/ai3d.js        # Cliente de pago opcional (Meshy y Tripo v3)
js/hf3d.js        # Cliente gratuito Hugging Face Spaces (nuevo)
js/hf-token.js    # Token Read: solo localStorage, nunca en el repo (v0.5)
js/validate-image.js # Validación de imagen sin DOM, probada en Node
js/timeline.js    # Keyframes, pistas y grabación WebM
js/ui.js          # Enlaces de todos los controles del panel
test/test-v04.mjs # Test Node de la v0.4 (ids, bindings, gradio lazy)
test/test-v05.mjs # Test Node de la v0.5 (password, localStorage, hf_token)
test/test-v06.mjs # Test Node de la v0.6 (Box3, eje 2, encuadre FOV 80%)
js/outliner.js    # Árbol de jerarquía, excluye helpers/grillas (v0.7)
test/test-v07.mjs # Test Node de la v0.7 (Outliner, Mesh hijo, no destructivo)
test/test-v08.mjs # Test Node de la v0.8 (refresh, sync, cleanup)
js/environment.js # HDRI: RGBELoader + PMREM, toggle fondo, dispose VRAM (v0.9)
test/test-v09.mjs # Test Node de la v0.9 (RGBELoader, PMREM, toggle, dispose)
js/snapshot.js    # Render final PNG: supersampling 2x/4x, alfa, restaurar (v0.10)
test/test-v10.mjs # Test Node de la v0.10 (botón, alfa, supersampling, restaurar)
js/vfx.js       # Post-procesamiento: EffectComposer + Bloom + OutputPass (v0.11)
test/test-v11.mjs # Test Node de la v0.11 (composer, Bloom, panel VFX, Snapshot Sync)
test/test-v12.mjs # Test Node de la v0.12 (cache busting ?v=0.12, log v0.12)
js/ar.js       # WebXR AR: retículo, hit-test, anclaje, paneles sessionstart/end (v0.13)
test/test-v13.mjs # Test Node de la v0.13 (XR, ARButton, retículo, anclaje, cache busting)
test/test-v14.mjs # Test Node de la v0.14 (dom-overlay, pinch, twist, clamp, cache busting)
js/ar-compat.js # Aviso AR al abrir: HTTPS + immersive-ar, alternativa visor 3D (v0.15)
test/test-v15.mjs # Test Node de la v0.15 (aviso AR, ramas compatible/no compatible/sin HTTPS)
test/test-v16.mjs # Test Node de la v0.16 (estado AR en sesión, reintento hit-test, respaldo frente a cámara)
test/test-v17.mjs # Test Node de la v0.17 (sin dom-overlay, hit-test + select + respaldo)
test/test-v18.mjs # Test Node de la v0.18 (ajuste a 30 cm + restaurar, 1 unidad = 1 metro)
test/test-v19.mjs # Test Node de la v0.19 (dom-overlay corregido, pellizco + giro)
test/test-v20.mjs # Test Node de la v0.20 (botones + / − en AR, pellizco con texto de escala, tamaños predefinidos)
```

## v0.20 Escala AR con botones: si el pellizco no llega, hay otro camino

- Reporte del usuario tras v0.19: el pellizco sigue sin funcionar. Sin diagnóstico en vivo, hay tres causas posibles: caché (badge viejo), capa no activa (sin texto de ayuda en sesión), o el navegador no entrega el multitáctil a la capa.
- Nuevo en sesión: botones "− Achicar" y "Agrandar +" en la parte inferior de la capa AR, que escalan ×0,8 / ×1,25 con el mismo clamp 0,1–10. Los toques sobre esos botones no colocan el modelo.
- Nuevo diagnóstico: al pellizcar, el texto de ayuda muestra la escala en vivo ("Escala: 0,25"). Si al pellizcar ese texto no cambia, el navegador no está entregando el multitáctil y hay que usar los botones.
- Nuevo antes de AR: tamaños predefinidos 10 cm, 30 cm, 50 cm y 1 m en "Objeto seleccionado", que funcionan aunque el pellizco en sesión no llegue.
- Escaneo (js/scan.js) queda como borrador local sin publicar en v0.20, para no mezclarlo con la corrección del pellizco; se retoma en v0.21 tras confirmar la escala en AR.

## v0.19 Pellizco AR de vuelta: dom-overlay corregido

- El pellizco en AR necesita dom-overlay, porque sin esa capa los toques van al controlador XR (solo toque, no multitáctil).
- Diferencia frente a v0.14-0.16, que coincidió con la cámara negra: la capa #arOverlay ya NO está en display:none al pedir la sesión. Está visible desde el inicio, con pointer-events:none y el texto en opacity 0, para no tapar ni bloquear el visor. Solo en sessionstart se activan los toques y el texto; en sessionend se vuelven a desactivar.
- Gestos en sesión: 1 toque coloca/arrastra al retículo (o frente a ti sin superficie), 2 dedos pellizcan para escalar (clamp 0,1–10 por eje) y giran en Y. El botón "Ajustar a 30 cm para AR" de v0.18 sigue disponible antes de entrar.
- Riesgo honesto: si la cámara vuelve a salir negra con esta capa, el retroceso es v0.18 (sin capa, cámara confirmada, sin pellizco). Prueba real en el teléfono del usuario pendiente: ¿cámara abierta + pellizco funciona?

## Segunda parte pendiente: escaneo y mapeo

- Escanear un objeto desde la cámara y mapear un sitio son dos funciones distintas de colocar un modelo en AR, y aún no están en la app. Opciones a decidir con el usuario: (A) escaneo por fotos alrededor de un objeto para generar su modelo 3D, (B) mapeo de un cuarto/sitio con los planos detectados por WebXR (suelo, paredes) como base para colocar objetos.

## v0.18 Tamaño AR 30 cm: el cubo no es un error, es de 1,5 m

- En WebXR, 1 unidad = 1 metro real. El cubo por defecto mide 1,5 x 1,5 x 1,5, así que en el cuarto llena la vista, aunque en el visor se vea normal (la cámara está a ~9 unidades).
- Nuevo, antes de entrar a AR, en "Objeto seleccionado": botón "Ajustar a 30 cm para AR" (deja el lado mayor en 0,30 m, guarda la escala original) y "Volver a tamaño original". Dentro de la sesión no hay botones y el pinch sigue pausado desde v0.17, por eso el ajuste es previo.
- Prueba real en el teléfono del usuario pendiente.

## v0.17 Cámara AR sin capa: quitar dom-overlay

- En el teléfono del usuario, con dom-overlay la sesión abría (indicador de cámara activo) pero la cámara no se veía y el texto de ayuda tampoco aparecía, solo pantalla negra y el aviso de pantalla completa.
- v0.17 pide la sesión solo con hit-test, sin dom-overlay, para que ninguna capa DOM quede por encima de la cámara. Colocar por toque (select) y el respaldo frente a cámara de v0.16 siguen activos. El pinch y el twist en AR quedan pausados en esta versión, porque dependían de dom-overlay; lo primero es que la cámara abra.
- Prueba real en el teléfono del usuario pendiente.

## v0.16 AR sin atasco: estado en sesión y colocación de respaldo

- Antes, si la detección de superficie fallaba, la sesión quedaba en silencio: sin retículo, tocar no colocaba nada y parecía atascada.
- Ahora el texto de ayuda en sesión muestra el estado real (buscando superficie / superficie detectada / sin superficie: toca para colocar frente a ti), el hit-test se reintenta a los 2 s si falla, y sin retículo tocar coloca el modelo 1,5 m frente a la cámara.
- Gestos v0.14 y aviso v0.15 intactos. Prueba real en el teléfono del usuario pendiente.

## v0.15 Aviso AR: compatibilidad al abrir, antes del botón AR

- Al cargar, `js/ar-compat.js` comprueba solo dos cosas: página segura (HTTPS) y sesión WebXR `immersive-ar` disponible. No se lee ningún otro dato del dispositivo.
- El aviso `#arCompat` aparece en la página antes de pulsar el botón AR. Si AR está disponible, dice que pulses AR y cómo colocar el modelo. Si no está disponible, dice que AR no está disponible y nombra la alternativa concreta: el visor 3D de la misma página (girar, acercar, mover) o descargar una imagen PNG.
- En sesión AR, `#arCompat` se oculta junto a header, aside y timeline, y se restaura al salir. Los gestos v0.14 (pinch, twist, 1 toque) quedan intactos.
- Prueba local: test v0.15 aprobado (ramas compatible, no compatible y sin HTTPS, con navegadores simulados), sintaxis ES6 aprobada, servidor local 200. La prueba real en un teléfono queda para el usuario: un resultado de escritorio nunca se presenta como resultado del teléfono.

## v0.14 Gestos AR: pinch, twist y reposicionamiento con 1 toque

- DOM Overlay: `ARButton.createButton(renderer, {
  requiredFeatures: ['hit-test'], optionalFeatures:
  ['dom-overlay'], domOverlay: { root: #arOverlay } })`. La raíz
  es el contenedor dedicado `#arOverlay` (no `document.body`
  entero, que incluye paneles y canvas): un div a pantalla
  completa, oculto fuera de sesión, con `touch-action:none` y
  un texto de ayuda ("Toca para colocar • Pellizca para escalar
  • Gira con dos dedos para rotar"). `dom-overlay` es opcional:
  sin soporte, la sesión sigue con hit-test y el `select` de
  v0.13 como respaldo. Si `#arOverlay` faltara, se usa
  `document.body` como respaldo.
- Multitáctil en `js/ar.js`, con listeners `touchstart` y
  `touchmove` (y `touchend`/`touchcancel`) sobre `#arOverlay`,
  con `{ passive: false }` para que `preventDefault()` funcione
  y el navegador no robe el gesto con su zoom/scroll:
  - 2 toques: distancia inicial y ángulo inicial se guardan en
    `touchstart` (junto a la escala inicial del modelo); en
    `touchmove`, factor = distancia actual / inicial para la
    escala, y delta de ángulo normalizado a [-PI, PI] para
    `rotation.y += delta`.
  - 1 toque: en `touchstart` y en `touchmove`, si el retículo
    es visible, se llama a `placeSelectedAtReticle()`, así que
    tocar coloca y arrastrar con un dedo reposiciona
    dinámicamente mientras el retículo siga sobre una superficie.
  - El `select` de v0.13 se mantiene como respaldo sin overlay;
    con overlay, los toques van al DOM y no disparan `select`,
    y colocar dos veces en el mismo retículo sería idempotente.
- Guardrail: escala por eje con `THREE.MathUtils.clamp(valor,
  0.1, 10)`, sobre la escala inicial por el factor de pinch,
  para que un gesto brusco no deje el modelo microscópico ni
  titánico. Se guarda la escala inicial al empezar el pinch para
  no acumular error en cada `touchmove`.
- Cache busting: `?v=0.14` en la entrada, el CSS y las 39
  importaciones locales, siguiendo la convención v0.12.
- Prueba local: test v0.14 aprobado, sintaxis ES6 aprobada,
  servidor local 200 para index, main.js?v=0.14 y ar.js?v=0.14
  con `#arOverlay` servido, y gestos simulados aprobados
  (pinch 100->200 duplica, 100->2000 clampa a 10, 100->5 clampa
  a 0.1, twist 0.5 rad, 1 toque reposiciona a 1.5/0/-2).
  Límite honesto: los gestos reales exigen un móvil con WebXR +
  dom-overlay + cámara y no se pueden probar en Node ni en
  escritorio; quedan para la prueba del usuario en su móvil.
```
```

## v0.13 AR WebXR: colocar el modelo en el mundo real

- `main.js`: `renderer.xr.enabled = true` y
  `document.body.appendChild(ARButton.createButton(renderer,
  { requiredFeatures: ['hit-test'] }))`, importado desde
  `three/addons/webxr/ARButton.js`. En escritorio o en un
  navegador sin AR, el botón muestra "AR NOT SUPPORTED":
  esperado, no un fallo. Si ARButton falla, la app sigue sin AR.
- Nuevo `js/ar.js`: retículo anillo (`RingGeometry(0.15, 0.2,
  32)`, `matrixAutoUpdate = false`, invisible al inicio);
  hit-testing cada frame con el XRFrame (`requestReferenceSpace
  ('viewer')` + `requestHitTestSource`, `frame.getHitTestResults
  (hitTestSource)`, matriz de la pose escrita en el retículo),
  así que el anillo sigue el centro de la cámara y se adhiere
  al suelo o a una mesa detectada; al tocar la pantalla, el
  controlador dispara `select` y el objeto colocable se desplaza
  instantáneamente a la posición del retículo, sin cambiar
  escala ni rotación. Si lo seleccionado es una malla hija de un
  .glb, se sube hasta el objeto de nivel superior para mover el
  .glb completo, no una sola malla. Sin selección, no se mueve
  nada y se avisa en el registro.
- UI en AR: en `sessionstart` se ocultan el `<aside>` (que
  contiene Outliner, VFX e Importación), el header y el timeline,
  y en `sessionend` se restauran con sus valores originales.
  Además, en sesión el fondo pasa a `null` (el fondo oscuro
  taparía la cámara real) y la rejilla se oculta; ambos se
  restauran al salir.
- Bucle y render en XR: `main.js` pasa de `requestAnimationFrame`
  recursivo a `renderer.setAnimationLoop(animate)`, que es el
  bucle que WebXR exige y que entrega el XRFrame. En sesión AR,
  el render es `renderer.render()` directo y se omite
  `OrbitControls.update()` (la cámara la controla WebXR):
  EffectComposer NO es compatible con WebXR (renderiza a sus
  propios targets y taparía la cámara real), así que el Bloom
  queda pausado durante la sesión y vuelve al salir.
- Cache busting: `?v=0.13` en la entrada, el CSS y las 39
  importaciones locales (36 de la v0.12 + AR en main y 2 en
  ar.js), siguiendo la convención v0.12.
- Prueba local: test v0.13 aprobado, sintaxis aprobada,
  servidor local 200 para index, main.js?v=0.13 y ar.js?v=0.13,
  y secuencia lógica simulada (retículo, hit, anclaje del .glb
  completo, paneles, render directo en XR). Límite honesto: la
  sesión AR real exige un móvil con WebXR, cámara y HTTPS
  (GitHub Pages lo es), y no se puede probar en Node ni en el
  navegador de escritorio; el botón AR, el retículo y el anclaje
  en un dispositivo real quedan para la prueba del usuario en su
  móvil.
```
```

## v0.12 Cache Busting: invalidación de caché controlada

- `index.html`: entrada `js/main.js?v=0.12` y CSS
  `styles.css?v=0.12`. El título y el badge pasan a v0.12.
- **Punto crítico:** versionar solo la entrada NO basta. En ES
  Modules, una importación relativa `'./scene.js'` resuelta
  desde `'js/main.js?v=0.12'` pierde el query string y queda
  como `'js/scene.js'`, así que el navegador seguiría sirviendo
  los módulos internos viejos en caché. Por eso la versión se
  aplicó a **las 36 importaciones locales** en los 11 módulos
  que importan otros módulos locales (por ejemplo,
  `'./scene.js?v=0.12'`, `'./vfx.js?v=0.12'`). Con URLs
  distintas a las de la v0.11, el navegador no puede reutilizar
  la caché vieja: debe descargar los módulos nuevos.
- Importaciones externas (three, three/addons, @gradio/client)
  NO llevan la versión local: van por importmap con su versión
  fijada (three 0.160.0) y la única importación dinámica local
  no existe; la única dinámica es `@gradio/client`, externa.
- Log de inicio en `main.js`: en el caso normal (VFX
  inicializado) empieza exactamente con
  "Listo v0.12. Motor VFX activo.", seguido del estado del Bloom
  y las instrucciones. Solo si `initVFX()` falló se dice lo
  contrario, para no afirmar un VFX que no se inicializó.
- Convención a partir de ahora: en cada iteración mayor se
  incrementa el query string (`?v=0.13`, `?v=0.14`, …) en la
  entrada, el CSS y **todas** las importaciones locales, no solo
  en la entrada. El test `test-v12.mjs` verifica que no quede
  ninguna importación local sin versión.
- Prueba local: test v0.12 aprobado (36 importaciones
  versionadas, 0 sin versión), sintaxis aprobada, servidor local
  200 para `index.html`, `js/main.js?v=0.12` y
  `js/scene.js?v=0.12`, con el texto del log servido. El test
  v0.11 antiguo falla solo por la cadena de versión (esperado,
  no es regresión).
```
```

## v0.11 VFX: post-procesamiento con Bloom, sin romper el snapshot

- Nuevo `js/vfx.js`: `EffectComposer` con `RenderPass` base,
  `UnrealBloomPass` sutil (`threshold 0.8, strength 0.3,
  radius 0.5`; el constructor es (resolución, strength, radius,
  threshold)) y `OutputPass` al final. El OutputPass es necesario
  aunque el encargo solo pedía RenderPass + Bloom: sin él,
  renderizar a un render target perdería el tone mapping ACES y
  la conversión sRGB que `renderer.render()` aplica a pantalla,
  y el pipeline PBR cambiaría de tono al activar VFX.
- El bucle principal en `main.js` ya no usa `renderer.render()`
  directo: usa `renderVFX()`, que llama a `composer.render()`.
  Si `initVFX()` falla (por ejemplo, un módulo de postprocessing
  no carga), la app no se rompe: cae a `renderer.render()`
  directo y el panel VFX queda marcado como no disponible.
- Panel "Efectos Visuales (Post-Procesamiento)": checkbox para
  activar/desactivar el Bloom (`bloomPass.enabled`) y slider de
  intensidad (`strength`, 0 a 2, paso 0.05, por defecto 0.3),
  con estado visible en `#vfxStatus`. Con el Bloom desactivado,
  la cadena sigue siendo RenderPass + OutputPass, con el mismo
  tono PBR.
- Snapshot Sync: `snapshot.js` usa `renderVFX()` y `syncVFXSize()`
  cuando el compositor está listo, así que la captura 2x/4x
  llama a `composer.render()` (no a `renderer.render()`) antes
  de extraer el PNG, y el Bloom se imprime en la imagen final.
  El registro del render ahora indica la vía (`vía composer` o
  `vía renderer`). El tamaño del compositor se sincroniza con
  el tamaño supersampling antes del render y se restaura al
  tamaño original en `finally`, igual que el renderer.
- Prueba local: secuencia verificada con un compositor simulado
  (sin WebGL, sin GPU): threshold 0.8 discrimina un metal
  brillante (brillo 1.2, pasa) de un mate oscuro (0.2, no pasa),
  el slider cambia strength 0.3 -> 0.8, el toggle desactiva el
  Bloom sin dejar de renderizar por el compositor, y el snapshot
  2x usa `composer.render()` con 0 renders directos. Límite
  honesto: la caída de FPS real no se puede medir en Node sin
  GPU; el bucle simulado hace 1 render por frame, sin trabajo
  extra por frame, y la fluidez real con Bloom queda para la
  prueba en Pages y en el equipo del usuario.
```
```

## v0.10 Render: snapshot PNG de alta resolución

- Botón "Renderizar Imagen (PNG)", selector de resolución 2x
  (doble) o 4x (cuádruple) y checkbox "Fondo Transparente" en
  el nuevo panel "Render Final".
- El WebGLRenderer ya tenía `preserveDrawingBuffer:true` (sin
  él, `toDataURL()` devuelve negro) y ahora además se instancia
  con `alpha:true` para que el canal alfa sea extraíble.
- `js/snapshot.js` sigue el orden exacto: guarda pixelRatio y
  tamaño, aumenta temporalmente el tamaño al factor elegido,
  fuerza `renderer.render(scene, camera)`, extrae
  `canvas.toDataURL('image/png', 1.0)` y descarga
  `render_estudio3d.png`, y restaura resolución, ratio, aspect
  y vista en `finally`, para no asfixiar la GPU.
- Canal alfa: si "Fondo Transparente" está marcado, se ocultan
  temporalmente `scene.background` y la grilla (`gridHelper`,
  ahora exportada desde `scene.js`) justo antes del render, con
  `setClearAlpha(0)`, y se restauran al finalizar.
  `scene.environment` no se toca nunca, así que la iluminación
  PBR/IBL no cambia entre la vista normal y el snapshot.
- Prueba local: secuencia verificada con un renderer simulado
  (sin WebGL, que no hay en Node): 2x captura 1600x1200 y 4x
  captura 3200x2400 desde 800x600, con fondo, grilla, clearAlpha
  y resolución restaurados y environment intacto. Límite
  honesto: la descarga real en un navegador con WebGL queda
  para la prueba en Pages, porque en Node no hay GPU ni canvas
  real.
```
test/test-env.hdr # HDR local 4x4 Radiance, solo local, no se sube por ser binario
```

## v0.9 HDRI: iluminación basada en imagen (IBL)

- Nuevo sub-panel "Entorno / Iluminación" con
  `<input type="file" id="envHdr" accept=".hdr">` y un checkbox
  `#envBackground` ("Mostrar HDRI como fondo visible").
- `js/environment.js` usa `RGBELoader` de
  `three/addons/loaders/RGBELoader.js`, marca la textura como
  `EquirectangularReflectionMapping` (lineal, sin sRGB) y la pasa
  por `PMREMGenerator.fromEquirectangular()` para pre-calcular
  la irradiancia PBR. La textura resultante se asigna a
  `scene.environment`, que ilumina todos los materiales PBR;
  un objeto metálico (metalness alto, rugosidad baja) refleja
  ese entorno.
- Fondo: si la casilla está marcada, `scene.background` es la
  textura HDRI equirectangular; si no, vuelve a color sólido
  oscuro `#0b0e14`, mientras la iluminación del entorno sigue
  activa en ambos casos. El entorno por defecto
  (RoomEnvironment) queda guardado en `scene.initialEnvironment`
  para una futura restauración.
- VRAM estricta: antes de cargar un nuevo HDRI, se desengancha
  `scene.environment` de la textura PMREM vieja y se hace
  `dispose()` de la textura HDR anterior y de la textura PMREM
  anterior. El generador PMREM se reutiliza. El HDRI nunca se
  sube al repositorio: solo vive en la memoria del navegador.
- Prueba local: HDR Radiance 4x4 creado a mano (109 bytes,
  píxeles brillantes y oscuros), parseado con `RGBELoader` real
  en Node (4x4, 64 valores HalfFloat, no ceros), y material
  metálico de prueba con metalness 1 y rugosidad 0. Límite
  honesto: PMREM real y reflejos visibles exigen WebGL con GPU
  y no se pueden ejecutar en Node sin GPU; la confirmación
  visual de reflejos queda para la prueba en navegador con un
  objeto metálico y un HDRI real (el de prueba 4x4 es demasiado
  pequeño para un entorno realista).
```
```

## v0.8 BoxHelper: sincronización dinámica de matrices

La v0.7 dejaba el BoxHelper creado en `select()` antes de
`normalizeAndFrame()`, por eso quedaba con la escala y el centro
viejos y no se veía bien en Pages. La v0.8 lo corrige:

- Instanciación post-normalización: `normalizeAndFrame()` recrea
  el helper al final (`refreshSelectionHelper()`), en el mismo
  tick síncrono y antes del siguiente render, así que el helper
  que llega a pantalla ya usa las matrices finales. Lo mismo
  ocurre para modelos importados y generados, porque ambos pasan
  por `normalizeAndFrame()`.
- Sincronización basada en eventos: `helper.update()` enlazado
  al evento `change` de TransformControls (gizmo) y, además, en
  cada frame del bucle de animación (`syncSelectionHelper()` en
  `main.js`), para que el recuadro siga a la malla al trasladar,
  rotar o escalar en tiempo real.
- Cleanup: `disposeSelectionHelper()` hace `removeFromParent()`
  y `dispose()` de geometría y material. Se llama al cambiar de
  nodo, al deseleccionar y al eliminar. Clic en el fondo ahora
  deselecciona (`select(null)`), salvo mientras el gizmo está
  siendo arrastrado (`transform.dragging`), para no romper el
  arrastre.
- Prueba local con Three real y el GLB compuesto: helper
  pre-normalización 3.40, obsoleto tras normalizar sigue 3.40,
  tras refresh 2.00 x 0.59 x 0.59 exacto; HijoA movido y escalado
  con el gizmo simulado: sin `update()` el helper queda en
  -0.71, con `update()` sigue al centro real 0.47 y al ancho
  1.18, HijoB intacto en 0.71, y tras cleanup quedan 0 BoxHelper
  en la escena.
```
test/composite-2-meshes.glb # GLB local, 2 mallas (HijoA 0.5 / HijoB 0.2), solo local, no se sube por ser binario
```

## v0.7 Outliner: jerarquía y materiales no destructivos

- Nuevo panel `#outliner` en `js/outliner.js`: árbol dinámico
  desde `state.objects` (solo interactivos registrados), con
  hijos anidados. GridHelper y TransformControls quedan fuera
  porque no están registrados y se filtran además explícitamente.
  Se redibuja con `state.onObjectsChange` (importación,
  generación, eliminación) y con `state.onSelectChange` para
  marcar el nodo activo.
- Raycasting recursivo en `scene.js`: `intersectObjects(...,
  true)` y selección exclusivamente del `THREE.Mesh` hijo
  interceptado, ya no del Group padre. La selección se resalta
  con un `BoxHelper` temporal magenta, no registrado, así que
  no aparece en el Outliner.
- Inspector granular: al seleccionar una sub-malla, los
  controles de color, metalness y rugosidad reflejan sus valores
  actuales, y `#matInfo` indica si tiene textura. `applyMaterial`
  afecta solo a esa Mesh; un Group seleccionado en el Outliner
  sigue siendo un ajuste de grupo explícito. Bajo ninguna
  circunstancia se toca `material.map`, no se reemplaza el
  material ni se elimina la textura: el color solo muta
  `material.color`, tinte multiplicador en PBR.
- Prueba local: GLB compuesto generado con Three real
  (3904 bytes, grupo ModeloCompuesto con HijoA rugosidad 0.5 e
  HijoB rugosidad 0.2), cargado con GLTFLoader real en Node:
  cambiar solo HijoA a 0.9 deja HijoB en 0.2 y `material.map`
  intacto. Servidor local 200 para index, outliner.js y el GLB.
  La prueba en navegador con la app completa (clic en viewport
  y cambio desde el slider) queda pendiente de Pages, porque
  el navegador de prueba no alcanza el localhost de la VM.
```
```

## v0.6 Encuadre: normalización y cámara adaptativa

La v0.5 ya normalizaba la malla gratuita a eje mayor 2 en `hf3d.js`,
pero sin encuadre de cámara y con el spinner de `#hfStatus` vivo
tras el éxito. La v0.6 lo centraliza en `scene.normalizeAndFrame`:

- Bounding Box con `THREE.Box3().setFromObject()`, escala para
  que el eje más largo mida exactamente 2 unidades y centro de la
  geometría en el origen absoluto (0, 0, 0).
- Encuadre trigonométrico: `controls.target` al centro del modelo
  y cámara hacia atrás a lo largo de su vector de visión actual,
  a distancia `radio / (0.8 * sin(FOV_efectivo / 2))`, con FOV
  efectivo = menor entre vertical y horizontal (derivado del
  aspect), para que la malla ocupe el 80% del viewport sin saltar
  a un ángulo por defecto.
- Se aplica tanto a la generación gratuita (`hf3d.js`) como a los
  modelos importados y a los de pago (`loaders.js`), que ya no
  usan `position.y = 1`.
- Limpieza de UI: tras el éxito, `ui.js` destruye el spinner de
  `#hfStatus` asignando su `textContent` sobre sí mismo, y
  `#log` registra el éxito con las dimensiones finales, por
  ejemplo "Dimensiones finales: 2.00 x 1.23 x 0.87 (eje mayor
  2.00). Cámara encuadrada al 80%."
- Límite honesto: el encuadre está implementado y probado en
  Node por fórmula y por código, pero no está validado en vivo
  con un modelo real generado, porque eso exige el token Read
  del usuario en su navegador.
```
```

## v0.5 Token: autenticación segura del lado del cliente

La v0.4 validó que la interfaz reacciona, pero la generación falló
con 401: el Space TripoSR no se puede acceder sin token. La v0.5
lo resuelve sin tocar la seguridad del repositorio:

- Nuevo campo `<input type="password" id="hfToken">` en la sección
  de generación gratuita, etiquetado "Hugging Face Token (Read)".
- Al escribirlo se guarda solo en `localStorage` del navegador
  (`estudio3d_hf_token`). Al borrarlo, o con el botón "Borrar token
  guardado", se elimina. Al recargar, el campo se restaura oculto
  por ser de tipo contraseña.
- `hf3d.js` lee ese token y lo pasa a
  `Client.connect(space, { hf_token: token })`, tanto para Stable
  Fast 3D como para TripoSR. El token nunca se registra en `#log`,
  en `#hfStatus` ni en la consola.
- Sin token, la generación se detiene antes de llamar a ningún
  Space y muestra en `#log` una advertencia pidiéndolo.
- Guardrail verificado por test: ningún archivo subido contiene
  un token hardcodeado, variables de entorno simuladas ni
  credenciales. El usuario debe crear su propio token de lectura
  en huggingface.co/settings/tokens y pegarlo en su navegador;
  ese token nunca llega a este asistente ni al repositorio.
```
```

## v0.4 QA: qué se reparó y por qué

Diagnóstico real de la v0.3:
- No existía ningún `#importImage`. El campo se llamaba `hfImageFile`
  y solo reaccionaba al botón, no al elegir la imagen.
- `hf3d.js` importaba `@gradio/client` en la cabecera. Si ese CDN
  fallaba, todo el grafo de módulos fallaba y la interfaz quedaba
  muerta sin ningún mensaje en `#log`, solo en la consola oculta.
- Los enlaces de `ui.js` no tenían protección si faltaba un id.

Reparación:
- `js/io.js` eliminado definitivamente del repositorio (en local
  ya no existía desde el renombrado a `js/loaders.js`).
- Nuevo campo `#importImage` con evento `change` que valida la
  imagen y dispara el flujo automáticamente. El botón usa la misma
  función, para reintentar.
- `@gradio/client` se carga de forma perezosa dentro de `try/catch`,
  con timeouts. Cualquier fallo (CDN, CORS, timeout, Space dormido
  o API cambiada) se imprime en `#log` y en `#hfStatus`.
- `main.js` espera a `DOMContentLoaded`, captura errores de arranque
  en `#log` y marca la app como lista. Si no arranca en 10 s, el
  propio HTML escribe el error en `#log`.
- Verificación local: test Node aprobado, sintaxis aprobada y
  servidor local 200. La verificación en navegador por localhost
  no fue posible porque ese localhost es de la VM, no del navegador
  de prueba, por lo que la v0.4 se verifica en Pages tras el push.
```

Three.js se carga por importmap desde CDN (versión 0.160.0) y
`@gradio/client` también por CDN, sin paso de compilación.

## Pipeline gratuito 2D a 3D (v0.3, sin clave)

Flujo exacto:
1. El usuario sube una imagen JPG, PNG o WebP en "Generar 3D gratis".
2. Se muestra: "Generando malla 3D, esto puede tardar unos segundos..." con spinner,
   mientras `@gradio/client` conecta con el Space y espera la inferencia.
3. Se extrae el archivo .glb de la respuesta.
4. Se descarga como blob, se carga con `GLTFLoader` y se inyecta en (0, 0, 0),
   centrado y normalizado a unos 2 m para que quepa en el viewport.

### Espacio principal: stabilityai/stable-fast-3d
- `Client.connect("stabilityai/stable-fast-3d")`
- Intento opcional `/requires_bg_remove` con `{ image, fr: 0.85 }`
- Generación `/run_button` con
  `{ input_image, foreground_ratio: 0.85, remesh_option: "None", vertex_count: -1, texture_size: 1024 }`
- Entrada: JPG/PNG/WebP, cada lado mínimo 64 px, entre 4.096 y 4.194.304 px en total.

### Espacio alternativo: VAST-AI/TripoSR
- Si Stable Fast 3D falla, se intenta TripoSR automáticamente.
- `/predict` con imagen, quitar fondo, ratio 0.9 y resolución 256.

### Límites honestos del "coste cero"
- No pide clave ni créditos en esta app, pero el Space es público y compartido:
  puede haber cola (más que "unos segundos"), estar pausado, requerir
  inicio de sesión en HF en momentos de carga, o haber cambiado su API.
- El código intenta los endpoints documentados y muestra el último error
  tal cual en lugar de fingir una malla. No hay SLA de un Space gratuito.
- TripoSR da mallas con colores por vértice, no siempre texturas PBR
  completas como Stable Fast 3D.

## Pipeline de pago opcional (v0.2, se mantiene)

Meshy (`POST /openapi/v1/image-to-3d`, polling hasta `SUCCEEDED`,
`model_urls.glb`) y Tripo v3 (`/v3/generation/image-to-model`,
`/v3/tasks/<id>`). La clave vive solo en memoria del navegador y nunca
se escribe en el repositorio. Generar cuesta créditos del proveedor.

## Ejecutar en local

```bash
cd ~/workspace/estudio-3d
python3 -m http.server 8000
```

Abrir http://localhost:8000/

## Despliegue en GitHub Pages

Proyecto estático en el repositorio público `miguelithoruiz1/estudio-3d`,
rama `main`, raíz `/`.

URL pública: https://miguelithoruiz1.github.io/estudio-3d/

Nota: tras activar Pages, la primera publicación tardó unos minutos
(primero 404, luego 200). Cada nuevo push vuelve a publicar y puede
tardar unos minutos en verse reflejado.
