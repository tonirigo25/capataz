# Capataz — roadmap maestro de producto, UX y producción

Fecha de auditoría: 17 de julio de 2026

Base examinada: rama local `codex/suppliers-subcontractors-expenses`, HEAD `2070d9b54eed8e4eb5df3976cba69f48b0f48d17`

Alcance: auditoría estática del repositorio, documentación y evidencia de pruebas existente. No se ha accedido a Railway ni a producción.

Fuente de verdad visual y de experiencia: [`docs/CAPATAZ_PRODUCT_DESIGN_MANUAL.md`](./CAPATAZ_PRODUCT_DESIGN_MANUAL.md). Todo trabajo de producto, UX o interfaz debe seguir ese manual.

## 1. Resumen ejecutivo

Capataz ya es una aplicación de gestión vertical amplia: tiene autenticación y sesiones reales, aislamiento por empresa, CRM, obras, ciclo de presupuestos y facturación, cobros, tesorería, compras, proveedores, subcontratas, lector documental privado, agenda, tareas, automatizaciones, inteligencia de negocio y un chat con historial, contexto, voz y confirmaciones. La base funcional supera la de un prototipo.

El principal problema ya no es la falta de módulos, sino la coherencia de producto y producción. Nueve rutas implementadas están reescritas a `modulo-no-disponible`; la navegación sigue enlazándolas; documentación y textos comerciales todavía afirman que no existe autenticación real; la PWA puede almacenar respuestas autenticadas sin una política de datos; y Capacitor permite tráfico claro y contenido mixto. Además, la experiencia muestra demasiadas áreas a la vez y mezcla modelos de identidad heredados con los actuales.

La dirección recomendada es estabilizar primero el producto visible y su contrato de seguridad, crear después un sistema visual común y simplificar `Hoy` y la navegación. Las integraciones externas, suscripciones y publicación móvil deben esperar. La IA debe conservar revisión humana y confirmación explícita; nunca debe enviar comunicaciones ni escribir datos ambiguos automáticamente.

## 2. Estado actual verificado

- Aplicación: Next.js 15, React 19, TypeScript, Prisma 6 y PostgreSQL; salida standalone.
- Persistencia: 20 migraciones versionadas, desde `20260621000000_init` hasta `20260717120000_procurement_management`.
- Identidad: `User`, `Company`, `CompanyMembership`, `Session`, tokens de verificación/restablecimiento y `SecurityAuditEvent`.
- Producto: 50 páginas/rutas visuales o de documento y 8 endpoints Route Handler localizados.
- Pruebas: 109 scripts `test:*`; el runner agregado aislado pasó 109/109, sin fallos ni timeouts.
- Aislamiento de prueba: PostgreSQL en `127.0.0.1`, base `capataz_test_all`, con `CAPATAZ_TEST_DATABASE_ISOLATED=true`.
- Despliegue declarado: una sola ruta de migración en `preDeployCommand`; el arranque no repite migraciones.
- Estado funcional reciente: proveedor/subcontrata, factura recibida, pagos, gasto enlazado, tesorería, costes de obra y lector documental están implementados en la rama local auditada.
- PD-4 · Inteligencia operativa y contexto de negocio: **Completada localmente** con señales deterministas, explicables, enlazables y aisladas por empresa; pendiente de publicación e integración autorizadas.
- PD-5 · Control económico, tesorería y previsión por vencimientos: **Completada localmente** con posición registrada, cobros y pagos trazables, previsión determinista por documentos y rentabilidad de obra; pendiente de publicación e integración autorizadas.
- Límite de esta auditoría: no se ha verificado en vivo el estado remoto, Railway, producción ni tiendas móviles.

## 3. Arquitectura existente

| Capa | Implementación observada | Evaluación |
|---|---|---|
| Presentación | App Router en `app`, componentes React en `components`, Tailwind y Lucide | Amplia, pero navegación y densidad necesitan consolidación. |
| Aplicación | Server Actions por dominio y Route Handlers para estado, exportaciones, PDFs, descargas, cron y transcripción | Buen enfoque server-first; algunas acciones, especialmente chat, son demasiado grandes. |
| Dominio | Módulos en `lib` para autenticación, tenant, obras, tesorería, documentos, procurement, IA y automatizaciones | Cobertura alta; faltan fronteras más claras en chat y modelos heredados. |
| Datos | Prisma/PostgreSQL, 20 migraciones y modelos con `companyId` | Base sólida; conviven `UsuarioPerfil`/`Empresa` y `User`/`Company`. |
| IA | Cliente/modelos configurables, motor local, OpenAI opcional, extracción documental por proveedor y transcripción | Degradación parcial sin clave; debe unificarse el contrato de disponibilidad. |
| Archivos | Almacenamiento documental privado configurable fuera de `public`, descarga autenticada | Correcto para lector; logos, sello y fotos aún no usan una política única. |
| Procesos | Evaluación proactiva y automatizaciones mediante endpoints internos/cron | Implementados, pero parte de la UI está ocultada por middleware. |
| Entrega | Railway standalone, healthcheck, predeploy de migración; PWA y shells Capacitor | Web preparada; PWA/móvil requieren endurecimiento antes de publicación. |

## 4. Inventario de módulos

Leyenda: **Hecho** = flujo principal implementado y probado; **Parcial** = existe pero faltan capacidades o cierre; **Simulado** = experiencia o datos de demostración sin servicio final; **Pendiente** = sin implementación funcional; **Bloqueado** = existe código, pero no es accesible en el producto actual.

