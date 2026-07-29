# Release integrada de Production — 2026-07-28

Estado: `DEPLOYED_AND_OPERATIONALLY_VERIFIED`

## Resultado

- SHA integrado previo:
  `c43c65223daa33cdb34b0e339444f1d0df1416fe`.
- SHA productivo final:
  `6b96f7c5004f4066b7b3167c6d2fe9ee76a4cdae`.
- Tag: `production-2026-07-28`.
- Deployment Railway:
  `daaef968-b01a-4896-9208-74b498e7be51` (`SUCCESS`).

El SHA final contiene readiness F1–F11
`a68a025ddc9589e6e915780156c6191df590fe60`, Field OS D0–D11
`4000390f02f9decbb122015bcd503fa1d2f29aee` e infraestructura
`05820178846208e34a4277f01a1c17c4b71f0770`.

## Integración

- PR #40 integró la release.
- PR #41 cerró los gates de CI.
- PR #42 añadió diagnóstico sanitario.
- PR #43 corrigió las sondas Railway y produjo el SHA productivo final.
- PR #38 se cerró sin fusión directa.
- PR #39 fue fusionada independientemente; el hecho se conserva por
  trazabilidad y su anclaje está incluido en el SHA final.

Los deployments de #40, #41 y #42 no quedaron saludables y no se declaran
releases verdes. El deployment de #43 es el vigente.

## Evidencia de release

- CI `30409864258` y Security `30409864259`: `SUCCESS`.
- 44 migraciones, 0 pendientes, head
  `20260728180000_add_stripe_billing_foundation`.
- `/`, `/login`, live y ready: HTTP 200; TLS válido.
- Primer snapshot cifrado: `PASS`; `2026-07-29T07:28:10Z`;
  1.155.255 bytes; prefijo checksum `ae61715af3aa`; snapshot abreviado
  `8d412d8df4e9`.
- Restore local efímero: `PASS`; RTO 226 s; 7 tablas; 0 huérfanos;
  Production sin cambios; temporales eliminados.
- Rendimiento: 60/60 HTTP 200; home 93/LCP 1809 ms; login 81/LCP
  3410 ms con observación de arranque JavaScript; sin PR de rendimiento.
- Resend: dominio verified, claves de envío scoped en Staging y Production,
  pruebas oficiales PASS y bootstrap revocada. Webhook y live siguen apagados.
- `proactive-evaluator`: recuperado; deployment `0ee88832…` `SUCCESS`.

## Flags fail-closed

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

## Límites

No existe PITR; el modelo es snapshot con RPO objetivo de 6 horas. QA humana,
dispositivos reales y accesibilidad asistida siguen
`READY_FOR_EXTERNAL_INPUT`. Nameservers, DNSSEC, providers live, registro,
indexación y traslado/cancelación de dominios continúan fuera del alcance
autorizado.
