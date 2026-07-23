# Roles y capacidades

Los roles `OWNER`, `ADMIN`, `MANAGER`, `MEMBER` y `VIEWER` son plantillas versionables, no permisos absolutos. El catálogo tipado vive en `lib/commercial/catalog.ts` y usa claves `domain.action`, sensibilidad, entitlement requerido, soporte de alcance, confirmación y dependencias.

OWNER conserva propiedad, facturación comercial y transferencia. ADMIN administra sin transferir propiedad. MANAGER coordina operación. MEMBER trabaja con capacidades limitadas. VIEWER solo consulta lo concedido. Los overrides por membresía pueden conceder, denegar o limitar alcance, y deben auditarse.
## Perfiles funcionales iniciales

Los perfiles son `OWNER`, `PURCHASING_MANAGER`, `GENERAL_MANAGER`, `ADMINISTRATIVE`, `SALES`, `WORK_MANAGER`, `WORKER`, `VIEWER` y `EXTERNAL_COLLABORATOR`. Sus etiquetas visibles se centralizan por sector, mientras la seguridad permanece estable. Propietario y Jefe de compras son los únicos perfiles económicos. La pantalla Configuración → Equipo → Roles y acceso asigna perfiles y muestra excepciones; bloquea autoelevación, cambios cross-tenant y concesiones económicas incompatibles.
