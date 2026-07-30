# Design QA — Orqena Field OS V2

Fecha: 2026-07-30  
Rama: `design/orqena-field-os-v2`  
Entorno: `orqena-review-continuous`

## Fuente y comparación

La dirección aprobada procede de `06_VISUAL_ATLAS.html` y de los SVG del
paquete de rediseño. Se compararon en una misma composición la fuente y la
implementación remota:

`artifacts/design-v2/source-review-comparison.png`

La implementación conserva la estructura oscura, el acento verde, la
visibilidad del producto, la navegación financiera y la modularidad aprobadas,
adaptadas a las rutas y funcionalidades reales de Capataz.

## Inspección visual

- Portada: jerarquía clara, H1 aprobado, CTA primario/secundario y producto
  visible en el primer viewport.
- Navegación: megamenús de Producto y Soluciones, móvil, foco, teclado,
  `aria-expanded`, `Escape` y clic exterior.
- Responsive: contenido completo y sin huecos en 320, 360, 375, 390, 430, 768,
  1024, 1280, 1440 y 1920 px.
- Producto autenticado: OWNER, WORKER, EXTERNAL_COLLABORATOR y
  ADVISOR_AUDITOR; móvil y escritorio.
- Estados: normal, solo lectura, noindex, registro cerrado, IA/provider gates,
  demo local, reduced motion y forced colors.

## Hallazgos corregidos

| Prioridad | Hallazgo | Corrección |
|---|---|---|
| P1 | Contraste insuficiente en la demo, banda beta y navegación activa | Se usan tinta y tokens semánticos AA |
| P1 | Verde de éxito insuficiente sobre superficie y fondo suave | Nuevo token `successText` AA, separado del verde de marca |
| P1 | Dos enlaces de Seguridad por debajo de 24 px | Objetivo táctil elevado a 44 px |
| P2 | Nota de precios en 4,49:1 | Tono de texto oscurecido |
| P2 | Capturas `fullPage` omitían contenido con `content-visibility` | El arnés fuerza render visible sólo durante la captura |
| P2 | LCP incluía contenido abierto después de la interacción | LCP/CLS se fijan antes de medir INP |
| P2 | Validadores esperaban el eslogan literal anterior | Se alinearon con el H1 aprobado y la firma central |

No quedan hallazgos P0, P1 o P2 automatizados abiertos.

## Evidencia

- `artifacts/design-v2/baseline-2076a52/report.json`
- `artifacts/design-v2/d10-public-9e86a799/public-matrix.json`
- `artifacts/design-v2/d10-auth-review-9e86a799/authenticated-engine-matrix.json`
- `docs/design-v2/QA_RELEASE_EVIDENCE.md`
- Railway Review estable:
  `https://orqena-review-web-review.up.railway.app`

## Límites humanos

Permanecen `READY_FOR_EXTERNAL_INPUT`: iPhone/Safari real, Android/Chrome real,
NVDA, VoiceOver, zoom humano 200 %/400 % y aprobación visual humana. No se
inventan sus resultados y no se ha promovido Production.

final result: passed
