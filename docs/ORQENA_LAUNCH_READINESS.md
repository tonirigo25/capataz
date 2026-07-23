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

## Pendiente de revisión jurídica

Textos contractuales, privacidad, fiscalidad, tratamiento de soporte y condiciones de suscripción.

## Pendiente de dominio

Compra, DNS, TLS, remitente y enlaces públicos definitivos.

## Pendiente de proveedor de billing

Cuenta, catálogo, webhooks firmados, conciliación y pruebas en sandbox. Stripe no está operativo.

## Pendiente de correo transaccional real

Proveedor, dominio remitente, plantillas revisadas, rebotes y reputación. No se han enviado correos reales.
## Puerta final de privacidad y roles

La release candidate requiere la migración aditiva de propietario de conversación y perfil funcional, preflight legacy sin contenido, suite `test:orqena-final-product-closure`, suites focales, runner aislado, typecheck, build y validación remota del SHA desplegado. La integración generativa real continúa separada y requiere una credencial específica de staging.
