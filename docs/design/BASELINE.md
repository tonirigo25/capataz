# Baseline de diseño Orqena Field OS

## Fuente

- SHA: `21412ff4a500394ea97939fd604374612b44dcda`
- Rama de origen: `codex/orqena-external-closure`
- Árbol e índice: limpios.
- Fecha de evidencia remota: 26-27 de julio de 2026.

## Capturas disponibles

El baseline remoto autenticado usa exclusivamente fixtures sintéticos:

- 11 perfiles.
- `/hoy` a 320, 390, 768, 1024, 1440 y 1920 px por perfil.
- 46 familias de superficie OWNER a 1440 px.
- empty, loading, error, offline, teclado y reflow equivalente.
- ubicación local ignorada: `artifacts/review-auth/`.

La captura local reproducible existente se ejecuta con:

```powershell
$env:CAPATAZ_EMBEDDED_POSTGRES_ROOT='C:\Users\Toniet\AppData\Local\Capataz\embedded-postgres-qa'
npm run validate:orqena-visual
```

Ese validador provisiona PostgreSQL aislado, datos sintéticos y un servidor local; captura 17 rutas en 390, 768, 1024 y 1440 px y destruye el runtime que crea.

La captura pública remota D0 se ejecuta con:

```powershell
$env:ORQENA_DESIGN_ALLOW_REMOTE_CAPTURE='true'
$env:ORQENA_DESIGN_SHA='<sha desplegado>'
npm run design:capture-baseline
```

No requiere credenciales, no envía formularios y solo permite el origen estable de Railway Review.

## Gates base

- CI final del SHA base: aplicación, navegador, base de datos crítica, CodeQL, supply-chain, Prisma y Railway review, todos verdes.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS.
- `npm run readiness:scan-secrets`: PASS, 1.019 archivos y 0 hallazgos.
- `npm run test:deploy-migration-owner`: PASS.
- Review: 43 migraciones, ninguna pendiente.

## Límites

- El baseline automatizado no sustituye Safari real, Chrome Android real, NVDA, VoiceOver ni zoom humano.
- No existe afirmación de capacidad de producción.
- LCP local de portada `2623 ms`: continúa abierto frente al objetivo `2500 ms`.
- Las imágenes de baseline no se versionan para evitar PII accidental y crecimiento del repositorio; se versionan manifiestos y reportes sanitizados.

