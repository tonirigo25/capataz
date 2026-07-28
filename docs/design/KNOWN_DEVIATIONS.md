# Desviaciones conocidas frente al atlas

## Baseline

- Los colores maestros del paquete se conservan intactos. Tras reproducir contraste insuficiente en toda la matriz remota D1, el texto pequeño usa variantes semánticas AA derivadas (`textMuted`, `warningText`, `dangerText`) y la navegación activa sobre lima usa `ink`.
- Los aliases históricos `--cap-*` ya consumen el contrato Field OS, pero el tema oscuro conserva una variante derivada que debe revisarse visualmente por contraste.
- La home ya adopta exactamente “Del audio en la obra al cobro”. Lighthouse local marca un aviso de `target-size` en el CTA final; la repetición en Review midió 0 violaciones Axe serias/críticas en 12 combinaciones, por lo que permanece como observación no bloqueante de Lighthouse.
- D9 resolvió la diferencia entre las 43 filas entregadas y las 93 páginas del repositorio: la matriz integrada contiene 93 rutas únicas, 0 huérfanas y 11 dimensiones de estado/permisos enlazadas a una única regla ejecutable por ruta.
- Trece superficies del baseline presentan más de una acción visualmente primaria; se resolverán en su bloque correspondiente sin eliminar funcionalidad.
- Las matrices autenticadas han observado hidrataciones `React #418` aisladas en rutas distintas. D1 exige un replay en contexto nuevo tanto para las homes por perfil como para las superficies OWNER; un replay limpio queda en observación y uno repetido bloquea.
- D1 cerró con replay limpio de las hidrataciones aisladas en OWNER `/dinero` y `/tesoreria`; si reaparecen en el mismo contexto se convertirán en regresión demostrable.
- D2 repitió la matriz autenticada completa sin bloqueadores ni nuevas regresiones de hidratación. Conserva 13 observaciones de múltiples acciones primarias, asignadas a las superficies que se rediseñarán en D3-D10.
- D3 observó una hidratación `React #418` en la primera visita móvil aislada de permisos a `/dashboard`. El replay obligatorio en contexto nuevo y la repetición final completa no la reprodujeron; queda como incidencia no reproducida, no como regresión demostrable.
- D3 cerró Hoy y Dashboard con 0 observaciones de acción primaria en las superficies focales. Las observaciones restantes pertenecen a bloques D4-D10 aún no ejecutados.
- El primer gate D4 de `a226f7c...` detectó múltiples acciones primarias en el listado y un falso bloqueo al exigir split pane en el estado vacío. `78fe7ff...` separa la vista activa de una CTA, deja una única acción primaria contextual y supera el replay completo con 0 observaciones.
- El primer gate D5 de `174c2e9...` detectó seis jerarquías de acción primaria y cinco expectativas/aserciones incorrectas del auditor; `a77cb05...` dejó 0 observaciones y un único falso negativo por espacio tipográfico en moneda. `cd92c3d...` normaliza esa evidencia y supera exactamente la misma matriz con 0 observaciones y 0 bloqueadores.
- El primer gate D6 de `03dfaf4...` detectó enlaces a un binario sintético ausente, navegación de Tesorería hacia la obra en lugar del documento origen, jerarquías primarias duplicadas y un contrato responsive demasiado ligado al texto de la tabla desktop. `b82be78...` corrige producto y auditor, y cierra D6 con 5/5 interacciones, 0 observaciones focales y 0 bloqueadores.
- El barrido global de D6 conserva nueve observaciones fuera de fase: acciones primarias múltiples en plantillas, tareas, recomendaciones, configuración, soporte y salud de plataforma, además de dos hidrataciones aisladas con replay limpio en Agenda y Cliente 360 móvil. Se mantienen abiertas para D7-D10; no son una regresión demostrada en D0-D6.
- D7 resolvió las observaciones asignadas a tareas y recomendaciones, además de ocultar identificadores y estados internos en tareas/seguimientos. La matriz final conserva una sola observación focal: `React #418` en la primera visita de Agenda a 390 px, no reproducido por el replay obligatorio.
- D8 detectó y corrigió un encabezado móvil oculto en Orqena, dos acciones primarias en Equipo y contraste insuficiente en la etiqueta del historial. El replay exacto final conserva 4 perfiles, 8 superficies, 11 interacciones y 36 casos Axe con 0 observaciones y 0 bloqueadores.
- D9 homogeneizó la confirmación accesible de archivo en trabajos, tareas y seguimientos para que el manifiesto no afirmara un control inexistente. La matriz remota focal terminó con 0 observaciones y 0 bloqueadores.
- Los documentos sintéticos de Review contienen metadatos verificables pero no un binario real. La interfaz lo declara y no ofrece descarga; la carga, cuarentena y lectura de binarios reales quedan cubiertas por pruebas locales, mientras la validación con archivos reales permanece `READY_FOR_EXTERNAL_INPUT`.
- Safari real, Chrome Android real, NVDA, VoiceOver y zoom humano siguen `READY_FOR_EXTERNAL_INPUT`.
- D10 automatizó Chromium, Firefox y WebKit, 320–1920 px, forced colors, reducción de movimiento, reflow equivalente, Axe y rendimiento. Safari/Chrome Android en hardware real, NVDA, VoiceOver, zoom real y pruebas con personas, dispositivos o datos reales siguen `READY_FOR_EXTERNAL_INPUT`; no se declaran `PASS`.
- Cuatro cierres de contexto Chromium abortaron un `POST` same-origin con cabecera `Next-Action`. El auditor endurecido los registra como esperados y mantiene cualquier otro aborto como bloqueo; el replay focal acabó con 0 diagnósticos no clasificados.
- Axe observó objetivos offscreen en el CTA secundario final de `/` y `/marketing-v2`; el replay después de desplazar el objetivo pasó. Se conserva como observación técnica no bloqueante, no como exención general de `target-size`.
- D11 repitió el patrón offscreen en diez combinaciones estrechas de `/` y
  `/marketing-v2`; todos los replays con el objetivo visible pasaron. También
  registró dos React #418 aislados en la matriz pública, ambos con replay limpio
  en contexto nuevo. No existe una regresión reproducible, pero los eventos se
  conservan en el informe.
- Una de las 25 capturas del journey de staging usó fallback de viewport cuando
  la captura completa de `/` agotó 60 segundos bajo tres runners concurrentes.
  La navegación respondió 200, no dejó diagnóstico sin resolver y la matriz
  pública independiente pasó la ruta en 24 combinaciones de motor/viewport.
- Los logs de candidatos D11 revelaron que el contexto de `railway up` incluía
  directorios auxiliares ignorados por Git. `.railwayignore` los excluye; los
  candidatos no saneados se retiraron antes de activarse y los deployments
  finales de Review/staging se construyeron con el contexto saneado. No se
  representa como saneada ninguna imagen histórica anterior.
- Producción conserva un SHA anterior que sólo expone `/api/status`; sus rutas
  `/api/health/live` y `/api/health/ready` devuelven 404 por ausencia histórica,
  no por caída. Producción no se actualizó para corregir una diferencia de
  observabilidad sin el go/no-go requerido.
