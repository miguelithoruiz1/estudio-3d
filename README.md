# Estudio 3D — v0.2 modular

## Arquitectura

La v0.1 monolítica quedó guardada como `index-v01.html`. La v0.2 separa la lógica en módulos ES6:

```
index.html        # Solo estructura y paneles
styles.css        # Estilos
js/main.js        # Arranque y bucle de animación
js/store.js       # Estado compartido (sin claves)
js/scene.js       # Renderer, cámara, controles, selección, materiales
js/io.js          # Importar .glb/.gltf/.obj/.fbx y exportar .glb/.obj
js/effects.js     # Primitivas, partículas, texto, rig simple, inflado
js/ai3d.js        # Cliente IA asíncrono (Meshy y Tripo v3)
js/timeline.js    # Keyframes, pistas y grabación WebM
js/ui.js          # Enlaces de todos los controles del panel
```

Three.js se carga por importmap desde CDN (versión 0.160.0). No hay paso de compilación.

## Pipeline IA real (reemplaza al relieve 2D)

El relieve 2D de la v0.1 fue eliminado. Ahora hay un cliente asíncrono real, no una simulación:

### Meshy (rutas verificadas en docs.meshy.ai)
- `POST https://api.meshy.ai/openapi/v1/image-to-3d` con `image_url`, `ai_model: 'latest'`, `should_texture: true`, `target_formats: ['glb']`
- Respuesta: `result` con el ID de tarea
- Polling cada 10 s a `GET /openapi/v1/image-to-3d/<id>` hasta `SUCCEEDED`
- Resultado: `model_urls.glb`, que se carga con `GLTFLoader` y se inyecta en la escena
- Acepta URL pública o data URI base64 (por eso un archivo local funciona en Meshy)
- Límite: imagen JPG/PNG/WebP de máximo 20 MB. Crear tareas requiere plan de pago en Meshy.

### Tripo v3 (no v2, retirada el 2026-10-31)
- Base global: `https://openapi.tripo3d.ai/v3`
- `POST /v3/generation/image-to-model` con `input` (URL pública o file_token)
- Archivo local: primero `POST /v3/files` (multipart) para obtener el file_token
- Polling a `GET /v3/tasks/<task-id>` hasta `success`
- El .glb se busca en la respuesta y se inyecta igual que en Meshy

### Seguridad y límites honestos
- La clave se escribe en el campo de la página, vive solo en memoria del navegador y nunca se escribe en un archivo ni se sube al repositorio.
- Generar cuesta créditos del proveedor.
- Llamar directo desde el navegador puede fallar por CORS según el proveedor. Si eso pasa, el mensaje lo dice y la solución real es un pequeño proxy/backend que guarde la clave en el servidor, no exponerla en el frontend de producción.
- Sin una clave válida con créditos, no se puede probar una generación real end-to-end. El código del flujo completo está implementado y listo para esa prueba.

## Ejecutar en local

```bash
cd ~/workspace/estudio-3d
python3 -m http.server 8000
```

Abrir http://localhost:8000/

## Despliegue en GitHub Pages

Proyecto estático: basta con publicar la carpeta en un repositorio público y activar Pages desde la rama principal, raíz `/`.

URL esperada una vez creado el repositorio `estudio-3d` y activado Pages:
`https://miguelithoruiz1.github.io/estudio-3d/`

Si el conector de GitHub no permite crear el repositorio nuevo (ya ocurrió antes con un 403), la creación debe hacerse manual en GitHub o desde el navegador, y luego se puede hacer push a ese repositorio ya existente.
