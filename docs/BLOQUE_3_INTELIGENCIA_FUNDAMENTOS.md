# Bloque 3 - Inteligencia empresarial: fundamentos

Fecha de implementacion: 2026-07-11.

## Estado

Documento vivo para la rama `codex/business-intelligence-foundations`.

El Bloque 3 incorpora una primera capa determinista de inteligencia empresarial. No anade migraciones ni cambia el esquema Prisma. No modifica `.env` ni secretos.

## Objetivo funcional

- Panel nuevo `/inteligencia` con resumen ejecutivo, KPIs, comparativas, alertas, calidad de datos, rankings de obras y clientes.
- Exportaciones CSV desde `/inteligencia/export`.
- Capataz Chat responde preguntas de negocio usando la misma capa central.
- Formulas financieras explicitas y testeadas.
- Sin IA generativa para calculos. La IA podra explicar o redactar en fases futuras, pero no definir la verdad contable.

## Capa central

Archivos principales:

- `lib/business-periods.ts`: periodos y comparativas.
- `lib/business-metrics.ts`: formulas puras y definiciones de metricas.
- `lib/business-intelligence.ts`: agregacion de Prisma, rankings, alertas, salud y CSV.
- `app/(app)/inteligencia/page.tsx`: panel visual.
- `app/(app)/inteligencia/export/route.ts`: exportacion CSV.

## Periodos soportados

- `today`
- `this_week`
- `this_month`
- `previous_month`
- `this_quarter`
- `previous_quarter`
- `this_year`
- `previous_year`
- `last_30_days`
- `last_90_days`
- `custom`

Las comparativas de mes, trimestre y ano usan periodos calendario anteriores, no resta bruta de milisegundos. Esto evita errores cuando los meses tienen distinta duracion.

## Definiciones financieras

### Facturado

Formula: suma de `Invoice.total` por `fechaEmision` dentro del periodo.

Incluye:

- Facturas validas emitidas.

Excluye:

- `borrador`
- `pendiente_emitir`
- Presupuestos.
- Pagos.

### Cobrado

Formula: suma de `Payment.importe` por fecha de pago dentro del periodo.

Incluye:

- Pagos reales registrados.

Excluye:

- Facturas sin pago.
- Pendiente de cobro.
- Presupuestos.

### Pendiente de cobro

Formula: `max(0, Invoice.total - suma(Payment.importe))`.

Incluye:

- Saldo abierto de facturas validas hasta el final del periodo.

Excluye:

- Sobrepagos como deuda negativa.
- `borrador`.
- `pendiente_emitir`.

Si hay pagos asociados, los pagos son la fuente de verdad. Los campos denormalizados `pagado` y `pendiente` son fallback solo cuando no hay array de pagos cargado.

### Vencido

Formula: pendiente de cobro con `fechaVencimiento` anterior al dia actual.

Incluye:

- Facturas validas con saldo pendiente y vencimiento pasado.

Excluye:

- Facturas pagadas.
- Sobrepagos.
- Facturas no emitidas.

### Gastos

Formula: suma de `Expense.importe` por `fecha`.

Incluye:

- Gastos reales registrados.

Excluye:

- Presupuestos de proveedor no registrados como gasto.

### Beneficio

Hay dos lecturas explicitas:

- Beneficio sobre facturado: `facturado - gastos`.
- Beneficio sobre cobrado: `cobrado - gastos`.

El chat debe explicitar cual usa cuando el usuario pregunta por beneficio.

### Margen

- Margen sobre facturado: `(facturado - gastos) / facturado * 100`.
- Margen sobre cobrado: `(cobrado - gastos) / cobrado * 100`.

La division entre cero devuelve 0.

### Conversion de presupuestos

Formula: `presupuestos aceptados / presupuestos decididos * 100`.

Decididos:

- `aceptado`
- `rechazado`
- `caducado`

Aceptados:

- `aceptado`

Pendientes sin decision no entran en el denominador.

## Alertas deterministas

El panel genera avisos a partir de datos reales:

- Facturas vencidas.
- Obras con margen negativo.
- Gasto real superior a coste previsto.
- Deuda concentrada en un cliente.
- Presupuestos proximos a caducar.
- Facturas sin pagos tras 30 dias.
- Recordatorios atrasados.

No se crean tareas ni recordatorios automaticamente.

## Calidad de datos

Se reportan incidencias no destructivas:

- Facturas con vencimiento anterior a emision.
- Facturas con sobrepago.
- Clientes fiscales incompletos.
- Obras sin coste previsto.
- Obras con margen negativo.
- Documentos sin importe estructurado.
- Pagos sin factura: 0 porque el modelo actual exige factura.
- Gastos sin obra: 0 porque el modelo actual exige obra.

## Capataz Chat

Consultas nuevas o redirigidas a BI:

- `como va mi negocio`
- `cuanto he cobrado este mes`
- `cuanto tengo pendiente de cobrar`
- `cuanto tengo vencido`
- `cuanto beneficio tengo`
- `cual es mi margen`
- `que obra es mas rentable`
- `que cliente tarda mas en pagar`
- `conversion de presupuestos`
- `comparame este mes con el anterior`
- `que deberia revisar`

Las consultas de negocio usan `getBusinessIntelligenceSummary`. Las respuestas llevan diagnostico `noMutation: true`.

## Rutas nuevas

- `/inteligencia`
- `/inteligencia?periodo=this_month`
- `/inteligencia?periodo=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `/inteligencia/export?tipo=summary&periodo=this_month`
- `/inteligencia/export?tipo=works&periodo=this_month`
- `/inteligencia/export?tipo=pending-invoices&periodo=this_month`
- `/inteligencia/export?tipo=expenses&periodo=this_month`

## Tests

Scripts nuevos:

- `test:business-periods`
- `test:business-metrics`
- `test:business-health`
- `test:business-intelligence`
- `test:business-chat`

Tambien se amplia:

- `test:chat-query`

Validacion local ejecutada:

- `npx prisma validate`: OK.
- `npm run typecheck`: OK.
- `test:business-periods`: OK.
- `test:business-metrics`: OK.
- `test:business-health`: OK.
- `test:business-intelligence`: OK.
- `test:business-chat`: OK.
- `test:chat-query`: OK.
- Regresion de dashboard, CRM, obras, chat, PDFs, agenda, documentos, notificaciones, busqueda, configuracion e integracion Bloque 2: OK.
- `npm run build`: OK.

## Limitaciones

- No hay prediccion ni forecast estadistico.
- No hay OCR ni extraccion automatica de tickets.
- No hay IA proactiva que cree acciones.
- No hay multiempresa/ownership transversal.
- Los CSV son exportaciones operativas sencillas.
- La rentabilidad de obra depende de que facturas y gastos esten correctamente asociados a la obra.
- La calidad documental solo revisa metadata estructurada disponible, no lee archivos.

## Railway y produccion

Pendiente tras merge a `main`:

- Push de `main`.
- Confirmar status Railway/GitHub en success.
- Validar `https://capataz-production.up.railway.app`.
- Validar `/api/status`, `/inteligencia`, `/hoy`, `/clientes`, `/obras`, `/capataz` y PDFs.
- No validar ni modificar `capataz.app` en este bloque.
