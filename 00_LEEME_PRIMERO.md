# ORQENA / CAPATAZ — PAQUETE DE CORRECCIÓN COMPLETA DE LA PR #63

Este paquete sustituye cualquier declaración previa de que la PR #63 está preparada para Production.

## Estado

- PR: `#63`
- Rama de trabajo: `design/orqena-field-os-v2`
- SHA rechazado visualmente: `d942cc61f5309c6588e31be5cc534ad95c662159`
- Review: `https://orqena-review-web-review.up.railway.app`
- Production: no modificar
- Merge: no autorizado
- Estado correcto: `VISUAL_REVISION_REQUIRED`

## Motivo

La implementación actual contiene trabajo aprovechable, pero no reproduce con suficiente fidelidad la portada, navegación, mega menús y portal aprobados. La PR conserva además seis conversaciones de revisión sin resolver, incluidas dos P1.

## Orden de lectura

1. `01_PROMPT_MAESTRO_PR63.md`
2. `02_PORTADA_Y_MEGA_MENU.md`
3. `03_PORTAL_INTERNO.md`
4. `04_DEMO_ADMIN_IA_EMAIL_DOCUMENTOS.md`
5. `05_ISSUES_PR63.md`
6. `06_QA_CAPTURAS_GATES.md`
7. `referencias_visuales/README.md`

## Puertas humanas obligatorias

### Puerta 1

Después de portada y menú, Codex debe detenerse hasta recibir:

`PORTADA_Y_MENU_APROBADOS`

### Puerta 2

Después del portal interno:

`PORTAL_INTERNO_APROBADO`

### Puerta 3

Después de demo, panel admin, IA, correos y documentos:

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