La columna “Evidencia” resume rutas/componentes, endpoints/actions, modelos/migraciones y pruebas. “Cierre” combina problemas, dependencias, riesgo, trabajo pendiente y criterio verificable de terminado.

| # | Módulo y estado | Evidencia | Cierre requerido |
|---:|---|---|---|
| 1 | Autenticación — **Hecho** | `/login`, `/registro`, recuperación, restablecimiento y verificación; `app/(auth)/actions.ts`; `User` y tokens; migración `identity_sessions`; tests auth | Corregir documentación obsoleta y validar rate limiting distribuido. Terminado cuando registro, verificación, login, bloqueo y recuperación pasen E2E sin revelar existencia de cuentas. |
| 2 | Usuarios — **Parcial** | `User`, membresías, perfil en configuración, acciones de perfil; tests de identidad | No hay gestión administrativa completa de miembros/roles. Terminado con alta, baja, cambio de rol y auditoría, siempre dentro de empresa. |
| 3 | Sesión — **Hecho** | `lib/auth/session.ts`, `Session`, cookies y tests `auth-sessions` | Añadir matriz E2E de expiración, revocación, cambio de contraseña y múltiples dispositivos. |
| 4 | Separación multiempresa — **Hecho** | `Company`, `CompanyMembership`, `requireCompanyContext`, `companyId`; migraciones ownership; tests multitenancy | Mantener revisión obligatoria para cada ruta nueva. Terminado cuando una matriz automatizada cubra lectura, escritura, agregados, archivos y exportaciones. |
| 5 | Perfil personal — **Hecho** | `/configuracion#perfil`, `UsuarioPerfil` y vínculo de usuario; actions/settings tests | Retirar gradualmente el modelo heredado sin perder datos. Terminado con una fuente de verdad documentada y migración reversible. |
| 6 | Configuración de empresa — **Hecho** | `/configuracion`, acciones; `Company`/`Empresa`; settings y numbering tests | Separar claramente perfil, empresa, facturación y plan; validar permisos por rol. |
| 7 | Clientes — **Hecho** | `/clientes`, `/clientes/[id]`, CRM components/actions; `Client`, `Contact`; migración CRM; `test:crm-clientes` | Añadir estados transversales de carga/error y acción contextual de Capataz. |
| 8 | Leads — **Parcial** | Estados/origen y seguimiento dentro de `Client`; CRM y follow-ups | No existe embudo separado ni conversión explícita. Terminado con estados simples, origen, siguiente acción y conversión sin duplicar cliente. |
| 9 | Obras — **Hecho** | `/obras`, detalle y actions; `Work`, documentos/fotos; migración work operations; tests works/detail/chat | Fotos y algunos botones indican integración futura. Terminado con carga privada real, permisos y acciones completas. |
| 10 | Presupuestos — **Hecho** | `/presupuestos`, detalle, plantillas, PDF; actions; `Budget`; tests PDF/chat/block2 | Revisar PDF legal y seguimiento reproducible. Terminado con aceptación, numeración atómica, conversión a obra y documento profesional validado. |
| 11 | Facturas emitidas — **Hecho** | `/dinero`, detalle y PDF; actions; `Invoice`; tests block2/numbering | Completar tipologías fiscales y rectificativas. Terminado tras validación legal española independiente y separación total de notas internas. |
| 12 | Cobros — **Hecho** | `/dinero`, `registerPayment`; `Payment`; tests de chat, tesorería e integración | Añadir conciliación y trazabilidad visual uniforme. Terminado cuando saldo, tesorería e idempotencia coincidan ante reintentos. |
| 13 | Pagos parciales — **Hecho** | `Payment`, `PurchaseInvoicePayment`, saldos y movimientos; procurement/treasury tests | Unificar representación visual de cobros y pagos parciales y probar anulaciones concurrentes. |
| 14 | Proveedores — **Hecho** | `/proveedores`, detalle/actions, `procurement-partners`; `BusinessPartner`; migración procurement; `test:procurement` | Añadir estados comunes y Capataz contextual; preservar historial fiscal/económico. |
| 15 | Subcontratas — **Hecho** | `/subcontratas`, detalle, componente compartido; oficio, RC y estado documental en `BusinessPartner`; procurement tests | Terminado con avisos de caducidad accionables, documentos privados y validación de permisos. |
| 16 | Facturas recibidas — **Hecho** | rutas separadas proveedor/subcontrata; `PurchaseInvoice` y pagos/historial; procurement tests | Mejorar bandeja común y filtros sin borrar la distinción legal. Terminado con gasto único enlazado, vencimientos, anulaciones e idempotencia. |
| 17 | Gastos — **Hecho** | `/gastos-materiales`, lector/actions; `Expense`; migrations expense reader/procurement; tests expense/procurement | Reducir mezcla visual con materiales y asegurar que cada origen económico genera una sola salida. |
| 18 | Tesorería — **Hecho** | `/tesoreria`, export; `FinancialAccount`, `CashMovement`, flujos y settings; suite treasury | Pantalla muy densa. Terminado con jerarquía por saldo, próximos movimientos y escenarios, más conciliación y estados vacíos. |
| 19 | Materiales — **Hecho** | `/gastos-materiales`, gestión; `Material`; tests documents/works/block2 | Separar compra, necesidad y consumo por obra en la UX; evitar duplicar gasto de factura recibida. |
| 20 | Costes de obra — **Hecho** | detalle de obra, `Expense`, compras y `lib/works.ts`; profitability/procurement tests | Mostrar procedencia y reconciliación de cada coste. Terminado cuando materiales, subcontrata y generales cuadren con tesorería. |
| 21 | Márgenes y desviaciones — **Hecho** | obra, inteligencia y tesorería; agregados; business/treasury tests | Exponer fórmula y fecha de cálculo. Terminado con enlaces a partidas, filtros reproducibles y explicación de desviaciones. |
| 22 | Agenda — **Hecho** | `/agenda`, actions; `EventoAgenda`; tests agenda/chat | Integrar tareas, hitos, vencimientos y documentos con una taxonomía única, sin enviar calendarios externos. |
| 23 | Recordatorios — **Hecho** | `/recordatorios`, gestión; `Reminder`; block2/chat tests | Diferenciar aviso interno de comunicación externa preparada; exigir confirmación para cualquier envío futuro. |
| 24 | Seguimiento comercial — **Bloqueado** | `/seguimientos`, detalle/actions; `FollowUp`, intentos/resultados; automation suite | Middleware oculta la ruta. Terminado al decidir su exposición, probar navegación y mantener toda comunicación en borrador confirmable. |
| 25 | Dashboard Hoy — **Hecho** | `/hoy`; prioridad, métricas, agenda, acciones y actividad; `test:dashboard-hoy` | Evolucionar, no reconstruir: atención accionable, máximo seis KPI enlazables, agenda temporal, facturas recibidas y entrada global de IA. |
| 26 | Buscador global — **Bloqueado** | `/buscar`, formulario en cabecera; server query; `test:global-search` | Middleware lo oculta aunque la navegación enlaza. Terminado al exponerlo con tenant scope, estados de carga y teclado/móvil. |
| 27 | Chat Capataz — **Bloqueado** | `/capataz`, `CapatazChat`, actions/motor; `ChatMessage`; tests ai/parser/engine/routing | Middleware lo oculta; actions supera una frontera razonable. Terminado tras dividir dominio, unificar disponibilidad y E2E de confirmaciones. |
| 28 | Historial de chats — **Bloqueado** | UI crear/abrir/renombrar/archivar/borrar; `ChatConversation`; migration chat conversations; test conversations | Persistencia PostgreSQL existe. Terminado con paginación, borrado/retención definidos y pruebas multiusuario/multiempresa. |
| 29 | Contexto conversacional — **Bloqueado** | `activeTask`, contexto recuperado, mensajes y `ChatActionLog`; migration conversation state; routing/query tests | Faltan entradas contextuales homogéneas desde todas las entidades. Terminado con referencias inequívocas y campos pendientes persistentes. |
| 30 | Voz y transcripción — **Parcial** | `MediaRecorder`, edición en input, `POST /api/capataz/transcribe`, modelo configurable; chat tests parciales | Requiere OpenAI, devuelve error técnico sin clave y no declara rate limit/formato estricto. Terminado con mensaje seguro, límites, consentimiento y E2E; nunca enviar antes de editar. |
| 31 | Memoria de negocio — **Parcial** | historial/contexto, estados de señales y `PartnerLearning` por empresa; tests recommendations/procurement | No es memoria semántica general. Terminado con alcance explícito, explicación, corrección, retención y borrado por empresa. |
| 32 | Confirmaciones de IA — **Hecho** | tarjetas editables, `confirmadoPorUsuario`, `AutomationConfirmation`, `ChatActionLog`; chat/automation tests | Mantener confirmación server-side, actor y clave idempotente. Terminado cuando ninguna escritura sensible o comunicación externa pueda saltársela. |
| 33 | PDFs — **Parcial** | rutas PDF de presupuesto/factura y `lib/simple-pdf.ts`; tests document PDF | Generación existe, pero falta cierre fiscal/legal y QA tipográfica de casos extremos. Terminado sin texto interno y validado con NIF, IVA/IRPF, series y rectificativas. |
| 34 | Archivos — **Parcial** | `/documentos`, plantillas, `Document`, `WorkDocument`, descarga autenticada; document tests | Hay varias estrategias de archivo. Terminado con política única de storage, metadatos, retención, antivirus y autorización. |
| 35 | Logos — **Simulado** | `logoUrl` en empresa/configuración/PDF; icono demo | No hay pipeline de upload privado validado. Terminado con formatos/tamaño, recorte, almacenamiento y fallback accesible. |
| 36 | Sellos — **Simulado** | `selloUrl` en empresa/configuración/PDF | Igual que logos; además exigir control de permisos y uso explícito por documento. |
| 37 | Uploads — **Parcial** | lector PDF/JPEG/PNG/WEBP, 10 MB, firma/MIME/extensión, storage privado; fotos/logos pendientes | Generalizar solo después de definir servicio y amenazas. Terminado con cuotas, escaneo, limpieza, tenant namespace y pruebas traversal. |
| 38 | Email — **Parcial** | proveedor Resend para verificación y reset; desarrollo seguro; `RESEND_API_KEY`/`EMAIL_FROM` | No hay envío comercial. Terminado con cola, plantillas, reintentos, auditoría y previsualización/confirmación para mensajes a clientes. |
| 39 | WhatsApp — **Pendiente** | Solo aparece como origen/canal o intención documental | Definir proveedor y cumplimiento antes de implementar. Todo mensaje debe prepararse, editarse, confirmarse y auditarse. |
| 40 | Google Calendar — **Pendiente** | Sin cliente OAuth ni sincronización | Requiere modelo de conexión, scopes mínimos, revocación, deduplicación y resolución de conflictos. |
| 41 | Outlook — **Pendiente** | Sin integración Microsoft/OAuth | Mismos criterios que calendario; no mezclar con login hasta definir necesidad. |
| 42 | Suscripciones — **Simulado** | Enlace `configuracion#suscripcion`, modos demo/test/production | Sin entitlement real. Terminado con planes versionados, permisos server-side, estados de pago y periodo de gracia. |
| 43 | Stripe — **Pendiente** | Sin dependencia, endpoints ni modelos Stripe | Implementar solo después de planes y fiscalidad; webhooks firmados, idempotencia, portal y pruebas. |
| 44 | Modo demo — **Parcial** | `NEXT_PUBLIC_APP_MODE`, límites y seed demo; `/demo-guiada` bloqueada | Seed heredado borra datos y no está protegido como flujo comercial. Terminado con tenant efímero, reset seguro y separación absoluta de producción. |
| 45 | PWA — **Parcial** | `app/manifest.ts`, `public/service-worker.js`, icono | Service worker cachea GET autenticados de forma indiscriminada. Terminado con estrategia explícita, exclusiones privadas, versionado, offline seguro y pruebas. |
| 46 | Android — **Parcial** | Capacitor y proyecto Android; scripts de sync/AAB | `cleartext` y mixed content están activos. Terminado con configuración por entorno, firma, permisos, QA y checklist de tienda. |
| 47 | iOS — **Parcial** | Capacitor y proyecto iOS; scripts de apertura | Falta firma, privacidad, permisos, revisión en dispositivos y publicación. No prometer soporte hasta completar tienda. |
| 48 | Seguridad — **Parcial** | auth, tenant, audit, path protection, errores sanitizados y tests safety | Faltan CSP/cabeceras explícitas, rate limits distribuidos, política PWA, antivirus y revisión móvil. Terminado con threat model y auditoría externa. |
| 49 | Auditoría — **Parcial** | `SecurityAuditEvent`, `ChatActionLog`, historiales procurement/proactive/automation | No hay visor/retención unificados. Terminado con eventos críticos normalizados, actor, empresa, correlación y exportación autorizada. |
| 50 | Pruebas — **Hecho** | 109 `test:*`, runner aislado, suites de dominio, DB safety y migraciones | Muchas son validaciones de scripts, no E2E de navegador. Terminado con pirámide documentada, CI y escenarios críticos reales a 390/768/1440. |
| 51 | Observabilidad — **Parcial** | `/api/status`, auditorías y algunos diagnósticos | Sin proveedor de métricas/trazas/alertas visible. Terminado con SLO, latencia/error rate, jobs, DB y alertas sin datos personales. |
| 52 | Logs — **Parcial** | logs de arranque, desarrollo y procesos; sanitización localizada | Falta política central. Terminado con niveles, correlación, redacción, retención y prohibición testeada de secretos/documentos. |
| 53 | Gestión de errores — **Parcial** | `app/(app)/error.tsx` y errores de dominio | Solo un límite visual general y pocos estados por ruta. Terminado con not-found/error/loading por flujo y recuperación sin duplicar escrituras. |
| 54 | Onboarding — **Parcial** | registro, verificación, configuración y demo guiada bloqueada | Terminado con progreso de perfil/empresa, primer cliente/presupuesto y ayuda contextual medible. |
| 55 | Preparación legal — **Parcial** | privacidad, términos, cookies, datos fiscales y PDFs | Requiere revisión jurídica, consentimiento/cookies, DPA/proveedores, retención, derechos RGPD y facturación española. |
| 56 | Preparación comercial — **Parcial** | textos/store assets, modo demo, soporte y PWA/móvil | Material obsoleto y sin planes reales. Terminado con propuesta coherente, onboarding, analítica consentida, soporte, precios y capturas del producto real. |

