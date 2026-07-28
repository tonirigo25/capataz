# Observabilidad operacional, SLO y synthetics

## SLO internos iniciales

- Disponibilidad de rutas críticas: 99,9% mensual.
- Error HTTP 5xx: aviso al 1%, crítico al 2% en 15 minutos.
- Latencia p95: aviso a 1 s, crítico a 2 s.
- Jobs: 99% de éxito; heartbeat máximo 2 veces el intervalo esperado.
- Cola: aviso a 50, crítico a 100; cualquier dead letter abre señal.
- DB p95: aviso a 250 ms, crítico a 500 ms.
- Proveedor: aviso al 1%, crítico al 3% de error.

Los umbrales están versionados en código y se muestran en `/plataforma/observabilidad`. Son objetivos internos, no un SLA contractual público.

## Jobs y synthetic smoke

Programar `POST /api/jobs/operational-monitor` cada 5 minutos y `POST /api/jobs/synthetic-smoke` cada 15 minutos con `JOB_RUNNER_SECRET`. El synthetic sólo usa GET contra landing, login, live y ready; el probe autenticado inyectable debe ser read-only. Cada ejecución persiste estado, duración, assertions, release y hash de evidencia.

La programación real y la aparición de eventos en un proveedor remoto son gates externos. No marcar el monitor como activo basándose sólo en que exista la ruta.

## Error tracking

`ERROR_TRACKING_DSN` vacío desactiva el envío. Cuando se active, `captureConfiguredError` crea un evento sin error original ni stack con PII: sólo mensaje redacted, fingerprint y contexto allowlist. Antes de launch se debe enviar un evento sintético y comprobarlo en el proyecto/entorno correcto.

## Alertas e incidentes

Un umbral o heartbeat vencido crea/actualiza `Incident`; el timeline registra detección. El cierre exige causa, resolución y acciones con responsable/fecha. Severidades y comunicación están en `INCIDENT_RESPONSE.md`.
