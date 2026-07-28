# Preparación de lanzamiento

> Regla de infraestructura: Staging no compartirá proyecto ni servicio lógico con production.

El staging independiente está en `orqena-staging` y su URL pública es `https://orqena-web-staging.up.railway.app`. El environment compartido fallido fue retirado de forma controlada; el proyecto antiguo conserva únicamente production. La evidencia reproducible se encuentra en los informes de despliegue, migraciones, auditoría visual e incidente del 22 de julio de 2026.

## Completado localmente

Dominio comercial, migración aditiva, guards, superficies administrativas, proveedor de billing local, catálogo demo, suite comercial 78/78, Macrofase 1 55/55, runner 122/122, build y validación visual en cuatro anchuras.

## Preparado técnicamente

Adaptadores desacoplados, configuración central, script local explícito, aislamiento multiempresa y auditoría.

## Pendiente de credenciales

Proveedor transaccional de correo, billing externo y observabilidad externa.

## Pendiente de decisiones comerciales

Precios, periodos, política exacta de gracia, límites públicos y soporte contratado.

## Pendiente de despliegue a production autorizado

Despliegue a production, migraciones de production, configuración comercial remota y publicación. Staging ya está desplegado y validado de forma independiente.

El cierre externo actual mantiene un `review` Railway persistente y aislado. El
dictamen vigente es **NO-GO** y se mantiene en
`docs/readiness/C10_GO_NO_GO.md`: faltan el ensayo de 43 migraciones sobre una
copia representativa autorizada, backup/PITR aplicable, gate completo del SHA
exacto en staging y aprobación humana. El restore lógico remoto de review pasó,
pero no sustituye esos gates.

## Pendiente de revisión jurídica

Textos contractuales, privacidad, fiscalidad, tratamiento de soporte y condiciones de suscripción.

## Pendiente de dominio

Compra, DNS, TLS, remitente y enlaces públicos definitivos.

## Pendiente de proveedor de billing

Cuenta, catálogo, webhooks firmados, conciliación y pruebas en sandbox. Stripe no está operativo.

## Pendiente de correo transaccional real

Proveedor, dominio remitente, plantillas revisadas, rebotes y reputación. No se han enviado correos reales.
## Puerta final de portales profesionales

La release candidate exige una sola migración aditiva de cierre, 12 perfiles, 25 paquetes, gobierno exclusivo del propietario, invitación de doble aprobación, `PortalManifest`, scopes en base de datos, campos económicos separados, outbox local sin persistir enlaces ni tokens, suites focales, runner aislado único, typecheck, build y E2E remoto del SHA desplegado. La provisión y las cuentas de prueba son sintéticas e idempotentes. Producción permanece fuera del proceso.

## Puerta Orqena Experience V4

Experience V4 añade una identidad abstracta reemplazable, activos favicon/PWA, temas Claro/Oscuro/Sistema sin flash, nueve escenas de producto construidas en DOM, catálogos públicos de diez módulos y trece sectores, páginas públicas profundas, workspaces compartidos y clasificación automática de todas las rutas. No añade migraciones ni modifica el dominio de permisos.

La publicación de esta fase queda limitada al staging independiente. Antes del dictamen se exige: suite V4, regresiones focales, route crawl 390/1440, typecheck, build, `git diff --check`, runner aislado único, capturas del SHA final, consola/red limpias, ZIP sin secretos y confirmación del SHA desplegado. Production, registro público, correo real y billing real permanecen sin cambios.

## Puerta de indexación pública

La indexación es un opt-in explícito controlado por `PUBLIC_INDEXING_ENABLED`. La beta privada usa el valor ausente o `false`; solo un lanzamiento público aprobado usa `true`. La activación queda bloqueada hasta disponer de dominio y marca definitivos, revisión legal completa y autorización comercial expresa.