## 5. Matriz de estado

| Estado | Módulos | Lectura ejecutiva |
|---|---|---|
| Hecho | 1, 3, 4, 6, 7, 9–25 salvo 24, 32, 50 | El núcleo de gestión y control humano está construido. “Hecho” no equivale aún a validación comercial o legal. |
| Parcial | 2, 5, 8, 30, 31, 33, 34, 37, 38, 44–49, 51–56 | Hay una base utilizable, pero faltan políticas, cierre UX, operación o validación externa. |
| Simulado | 35, 36, 42 | La interfaz o el dato existe, pero no el servicio final seguro. |
| Pendiente | 39–41, 43 | Integraciones externas y pagos no están implementados. |
| Bloqueado | 24, 26–29; además alertas, recomendaciones, inteligencia, automatizaciones, tareas y demo guiada | El código existe, pero middleware impide el acceso normal. |

## 6. Diferencias entre documentación y código

1. `README.md`, `README_DEPLOY.md` y textos de tienda aún indican que no existe login real; el código contiene autenticación, verificación, recuperación, sesiones y auditoría.
2. Documentos antiguos presentan módulos como próximos o cerrados con conteos de pruebas anteriores, mientras el repositorio ya tiene 109 pruebas y más migraciones.
3. La documentación de despliegue afirma que uploads/storage son futuros o efímeros; el lector documental ya implementa storage privado configurable, aunque no todos los archivos usan ese servicio.
4. Navegación y documentos describen Capataz, búsqueda, alertas, recomendaciones, inteligencia, tareas, seguimientos y automatizaciones como disponibles; `middleware.ts` los oculta.
5. PDFs aparecen en algunos textos como borrador, pero existen rutas descargables; a la vez, todavía falta validación fiscal/legal definitiva.
6. Store assets describen una experiencia demo antigua y no deben publicarse hasta alinearlos con autenticación y producto visible.
7. La documentación histórica de producción es evidencia fechada, no una garantía del estado actual; debe separarse de las guías vigentes.

