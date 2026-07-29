# ORQENA / CAPATAZ — PAQUETE MAESTRO PARA CODEX

Este paquete convierte la dirección visual aprobada en un programa de implementación completo.

## Concepto aprobado

- Web pública: mezcla de Embat y Holded, adaptada a Orqena Tech.
- Portal interno: navegación oscura, contenido claro, jerarquía compacta, IA visible y acciones rápidas.
- Producto: Capataz, by Orqena.
- Principio: mostrar mejor toda la funcionalidad existente sin eliminar ni alterar reglas de negocio.

## Archivos

1. `01_PROMPT_MAESTRO_CODEX.md`: mandato completo de D0 a D13.
2. `02_ESPECIFICACION_VISUAL_Y_RUTAS.md`: web, portal, Clientes y patrones por ruta.
3. `03_DEMO_ADMIN_IA_EMAIL_DOCUMENTOS.md`: demo privada, administración, IA, correos y PDFs.
4. `04_QA_RELEASE_CHECKLIST.md`: criterios de aceptación y despliegue.
5. `05_DESIGN_TOKENS.json`: colores, tipografía, spacing y layout.
6. `06_VISUAL_ATLAS.html`: atlas visual autónomo para abrir en navegador.
7. `07_MENSAJE_CORTO_CODEX.txt`: mensaje exacto para iniciar el trabajo.

## Orden de uso

Codex debe leer primero los archivos 00, 01, 02 y 04. Después debe abrir `06_VISUAL_ATLAS.html`.

## Entorno visible

Reutilizar obligatoriamente el Railway Review persistente:

`orqena-review-continuous`

No crear otro Review ni trabajar directamente en `main`.

## Reglas inviolables

No romper ni simplificar por motivos visuales:

- aislamiento entre empresas;
- roles, permisos y scopes;
- reglas de negocio;
- importes, saldos y numeración;
- fiscalidad;
- idempotencia y outbox;
- auditoría;
- confirmación humana;
- Stripe, Resend, OpenAI y R2;
- backups, PWA y seguridad.

## Resultado esperado

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_REVIEW`
