# ORQENA / CAPATAZ — PAQUETE DE CORRECCIÓN COMPLETA DE LA PR #63

Este paquete sustituye cualquier declaración previa de que la PR #63 está preparada para Production.

## Situación

- PR: `#63`
- Rama de trabajo: `design/orqena-field-os-v2`
- SHA rechazado visualmente: `d942cc61f5309c6588e31be5cc534ad95c662159`
- Railway Review: `https://orqena-review-web-review.up.railway.app`
- Production: no modificar
- Merge: no autorizado
- Estado correcto: `VISUAL_REVISION_REQUIRED`

## Motivo

La implementación actual contiene trabajo técnico aprovechable, pero no reproduce con suficiente fidelidad la portada, navegación, mega menús y portal aprobados. La PR también conserva seis conversaciones de revisión sin resolver, incluidas dos P1.

## Orden de lectura para Codex

1. `01_PROMPT_MAESTRO_PR63.md`
2. `02_PORTADA_Y_MEGA_MENU.md`
3. `03_PORTAL_INTERNO.md`
4. `04_DEMO_ADMIN_IA_EMAIL_DOCUMENTOS.md`
5. `05_ISSUES_PR63.md`
6. `06_QA_CAPTURAS_GATES.md`
7. `/referencias_visuales`

## Puertas humanas obligatorias

El paquete contiene todo el programa para que no haya que volver a adjuntarlo, pero Codex debe detenerse en estas puertas:

### Puerta 1

Después de corregir portada y menú, entregar capturas y esperar exactamente:

`PORTADA_Y_MENU_APROBADOS`

### Puerta 2

Después de corregir el portal interno, entregar capturas y esperar:

`PORTAL_INTERNO_APROBADO`

### Puerta 3

Después de demo, panel admin, IA, correos y documentos, esperar:

`FLUJOS_Y_SISTEMAS_APROBADOS`

Los tests automáticos no sustituyen estas aprobaciones.

## Invariantes

No alterar por motivos visuales:

- tenant isolation;
- autorización, roles y scopes;
- reglas de negocio;
- importes, saldos y numeración;
- fiscalidad;
- idempotencia y outbox;
- auditoría;
- confirmación humana;
- contratos de Stripe, Resend, OpenAI y R2;
- backups;
- PWA;
- flags comerciales.

Mantener:

```text
BILLING_ENABLED=false
ORQENA_PUBLIC_REGISTRATION_ENABLED=false
EU_B2B_CROSS_BORDER_ENABLED=false
```

## Dirección visual

- Embat: orden, navegación, claridad financiera e inteligencia operativa.
- Holded: producto visible, facilidad, modularidad y onboarding.
- Orqena: identidad propia, vertical de construcción/servicios, control humano e IA contextual.

## Package build

Esta revisión activa el workflow que incorpora las cuatro referencias visuales y genera el ZIP comprobado.
