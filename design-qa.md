# Design QA — corrección visual PR #63, Gate 1, revisión 2

Fecha: 2026-07-30  
Rama: `design/orqena-field-os-v2`  
Entorno objetivo: `orqena-review-continuous / orqena-review-web-review`

## Fuente y comparación canónicas

- Fuente principal: `referencias_visuales/01_PORTADA_FINAL_OSCURA.png`
  (1536×1024), complementada por `04_PRESENTACION_GENERAL.png`.
- Implementación comparada: hero Hoy a 1440×1000 y los cuatro estados
  alternativos del mismo producto.
- Comparación conjunta inspeccionada:
  `artifacts/design-v2/correction-pr63/gate-1-revision-2/09-comparacion-referencia-implementacion.png`.
- Navegador: Chromium integrado de Codex Desktop.

## Primera inspección y correcciones

La inspección inicial confirmó una página de 21 secciones y más de 15.000 px
en escritorio; las pestañas del hero sólo sustituían el nombre del área. En la
primera iteración se redujo la portada a siete secciones visibles, se crearon
cinco superficies de producto completas y se sustituyeron las muestras
decorativas por datos, gráficos, estados y microacciones. En la segunda
iteración se eliminó el desbordamiento horizontal de la navegación de la demo
en tablet y se compactó su recorrido a tres minutos.

## Resultado visible validado

- Header, hero, banda de valor, áreas clave, flujos, demo, CTA y footer forman
  una secuencia corta y comercial.
- Hoy, Clientes, Trabajo, Dinero y Orqena IA cambian título, subtítulo, KPIs,
  visualización, tarjetas, estados, acciones e interfaz móvil.
- Los gráficos muestran series, pipeline, progreso, tesorería y señal de
  escenario con datos sintéticos coherentes.
- La demo pública conserva edición, teclado, revisión, confirmación y resultado,
  pero usa menos aire y una jerarquía de producto más clara.
- CTA y footer se verificaron completos en 390 px y 1440 px.
- No hay desbordamiento horizontal en 390, 768 ni 1440 px.
- No se inició el portal autenticado y no se modificaron lógica de negocio,
  migraciones, datos ni Production.

## Evidencia exigida

1. `01-hero-hoy-1440x1000.png`
2. `02-hero-clientes-1440x1000.png`
3. `03-hero-trabajo-1440x1000.png`
4. `04-hero-dinero-1440x1000.png`
5. `05-hero-orqena-ia-1440x1000.png`
6. `06-demo-guiada-redisenada.png`
7. `07-cierre-cta-footer-mobile-390.png`
8. `08-cierre-cta-footer-1440x1000.png`

Directorio:
`artifacts/design-v2/correction-pr63/gate-1-revision-2/`.

La aprobación visual del propietario sigue siendo externa a los tests y esta PR
debe permanecer Draft.

final result: passed