## 7. Problemas críticos

- Resolver el contrato de módulos ocultos: no se puede enlazar desde navegación a rutas reescritas como no disponibles.
- Evitar cachear páginas o respuestas autenticadas en la PWA sin exclusiones y política de usuario/empresa.
- Desactivar `cleartext` y `allowMixedContent` en builds móviles de producción.
- Definir una sola fuente de verdad para perfil/empresa antes de retirar `UsuarioPerfil` y `Empresa`.
- Corregir documentación pública que niega autenticación y describe un producto distinto.
- Someter PDFs fiscales y textos legales a revisión profesional antes de uso comercial.

## 8. Riesgos de seguridad

| Riesgo | Impacto | Mitigación/aceptación |
|---|---|---|
| Cache PWA de GET autenticados | Exposición de datos tras cerrar sesión o compartir dispositivo | No cachear HTML/API privadas; limpiar por logout/versión; probar cambio de usuario y empresa. |
| HTTP claro/mixed content móvil | Intercepción o downgrade | Configuración por entorno; solo HTTPS en release; ATS/Network Security Config restrictivos. |
| Uploads heterogéneos | Traversal, malware, fuga cross-tenant | Servicio privado único, validación binaria, cuotas, antivirus, namespace tenant y descarga autorizada. |
| Transcripción externa | Audio y datos personales enviados a proveedor | Consentimiento, límites, política de retención, aviso claro, redacción de errores y modo no configurado. |
| Roles incompletos | Acciones administrativas por usuarios no autorizados | Matriz de permisos server-side y tests por rol. |
| Logs dispersos | Exposición de PII, tokens o documentos | Logger central con redacción y retención; tests negativos. |
| Comunicaciones futuras | Envío accidental | Borrador editable, confirmación explícita server-side, idempotencia y auditoría. |

