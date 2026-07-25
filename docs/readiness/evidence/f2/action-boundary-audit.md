# F2 action boundary audit

Date: 2026-07-25

The repository contains 30 Server Action files. A conservative static scan still finds direct Prisma access in 20 of them. This heuristic includes reads and authorization lookups, so it is not by itself proof of an unsafe write; it does prove that ARCH-007 cannot honestly be marked complete yet.

F2 moved platform support/suspension rules to `lib/commercial/platform-service.ts` and public demo rules to `lib/commercial/demo-service.ts`. The corresponding action/route boundaries now authorize, parse, invoke a service, and refresh or return UI state.

Remaining direct-Prisma action files:

- `app/(app)/alertas/actions.ts`
- `app/(app)/automatizaciones/actions.ts`
- `app/(app)/capataz/actions.ts`
- `app/(app)/clientes/actions.ts`
- `app/(app)/configuracion/actions.ts`
- `app/(app)/demo-guiada/actions.ts`
- `app/(app)/dinero/actions.ts`
- `app/(app)/equipo/actions.ts`
- `app/(app)/equipos/actions.ts`
- `app/(app)/gastos-materiales/actions.ts`
- `app/(app)/gestion/actions.ts`
- `app/(app)/obras/actions.ts`
- `app/(app)/onboarding/actions.ts`
- `app/(app)/presupuestos/actions.ts`
- `app/(app)/proveedores/actions.ts`
- `app/(app)/seguimientos/actions.ts`
- `app/(app)/tareas/actions.ts`
- `app/(app)/tesoreria/actions.ts`
- `app/(auth)/actions.ts`
- `app/seleccionar-empresa/actions.ts`

Exit gate: classify every direct access as boundary-safe read/authorization or move the transactional business rule into a tenant-scoped domain service; then enforce the classification in CI.
