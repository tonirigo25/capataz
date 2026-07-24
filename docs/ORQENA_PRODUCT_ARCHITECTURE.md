# Arquitectura de producto Orqena

Orqena es la marca visible y `/capataz` se conserva como alias técnico compatible. `lib/brand.ts` centraliza nombre, descriptor, metadatos, PWA, remitente futuro y aliases. Los identificadores `CAPATAZ_*`, rutas, históricos y nombres técnicos existentes no se renombran en esta macrofase.

El producto mantiene un núcleo horizontal: clientes, trabajos, ventas, compras, tesorería, agenda, documentos y conversación. `lib/business-profile` adapta terminología y recomendaciones sin duplicar aplicaciones. El perfil sin configurar conserva el comportamiento histórico de construcción.

La empresa activa procede siempre de `requireCompanyContext`; ningún formulario elige `companyId`. Los cambios son aditivos y preservan rutas y datos. Completado localmente y pendiente de integración/publicación autorizada.
# Evolución comercial

La arquitectura de producto de Macrofase 1 se conserva como base funcional. La capa comercial posterior está descrita en `ORQENA_MULTI_COMPANY_ARCHITECTURE.md`, `ORQENA_AUTHORIZATION_MODEL.md`, `ORQENA_PLANS_AND_ENTITLEMENTS.md` y `ORQENA_SUBSCRIPTION_DOMAIN.md`. El contexto de empresa ya no elige silenciosamente la primera membresía cuando existen varias.
