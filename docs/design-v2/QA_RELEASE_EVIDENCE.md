# Orqena Field OS V2 — evidencia de QA de release

## Evidencia activa — corrección PR #63, Gate 1, revisión 2

- Rama y PR conservadas: `design/orqena-field-os-v2`, PR `#63` Draft.
- Superficie: marketing público y demo guiada pública únicamente.
- Viewports comprobados: 390 px, 768 px y 1440 px.
- Hero: cinco estados funcionales distintos, con KPIs, gráficos, estados,
  microacciones y contenido de producto propios.
- Portada: siete secciones; sin repetición de FAQ, ROI, formulario persistente
  ni bloques históricos que alargaban la narrativa.
- Demo: recorrido editable y confirmable, compactado a tres minutos y sin
  desplazamiento horizontal en tablet.
- Capturas y comparación canónica:
  `artifacts/design-v2/correction-pr63/gate-1-revision-2/`.
- Production, base de datos, migraciones, providers y portal autenticado: sin
  cambios y fuera de alcance.
- Resultado automatizado: PASS; aprobación humana: pendiente.

> **ESTADO ACTUAL — GATE 1 ÚNICAMENTE.** El objetivo histórico de producción
> que aparece más abajo queda superseded. La entrega activa es una revisión de
> portada y navegación en Railway Review; requiere aprobación visual humana y
> no autoriza merge ni Production.

## Evidencia activa — corrección PR #63

- Rama: `design/orqena-field-os-v2`.
- PR existente: `#63` (Draft).
- Entorno a reutilizar: `orqena-review-continuous`.
- Capturas: ocho archivos en
  `artifacts/design-v2/correction-pr63/gate-1/`.
- Contratos focales: origen canónico, release SHA, subset D10, rutas CTA,
  enlaces de megamenús y puente de interacción.
- Portal autenticado, base de datos, migraciones y Production: fuera de alcance
  y sin cambios.
- Estado de propietario: `READY_FOR_EXTERNAL_INPUT` hasta recibir
  `PORTADA_Y_MENU_APROBADOS`.

## Evidencia histórica / superseded

Fecha: 2026-07-30  
Objetivo: `ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_REVIEW`

## Entorno

- URL: `https://orqena-review-web-review.up.railway.app`
- Environment reutilizado: `orqena-review-continuous / review`
- Datos: fixtures sintéticos existentes, preservados
- Indexación: `noindex`
- Production: sin cambios

## Gates locales

Pasaron:

- `git diff --check`
- lint y typecheck
- build de producción
- validadores de tokens y web pública D2
- fundamentos visuales y navegación del shell
- contratos D5, D6, D7 y D8
- matriz D9: 94 rutas, 0 huérfanas
- acceso por rutas y hostname
- IA, documentos, PDF, lector de gasto, CRM, obra y plataforma de lanzamiento
- sistema proactivo: evaluación, lifecycle, scheduler, locking, cooldown,
  reactivación, auditoría, mantenimiento, chat e integración
- escaneo de secretos

No se usó como gate el validador histórico
`test:orqena-commercial-platform`: conserva aserciones textuales previas a la
refactorización y ya era deuda del baseline. Los contratos actuales equivalentes
sí pasaron.

## Baseline y comparación visual

El baseline anterior se capturó en 390, 768, 1024 y 1440 px para `/`, `/demo` y
`/login`: 12 respuestas 200, cero overflow, cero imágenes rotas, cero
violaciones Axe serias/críticas y `noindex` presente.

La fuente aprobada y la implementación remota se compararon en una única
composición:

`artifacts/design-v2/source-review-comparison.png`

La diferencia respecto al baseline se registra como rediseño intencionado. No se
usa una tolerancia de píxeles para fingir que el cambio visual no existe.

## QA pública

La matriz D10 cubre:

- Chromium, Firefox y WebKit;
- 320, 390, 430, 768, 1024, 1280, 1440 y 1920 px;
- 26 rutas públicas, incluidos los alias `/funcionalidades` y `/precios`;
- estado HTTP, H1, `main`, overflow, imágenes, `noindex`, PII, secretos;
- Axe WCAG 2 A/AA, 2.1 AA y 2.2 AA;
- reduced motion, forced colors, foco, reflow equivalente a 200 %;
- LCP, CLS e INP sintéticos;
- tres cargas de rendimiento;
- capturas y diferencias contra baseline.

El detalle machine-readable se conserva bajo
`artifacts/design-v2/d10-public-9e86a799/`.

La primera ejecución exhaustiva detectó contraste en demo/beta/precios,
objetivos táctiles en Seguridad y una medición LCP posterior a una interacción.
Se corrigieron con tokens AA, objetivos de 44 px y separación de LCP/CLS frente
a INP. La ejecución focal posterior valida los mismos selectores en el SHA
final.

## QA autenticada

La matriz autenticada usa únicamente usuarios sintéticos de Review y cubre:

- OWNER con MFA;
- WORKER;
- EXTERNAL_COLLABORATOR;
- ADVISOR_AUDITOR en solo lectura;
- Chromium, Firefox y WebKit;
- móvil 390 px y escritorio 1440 px;
- `/hoy`, dashboard, cliente, obra, presupuesto, factura, documentos, agenda,
  Capataz, equipo, configuración y plataforma;
- aislamiento de sesión, rutas por rol, solo lectura, overflow, imágenes,
  errores de navegador y Axe.

Las credenciales se leen del entorno autenticado y no se escriben en los
artefactos, repositorio o logs.

La primera ejecución autenticada detectó el verde de éxito sobre blanco y
`greenSoft` por debajo de AA en dashboard/agenda. El token semántico de texto de
éxito se separó del verde de marca y se fijó en un valor AA sobre ambas
superficies.

## Interacción comprobada

- La portada canónica muestra el H1 aprobado.
- Producto y Soluciones abren megamenús accesibles.
- `aria-expanded` refleja el estado real.
- `Escape` cierra el megamenú.
- El CTA de demo utiliza el formulario y endpoint existentes.
- Los endpoints de salud permanecen fuera de redirecciones de marketing.

## Controles no automatizables

Quedan `READY_FOR_EXTERNAL_INPUT`, sin afirmar resultados:

- Safari en iPhone real;
- Chrome en Android real;
- instalación y actualización PWA en dispositivo real;
- NVDA;
- VoiceOver;
- zoom humano 200 %/400 %;
- aprobación visual humana final.

Estos controles no ocultan ningún fallo automatizado y no autorizan por sí
solos la promoción a Production.

## Veredicto

La rama queda preparada para revisión de Production. La PR no activa ni
promueve Production.
