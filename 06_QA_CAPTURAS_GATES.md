# QA FINAL, CAPTURAS Y GATES

Ejecutar después de `FLUJOS_Y_SISTEMAS_APROBADOS`.

## Funcional

Validar formulario demo, correos, aprobación, provisioning, invitación, primer login, siete días, expiración, extensión, revocación, cero cobro, límites IA, plantillas, dos tenants, roles y read-only.

## Rutas públicas

`/`, `/producto`, `/funcionalidades`, `/demo`, `/contacto`, `/precios`, `/seguridad`, `/privacidad`, `/terminos`, `/cookies`, `/login`.

## Rutas privadas

`/hoy`, `/dashboard`, `/clientes`, cliente individual, `/obras`, obra individual, `/presupuestos`, `/dinero`, `/tesoreria`, `/documentos`, `/agenda`, `/capataz`, `/equipo`, `/configuracion`, `/plataforma`.

## Viewports y engines

320, 360, 375, 390, 430, 768, 1024, 1440 y 1920 px. Chromium, Firefox y WebKit.

## Estados

Populated, loading, empty, error, restricted, read-only, demo active/expiring/expired, IA disabled/exhausted, provider error, offline y reduced motion.

## Accesibilidad

Axe, teclado, foco, reflow, reduced motion, forced colors, target size y contraste. Mantener como `READY_FOR_EXTERNAL_INPUT`: iPhone, Android, NVDA, VoiceOver y zoom humano.

## Rendimiento

```text
LCP ≤ 2,5 s
INP ≤ 200 ms
CLS ≤ 0,1
```

Comprobar HTML, CSS, JS, imágenes, fonts, cold/warm, redirects, middleware, bundle y ausencia de scroll hijacking.

## Seguridad

Origin, CSRF, MFA plataforma, rate limits, tenant isolation, no secretos, no PII en logs, R2 privado, outbox, idempotencia, autorización directa y revocación de sesión demo.

## Railway

Reutilizar `orqena-review-continuous`, mismo SHA, noindex, health, cero 5xx, cero errores graves, base/volumen preservados y datos sintéticos.

Staging sólo después de las tres aprobaciones humanas. Production no se modifica.

Estado final permitido:

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_DECISION`
