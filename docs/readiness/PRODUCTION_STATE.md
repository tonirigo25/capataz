# Estado canónico de Production

Estado: `PRODUCTION_DEPLOYED_OPERATIONAL_BACKUP_VERIFIED_EXTERNAL_QA_OPEN`

Actualizado: 2026-07-29

Este documento es la fuente canónica del estado productivo posterior a la
release integrada. Sólo recoge hechos técnicos ejecutados y límites externos
que permanecen fail-closed.

## Identidad del release

| Campo | Valor verificado |
| --- | --- |
| Repositorio y rama | `tonirigo25/capataz`, `main` |
| SHA base de producto capturado | `6b96f7c5004f4066b7b3167c6d2fe9ee76a4cdae` |
| Tag | `production-2026-07-28` sobre el mismo SHA |
| Railway Production deployment base capturado | `daaef968-b01a-4896-9208-74b498e7be51` |
| Estado Railway | `SUCCESS` |
| URL de aplicación | `https://app.orqenatech.com` |
| Migraciones | 44 encontradas, 0 pendientes |
| Head de migración | `20260728180000_add_stripe_billing_foundation` |

El SHA productivo contiene como ancestros los anclajes de readiness F1–F11
`a68a025ddc9589e6e915780156c6191df590fe60`, Field OS D0–D11
`4000390f02f9decbb122015bcd503fa1d2f29aee` e infraestructura
`05820178846208e34a4277f01a1c17c4b71f0770`.

La PR de cierre operativo avanza `main` y genera un deployment posterior.
Su SHA/deployment final se obtiene de GitHub y Railway y se entrega en el
registro de ejecución; no se incrusta en el mismo commit para evitar una
referencia circular falsa.

## Gates del release

- CI de `main` run `30409864258`: `SUCCESS`.
- Security and supply chain run `30409864259`: `SUCCESS`.
- Railway Production `Wait for CI`: activado el 2026-07-29; el flujo espera
  los workflows de `main`, incluido el snapshot previo al deploy.
- `/`, `/login`, `/api/health/live` y `/api/health/ready`: HTTP 200.
- Certificado TLS del hostname productivo: válido.
- Railway ejecutó `npm run db:deploy` como predeploy; encontró 44 migraciones
  y terminó con cero pendientes.

## Backup y recuperación verificados

- Bucket R2 privado en la UE: operativo.
- Primer backup: `PASS`, timestamp `2026-07-29T07:28:10Z`, tamaño
  `1.155.255` bytes, checksum SHA-256 conservado sólo como prefijo
  `ae61715af3aa` y snapshot abreviado `8d412d8df4e9`.
- `restic check`: `PASS`.
- Restore drill: `PASS` en PostgreSQL local efímero aislado.
- RTO observado: `226 s`.
- `pg_restore`, checksum y `restic check` completo: `PASS`.
- Reconciliación: 7 tablas, 0 huérfanos y agregados no PII
  `5|6|10|18|5|3`.
- Production no cambió y todos los recursos temporales del drill fueron
  eliminados.
- Modelo: snapshots sin PITR, RPO objetivo de 6 horas.
- Retención: `keep-last=28`, `keep-daily=14`, `keep-weekly=8`,
  `keep-monthly=12`.
- Documentos: automatización diaria con `current` y `versions`; canario
  `PASS` sobre origen vacío; restore del canario versionado `PASS` (32 bytes).
  No se interpreta como prueba de un corpus real.
- Versiones de documentos: retención 365 días.
- Restic: dos claves activas verificadas.
- GitHub: 10 secretos de backup aislados en `backup-production`, cero copias
  equivalentes a nivel de repositorio.
- Fallback local: clave de recuperación protegida con DPAPI del usuario
  actual; tarea diaria a las `04:53`, estado `Ready`.
- Alertas: issue genérica en fallo y cierre automático tras dos ejecuciones
  consecutivas correctas.

No existe PITR ni se declara un rango de recuperación continua.

## Rendimiento productivo

Estado: `EXECUTED_NO_REGRESSION_FOUND`

- 60/60 solicitudes devolvieron HTTP 200.
- No se detectó regresión atribuible a CSS o Railway.
- Lighthouse home: score 93, LCP 1809 ms.
- Lighthouse login: score 81, LCP 3410 ms; observación localizada en arranque
  JavaScript.
- No se abrió una PR de rendimiento porque la ejecución no justificó un cambio
  de código.

## Email y automatización

- Dominio de Resend: `verified`.
- Clave de envío con alcance limitado: configurada en Staging y Production,
  sin registrar su valor.
- Webhook: deshabilitado de forma fail-closed mientras
  `EMAIL_LIVE_ENABLED=false`.
- Pruebas oficiales `delivered`, `bounced`, `complained` y `suppressed`:
  `PASS`.
- Credencial bootstrap: revocada.
- `proactive-evaluator`: recuperado después de `HOST_NOT_ALLOWED` usando el
  custom domain de la aplicación; deployment abreviado `0ee88832…`,
  `SUCCESS`.

## Flags actuales

```text
ORQENA_PUBLIC_REGISTRATION_ENABLED=false
PUBLIC_INDEXING_ENABLED=false
PUBLIC_PRICING_ENABLED=false
FISCAL_ENGINE_ENABLED=false
BILLING_ENABLED=false
EMAIL_LIVE_ENABLED=false
AI_ENABLED=false
ANALYTICS_ENABLED=false
```

La configuración de credenciales o la verificación de un dominio no cambia
estos flags ni autoriza actividad live.

## Gates externos abiertos

| Gate | Estado | Fuente |
| --- | --- | --- |
| Aceptación humana | `READY_FOR_EXTERNAL_INPUT` | `docs/qa/HUMAN_ACCEPTANCE_2026-07.md` |
| Dispositivos reales | `READY_FOR_EXTERNAL_INPUT` | `docs/qa/REAL_DEVICE_MATRIX_2026-07.md` |
| Accesibilidad humana | `READY_FOR_EXTERNAL_INPUT` | `docs/qa/ACCESSIBILITY_HUMAN_TEST_2026-07.md` |
| DNS, DNSSEC y dominios | `NOT_AUTHORIZED` | `docs/operations/EXTERNAL_DECISIONS_REGISTER.md` |
| Providers live e indexación | `NOT_AUTHORIZED` | `docs/operations/EXTERNAL_DECISIONS_REGISTER.md` |

## Límite del lanzamiento

La aplicación está desplegada, pero esta promoción no autoriza cambios de
nameservers, DNSSEC, traslado/cancelación de dominios, Stripe o billing live,
registro público, transmisión fiscal, indexación, email live, IA live ni
analytics.
