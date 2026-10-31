# Estudio 3D — v0.11 VFX

## Arquitectura

La v0.1 monolítica quedó guardada en local como `index-v01.html` (no se sube a Pages).
La v0.2 separó la lógica en módulos ES6, la v0.3 añadió el pipeline gratuito,
la v0.4 es la revisión QA que repara su integración, la v0.5 añade
autenticación segura con token de Hugging Face, la v0.6 añade
post-procesamiento espacial para las mallas inyectadas, la v0.7
añade Outliner e inspector de materiales granular, la v0.8
sincroniza dinámicamente el BoxHelper de selección, la v0.9
añade iluminación HDRI (IBL), la v0.10 añade render final PNG
y la v0.11 añade post-procesamiento VFX con Bloom:

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
