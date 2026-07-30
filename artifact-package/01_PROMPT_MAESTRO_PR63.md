# PROMPT MAESTRO — CORRECCIÓN REAL DE ORQENA FIELD OS V2

## Mandato

Continúa sobre la PR #63. No abras otra PR salvo bloqueo técnico demostrado.

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

Si la rama ha avanzado legítimamente, usa su HEAD actual y registra el cambio.

## Protección

- No hacer merge.
- No modificar Production.
- No crear otro Railway Review.
- Reutilizar `orqena-review-continuous`.
- No ejecutar migraciones destructivas.
- No borrar datos.
- No usar `git reset --hard`.
- No ocultar diferencias visuales con un flag permisivo.
- No declarar una fase PASS porque una funcionalidad antigua ya existía.
- No sustituir aprobación humana por Axe, LCP o CI.

## Estado de la PR

Convierte la PR #63 a Draft cuando sea posible.

Actualiza título o cuerpo indicando:

`VISUAL REVISION REQUIRED — OWNER REJECTED CURRENT HOME AND MEGA MENU`

Conserva:

- tokens y escalas tipográficas;
- correcciones de contraste;
- noindex;
- pruebas válidas;
- navegación accesible;
- Review y Staging existentes;
- cualquier refactor técnico correcto.

## Orden obligatorio

### Fase A — Bloqueadores técnicos

Resuelve íntegramente `05_ISSUES_PR63.md` y añade pruebas que fallen antes de cada fix.

### Fase B — Portada y mega menú

Ejecuta `02_PORTADA_Y_MEGA_MENU.md`.

Después:

- despliega Review;
- genera las capturas exigidas;
- entrega `VISUAL_CORRECTION_READY_FOR_OWNER_REVIEW`;
- detente.

No empieces el portal hasta recibir exactamente:

`PORTADA_Y_MENU_APROBADOS`

### Fase C — Portal interno

Tras la aprobación, ejecuta `03_PORTAL_INTERNO.md`.

Después:

- despliega Review;
- genera capturas autenticadas;
- entrega `PORTAL_CORRECTION_READY_FOR_OWNER_REVIEW`;
- detente.

No empieces los sistemas funcionales hasta recibir:

`PORTAL_INTERNO_APROBADO`

### Fase D — Sistemas funcionales

Tras la aprobación, ejecuta `04_DEMO_ADMIN_IA_EMAIL_DOCUMENTOS.md`.

Después:

- Review;
- pruebas end-to-end;
- capturas;
- entrega `FUNCTIONAL_SYSTEMS_READY_FOR_OWNER_REVIEW`;
- detente.

No prepares promoción hasta recibir:

`FLUJOS_Y_SISTEMAS_APROBADOS`

### Fase E — QA final

Ejecuta `06_QA_CAPTURAS_GATES.md`.

Resultado permitido:

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_DECISION`

No hacer merge ni promover Production.

## Referencias visuales

Prioridad:

1. `referencias_visuales/01_PORTADA_FINAL_OSCURA.png`
2. `referencias_visuales/02_PORTAL_INTERNO_CLARO.png`
3. `referencias_visuales/03_MENU_MOVIL_PLANTILLAS.png`
4. `referencias_visuales/04_PRESENTACION_GENERAL.png`

No copiar marcas, cifras ni clientes ficticios. Reproducir composición, jerarquía, densidad, navegación y lenguaje visual.

## Fuente de verdad

GitHub es la fuente de código. Railway Review es la superficie de revisión.

No afirmar que una página está terminada sin abrirla en Review.

## Documentación honesta

Actualizar:

- `design-qa.md`;
- `docs/design-v2/IMPLEMENTATION_LOG.md`;
- `docs/design-v2/QA_RELEASE_EVIDENCE.md`;
- cuerpo de PR #63.

Usar sólo estos estados:

```text
IMPLEMENTED
VALIDATED
READY_FOR_OWNER_REVIEW
READY_FOR_EXTERNAL_INPUT
NOT_IMPLEMENTED
BLOCKED
```

## Entrega por puerta

Cada entrega debe incluir:

1. SHA;
2. deployment Review;
3. URL;
4. archivos modificados;
5. migraciones;
6. tests;
7. capturas;
8. diferencias frente al estado rechazado;
9. threads de review resueltos;
10. estado exacto de la puerta.

No entregar un resumen genérico ni continuar sin aprobación explícita.
