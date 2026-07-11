# Plan de ownership y multiempresa

## Estado actual

Capataz sigue siendo monousuario. No hay autenticacion ni aislamiento real por workspace, por lo que esta fase no introduce un `companyId` parcial en entidades sueltas. Las nuevas tablas (`Contact`, `InternalNote`, `Document`, `Notification`) se han creado de forma compatible con una futura migracion integral, pero no fingen aislamiento multiempresa.

## Objetivo futuro

La migracion correcta debe introducir una frontera clara:

- `User`: identidad personal del usuario.
- `Company` o `Workspace`: cuenta operativa.
- `Membership`: relacion usuario-workspace.
- Roles: propietario, administrador, oficina, encargado, operario y solo lectura.
- Ownership obligatorio en entidades de negocio.

## Entidades que deben recibir ownership

- `Client`
- `Contact`
- `Work`
- `Budget`
- `Invoice`
- `Payment`
- `Expense`
- `Material`
- `Reminder`
- `EventoAgenda`
- `ChatConversation`
- `ChatMessage`
- `ChatActionLog`
- `Document`
- `InternalNote`
- `Notification`
- `Empresa`
- `UsuarioPerfil`

## Estrategia de migracion

1. Crear `Workspace`, `User` y `Membership` en una migracion no destructiva.
2. Crear un workspace por defecto para los datos existentes.
3. Backfill de `workspaceId` en todas las entidades de negocio dentro de una transaccion controlada.
4. Anadir indices compuestos por `workspaceId` y campos de busqueda frecuentes.
5. Cambiar consultas de lectura a servicios centralizados que reciban contexto de workspace.
6. Cambiar acciones de escritura para validar pertenencia antes de mutar.
7. Activar restricciones `NOT NULL` de `workspaceId` solo cuando el backfill y el codigo esten desplegados.
8. Introducir roles y permisos por accion.
9. Anadir auditoria de seguridad y tests de aislamiento.

## Reglas para las nuevas entidades

- Ninguna nueva entidad debe depender de datos globales anonimos.
- Las consultas nuevas deben poder recibir `workspaceId` sin reescritura profunda.
- Los documentos y notas internas deben quedar siempre dentro del workspace.
- Las notificaciones deben ser derivables por workspace y por usuario cuando exista multiusuario.
- El chat no debe mezclar conversaciones ni contexto entre workspaces.

## Riesgos

- Hacer `companyId` parcial en una sola tabla crearia una falsa sensacion de seguridad.
- Activar auth sin backfill completo puede ocultar datos reales.
- Las busquedas globales deben filtrar por workspace antes de agrupar resultados.
- Los PDFs deben validar ownership de presupuesto/factura antes de renderizar.

## Pendiente para Bloque 3 o fase de plataforma

- Autenticacion real.
- Modelo `Workspace/User/Membership`.
- Matriz de permisos.
- Backfill completo.
- Tests de aislamiento entre empresas.
- Auditoria de accesos por ID.
