# Orqena Experience V4

## Dirección

Orqena se presenta como una plataforma horizontal para autónomos y equipos de distintos sectores. El lenguaje público usa cliente, trabajo, servicio, proyecto, actividad y operación; la terminología especializada solo aparece dentro del sector que la necesita. La home alterna ejemplos de educación, servicios, ventas y finanzas sin convertir datos sintéticos en prueba social.

## Identidad

Se exploraron exactamente tres símbolos originales: Relay, Trama y Puente. Los tres se revisan en 16, 24, 32, 64 y 128 px, sobre fondo claro, oscuro y monocromo, en `BrandCandidateGrid`.

Relay es el símbolo seleccionado. Sus cuatro piezas redondeadas y el recorrido continuo expresan orden, conexión y avance sin depender de una inicial o un gremio. Conserva lectura a 16 px, admite impresión monocroma y deja una zona segura suficiente en el icono PWA. El wordmark sigue siendo texto HTML y la marca visible se resuelve desde `lib/brand.ts`.

Activos:

- `public/brand/mark.svg`
- `public/brand/mark-mono.svg`
- `public/brand/mark-inverse.svg`
- `public/brand/app-icon.svg`
- `public/brand/favicon.svg`
- `public/brand/icon-192.png`
- `public/brand/icon-512.png`
- `public/brand/icon-maskable-512.png`
- `public/brand/apple-touch-icon.png`

## Temas y movimiento

Claro usa marfil cálido, superficies suaves, esmeralda y azul cobalto. Oscuro usa grafito azul-verde, superficies elevadas y los mismos acentos con contraste adaptado. Sistema sigue `prefers-color-scheme`. La preferencia se conserva en almacenamiento local y cookie, se sincroniza entre pestañas y se aplica con un script previo a la hidratación. La impresión fuerza una presentación clara.

El sistema de movimiento compartido contiene `DemoController`, `ProductScene`, `SceneStage`, `SceneProgress`, `PlaybackControls`, `ReducedMotionFallback`, `useInViewportPlayback` y `useDocumentVisibilityPause`. Las escenas parten de un estado útil, se pausan fuera del viewport, con la pestaña oculta, foco o puntero, admiten control manual y se detienen tras dos ciclos. `prefers-reduced-motion` muestra un estado estable.

## Producto público

La home consume nueve escenas DOM: Hero Product Orchestra, Role Portal Studio, Client 360, Work 360, Sales Quote Studio, Treasury Flow, Contextual Agenda, Orqena Action y Mobile Work. No son capturas planas, GIF ni vídeo sobre el primer pliegue.

`marketingProductCatalog` define diez módulos y `marketingSectorCatalog` trece sectores. Las rutas `/producto/[modulo]` y `/sectores/[sector]` consumen esos catálogos. Demo permite cambiar sector y perfil con datos declarados como sintéticos; la escena de Orqena es determinista y no llama a servicios externos. Planes consume el catálogo comercial real y no inventa precios. El registro público permanece bloqueado.

`VisualReferenceManifest` relaciona las nueve referencias con consumidores públicos, autenticados, comportamiento, fallback y restricciones.

## Producto autenticado

El shell comparte marca y temas con la web pública. `ListWorkspace` se usa en las familias de clientes, trabajos, presupuestos, facturas, proveedores, facturas recibidas, gastos, agenda, tareas, seguimientos, recordatorios, documentos, auditoría y notificaciones. `RecordWorkspace` estructura Cliente 360 y Trabajo 360. `RecordPeek` conserva la lista en escritorio y no se presenta en móvil.

`RouteExperienceManifest` clasifica cada `page.tsx` por familia, shell, acceso, título, acción, móvil y estados. Su validador rechaza rutas sin regla o con solapamientos.

## Validación

La suite `test:orqena-experience-v4` cubre activos, candidatos, temas, movimiento, escenas, catálogos, páginas públicas, workspaces y manifiestos. Las suites existentes de foundations, shell, transformación, plataforma comercial, PortalManifest, Agenda y Tesorería permanecen como regresión.

Las evidencias finales se generan fuera del repositorio en `C:\Users\Toniet\Desktop\orqena-experience-v4-audit`. No se incorporan capturas, vídeos, logs, credenciales ni ZIP al historial Git.

## Límites de la fase

No se añade una migración Prisma. No se habilitan correo ni billing reales. No se modifica production. El despliegue autorizado se limita al proyecto y servicio independientes de staging.
