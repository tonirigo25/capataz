# Roles y capacidades

Los roles `OWNER`, `ADMIN`, `MANAGER`, `MEMBER` y `VIEWER` son plantillas versionables, no permisos absolutos. El catálogo tipado vive en `lib/commercial/catalog.ts` y usa claves `domain.action`, sensibilidad, entitlement requerido, soporte de alcance, confirmación y dependencias.

OWNER conserva propiedad, facturación comercial y transferencia. ADMIN administra sin transferir propiedad. MANAGER coordina operación. MEMBER trabaja con capacidades limitadas. VIEWER solo consulta lo concedido. Los overrides por membresía pueden conceder, denegar o limitar alcance, y deben auditarse.
## Perfiles profesionales definitivos

Los doce perfiles son `OWNER`, `GENERAL_MANAGER`, `SALES_MANAGER`, `SALES`, `ADMINISTRATIVE`, `FINANCE`, `PROCUREMENT_MANAGER`, `PROJECT_MANAGER`, `TEAM_SUPERVISOR`, `WORKER`, `EXTERNAL_COLLABORATOR` y `ADVISOR_AUDITOR`. Los alias legacy se resuelven de forma conservadora, sin activar membresías ni invitaciones históricas.

El catálogo contiene 25 paquetes: CRM, presupuestos, pricing, aprobaciones, facturación, compras, facturas recibidas, cobros, pagos, tesorería, banca, fiscalidad, control de proyecto, costes, margen, rentabilidad, operaciones, supervisión, documentos por clase, auditoría, gobierno de accesos y dos niveles de Orqena. Solo `OWNER` puede invitar, revisar, aprobar, rechazar o revocar personas, cambiar perfiles, paquetes, scopes, campos, equipos, autoridades, billing o propiedad. Un gerente puede aprobar negocio dentro de una autoridad delegada, pero nunca administrar permisos.
