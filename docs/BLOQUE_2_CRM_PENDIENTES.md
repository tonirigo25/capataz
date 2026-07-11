# Bloque 2 - CRM Clientes 360: cierre y pendientes

## A. Completado y validado

- Listado profesional de clientes en `/clientes` con busqueda en servidor, filtros, ordenacion y paginacion por URL.
- Vista responsive: tarjetas en movil y tabla en escritorio.
- Ficha 360 en `/clientes/[id]` con cabecera, KPIs, tabs y secciones de resumen, contactos, obras, presupuestos, facturas, pagos, visitas/seguimientos, documentos, actividad, notas y datos.
- Capa de consultas y calculos CRM en `lib/client-crm.ts` y `lib/client-crm-calculations.ts`.
- Archivado/restauracion logica con `Client.archivadoAt`; no borra relaciones.
- Migracion Prisma no destructiva para campos fiscales, contacto principal/facturacion e indices basicos.
- Validacion automatizada `npm run test:crm-clientes`.

## B. Corregido en esta fase

- La regla de facturacion excluye solo estados reales del modelo actual: `borrador`.
- La deteccion de duplicados compara tambien email/telefono de facturacion y contacto principal.
- Se añadieron casos de prueba para facturas de 4.200 EUR, pagos parciales, pago completo, sobrepago, varias facturas y duplicados por contacto.

## C. Pendiente antes de produccion

- Confirmar que el deploy de Railway que sirve produccion ha ejecutado `npm run db:deploy` o `npx prisma migrate deploy`.
- Validar la URL publica de produccion tras el deploy: `/clientes`, ficha de cliente, `/hoy`, `/capataz` y rutas PDF.
- Si produccion despliega solo `main`, fusionar mediante PR antes de esperar deploy automatico.

## D. Pendiente para fases posteriores

- Paginacion 100% a nivel de base de datos para ordenaciones calculadas complejas.
- Sistema real de contactos multiples.
- Centro documental real con subida de archivos.
- Notas internas con entidad propia, autor, fecha, edicion y borrado controlado.
- Multiempresa/ownership transversal.
- Auditoria avanzada de actividad con eventos persistidos en lugar de timeline derivado.

## E. Contactos reales

No existe tabla `Contact`. El CRM muestra contactos derivados de campos de `Client`:

- `contactoPrincipalNombre`
- `contactoPrincipalCargo`
- `contactoPrincipalTelefono`
- `contactoPrincipalEmail`
- `contactoFacturacionNombre`
- `emailFacturacion`
- `telefonoFacturacion`

Especificacion propuesta para una fase futura:

```prisma
model Contact {
  id               String   @id @default(cuid())
  clientId         String
  name             String
  role             String?
  phone            String?
  email            String?
  isPrimary        Boolean  @default(false)
  isBillingContact Boolean  @default(false)
  isSiteContact    Boolean  @default(false)
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  client           Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
}
```

## F. Documentos

No existe entidad `Document`. La seccion Documentos centraliza PDFs ya generables desde presupuestos y facturas:

- `/presupuestos/[id]/pdf`
- `/dinero/[id]/pdf`

Queda pendiente un centro documental real para adjuntos, contratos, fotos, tickets y otros archivos.

## G. Notas

No existe entidad `ClientNote`. Las notas actuales son campos simples derivados de:

- `Client.notas`
- `Work.notas`
- `EventoAgenda.notas`
- `Reminder.mensaje`

No tienen autor ni historial propio. Deben evolucionar a una entidad dedicada antes de presentarlas como historial completo de notas.

## H. Multiempresa/ownership

El proyecto actual no tiene `userId`, `companyId`, `tenantId` ni `organizationId` en las entidades operativas. Existen `UsuarioPerfil` y `Empresa`, pero no estan relacionadas como ownership de:

- Client
- Work
- Budget
- Invoice
- Payment
- Expense
- Reminder
- EventoAgenda
- ChatConversation
- ChatMessage

Estado real: funcional para un unico espacio de trabajo, no preparado todavia para aislamiento real entre empresas.

Propuesta futura:

- Crear `Organization` o usar `Empresa` como tenant propietario.
- Añadir `empresaId` no nullable con backfill controlado a entidades operativas.
- Crear indices por `empresaId` y entidad.
- Aplicar filtros obligatorios en todas las queries y Server Actions.
- Añadir pruebas de acceso cruzado.

## I. Datos antiguos por revisar

Los registros antiguos siguen siendo compatibles porque los campos nuevos son nullable o tienen default. Deben revisarse manualmente:

- Clientes empresa con `tipo` antiguo como `Pyme` o `Negocio`.
- Clientes sin NIF/CIF.
- Clientes con direccion principal usada antes como fiscal.
- Clientes con telefono/email en campos antiguos pero sin contacto principal separado.

El CRM marca datos pendientes y permite edicion manual; no hace limpieza automatica agresiva.

## J. Riesgos tecnicos

- Las ordenaciones por saldo, facturacion y obras activas se calculan tras consultar clientes candidatos porque dependen de agregados compuestos.
- Sin ownership transversal no hay aislamiento multiempresa real.
- El timeline de actividad es derivado; no sustituye a un `ActivityLog` de negocio.
- El archivado es logico, pero las relaciones existentes siguen teniendo `onDelete: Cascade` si se implementase borrado fisico en el futuro. No debe añadirse borrado permanente sin politica explicita.

## K. Recomendaciones para el Prompt 4 de obras

- No crear ficha avanzada de obra sin resolver antes la estrategia de ownership.
- Mantener CRM -> obra apuntando a rutas reales de gestion hasta que exista `/obras/[id]`.
- Diseñar KPIs de obra con datos reales: presupuesto aprobado, facturado, cobrado, gastos y margen.
- Evitar barras de progreso si no existe porcentaje real.
- Separar direccion fiscal del cliente y direccion de obra.
- Reutilizar `lib/client-crm-calculations.ts` para no duplicar reglas financieras.
