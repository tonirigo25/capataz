# Informe local de Macrofase 1

La transformación introduce marca central Orqena, perfiles sectoriales, onboarding reanudable, relaciones contextuales, filtros compactos, arquitectura conversacional modular, continuidad estructurada, completitud, propuestas con confirmación y memoria controlada.

## Compatibilidad

Se conservan `/capataz`, variables `CAPATAZ_*`, nombres de scripts, migraciones históricas, modelos Prisma y plantillas físicas cuyos nombres forman parte de contratos existentes. La migración es aditiva, no ejecuta actualizaciones masivas y no borra datos.

## Seguridad

La empresa procede de sesión; los IDs se validan por tenant y relación; las confirmaciones pertenecen a empresa y conversación y caducan. El audio solo produce texto editable. No se afirma cumplimiento regulatorio.

## Estado

Completado localmente y pendiente de integración/publicación autorizada. No incluye billing, Stripe, plataforma interna, selector multiempresa comercial, roles finales ni despliegue; esos asuntos quedan aplazados a Macrofase 2.

## Validación de cierre

La validación visual local es reproducible con `npm run validate:orqena-visual`. El runner crea una base PostgreSQL aislada, aplica la cadena completa de migraciones y recorre 25 superficies operativas en 390, 768, 1024 y 1440 px mediante Google Chrome headless. La ejecución final generó 101 capturas y comprobó overflow horizontal, errores de consola, la hoja móvil de filtros, cierre con Escape, restauración de foco y compositor del chat visible sobre la navegación.

Los listados con criterios de consulta usan el contenedor común de filtros compactos, con formulario en escritorio y hoja inferior en móvil. El flujo principal de conversación delega persistencia, enrutado, presentación y cierre de turno en el servicio de conversación de Orqena; contexto, resolución, planificación, confirmación, ejecución, completitud y memoria permanecen separados en sus servicios dedicados.
