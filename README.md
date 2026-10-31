# Estudio 3D — v0.6 Encuadre

## Arquitectura

La v0.1 monolítica quedó guardada en local como `index-v01.html` (no se sube a Pages).
La v0.2 separó la lógica en módulos ES6, la v0.3 añadió el pipeline gratuito,
la v0.4 es la revisión QA que repara su integración, la v0.5 añade
autenticación segura con token de Hugging Face y la v0.6 añade
post-procesamiento espacial para las mallas inyectadas:

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
