# Desviaciones conocidas frente al atlas

## Baseline

- Los colores maestros del paquete se conservan intactos. Tras reproducir contraste insuficiente en toda la matriz remota D1, el texto pequeño usa variantes semánticas AA derivadas (`textMuted`, `warningText`, `dangerText`) y la navegación activa sobre lima usa `ink`.
- Los aliases históricos `--cap-*` ya consumen el contrato Field OS, pero el tema oscuro conserva una variante derivada que debe revisarse visualmente por contraste.
- La home ya adopta exactamente “Del audio en la obra al cobro”. Lighthouse marca un aviso de `target-size` en el CTA final pese a medir 0 bloqueantes Axe serios/críticos en 390 y 1440 px; permanece como observación hasta repetirlo en Review.
- La matriz de entrega contiene 43 patrones, mientras el repositorio tiene 93 páginas; D9 debe incorporar rutas especializadas y demostrar que no quedan huérfanas.
- Trece superficies del baseline presentan más de una acción visualmente primaria; se resolverán en su bloque correspondiente sin eliminar funcionalidad.
- Las matrices autenticadas han observado hidrataciones `React #418` aisladas en rutas distintas. D1 exige un replay en contexto nuevo tanto para las homes por perfil como para las superficies OWNER; un replay limpio queda en observación y uno repetido bloquea.
- D1 cerró con replay limpio de las hidrataciones aisladas en OWNER `/dinero` y `/tesoreria`; si reaparecen en el mismo contexto se convertirán en regresión demostrable.
- Safari real, Chrome Android real, NVDA, VoiceOver y zoom humano siguen `READY_FOR_EXTERNAL_INPUT`.
