# Estudio 3D — v0.3 gratuita HF

## Arquitectura

La v0.1 monolítica quedó guardada en local como `index-v01.html` (no se sube a Pages).
La v0.2 separó la lógica en módulos ES6 y la v0.3 añade el pipeline gratuito:

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
js/timeline.js    # Keyframes, pistas y grabación WebM
js/ui.js          # Enlaces de todos los controles del panel
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
