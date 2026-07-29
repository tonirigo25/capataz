# Matriz de dispositivos reales — julio de 2026

Estado: `READY_FOR_EXTERNAL_INPUT`

Ejecución: `READY_FOR_EXTERNAL_INPUT`

Las emulaciones y motores automatizados no se presentan como pruebas de
hardware real.

| Plataforma | Navegador/dispositivo objetivo | Estado |
| --- | --- | --- |
| iOS | Safari en iPhone físico soportado | `READY_FOR_EXTERNAL_INPUT` |
| iPadOS | Safari en iPad físico soportado | `READY_FOR_EXTERNAL_INPUT` |
| Android | Chrome en teléfono físico soportado | `READY_FOR_EXTERNAL_INPUT` |
| Windows | Chrome y Edge en equipo real | `READY_FOR_EXTERNAL_INPUT` |
| macOS | Safari y Chrome en equipo real | `READY_FOR_EXTERNAL_INPUT` |

## Casos mínimos por dispositivo

- carga inicial, login y logout;
- navegación privada y cambio de contexto permitido;
- teclado/táctil, orientación y zoom del sistema;
- PDF, descarga, subida y borrado de archivo autorizado;
- PWA/manifest/service worker sin ampliar el alcance de almacenamiento;
- ausencia de overflow, bloqueo de controles y errores inesperados de red.

## Evidencia de cierre

Registrar modelo aproximado, versión de SO/navegador, viewport, fecha, SHA,
resultado y hallazgos. No registrar identificadores del dispositivo, cuentas,
cookies, archivos privados ni datos personales.
