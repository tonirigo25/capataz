# Modelo de autorización

La autorización efectiva combina estado de empresa, membresía activa, capacidades del rol, overrides, alcance y entitlement. Se deniega por defecto; un override `DENY` prevalece. `requireCapability` y `requireEntitlement` son guards de servidor.

Los alcances disponibles son `COMPANY`, `OWN`, `ASSIGNED`, `TEAM`, `SELECTED_WORKS` y `SELECTED_CLIENTS`. Las consultas sensibles deben incorporar el filtro en base de datos. Orqena rechaza de forma conservadora el acceso conversacional cuando el alcance no es empresarial hasta que el consumidor aplique el filtro específico.
