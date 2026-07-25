# Implementación final de producto Orqena

## Alcance de la release candidate

Esta entrega sustituye la matriz rígida de roles por un modelo profesional compuesto por 12 perfiles, 25 paquetes funcionales, scopes por membresía, visibilidad explícita de campos y autoridades de aprobación. El contrato `PortalManifest` determina en servidor qué navegación, inicio, acciones rápidas, dominios de búsqueda y notificaciones, clases documentales, configuración y herramientas de Orqena recibe cada persona.

La única migración de cierre es `20260724150000_orqena_professional_portals_closure`. Es aditiva, conserva invitaciones históricas para revisión y clasifica documentos legacy como restringidos antes de dejar `OPERATIONAL` como valor por defecto para documentos nuevos.

## Gobierno y seguridad

Solo una membresía `OWNER` activa puede invitar, revisar, aprobar, rechazar o revocar invitaciones; modificar perfiles, paquetes, scopes, campos, equipos y autoridades; suspender o revocar accesos; gestionar plan y transferir la propiedad. Todas esas mutaciones revalidan empresa, objetivo y pertenencia en servidor, incrementan `accessVersion`, cierran sesiones cuando corresponde y registran auditoría.

Los perfiles profesionales son: propietario, dirección general, dirección comercial, comercial, administración, finanzas, compras, responsable de proyecto, supervisor de equipo, trabajador, colaborador externo y asesor/auditor. `READ_ONLY` conserva únicamente operaciones de lectura. Los perfiles operativos y externos reciben scope restringido por defecto; las consultas de clientes, trabajos, agenda, tareas, recordatorios, documentos, búsqueda y Orqena incorporan el alcance antes de leer filas.

Precio de venta, coste de compra, coste interno, margen porcentual, margen absoluto, beneficio, tesorería, banca y fiscalidad son capacidades separadas. Una política de campo nunca amplía la frontera del perfil. Las aprobaciones combinan capability y autoridad vigente con límites de importe, descuento y margen.

## Ciclo de empleado y outbox

El propietario crea una invitación con perfil, paquetes, modo, trabajo, equipos, límite y caducidad. Solo se persiste el hash de un token opaco de un uso. El empleado acepta con el mismo correo y queda `pending_owner_approval`, sin poder seleccionar empresa ni leer datos. El propietario puede previsualizar el portal resultante, modificar la propuesta, aprobar, rechazar o revocar. La aprobación materializa accesos en una transacción y activa la membresía.

El outbox local conserva evento, plantilla, destinatario, estado, intentos y relación con la invitación. El enlace seguro se genera de forma transitoria durante el procesamiento y no se persiste en payload, HTML ni auditoría. Staging bloquea proveedores de correo externos.

## Producto interno y web pública

Hoy se genera desde el manifiesto y solo consulta agenda cuando forma parte del portal. El shell no renderiza rutas o acciones no autorizadas. Agenda mantiene relaciones fijas entre cliente y trabajo, los filtros se compactan, el acceso restringido siempre explica el motivo y el chat recibe únicamente contexto autorizado. Configuración reserva datos societarios, facturación y gobierno al propietario.

La web pública incorpora rutas de producto, sectores, planes, seguridad, demo y contacto, activos WebP sintéticos, navegación responsive, metadatos, sitemap y formularios con validación. Las solicitudes de demo se registran como datos neutrales para la plataforma y no ejecutan correo ni cobro real.

## Validación y publicación

La validación funcional aislada aplica las 25 migraciones y comprueba resolución de los 12 perfiles, manifiestos, 84 decisiones de autorización, gobierno del propietario, campos, solo lectura e invitación completa. La publicación se limita a la rama autorizada y al proyecto independiente de staging. Producción no se consulta para datos empresariales ni se modifica.

Los runners PostgreSQL utilizan un runtime común de puertos efímeros de loopback. Comprueban disponibilidad, reintentan el arranque con un máximo acotado, conservan el log de fallo, informan suite, puerto y directorio de datos, y terminan únicamente el árbol de procesos propio. La regresión focal ocupa deliberadamente un puerto y demuestra tanto el fallback como el código no cero cuando se prohíbe una alternativa.

El cierre local del 24 de julio de 2026 ejecutó el runner completo después de typecheck y build: 128/128 pruebas superadas, 0 fallos, 0 timeouts y 122 puertos hijo dinámicos. El informe JSONL contiene un resultado por prueba, el cierre global y el evento de limpieza. Este último confirmó PostgreSQL detenido, 0 handles y 0 requests abiertos; la comprobación externa confirmó además 0 procesos y 0 directorios propios residuales y los puertos de runner cerrados.

La revisión de seguridad de cierre bloquea cualquier mutación indirecta de Orqena si falta `orqena.execute`, la capacidad funcional específica o scope `COMPANY`; `READ_ONLY` no puede escribir mediante el chat. El contexto enviado a un proveedor de IA omite identificadores, nombres, direcciones, números, conceptos, relaciones y texto libre persistido. Las lecturas previas respetan capacidades, scopes y visibilidad de campos del `PortalManifest`.

Los SHA, deployment, E2E remoto, capturas, artefactos y hash del ZIP se registran al cerrar la release candidate.

## Experience V4

La capa de experiencia se consolida sin reabrir seguridad ni persistencia. La marca visible se centraliza en `lib/brand.ts`; Relay sustituye los símbolos heredados y se entrega como SVG, favicon, Apple Touch Icon e iconos PWA. El wordmark permanece como texto.

Los temas Claro, Oscuro y Sistema comparten tokens semánticos, prehidratación sin flash, persistencia local, sincronización entre pestañas, impresión clara y cobertura de superficies públicas y autenticadas. El sistema de movimiento controla viewport, visibilidad, foco, puntero, teclado, ciclos y movimiento reducido.

La web pública consume nueve escenas interactivas y catálogos centrales para diez módulos y trece sectores. Planes usa capacidades y límites reales sin publicar precios ficticios; Demo cambia sector y perfil sin llamadas externas; registro público continúa cerrado.

En producto autenticado, `ListWorkspace`, `RecordWorkspace` y `RecordPeek` organizan listados y fichas sin cambiar consultas o autorizaciones. Cliente 360 y Trabajo 360 conservan fronteras económicas y `PortalManifest`. `RouteExperienceManifest` clasifica automáticamente las 77 rutas existentes y su validador exige una coincidencia exacta por página.

La suite V4 se añade como única suite nueva. La documentación de detalle está en `docs/ORQENA_EXPERIENCE_V4.md`; los artefactos visuales y de auditoría se mantienen fuera del repositorio.