## 9. Riesgos de producción

- No existe evidencia en esta auditoría de CI obligatorio, checks remotos o estrategia automática de rollback de aplicación y migración.
- Las variables de ejemplo de staging/production no están alineadas con `.env.example`; validar nombres, nunca valores, antes de desplegar.
- El almacenamiento local requiere volumen persistente y backup probado; no debe asumirse por documentación.
- Cron/automatizaciones necesitan autenticación interna, exclusión mutua, idempotencia, alertas y manual de recuperación.
- La semántica de modos demo/test/production debe imponerse en servidor; una variable pública no es un control de seguridad.
- Las 2 vulnerabilidades moderadas heredadas de Next/PostCSS son riesgo conocido no bloqueante de esta fase, pero requieren una actualización controlada separada.

## 10. Deuda técnica relevante

- `app/(app)/capataz/actions.ts` concentra demasiadas intenciones, consultas y escrituras; dividir por parser, consulta, propuesta, confirmación y persistencia.
- Modelos heredados `UsuarioPerfil`/`Empresa` conviven con `User`/`Company`.
- `gestion` funciona como formulario polimórfico grande y acopla muchos dominios.
- Hay componentes/acciones compartidos correctamente para procurement, pero rutas duplicadas pueden divergir en textos y estados.
- Solo `clientes` tiene un `loading.tsx` dedicado; faltan estados transversales consistentes.
- Seed heredado ejecuta `deleteMany` y no está diseñado como demo multiempresa segura.
- Documentación histórica, operativa y comercial está mezclada sin estado de vigencia.

## 11. Auditoría funcional

El flujo `cliente → presupuesto → aceptación → obra → factura → cobro` existe, así como el flujo de compra `documento/factura recibida → revisión humana → gasto → pago → tesorería → coste y margen de obra`. Los dos están cubiertos por modelos, acciones y suites específicas.

Fortalezas: numeración por empresa, pagos parciales, saldos, idempotencia en chat/automatizaciones, confirmación humana, lector privado, facturas recibidas diferenciadas y aprendizaje determinista por empresa.

Huecos: leads no forman un embudo explícito; fotos/logos/sellos no comparten storage final; comunicaciones externas, calendarios, suscripciones y Stripe no existen; fiscalidad y PDFs necesitan validación externa. Los módulos ocultos deben tratarse como bloqueados, no como producto disponible.

## 12. Auditoría de UX

| Área | Hallazgo | Acción futura |
|---|---|---|
| Objetivo/usuario | Adecuado para autónomo/pyme, pero la amplitud se acerca a un ERP | Priorizar tareas diarias y revelar detalle bajo demanda. |
| Acción principal | Hay botón flotante “Añadir” y Capataz, más acciones por pantalla | Una primaria por contexto; rápidas limitadas a acciones frecuentes. |
| Navegación | 25 enlaces en tres secciones y rutas bloqueadas | Reducir nivel principal; agrupar administración en “Más”. |
| Densidad | Tesorería, detalle de obra y gestión concentran mucha información | Resumen primero, listas/tablas para comparación, secundarios en pestañas/acordeones. |
| Filtros | Existen en listados, pero no siempre son reproducibles desde KPI | Usar parámetros URL estables y enlaces desde `Hoy`. |
| Formularios | Reutilización amplia, pero `gestion` mezcla dominios | Formularios por intención con validación y retorno previsibles. |
| Estados | Hay empty states y error global; loading dedicado escaso | Patrón común loading/empty/error/success/offline. |
| Confirmaciones | Chat y operaciones sensibles muestran revisión | Trasladar el control a servidor y estandarizar copy/actor/idempotencia. |
| Móvil | Drawer, controles táctiles y FAB existen; bottom nav de 10 elementos es excesiva | Máximo 4 destinos y “Más”; revisar teclado, safe areas y 390 px. |

