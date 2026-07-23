# Modelo de autorización

La autorización efectiva combina estado de empresa, membresía activa, capacidades del rol, overrides, alcance y entitlement. Se deniega por defecto; un override `DENY` prevalece. `requireCapability` y `requireEntitlement` son guards de servidor.

Los alcances disponibles son `COMPANY`, `OWN`, `ASSIGNED`, `TEAM`, `SELECTED_WORKS` y `SELECTED_CLIENTS`. Las consultas sensibles deben incorporar el filtro en base de datos. Orqena rechaza de forma conservadora el acceso conversacional cuando el alcance no es empresarial hasta que el consumidor aplique el filtro específico.
## Cierre de producto: perfiles funcionales y frontera económica

La autorización parte siempre de usuario, empresa activa y membresía activa. `functionalProfileKey` selecciona una plantilla del catálogo existente; no sustituye las capabilities ni los scopes. Las capabilities económicas forman un grupo reservado: solo `OWNER` y `PURCHASING_MANAGER` pueden recibirlas, y un override ordinario no puede ampliar esa frontera. Las rutas, acciones, descargas, búsqueda y Orqena aplican la misma decisión de servidor y responden sin revelar la existencia de recursos ajenos.
