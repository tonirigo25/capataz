# Cierre posterior al despliegue

Estado: `OPERATIONAL_GATES_PASS_EXTERNAL_QA_OPEN`

Este registro separa controles ya ejecutados de decisiones externas que
continúan fail-closed.

## Controles ejecutados

| Acción | Estado | Evidencia resumida |
| --- | --- | --- |
| Primer backup | `PASS` | 2026-07-29T07:28:10Z; 1.155.255 bytes; prefijo checksum `ae61715af3aa`; snapshot abreviado `8d412d8df4e9`; restic check PASS |
| Restore aislado | `PASS` | local efímero; RTO 226 s; pg_restore/checksum/restic full PASS; 7 tablas; 0 huérfanos |
| Rendimiento | `EXECUTED_NO_REGRESSION_FOUND` | 60/60 HTTP 200; home 93/LCP 1809 ms; login 81/LCP 3410 ms |
| Documentos | `PASS_CANARY_EMPTY_SOURCE` | copia diaria `current`/`versions`; restore local del canario versionado PASS, 32 bytes |
| Resend | `PASS_FAIL_CLOSED` | dominio verified; tests oficiales PASS; `EMAIL_LIVE_ENABLED=false` |
| Cron proactivo | `PASS` | custom domain corrigió `HOST_NOT_ALLOWED`; deployment `0ee88832…` SUCCESS |

El restore preservó Production sin cambios y eliminó los temporales. No existe
PITR. El login conserva una observación de arranque JavaScript; no se abrió PR
de rendimiento porque no se detectó una regresión justificante.

## Controles operativos

- Snapshot PostgreSQL cada 6 horas; RPO objetivo 6 horas.
- Snapshot adicional en cada `push` a `main`; Railway Production
  `Wait for CI` está activado y el ruleset exige el check agregador
  `production-backup`. En PR valida contratos sin secretos; en `main` sólo
  pasa después del snapshot cifrado real.
- Retención `28/14/8/12`: últimos/diarios/semanales/mensuales.
- Documentos diarios con `current` y `versions`.
- Retención de versiones de documentos: 365 días.
- Dos claves Restic verificadas y 10 secretos aislados en el environment
  `backup-production`, sin copias de repositorio.
- Issue automática en fallo y cierre tras dos éxitos consecutivos.
- Fallback DPAPI local diario a las 04:53, estado `Ready`.

El primer push del cierre detectó y rechazó una cabecera indentada de
`pg_restore` antes de subir el snapshot. La PR fix-forward #55 acepta
whitespace variable manteniendo el fallo cerrado si la cabecera no existe.

## Pendientes externos

| Acción | Estado |
| --- | --- |
| Aceptación humana | `READY_FOR_EXTERNAL_INPUT` |
| Dispositivos reales | `READY_FOR_EXTERNAL_INPUT` |
| Accesibilidad humana | `READY_FOR_EXTERNAL_INPUT` |
| DNS, DNSSEC y dominios | `NOT_AUTHORIZED` |
| Providers live e indexación | `NOT_AUTHORIZED` |

## Condiciones de escalado

Detener cualquier mutación si el objeto deja de ser privado, si el restore
apunta a Production, si el checksum cambia, si aparece una migración
destructiva o si la reconciliación diverge. No usar rollback destructivo.

## Directorio local atrasado

El worktree principal se confirmó 119 commits por detrás de `origin/main`,
sin cambios versionados y con 12.111 artefactos no versionados
(1.024.302.491 bytes). Ocho perfiles de navegador y una credencial DPAPI se
clasificaron como sensibles y permanecen excluidos de cualquier copia.

Se preservaron fuera del repositorio 282 archivos finales no sensibles
(33.754.530 bytes). No se borró ni sincronizó el material original y el
directorio quedó marcado localmente como no apto para desarrollo. Los nuevos
trabajos deben usar worktrees limpios desde `origin/main`.