## 13. Auditoría visual

La identidad actual usa negro/gris y amarillo de obra de forma muy dominante. Es reconocible, pero puede transmitir plantilla temática y competir con estados de alerta. La interfaz usa tarjetas con frecuencia, sombras y numerosos iconos; la jerarquía se debilita cuando todo tiene el mismo peso.

Dirección: fondo neutro cálido, superficies claras, azul petróleo o verde azulado propio, acento cálido moderado, estados semánticos independientes y una sola familia de iconos. El color de cada empresa debe limitarse a documentos, cabeceras y detalles de identidad, nunca alterar contraste o estados globales. Antes de rediseñar, documentar tokens y validar contraste WCAG, foco, zoom, reducción de movimiento y tamaños táctiles.

Esta auditoría no arrancó la aplicación ni repitió la validación visual; usa estructura de código y evidencia visual previa de la fase. Toda decisión debe revalidarse a 390, 768 y 1440 px con datos vacíos, normales y extremos.

## 14. Decisión sobre Dashboard Hoy

Se conserva `Hoy`. Ya contiene resumen diario, prioridades, seis métricas, agenda, acciones rápidas y actividad; no debe reconstruirse desde cero.

Evolución objetivo:

1. **Necesita tu atención:** vencidos, presupuestos sin respuesta, visitas, tareas, desviaciones, documentos/seguros y facturas recibidas. Cada fila abre, resuelve o pospone y permite consultar a Capataz.
2. **Negocio de un vistazo:** máximo seis KPI elegidos por utilidad, con fórmula y enlace a listado filtrado.
3. **Agenda:** ahora, después, hoy, mañana y próximos días; unificar eventos, tareas, compras, hitos y caducidades.
4. **Acciones rápidas:** presupuesto, cobro, gasto, cliente, visita, factura recibida y dictado a Capataz.
5. **Actividad reciente:** eventos de negocio legibles, nunca logs técnicos.
6. **Entrada IA global:** “¿Qué ha pasado hoy? Escribe o dicta…”, con transcripción editable y confirmación antes de guardar.

Terminado cuando las cinco zonas tengan carga, vacío, error, enlaces reproducibles y validación 390/768/1440 sin aumentar ruido visual.

## 15. Estrategia de IA transversal

- **Global:** entrada en `Hoy` para texto o voz.
- **Contextual:** “Preguntar a Capataz sobre este elemento” en cliente, obra, presupuesto, factura, factura recibida, proveedor, subcontrata y gasto; enviar identificador server-side validado y tipo, nunca un `companyId` confiado al cliente.
- **Proactiva:** sugerencias discretas, explicables y con origen/fecha: preparar recordatorio, crear aviso o seguimiento. Nunca enviar ni escribir directamente.
- **Contrato:** respuesta útil sin OpenAI cuando exista motor determinista; estado “no configurado” sanitizado para funciones que dependan de clave; propuesta editable; confirmación explícita; actor y clave idempotente; auditoría del resultado.
- **Calidad:** conjunto de casos reales españoles, ambigüedad, negación, importes/fechas, homónimos, reintentos y separación cross-tenant.

## 16. Historial y memoria de chat

La persistencia en PostgreSQL, creación/cambio/renombrado/archivo/borrado de conversaciones, `activeTask`, mensajes y logs ya existen. `localStorage` solo recuerda el hilo seleccionado, no es fuente de verdad.

Pendiente: definir retención y borrado; paginar; probar concurrencia entre pestañas; mantener referencias tipadas a cliente/obra/documento/economía; mostrar campos pendientes; permitir corregir memoria aprendida; asegurar que usuario y empresa filtran todas las consultas. Un hilo terminado debe recuperar contexto tras relogin, no cruzar empresas y pedir aclaración ante más de una coincidencia.

## 17. Voz y transcripción

El chat graba con `MediaRecorder`, envía el audio a `/api/capataz/transcribe`, inserta la transcripción en el campo de texto y permite editar antes de enviar. El endpoint limita a 25 MB, usa español y `gpt-4o-mini-transcribe` por defecto.

Pendiente: estado sanitizado sin `OPENAI_API_KEY`, autenticación y rate limit explícitos, allowlist de formatos, límite de duración, consentimiento/privacidad, cancelación, accesibilidad y pruebas móviles. El audio no debe conservarse por defecto ni el texto ejecutarse automáticamente.

## 18. Arquitectura de navegación

Escritorio recomendado: `Hoy`, `Clientes`, `Obras`, `Presupuestos`, `Facturas y cobros`, `Agenda`, `Más`. En “Más”: gastos, proveedores, subcontratas, materiales, recordatorios, catálogo/documentos, empresa y configuración. Alertas y Capataz entran como acciones globales, no como otra docena de destinos equivalentes.

Móvil recomendado: `Hoy`, `Obras`, acción central `+`, `Agenda`, `Más`; búsqueda y Capataz accesibles desde cabecera/contexto. El `BottomNav` actual de diez elementos no es viable en 390 px. Antes de cambiar rutas, medir frecuencia, resolver módulos bloqueados, conservar URLs y añadir redirecciones/telemetría consentida.

## 19. Sistema de diseño

