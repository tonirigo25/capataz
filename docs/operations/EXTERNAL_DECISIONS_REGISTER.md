# Registro canónico de decisiones externas

Estado: `ACTIVE`

Actualizado: 2026-07-29

La promoción técnica y los controles operativos ejecutados no autorizan
automáticamente DNS, proveedores live ni lanzamiento público.

| ID | Decisión | Estado | Efecto vigente |
| --- | --- | --- | --- |
| EXT-PROD-001 | Desplegar la release integrada | `APPROVED_AND_EXECUTED` | SHA `6b96f7c5004f4066b7b3167c6d2fe9ee76a4cdae` desplegado |
| EXT-BACKUP-001 | Primer backup y política operativa sin PITR | `APPROVED_AND_EXECUTED` | snapshot/restic check PASS; RPO objetivo 6 h; retención 28/14/8/12 |
| EXT-RESTORE-001 | Restore drill aislado | `APPROVED_AND_EXECUTED` | local efímero PASS; RTO 226 s; Production sin cambios |
| EXT-PERF-001 | Medición productiva | `EXECUTED_WITH_OBSERVATION` | 60/60 HTTP 200; login observa arranque JS; sin PR |
| EXT-EMAIL-SETUP-001 | Preparar Resend fail-closed | `APPROVED_AND_EXECUTED` | dominio verified, claves scoped en Staging/Production, tests PASS, bootstrap revocada |
| EXT-DNS-001 | Cambiar nameservers | `NOT_AUTHORIZED` | sin cambio |
| EXT-DNS-002 | Activar DNSSEC | `NOT_AUTHORIZED` | sin cambio |
| EXT-DOMAIN-001 | Trasladar o cancelar dominios | `NOT_AUTHORIZED` | sin cambio |
| EXT-INDEX-001 | Activar indexación pública | `NOT_AUTHORIZED` | `PUBLIC_INDEXING_ENABLED=false` |
| EXT-REG-001 | Abrir registro público | `NOT_AUTHORIZED` | `ORQENA_PUBLIC_REGISTRATION_ENABLED=false` |
| EXT-STRIPE-001 | Activar pricing, Stripe o billing live | `NOT_AUTHORIZED` | `PUBLIC_PRICING_ENABLED=false`; `BILLING_ENABLED=false` |
| EXT-FISCAL-001 | Activar emisión/transmisión fiscal live | `NOT_AUTHORIZED` | `FISCAL_ENGINE_ENABLED=false` |
| EXT-EMAIL-LIVE-001 | Activar email live y webhook | `APPROVED_CONTROLLED` | recuperación, invitaciones y contacto; webhook firmado y replay-safe; sin campañas ni tracking |
| EXT-AI-001 | Activar IA live | `APPROVED_CONTROLLED` | allowlist de empresa; 25 EUR/mes global, 5 EUR/mes por empresa, 50 solicitudes/día por usuario; kill switch y fallback manual |
| EXT-ANALYTICS-001 | Activar analytics | `NOT_AUTHORIZED` | `ANALYTICS_ENABLED=false` |
| EXT-QA-001 | Aceptación humana | `READY_FOR_EXTERNAL_INPUT` | sin firma |
| EXT-QA-002 | Dispositivos reales | `READY_FOR_EXTERNAL_INPUT` | matriz abierta |
| EXT-QA-003 | Accesibilidad humana | `READY_FOR_EXTERNAL_INPUT` | matriz abierta |

## Reglas de cambio

Para cambiar una fila externa a `APPROVED`, registrar autoridad o rol decisor
en el sistema privado, fecha, alcance, entorno, rollback, evidencia no sensible
y SHA/deployment aplicable.

No registrar secretos, datos personales, credenciales, URLs firmadas ni
documentos legales privados. La autorización controlada de IA o correo no
autoriza campañas, registro público, billing, fiscalidad live, analytics ni
indexación, y puede revocarse con sus kill switches sin alterar datos.
