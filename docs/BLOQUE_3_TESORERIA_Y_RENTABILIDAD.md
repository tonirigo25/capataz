# Bloque 3 - Tesoreria, cashflow y rentabilidad

Fecha de implementacion: 2026-07-11.

## Estado

Documento vivo para la rama `codex/treasury-cashflow-profitability`.

El bloque anade una capa real de tesoreria, prevision de caja y rentabilidad avanzada. No modifica `.env`, no muestra secretos y no inventa saldos bancarios cuando no hay cuentas configuradas.

## Objetivo funcional

- Panel nuevo `/tesoreria` con saldo registrado, movimientos, forecast, escenarios, alertas, cuentas, cobros, pagos, rentabilidad por obra y rentabilidad por cliente.
- Exportaciones CSV desde `/tesoreria/export`.
- Modelos persistentes para cuentas financieras, movimientos de caja, previsiones manuales, gastos recurrentes y ajustes de tesoreria.
- Integracion en `/hoy`, Cliente 360, Obra 360 y Capataz Chat.
- Formulas deterministas y testeadas. La IA no decide importes ni fechas.

## Modelos anadidos

- `FinancialAccount`: banco, caja u otra cuenta con saldo inicial, saldo manual opcional, moneda, minimo y estado.
- `CashMovement`: entrada, salida, transferencia, ajuste, estado, origen y relaciones opcionales con cliente, obra, factura, pago o gasto.
- `RecurringExpense`: gasto recurrente activo con frecuencia, proxima fecha, importe y clasificacion fijo/variable.
- `ExpectedCashFlow`: prevision manual de entrada o salida con probabilidad, estado y fuente.
- `TreasurySettings`: minimo global de caja, cobertura objetivo y tolerancia de desviacion.

Campos nuevos en `Expense`:

- `paymentStatus`: `unknown`, `pending`, `paid`, `cancelled`.
- `paymentDueDate`: fecha prevista de pago.
- `paidAt`: fecha real de pago.
- `costBehavior`: `unknown`, `fixed`, `variable`.

## Migracion

Migracion no destructiva:

- `prisma/migrations/20260711200000_treasury_cashflow_profitability/migration.sql`

Crea tablas y enums si no existen, anade campos nullable o con default a `Expense`, crea indices y claves foraneas. No elimina datos existentes.

## Capa central

Archivos principales:

- `lib/treasury.ts`: agregacion central, forecast, escenarios, alertas, CSV y definiciones.
- `app/(app)/tesoreria/page.tsx`: panel visual de tesoreria.
- `app/(app)/tesoreria/actions.ts`: altas y ajustes de cuentas, movimientos, transferencias, recurrentes, previsiones y settings.
- `app/(app)/tesoreria/export/route.ts`: exportaciones CSV.
- `scripts/validate-treasury-suite.mjs`: validacion determinista de tesoreria.

## Rutas