Crear primero tokens de color, tipografía, espacios, radios, elevación, iconos y breakpoints. Después normalizar botones, inputs, textarea, select/combobox, fechas/horas, buscador, badges/estados, tarjetas, filas, tablas responsive, acordeones, pestañas, menús, modales, confirmaciones, toasts, banners, skeletons, empty/error states y navegación móvil.

Reglas: tarjetas para resumen; listas para actividad; tablas para comparación; filas compactas en móvil; paneles solo con contexto. Cada componente debe cubrir disabled/loading/error, teclado, foco visible, lector de pantalla, contraste, zoom 200% y objetivos táctiles. Un catálogo documentado con pruebas visuales evita divergencias.

## 20. Estrategia móvil

1. Priorizar PWA segura y responsive antes de tiendas.
2. Corregir cache privado y probar instalación, actualización, logout, offline y cambio de cuenta.
3. Configurar Capacitor por entorno; HTTPS obligatorio en release, permisos mínimos de micrófono/cámara/archivos y enlaces universales.
4. Probar Android/iOS reales: teclado, safe areas, subida/descarga, PDF, voz, interrupciones, red lenta y reanudación.
5. Preparar privacidad de tiendas, capturas, firma, soporte y proceso de releases solo tras paridad web.

## 21. Roadmap por fases

| Fase | Objetivo y entregables | Salida verificable |
|---|---|---|
| 0. Cierre y estabilización | Publicar/integrar fases cerradas con autorización; alinear docs; resolver rutas bloqueadas; inventario de variables; PWA/móvil seguro; deuda de identidad planificada | Producto visible coherente, 109+ pruebas aisladas y ningún enlace a módulo no disponible. |
| 1. Fundamentos de producción | Roles, storage común, uploads, rate limits, observabilidad, errores, auditoría, backup/restore, CI | Threat model cerrado, pruebas críticas E2E y runbooks de incidente/rollback. |
| 2. Sistema visual | Tokens, componentes, navegación, responsive, accesibilidad y estados | Catálogo aprobado y regresión visual 390/768/1440. |
| 3. Dashboard Hoy | Atención, KPI, agenda, rápidas, actividad y entrada IA | Cada elemento accionable/enlazable y estados completos. |
| 4. Ciclo comercial/económico | Leads, cliente, presupuesto, aceptación, obra, factura, cobro y saldos | Recorrido E2E idempotente, PDF validado y trazabilidad económica. |
| 5. Operación de obra | Compras, gastos, proveedores, subcontratas, materiales, costes, margen, archivos y agenda | Costes reconciliados, caducidades accionables y storage único. |
| 6. IA transversal | Contexto por entidad, historial/memoria, voz, campos pendientes, confirmaciones y sugerencias | Casos de ambigüedad/tenant/idempotencia aprobados; cero envío automático. |
| 7. Integraciones | Email comercial, WhatsApp, calendarios y storage externo; planes/Stripe después | OAuth/webhooks/colas auditados, desconexión y reintento seguros. |
| 8. PDFs y cumplimiento | Plantillas, identidad, fiscalidad, tipos documentales, RGPD y legales | Validación jurídica/fiscal y pruebas de documentos extremos. |
| 9. Pulido comercial | Onboarding, demo segura, ayuda, PWA, tiendas, analítica, soporte, landing y pruebas de usuario | Checklist de lanzamiento, soporte y métricas con consentimiento. |

## 22. Dependencias entre fases

```text
Fase 0 (coherencia y seguridad inmediata)
  └─ Fase 1 (fundamentos de producción)
       ├─ Fase 2 (sistema visual)
       │    ├─ Fase 3 (Hoy)
       │    ├─ Fase 4 (ciclo comercial)
       │    └─ Fase 5 (operación de obra)
       ├─ Fase 6 (IA transversal), tras estabilizar entidades de 4 y 5
       └─ Fase 7 (integraciones), tras permisos, auditoría e idempotencia
Fase 8 (cumplimiento) acompaña 4, 5 y 7 y bloquea lanzamiento
Fase 9 comienza solo cuando 0–8 tienen criterios de salida aplicables
```

Stripe depende de planes/entitlements; calendarios de una agenda estable; email/WhatsApp de borradores y confirmación; IA contextual de referencias tipadas; publicación móvil de PWA, seguridad y producto visible coherentes.

## 23. Criterios de aceptación

- Toda lectura/escritura deriva empresa y usuario de sesión y tiene prueba cross-tenant.
- Ninguna comunicación externa o escritura de IA ocurre sin previsualización editable y confirmación explícita server-side.
- Reintentos no duplican cobros, gastos, facturas, movimientos, tareas ni mensajes.
- Todas las pantallas principales tienen carga, vacío, error, éxito y permisos insuficientes.
- Navegación no enlaza rutas bloqueadas y funciona con teclado, lector y móvil.
- Archivos se validan por firma/MIME/extensión, se guardan fuera de `public` y se descargan con autorización.
- PDFs no contienen notas internas y pasan revisión fiscal/legal española.
- PWA no conserva contenido privado tras logout/cambio de usuario; móvil release solo usa HTTPS.
- Build, typecheck, migración limpia/incremental/rollback aplicable y runner aislado pasan en CI.
- Logs y errores no contienen secretos, documentos completos ni PII innecesaria.

## 24. Pruebas necesarias

