# C10 — Go/no-go de promoción

Estado actual: **NO-GO para producción**.

Este documento es la decisión operativa vigente. No autoriza una promoción y
no sustituye la aprobación humana final. El SHA servido por `review`, su
despliegue y la matriz de revisión se mantienen en `LATEST_REVIEW.md`.

## Review → staging

| Gate | Estado | Evidencia o entrada necesaria |
| --- | --- | --- |
| Review persistente aislado | PASS | `CONTINUOUS_REVIEW_TOPOLOGY.md` |
| Web pública remota | PASS | `LATEST_REVIEW.md` y matriz Playwright |
| Perfiles, permisos, estados y accesibilidad autenticada | IN_PROGRESS | `C5_AUDIT_MATRIX.md`; repetición final del único estado pendiente |
| 43 migraciones y segundo arranque sin pendientes | PASS | pre-deploy y health de Railway |
| Aislamiento tenant y recursos | PASS | fingerprints separados y pentest sintético |
| Secretos, PII y providers live | PASS técnico | escaneo sin hallazgos; todos los providers siguen apagados |
| Release notes y rollback | PASS técnico | matriz D2 y kill switches; canary real pendiente |

No se promueve a staging mientras la matriz autenticada final no sea verde.
Staging permanece intacto.

## Staging → producción

| Gate obligatorio | Estado | Motivo |
| --- | --- | --- |
| Ensayo de las 43 migraciones y backfills sobre copia representativa | READY_FOR_EXTERNAL_INPUT | falta snapshot autorizado, protegido y preferiblemente anonimizado |
| Snapshot/backup previo verificable | READY_FOR_EXTERNAL_INPUT | requiere política, retención y ejecución en el recurso autorizado |
| Restore hermano | PASS lógico en review / READY_FOR_EXTERNAL_INPUT nativo | el restore lógico remoto pasó; Railway Backup/PITR requiere cobertura Pro |
| Gate completo de staging en el SHA exacto | READY_FOR_EXTERNAL_INPUT | no autorizado ni ejecutado para este candidato |
| E2E pública y autenticada del SHA candidato | IN_PROGRESS | pública verde; autenticada en repetición final |
| SHA/tag inmutable y artefacto trazable | IN_PROGRESS | existe RC de origen; el candidato final aún no se ha promovido desde `main` |
| Propietario único de migraciones y rollback | PASS técnico | deploy path único y rollback forward-compatible documentado |
| Aprobación humana y go/no-go firmado | READY_FOR_EXTERNAL_INPUT | no existe aún una aprobación de producción |

La promoción sólo podrá partir de `main` después de que todos los gates
anteriores sean PASS y el go/no-go humano quede registrado. Hasta entonces:

- no se cambia producción;
- no se cambia staging;
- `PUBLIC_INDEXING_ENABLED`, billing, email, fiscal, AI, analytics y cualquier
  otro provider live permanecen desactivados;
- el resultado del restore lógico no se usa como sustituto del ensayo con datos
  representativos ni del backup/PITR de producción.

## C11 posterior al lanzamiento

Las métricas de 30–90 días, pilotos pagados, MRR, retención, costes reales,
soporte, incidentes y comprobación continua de backups son
`READY_FOR_EXTERNAL_INPUT` hasta que exista un lanzamiento autorizado y datos
reales. La estructura técnica del data room puede mantenerse antes del
lanzamiento, pero no convierte esas métricas en evidencia.
