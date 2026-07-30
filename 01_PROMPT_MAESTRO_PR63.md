# PROMPT MAESTRO — CORRECCIÓN REAL DE ORQENA FIELD OS V2

## Mandato

Continúa sobre la PR #63 y la rama `design/orqena-field-os-v2`. No abras otra PR salvo bloqueo técnico demostrado.

Actúa como principal product engineer, diseñador UX/UI SaaS, desarrollador Next.js, especialista responsive y responsable de QA.

## Preflight

```powershell
git fetch origin
git status --short --branch
git rev-parse HEAD

gh pr view 63 `
  --repo tonirigo25/capataz `
  --json number,state,isDraft,mergeable,headRefName,baseRefName,headRefOid,url
```

Estado esperado:

```text
branch: design/orqena-field-os-v2
PR: #63
merged: false
base: main
```

Si la rama ha avanzado legítimamente, usa el HEAD actual y registra el cambio.

## Protección

- No hacer merge.
- No modificar Production.
- No crear otro Railway Review.
- Reutilizar `orqena-review-continuous`.
- No ejecutar migraciones destructivas.
- No borrar datos.
- No usar `git reset --hard`.
- No ocultar diferencias visuales con validadores permisivos.
- No declarar PASS porque una funcionalidad previa ya existía.
- No sustituir aprobación humana por Axe, LCP o CI.

Convierte la PR en Draft cuando sea posible y actualiza su descripción con:

`VISUAL REVISION REQUIRED — OWNER REJECTED CURRENT HOME AND MEGA MENU`

Conserva tokens, contraste, escalas tipográficas, QA, noindex, navegación accesible y cualquier refactor técnico correcto.

## Orden obligatorio

### A. Resolver bloqueadores técnicos

Ejecuta íntegramente `05_ISSUES_PR63.md`. Cada thread requiere reproducción o test rojo, fix, test verde, respuesta y resolución.

### B. Corregir portada y mega menú

Ejecuta `02_PORTADA_Y_MEGA_MENU.md`, despliega Review, genera capturas y entrega:

`VISUAL_CORRECTION_READY_FOR_OWNER_REVIEW`

Detente. No empieces el portal hasta recibir exactamente:

`PORTADA_Y_MENU_APROBADOS`

### C. Corregir portal interno

Tras la aprobación, ejecuta `03_PORTAL_INTERNO.md`, despliega Review, genera capturas autenticadas y entrega:

`PORTAL_CORRECTION_READY_FOR_OWNER_REVIEW`

Detente hasta recibir:

`PORTAL_INTERNO_APROBADO`

### D. Completar sistemas funcionales

Tras la aprobación, ejecuta `04_DEMO_ADMIN_IA_EMAIL_DOCUMENTOS.md`, prueba end-to-end y entrega:

`FUNCTIONAL_SYSTEMS_READY_FOR_OWNER_REVIEW`

Detente hasta recibir:

`FLUJOS_Y_SISTEMAS_APROBADOS`

### E. QA final

Ejecuta `06_QA_CAPTURAS_GATES.md`.

Resultado permitido:

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_DECISION`

No hacer merge ni promover Production.

## Referencias visuales

Primero ejecuta, si faltan los PNG locales:

```powershell
powershell -ExecutionPolicy Bypass -File .\referencias_visuales\DESCARGAR_PNG.ps1
```

Prioridad:

1. `referencias_visuales/01_PORTADA_FINAL_OSCURA.png`
2. `referencias_visuales/02_PORTAL_INTERNO_CLARO.png`
3. `referencias_visuales/03_MENU_MOVIL_PLANTILLAS.png`
4. `referencias_visuales/04_PRESENTACION_GENERAL.png`

Los SVG y `INDEX.html` permiten consultar las mismas referencias sin descargar. No copiar marcas, cifras ni clientes ficticios. Reproducir composición, jerarquía, densidad, navegación e interacción.

## Documentación honesta

Actualizar:

- `design-qa.md`;
- `docs/design-v2/IMPLEMENTATION_LOG.md`;
- `docs/design-v2/QA_RELEASE_EVIDENCE.md`;
- cuerpo de PR #63.

Usar sólo:

```text
IMPLEMENTED
VALIDATED
READY_FOR_OWNER_REVIEW
READY_FOR_EXTERNAL_INPUT
NOT_IMPLEMENTED
BLOCKED
```

## Entrega por puerta

Cada entrega incluye:

1. SHA;
2. deployment Review;
3. URL;
4. archivos modificados;
5. migraciones;
6. tests;
7. capturas;
8. diferencias frente al estado rechazado;
9. threads resueltos;
10. estado exacto de la puerta.

No entregar un resumen genérico ni continuar sin aprobación explícita.