- Unitarias: parsers, cálculos fiscales, saldos, márgenes, permisos, sanitización y reducers de estado.
- Integración PostgreSQL: constraints, transacciones, concurrencia, idempotencia, migraciones y tenant isolation.
- E2E navegador: auth, onboarding, presupuesto a cobro, compra a pago, lector, chat/voz, errores y permisos.
- Contrato: OpenAI/Resend/OAuth/Stripe mediante dobles deterministas, nunca servicios reales en regresión.
- Seguridad: traversal, MIME spoofing, CSRF/origen, rate limit, sesión revocada, IDOR y logs.
- Visual/accesibilidad: 390/768/1440, zoom 200%, teclado, screen reader, contraste, contenido largo y estados extremos.
- PWA/móvil: offline, actualización, cache, logout, permisos, subida/descarga, micrófono y red interrumpida.
- Operación: backup/restore, fallo predeploy, cron duplicado, rollback y alertas.

## 25. Elementos fuera de alcance

No forman parte de esta fase documental: rediseño, nuevas funciones, modificación de middleware, despliegue, Railway, producción, migraciones, configuración remota, proveedores externos, comunicaciones reales, Stripe, publicación en tiendas, cambios de dependencias o corrección automática de auditoría npm.

## 26. Primera fase recomendada

Ejecutar **Fase 0 — coherencia de acceso, documentación y seguridad de cliente** en una rama separada después de integrar la fase actual. Alcance propuesto:

1. Decidir, módulo por módulo, cuáles de las nueve rutas bloqueadas se exponen y cuáles se retiran de navegación.
2. Actualizar README, despliegue y store assets para describir autenticación y storage reales.
3. Sustituir el cache indiscriminado del service worker por una política segura.
4. Separar configuración Capacitor local de release y prohibir cleartext/mixed content en producción.
5. Unificar estados loading/empty/error en las rutas de mayor uso sin rediseñar su identidad.
6. Documentar la transición `UsuarioPerfil`/`Empresa` a `User`/`Company`; no migrar datos todavía.

No incluye integraciones, nueva IA, navegación final ni rediseño. Termina cuando no hay contradicción entre ruta, navegación y documentación; PWA/móvil cumplen el mínimo seguro; y las pruebas existentes más nuevos contratos focales pasan.

## 27. Archivos que probablemente afectaría

- Acceso/navegación: `middleware.ts`, `components/app-chrome.tsx`, `components/bottom-nav.tsx` y layouts.
- Documentación: `README.md`, `README_DEPLOY.md`, `docs/*.md` vigente y `store-assets/*.md`.
- PWA/móvil: `app/manifest.ts`, `public/service-worker.js`, `capacitor.config.ts`, proyectos Android/iOS y pruebas asociadas.
- Estados UI: componentes UI compartidos y `loading.tsx`/`error.tsx` de rutas prioritarias.
- Identidad: solo documento de migración y tests en la primera fase; cambios a `prisma/schema.prisma` quedarían para una fase autorizada posterior.

La lista es una previsión, no autorización para modificarlos.

## 28. Riesgos de ejecución

- Exponer módulos ocultos puede revelar flujos no validados en producción; usar feature gate server-side y aceptación por módulo.
- Cambiar navegación puede romper enlaces guardados; conservar URLs y medir/redirigir.
- Cambiar service worker puede dejar caches antiguos; incrementar versión y limpiar de forma comprobada.
- Migrar identidad puede perder ownership; usar migración aditiva, backfill idempotente y verificación antes de borrar legado.
- Dividir chat puede alterar idempotencia/contexto; añadir characterization tests antes.
- Ajustar PDFs puede cambiar numeración o totales; separar presentación de cálculo y congelar fixtures fiscales.

## 29. Plan de rollback

Cada fase debe usar commits pequeños y una migración por responsabilidad. Antes de datos: backup verificado, consulta de invariantes y ensayo en copia aislada. Preferir cambios aditivos y dual-read temporal; no eliminar columnas en el mismo despliegue que el backfill.

Para frontend/PWA: conservar artefacto anterior, versionar cache y poder desactivar la nueva navegación/función mediante gate server-side. Para integraciones: kill switch, cola pausable e idempotency keys. Para migraciones: rollback SQL probado cuando sea seguro o roll-forward documentado cuando revertir destruya datos. La reversión nunca debe depender de `reset --hard`, force push ni SQL improvisado en producción.

## 30. Checklist previo a producción

- [ ] Rama y commits revisados, CI obligatorio verde y artefacto reproducible.
- [ ] Migración limpia e incremental probada; único responsable de migrate confirmado.
- [ ] Backup y restauración ensayados; runbook y rollback aprobados.
- [ ] Variables requeridas validadas por nombre sin imprimir valores; secretos fuera de Git/logs.
- [ ] Auth, sesión, roles y matriz multiempresa E2E aprobados.
- [ ] PWA no cachea datos privados; logout/cambio de cuenta limpia estado.
- [ ] Capacitor release usa HTTPS, permisos mínimos y configuración de tienda revisada.
- [ ] Uploads/storage con volumen, cuotas, antivirus, backup y descarga autenticada.
- [ ] PDFs y fiscalidad española revisados; notas internas ausentes.
- [ ] IA sin clave degrada con mensaje seguro; con clave conserva revisión/confirmación.
- [ ] Email/WhatsApp/calendario desactivados hasta aprobación; ningún envío automático.
- [ ] Rate limits, CSP/cabeceras, redacción de logs y retención documentados.
- [ ] Healthcheck, métricas, alertas, cron, colas y soporte operativo comprobados.
- [ ] UX 390/768/1440, accesibilidad, carga/vacío/error y contenido extremo aprobados.
- [ ] Textos legales, privacidad, cookies, encargados y derechos RGPD revisados.
- [ ] Onboarding, soporte, términos comerciales y materiales de tienda coinciden con el producto real.