- `/tesoreria`
- `/tesoreria?horizonte=30d&escenario=base`
- `/tesoreria?horizonte=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `/tesoreria?cliente=CLIENT_ID`
- `/tesoreria?obra=WORK_ID`
- `/tesoreria/export?tipo=movements`
- `/tesoreria/export?tipo=forecast`
- `/tesoreria/export?tipo=receivables`
- `/tesoreria/export?tipo=payables`
- `/tesoreria/export?tipo=work-profitability`
- `/tesoreria/export?tipo=client-profitability`
- `/tesoreria/export?tipo=deviations`

## Definiciones financieras

### Saldo de tesoreria registrado

Formula: suma de cuentas activas.

Por cuenta:

- Si existe `currentManualBalance`, se usa ese saldo manual.
- Si no existe, se usa `openingBalance + movimientos confirmados hasta ahora`.

Limitacion: si no hay `FinancialAccount`, el saldo registrado es `null`. Capataz no inventa saldo.

### Flujo de caja

Formula: entradas de negocio menos salidas de negocio en el periodo.

Incluye:

- Movimientos confirmados de entrada y salida.

Excluye:

- Transferencias entre cuentas (`transfer_in`, `transfer_out`) para evitar doble conteo.

### Forecast de caja

Formula: `saldo inicial registrado + entradas previstas - salidas previstas`.

Entradas:

- Facturas validas pendientes por fecha de vencimiento.
- Previsiones manuales de entrada.
- Movimientos futuros o pendientes de entrada.

Salidas:

- Gastos con `paymentStatus = pending` y `paymentDueDate`.
- Gastos recurrentes activos dentro del horizonte.
- Previsiones manuales de salida.
- Movimientos futuros o pendientes de salida.

Los gastos pendientes sin `paymentDueDate` se muestran como "sin fecha" y no se colocan artificialmente en el calendario.

### Escenarios

- Conservador: incluye todas las salidas conocidas y solo entradas confirmadas.
- Base: incluye facturas pendientes, pagos previstos, recurrentes y previsiones no inciertas.
- Optimista: incluye tambien entradas inciertas registradas.
- Personalizado: preparado para futuras hipotesis sin mutar datos reales.

### Rentabilidad avanzada por obra

- Presupuestado: `presupuestoAprobado` o presupuestos aceptados/validos.
- Facturado: facturas validas de la obra.
- Cobrado: pagos asociados a facturas de la obra.
- Coste real: maximo entre gastos reales y `gastoReal` legacy.
- Coste pagado: gastos marcados como pagados o movimientos de salida vinculados.
- Beneficio sobre facturado: `facturado - coste real`.
- Beneficio sobre cobrado: `cobrado - coste real`.
- Flujo de caja de obra: `cobrado - coste pagado`.
- Necesidad de caja: `abs(flujo de caja)` cuando el flujo es negativo.

### Rentabilidad por cliente

- Facturado: facturas validas del cliente.
- Cobrado: pagos del cliente.
- Pendiente: saldo abierto de facturas validas.
- Vencido: pendiente con vencimiento pasado.
- Gastos: gastos directos del cliente y gastos de sus obras, deduplicados por id.
- Beneficio: `facturado - gastos`.
- Margen: `beneficio / facturado * 100`.
- Concentracion: peso del cliente en deuda e ingresos.

### Punto de equilibrio

Formula: `costes fijos / margen de contribucion`.

- Costes fijos: gastos del mes con `costBehavior = fixed` + recurrentes fijos del mes.
- Costes variables: gastos del mes con `costBehavior = variable`.
- Margen de contribucion: `(facturado del mes - costes variables) / facturado del mes`.

No se calcula si faltan gastos clasificados, costes fijos o facturacion del mes.

### Cobertura

Formula: `saldo registrado / gasto diario medio`.

- Gasto mensual medio: gastos de los ultimos 90 dias / 3.
- Gasto diario medio: gasto mensual medio / 30.
- Dias con saldo: `saldo registrado / gasto diario medio`.
- Dias con saldo y cobros confirmados: `(saldo registrado + cobros confirmados) / gasto diario medio`.

## Alertas deterministas

- Sin cuenta configurada.
- Saldo previsto negativo.
- Saldo por debajo del minimo.
- Facturas vencidas.
- Semana con mas pagos que cobros.
- Pendiente concentrado en un cliente.
- Pago elevado proximo.
- Obra consumiendo caja.
- Transferencia sin pareja trazable.
- Saldo actual bajo minimo.

No crean tareas ni movimientos automaticamente.

## Calidad de datos

Se reportan incidencias no destructivas:

- Cuentas no configuradas.
- Cuentas sin saldo inicial, manual ni movimientos.
- Monedas mezcladas.
- Gastos sin estado de pago.
- Gastos pendientes sin fecha de pago.
- Costes sin clasificar fijo/variable.
- Facturas con sobrepago.
- Facturas con total incoherente.
- Movimientos potencialmente duplicados.
- Transferencias sin grupo.
- Importes negativos no justificados.
- Gastos recurrentes sin proxima fecha.

## Capataz Chat

Consultas soportadas:

- `como esta mi caja`
- `cuanto dinero tengo disponible`
- `cuanto voy a cobrar esta semana`
- `cuanto tengo que pagar este mes`
- `cuanto pagare este mes`
- `como estara mi caja dentro de 30 dias`
- `cuando me quedare por debajo del minimo`
- `que facturas vencen esta semana`
- `que pagos tengo proximos`
- `flujo de caja`
- `que obra consume mas caja`
- `punto de equilibrio`
- `cobertura de caja`
- `haz escenario conservador`
- `compara base y conservador`
- `que deberia revisar en tesoreria`

Las respuestas usan `getTreasuryOverview` y diagnostico `noMutation: true`.

## Tests

Scripts nuevos:

- `test:treasury-accounts`
- `test:cash-movements`
- `test:cashflow-forecast`
- `test:cashflow-scenarios`
- `test:recurring-expenses`
- `test:work-profitability-advanced`
- `test:client-profitability`
- `test:break-even`
- `test:treasury-chat`
- `test:treasury-integration`

Validacion local ejecutada:

- `npx prisma validate`: OK.
- `npx prisma migrate status`: antes del deploy, migracion `20260711200000_treasury_cashflow_profitability` pendiente.
- `npx prisma generate`: OK.
- `npm run typecheck`: OK.
- `npm run test:treasury-chat`: OK.
- `npm run test:treasury-integration`: OK.
- `npm run build`: OK.

Validacion de release ejecutada:

- Suite de tesoreria completa: OK.
- Regresion de negocio, dashboard, CRM, obras, chat, PDF y AI fixture: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Hotfix de chat para `cuanto pagare este mes`: `test:treasury-chat`, `test:treasury-integration`, `typecheck` y `build` OK.

## Cierre de release

Rama de trabajo:

- `codex/treasury-cashflow-profitability`

Commits:

- Commit funcional de rama: `175f858` (`feat: add treasury cashflow profitability module`).
- Commit de hotfix en `main`: `ee68c5a` (`fix: classify treasury payment forecast query`).

Git:

- `origin/main` actualizado sin force push.
- No se incluyeron `.env`, `node_modules`, `.next`, temporales ni secretos.
- No se uso `git reset --hard`, `git clean -fd` ni `git push --force`.

Railway:

- `railway.json` usa `buildCommand: npm run build`.
- `railway.json` usa `preDeployCommand: npm run db:deploy`.
- CLI local de Railway no autenticado, por lo que el estado se valido por rutas de produccion y estado de migraciones.
- Durante el despliegue, `/tesoreria` paso de 404 a 200 y `npx prisma migrate status` paso a `Database schema is up to date!`.
- Migracion aplicada en la base configurada: `20260711200000_treasury_cashflow_profitability`.

Produccion validada solo en:

- `https://capataz-production.up.railway.app`

