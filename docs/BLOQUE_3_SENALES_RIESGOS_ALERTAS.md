# Bloque 3 - Señales, riesgos y alertas

## Arquitectura

La capa central vive en `lib/business-signals.ts`. Es determinista: reglas, consultas, métricas, históricos y estadística simple. No usa modelos entrenados, embeddings, fine tuning ni OpenAI Agents.

Consumidores actuales:

- `/alertas`
- `/hoy`
- chat de Capataz
- navegación principal y móvil

El motor no cambia facturas, obras, clientes, pagos ni importes. Solo persiste estado de señales.

## Modelos

`BusinessSignalState` guarda el ciclo de vida:

- `fingerprint` único para deduplicación.
- `type`, `ruleId`, `ruleVersion`.
- `level`, `status`, `lastPriority`.
- `source`, `entityType`, `entityId`.
- `clientId`, `workId`, `invoiceId`, `budgetId`.
- `amount`, `startsAt`, `expiresAt`.
- `firstDetectedAt`, `lastDetectedAt`, `shownAt`.
- `snoozedUntil`, `dismissedAt`, `dismissedReason`, `dismissedBy`.
- `resolvedAt`, `resolution`.
- `explanation`, `suggestedActions`, `metadata`.

`BusinessSignalPreference` deja preparada una futura personalización determinista. Puede bajar peso por comportamiento observado, pero nunca oculta señales automáticamente.

No hay claves foráneas hacia entidades de negocio. Esto conserva el histórico aunque un cliente, obra, factura o presupuesto se archive o cambie.

## Migración

Migración: `20260711213000_business_signals_risk_alerts`.

Es no destructiva:

- crea enums nuevos.
- crea tablas nuevas.
- crea índices.
- no hace `DROP`.
- no hace `DELETE`.
- no hace `TRUNCATE`.
- no modifica tablas existentes.
- no crea señales ficticias.
- no inserta miles de filas.

Índices principales:

- estado + prioridad.
- tipo.
- nivel.
- origen.
- regla.
- cliente.
- obra.
- factura.
- presupuesto.
- entidad genérica.
- caducidad.
- posposición.
- resolución.

## Estados

Estados persistentes:

- `active`
- `snoozed`
- `dismissed`
- `resolved`
- `expired`

Transiciones:

- `active -> snoozed`: guarda `snoozedUntil`; no borra la señal.
- `snoozed -> active`: al vencer el aplazamiento, si la causa sigue existiendo.
- `active -> dismissed`: guarda fecha, motivo y usuario; no borra la señal.
- `dismissed -> active`: solo si hay cambio material determinista, como subida relevante de prioridad o cambio de versión de regla.
- `active/snoozed -> resolved`: cuando desaparece la causa o el usuario resuelve manualmente.
- `resolved -> active`: si la causa vuelve a existir.
- `active -> expired`: si una señal temporal supera `expiresAt`.

## Scoring

Cada señal incluye `scoreBreakdown`.

Reglas principales:

- Factura vencida: base 30 + antigüedad hasta 35 + impacto económico hasta 20 + acumulación del cliente hasta 10 + estado reclamada 5.
- Factura próxima a vencer: base 18 + urgencia hasta 18 + impacto hasta 20 + dependencia de cliente 6.
- Concentración de deuda: 70 si el cliente concentra al menos 70%, 55 si al menos 50%, 40 si al menos 35%.
- Obra bloqueada: estado bloqueante + prioridad + días sin actualización + impacto.
- Obra sin actividad: obra activa, 14 días sin actualización y sin visita o recordatorio futuro.
- Rentabilidad: margen bajo o desviación de coste + porcentaje + importe.
- Planificación: recordatorios, visitas y eventos vencidos.
- Datos: clientes incompletos, documentos sin archivo e incidencias de tesorería.

La prioridad no depende del orden de creación. Ordena por score, impacto económico, fecha y detección.

## Agrupación

`/hoy` muestra un resumen limitado a 3-5 señales y enlaza a `/alertas`.

`/alertas` agrupa por tipo, origen y estado. Cada grupo muestra las 3 señales principales para evitar ruido y deja el detalle individual accesible.

## Explicabilidad

Cada señal responde:

- qué ocurrió.
- qué entidad está afectada.
- qué datos se usaron.
- qué regla se aplicó.
- qué score obtuvo.
- qué consecuencia tiene no revisarla.
- qué acción puede realizarse.

La UI muestra una explicación breve y un detalle desplegable de “Por qué aparece”.

## Fallback

Hay fallback solo de lectura si la migración no está aplicada. El objetivo es que `/alertas`, `/hoy` y el chat sigan mostrando señales derivadas durante despliegues intermedios.

El fallback no simula éxito de acciones persistentes. Posponer, descartar y resolver requieren `BusinessSignalState`. Si la tabla no existe, la acción falla y no finge persistencia.

Tras aplicar la migración, el camino principal es persistente.

## Chat

El chat usa `getBusinessSignals` para:

- “qué debería revisar hoy”
- “qué es lo más urgente”
- “qué problemas tengo”
- “qué riesgos importantes detectas”
- “qué cliente requiere atención”
- “qué obra debo revisar”
- “qué facturas son prioritarias”
- “por qué esta alerta es importante”
- “cuántas alertas críticas tengo”

Las respuestas son de solo lectura, enlazan datos reales y declaran que no se ha cambiado ningún registro.

## Tests

Scripts específicos:

- `npm run test:business-signals`
- `npm run test:risk-engine`
- `npm run test:alerts-center`
- `npm run test:alerts-chat`

Cobertura incluida:

- creación de señales.
- deduplicación por fingerprint.
- scoring y prioridad.
- reglas mínimas de facturas, presupuestos, obras, tesorería, CRM, agenda, documentos y gastos.
- explicaciones y acciones sugeridas.
- estados `active`, `snoozed`, `dismissed`, `resolved`, `expired`.
- reactivación por snooze vencido.
- reactivación por causa que vuelve.
- descarte que no reaparece sin cambio material.
- expiración.
- ruta `/alertas`.
- integración en `/hoy`.
- chat sin mutación.
- migración no destructiva.

## Railway

Para cerrar release, Railway debe ejecutar `npm run db:deploy` o equivalente antes del arranque productivo. La migración esperada es `20260711213000_business_signals_risk_alerts`.

Validaciones esperadas:

- `prisma migrate status` sin migraciones pendientes.
- build success.
- deployment success.
- `/api/status` 200.
- `/alertas` 200.
- acciones de posponer/descartar/resolver persistentes.

No usar `migrate reset`, `db push --force-reset`, `DROP`, `TRUNCATE` ni force push.

## Producción

Dominio de validación: `https://capataz-production.up.railway.app`.

Rutas a validar:

- `/api/status`
- `/alertas`
- `/hoy`
- `/capataz`
- `/clientes`
- `/obras`
- `/tesoreria`

La validación de persistencia debe usar una señal real no crítica. No debe modificar facturas, pagos, obras, clientes ni importes para generar datos.

Resultado de cierre, 2026-07-11:

- Commits de cierre: `3b5ad3d` para motor/centro/migración y `680a26d` para las consultas finales de chat.
- Railway usa `preDeployCommand: npm run db:deploy`.
- `npx prisma migrate status` queda al día con 10 migraciones aplicadas.
- `/api/status`, `/alertas`, `/hoy`, `/capataz`, `/clientes`, `/obras`, `/tesoreria` y `/alertas?estado=active&nivel=critico` devolvieron 200.
- Producción cargó 21 señales activas: 0 críticas y 4 importantes.
- La señal prioritaria de producción tiene explicación y acciones sugeridas.
- Posponer, descartar y resolver persistieron sobre una señal real no crítica y se restauró su estado original.
- El chat clasificó las 7 consultas de señales contra datos reales sin crear mensajes ni mutar entidades.
- Tests específicos, regresión principal, `typecheck` y `build` pasaron antes del despliegue.

## Limitaciones

- No hay emails.
- No hay WhatsApp.
- No hay OCR.
- No hay portal cliente.
- No hay machine learning.
- No hay automatizaciones externas.
- Algunas reglas solo aparecen si existen datos reales suficientes.

## Próxima Parte 2

La Parte 2 no debe empezar hasta que:

- la migración esté aplicada.
- `/alertas` funcione en producción.
- posponer, descartar y resolver persistan.
- no haya duplicados evidentes.
- el chat consulte señales reales sin mutar datos.
- tests, typecheck y build estén verdes.
