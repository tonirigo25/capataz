# Orqena Field OS V2 — inventario de rutas

Estado: CURRENT

Baseline de código: `c08ff92f30b8464302ff90760b2c3d28d57fc206`

Baseline remoto Review: `2076a52a7bab4dcc077f0ef63943e9da1e846c24`

## Alcance

La matriz canónica existente en `docs/design/ROUTE_MATRIX.csv` contiene 94 experiencias y sigue siendo la fuente exhaustiva. Este documento añade la lectura V2 sin duplicar esa matriz ni cambiar sus contratos.

| Área | Rutas | Patrón V2 dominante |
| --- | ---: | --- |
| Público | 20 | marketing oscuro, producto visible, demo y captación |
| Configuración | 10 | guided setup y formularios seguros |
| Acceso y autenticación | 9 | acceso compacto, recuperación e invitaciones |
| Compras y subcontratas | 10 | listas operativas, registros y revisión documental |
| Control, análisis y tesorería | 7 | canvas analítico, excepciones y trazabilidad |
| Operación, ejecución y planificación | 9 | work queue, calendario y trabajo 360 |
| Ventas y CRM | 7 | lista con preview, cliente 360, presupuestos y facturas |
| Equipo y plataforma | 7 | gobierno por capacidades y administración minimizada |
| Documentos, IA, automatización, soporte e infraestructura | 15 | inbox, revisión humana y estados operativos |

## Rutas públicas mínimas D13

`/`, `/producto`, `/funcionalidades`, `/demo`, `/contacto`, `/precios`, `/seguridad`, `/privacidad`, `/terminos`, `/cookies`.

Se conserva el gate de indexación. Review debe responder siempre con `noindex, nofollow, noarchive, nosnippet`.

## Rutas privadas mínimas D13

`/hoy`, `/dashboard`, `/clientes`, `/clientes/[id]`, `/obras`, `/obras/[id]`, `/presupuestos`, `/dinero`, `/tesoreria`, `/documentos`, `/agenda`, `/capataz`, `/equipo`, `/configuracion`, `/plataforma`.

El acceso efectivo sigue derivándose de `lib/commercial/authorization.ts`, `lib/commercial/portal-manifest.ts` y el contexto de empresa del servidor. Ocultar un enlace no sustituye la autorización directa de la ruta.

## Arquetipos

- Work queue: Hoy, agenda, alertas y recomendaciones.
- Lista + preview: clientes, presupuestos, facturas y documentos.
- Record + action rail: cliente 360, trabajo 360, proveedores y subcontratas.
- Editor + live preview: presupuestos y plantillas documentales.
- Inbox + review: lector documental, propuestas IA y outbox.
- Analytical canvas: dashboard, dinero, tesorería y plataforma.
- Guided setup: onboarding, empresa y configuración.

## Baseline visual

Captura no destructiva sobre `orqena-review-continuous`, con datos sintéticos:

- rutas: `/`, `/demo`, `/login`;
- viewports: 390, 768, 1024 y 1440 px;
- 12 de 12 casos HTTP 200;
- cero overflow horizontal;
- cero imágenes rotas;
- cero infracciones Axe serias o críticas;
- noindex presente en todos los casos.

Evidencia local: `artifacts/design-v2/baseline-2076a52/report.json`.

## Límites

Este rediseño no crea rutas paralelas, no sustituye APIs ni mueve reglas de negocio a componentes visuales. Los estados reales, importes, permisos, tenant isolation, idempotencia y confirmaciones permanecen en sus autoridades actuales.