Rutas validadas:

- `/api/status`: 200.
- `/tesoreria`: 200.
- `/hoy`: 200.
- `/clientes`: 200.
- `/clientes/cmr60ximn0003p60p7846qcgd`: 200.
- `/obras`: 200.
- `/obras/cmqr2rg9o000co50pc8szpefu`: 200.
- `/capataz`: 200.
- `/tesoreria/export?tipo=forecast`: 200, `text/csv`.
- `/presupuestos/cmqo8wdst0003n201muzu1r4o/pdf`: 200, `application/pdf`.
- `/dinero/cmqr2s0me000mo50pu9ofa65y/pdf`: 200, `application/pdf`.

Estado de datos en produccion:

- No hay cuentas financieras configuradas.
- `/tesoreria` muestra estado vacio correcto y no inventa saldo.
- No se crearon cuentas, saldos, movimientos, transferencias, recurrentes ni previsiones manuales de prueba.

Validacion navegador:

- `/tesoreria`, `/hoy`, Cliente 360, Obra 360 y `/capataz` cargan con cuerpo visible.
- Consola sin errores nuevos en esas rutas durante la validacion.

Chat en produccion:

- `como esta mi caja`: responde con escenario base, sin cuentas configuradas y sin saldo calculable.
- `cuanto cobrare esta semana`: responde con cobros previstos y aclara que facturas pendientes no son dinero disponible.
- `cuanto pagare este mes`: responde con pagos previstos 0 y explica gastos pendientes sin fecha.
- `como estara mi caja dentro de 30 dias`: responde forecast a 30 dias, saldo sin calculo por falta de cuentas y supuestos.
- `que obra consume mas caja`: responde sin obras con flujo de caja negativo con los datos registrados.
- `que obra tiene mejor margen`: responde ranking de obra rentable sin mutar datos.
- `que cliente tarda mas en pagar`: responde plazo medio de cobro.
- `cual es mi punto de equilibrio`: indica que no hay datos suficientes clasificados.
- `hazme un escenario conservador`: responde escenario conservador y confirma que no modifica datos reales.

Decision:

- LISTO para Prompt 3 del Bloque 3.

## Limitaciones

- No hay conciliacion bancaria ni importacion de extractos.
- No hay multi-moneda real; si hay monedas mezcladas se avisa, pero no se convierte.
- No hay motor probabilistico; los escenarios son deterministas.
- El escenario personalizado queda preparado para una fase posterior de hipotesis editables.
- Los gastos recurrentes generan previsiones, no gastos reales automaticos.
- El forecast depende de fechas registradas; los gastos pendientes sin fecha no se calendarizan.
- No hay permisos multiempresa ni control de roles en esta fase.
