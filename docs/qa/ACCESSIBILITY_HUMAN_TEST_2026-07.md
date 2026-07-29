# Prueba humana de accesibilidad — julio de 2026

Estado: `READY_FOR_EXTERNAL_INPUT`

Ejecución: `READY_FOR_EXTERNAL_INPUT`

Los resultados Axe y de teclado automatizados existentes son controles
separados. No prueban por sí solos experiencia con tecnología asistiva.

| Prueba | Estado | Criterio |
| --- | --- | --- |
| NVDA + navegador compatible | `READY_FOR_EXTERNAL_INPUT` | landmarks, nombres, orden, errores y cambios dinámicos |
| VoiceOver en macOS/iOS | `READY_FOR_EXTERNAL_INPUT` | navegación, rotor, formularios y feedback |
| Zoom real 200 % | `READY_FOR_EXTERNAL_INPUT` | reflow y operación completa |
| Zoom real 400 % | `READY_FOR_EXTERNAL_INPUT` | reflow, foco y lectura |
| Sólo teclado | `READY_FOR_EXTERNAL_INPUT` | orden, visibilidad, trampas y cierre |
| Contraste/forced colors humano | `READY_FOR_EXTERNAL_INPUT` | significado y controles distinguibles |

## Flujos mínimos

- home y login;
- Hoy;
- Clientes/Cliente 360;
- Obras/Trabajo 360;
- Dinero;
- Documentos;
- Agenda;
- Capataz;
- Configuración y diálogos de confirmación.

## Cierre

Registrar herramienta/versión, rol del evaluador, fecha, SHA, flujo,
hallazgo, severidad y decisión. Mantener cualquier identidad o grabación fuera
del repositorio público. El estado sólo cambia a `PASS` tras completar la
matriz y resolver o aceptar formalmente los hallazgos.
