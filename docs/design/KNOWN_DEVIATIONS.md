# Desviaciones conocidas frente al atlas

## Baseline

- Los colores maestros del paquete se conservan intactos. Tras reproducir contraste insuficiente en toda la matriz remota D1, el texto pequeño usa variantes semánticas AA derivadas (`textMuted`, `warningText`, `dangerText`) y la navegación activa sobre lima usa `ink`.
- Los aliases históricos `--cap-*` ya consumen el contrato Field OS, pero el tema oscuro conserva una variante derivada que debe revisarse visualmente por contraste.
- La home ya adopta exactamente “Del audio en la obra al cobro”. Lighthouse local marca un aviso de `target-size` en el CTA final; la repetición en Review midió 0 violaciones Axe serias/críticas en 12 combinaciones, por lo que permanece como observación no bloqueante de Lighthouse.
- La matriz de entrega contiene 43 patrones, mientras el repositorio tiene 93 páginas; D9 debe incorporar rutas especializadas y demostrar que no quedan huérfanas.
- Trece superficies del baseline presentan más de una acción visualmente primaria; se resolverán en su bloque correspondiente sin eliminar funcionalidad.
- Las matrices autenticadas han observado hidrataciones `React #418` aisladas en rutas distintas. D1 exige un replay en contexto nuevo tanto para las homes por perfil como para las superficies OWNER; un replay limpio queda en observación y uno repetido bloquea.
- D1 cerró con replay limpio de las hidrataciones aisladas en OWNER `/dinero` y `/tesoreria`; si reaparecen en el mismo contexto se convertirán en regresión demostrable.
- D2 repitió la matriz autenticada completa sin bloqueadores ni nuevas regresiones de hidratación. Conserva 13 observaciones de múltiples acciones primarias, asignadas a las superficies que se rediseñarán en D3-D10.
- D3 observó una hidratación `React #418` en la primera visita móvil aislada de permisos a `/dashboard`. El replay obligatorio en contexto nuevo y la repetición final completa no la reprodujeron; queda como incidencia no reproducida, no como regresión demostrable.
- D3 cerró Hoy y Dashboard con 0 observaciones de acción primaria en las superficies focales. Las observaciones restantes pertenecen a bloques D4-D10 aún no ejecutados.
- El primer gate D4 de `a226f7c...` detectó múltiples acciones primarias en el listado y un falso bloqueo al exigir split pane en el estado vacío. `78fe7ff...` separa la vista activa de una CTA, deja una única acción primaria contextual y supera el replay completo con 0 observaciones.
- El primer gate D5 de `174c2e9...` detectó seis jerarquías de acción primaria y cinco expectativas/aserciones incorrectas del auditor; `a77cb05...` dejó 0 observaciones y un único falso negativo por espacio tipográfico en moneda. `cd92c3d...` normaliza esa evidencia y supera exactamente la misma matriz con 0 observaciones y 0 bloqueadores.
- Safari real, Chrome Android real, NVDA, VoiceOver y zoom humano siguen `READY_FOR_EXTERNAL_INPUT`.
