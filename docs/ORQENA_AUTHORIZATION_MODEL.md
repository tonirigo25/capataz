# Modelo de autorización

La autorización efectiva combina estado de empresa, membresía activa, capacidades del rol, overrides, alcance y entitlement. Se deniega por defecto; un override `DENY` prevalece. `requireCapability` y `requireEntitlement` son guards de servidor.

Los alcances disponibles son `COMPANY`, `OWN`, `ASSIGNED`, `TEAM`, `SELECTED_WORKS` y `SELECTED_CLIENTS`. Las consultas sensibles deben incorporar el filtro en base de datos. Orqena rechaza de forma conservadora el acceso conversacional cuando el alcance no es empresarial hasta que el consumidor aplique el filtro específico.
## Cierre de producto: perfiles, paquetes y frontera económica

La decisión efectiva es `perfil profesional + paquetes funcionales + overrides + scope + autoridad de aprobación + modo de acceso`. `DENY` prevalece, `READ_ONLY` elimina mutaciones y una membresía distinta de `active` no recibe capabilities. Los paquetes base pueden desactivarse explícitamente y los adicionales solo amplían dentro de las fronteras del perfil.

Las capabilities económicas se separan por campo: precio de venta, coste de compra, coste interno, margen porcentual, margen absoluto, beneficio, tesorería, banca y fiscalidad. Solo perfiles económicos compatibles pueden recibirlas. `FieldVisibilityPolicy` no concede por sí sola: la visibilidad final exige la capability correspondiente.

Los scopes se aplican en la consulta Prisma, no después de cargar datos: clientes, trabajos, agenda, tareas, recordatorios, documentos, búsqueda y contexto de Orqena reciben únicamente IDs autorizados. Las aprobaciones de presupuesto exigen tanto `sales.budgets.approve` como una `ApprovalAuthority` vigente y dentro de importe, descuento y margen delegados; `OWNER` conserva la autoridad final.
