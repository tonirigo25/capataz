# Planes y entitlements

Los planes centralizados son `STARTER`, `PROFESSIONAL`, `BUSINESS` y `ENTERPRISE`. No se publican precios: permanecen nulos hasta una decisión comercial aprobada. El comportamiento funcional consulta entitlements, no compara directamente el nombre del plan.

Los valores soportan booleanos, enteros, decimales, strings y enums. Los overrides empresariales tienen vigencia y motivo. Los tenants existentes usan el fallback seguro STARTER hasta ejecutar el script local/controlado de configuración.
