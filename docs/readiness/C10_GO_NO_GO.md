# C10 — Go/no-go de promoción

> **HISTORICAL / SUPERSEDED — 2026-07-29.** Este documento conserva la
> decisión previa a la promoción. Ya no es la fuente del estado vigente.
> Consultar `docs/readiness/PRODUCTION_STATE.md`.

Estado histórico en el momento de esta decisión: **NO-GO para producción**.

Este documento fue la decisión operativa previa a la promoción. No sustituye
el registro productivo posterior ni la aprobación humana final. El SHA servido
por `review`, su despliegue y la matriz de revisión de aquel momento se
mantienen en `LATEST_REVIEW.md`.

## Review → staging

| Gate | Estado | Evidencia o entrada necesaria |
| --- | --- | --- |
| Review persistente aislado | PASS | `CONTINUOUS_REVIEW_TOPOLOGY.md` |
| Web pública remota | PASS | `LATEST_REVIEW.md` y matriz Playwright |
| Perfiles, permisos y estados autenticados automatizados | PASS | D10 Review amplio y D11 staging multiengine; `D11_STAGING_EVIDENCE.json` |
| Dispositivos, AT, zoom y baseline humanos | READY_FOR_EXTERNAL_INPUT | iOS/Android físicos, NVDA/VoiceOver, zoom real y aprobación visual |
| Presupuesto público C3 | PASS automatizado | Review LCP 2200 ms y staging 2180 ms; CLS 0 e INP 24 ms |
| 43 migraciones y segundo arranque sin pendientes | PASS | pre-deploy y health de Railway |
| Aislamiento tenant y recursos | PASS | fingerprints separados y pentest sintético |
| Secretos, PII y providers live | PASS técnico | escaneo sin hallazgos; todos los providers siguen apagados |
| Release notes y rollback | PASS técnico | matriz D2, kill switches y staging canary; ejecución productiva condicionada |

El propietario autorizó la promoción del candidato cerrado a staging. El SHA
funcional `2be6a99040c70c67fe2f91c0737f4c17bd116451` quedó desplegado y pasó el
gate D11. Las entradas manuales siguen `READY_FOR_EXTERNAL_INPUT`; no se
reinterpretan como PASS ni bloquean el resto del trabajo automatizable.

## Staging → producción

| Gate obligatorio | Estado | Motivo |
| --- | --- | --- |
| Ensayo de las 43 migraciones y backfills sobre copia representativa | READY_FOR_EXTERNAL_INPUT | falta snapshot autorizado, protegido y preferiblemente anonimizado |
| Snapshot/backup previo verificable | READY_FOR_EXTERNAL_INPUT | requiere política, retención y ejecución en el recurso autorizado |
| Restore hermano | PASS lógico en review / READY_FOR_EXTERNAL_INPUT nativo | el restore lógico remoto pasó; Railway Backup/PITR requiere cobertura Pro |
| Gate completo de staging en el SHA exacto | PASS automatizado | público 576, auth 360 Axe, journey 25, health/noindex y 0 bloqueadores |
| E2E pública y autenticada automatizada | PASS en review y staging | hardware/AT/manual siguen externos |
| SHA/tag inmutable y artefacto trazable | IN_PROGRESS | existe RC de origen; el candidato final aún no se ha promovido desde `main` |
| Propietario único de migraciones y rollback | PASS técnico | deploy path único y rollback forward-compatible documentado |
| Aprobación humana y go/no-go firmado | READY_FOR_EXTERNAL_INPUT | no existe aún una aprobación de producción |

La promoción sólo podrá partir de `main` después de que todos los gates
anteriores sean PASS y el go/no-go humano quede registrado. Hasta entonces:

- no se cambia producción;
- staging conserva únicamente el candidato exacto, sintético, noindex y con providers off;
- `PUBLIC_INDEXING_ENABLED`, billing, email, fiscal, AI, analytics y cualquier
  otro provider live permanecen desactivados;
- el resultado del restore lógico no se usa como sustituto del ensayo con datos
  representativos ni del backup/PITR de producción.

## Decisión registrada

- Decisión: `NO-GO`.
- Alcance autorizado y ejecutado: `review` aislado y staging independiente.
- Staging: candidato exacto D11 verde.
- Producción: sin cambios.
- Motivos decisivos: snapshot representativo, backup/PITR nativo y aprobación
  humana aún `READY_FOR_EXTERNAL_INPUT`; SHA/tag desde `main` no creado.

## C11 posterior al lanzamiento

Las métricas de 30–90 días, pilotos pagados, MRR, retención, costes reales,
soporte, incidentes y comprobación continua de backups son
`READY_FOR_EXTERNAL_INPUT` hasta que exista un lanzamiento autorizado y datos
reales. La estructura técnica del data room puede mantenerse antes del
lanzamiento, pero no convierte esas métricas en evidencia.
