# Bloque 3 · Automatizaciones · Parte 2

## Alcance y arquitectura

Esta entrega añade un núcleo aditivo para automatizaciones versionadas, tareas y seguimientos. `Reminder`, `EventoAgenda`, `ChatConversation.activeTask` y `BusinessRecommendation` se conservan por compatibilidad y no sustituyen a `Task` ni `FollowUp`.

Las capas se separan en `lib/automations`, `lib/tasks`, `lib/followups` y `lib/business-events.ts`. La UI funcional inicial vive en `/automatizaciones`, `/tareas` y `/seguimientos`. No hay diseñador visual avanzado.

## Modelos y migración

La migración `20260712143000_automation_core_tasks_followups` es aditiva. Crea Definition, Version, Trigger, Condition, Action, Schedule, Run y StepRun; BusinessEvent append-only; Task y sus asignaciones, dependencias, historial, comentarios, enlaces, checklist y recurrencia; FollowUp con intentos y resultados. Añade a Agenda enlaces opcionales a Task y FollowUp. No cambia Float, no elimina datos y no modifica migraciones anteriores.

Los campos `companyId`, actores, correlación y causación quedan opcionales para evolución futura. Los históricos usan `Restrict` o `SetNull`, nunca cascada destructiva.

## Versionado, reglas y seguridad

Una versión publicada se trata como inmutable. Publicar valida triggers, comparadores y acciones, calcula SHA-256, retira la versión publicada anterior y actualiza `currentVersionId`. Los comparadores son estructurados; no se usa `eval` ni código de usuario.

Las acciones externas o sensibles están enumeradas y rechazadas con `EXTERNAL_ACTION_DISABLED`. Las acciones confirmables entran en `waiting_confirmation`. Los snapshots y errores se sanitizan y limitan antes de persistir.

## Runner, scheduler e idempotencia

El runner crea una ejecución por clave única, evalúa AND/OR, registra cada paso y admite dry run. Las claves cubren versión/ocurrencia/entidad y cada paso. El scheduler reclama cada programación con `lockUntil`, libera en `finally` y permite recuperar locks vencidos. Los fallos se clasifican sin persistir payloads completos sensibles. La política de retry está estructurada en cada versión; la ejecución automática de backoff multiintento queda como limitación explícita para la siguiente iteración.

## Tareas y recurrencia

Task tiene ciclo de vida propio, prioridad, responsable futuro, fechas y enlaces operacionales. Cada transición registra historial. Las dependencias directas y reversas se validan para impedir ciclos simples. La recurrencia calcula la siguiente ocurrencia sin materializar indefinidamente el futuro; la generación por ventana y la edición “esta y siguientes” quedan preparadas en el modelo, con UI avanzada pendiente.

## Seguimientos

FollowUp representa un proceso con próxima acción, estado, prioridad y resultado. FollowUpAttempt registra intentos y FollowUpOutcome resultados. La ruta funcional permite crear, registrar intento y completar sin enviar comunicaciones.

## Eventos, Agenda, Hoy y Chat

`publishBusinessEvent` proporciona una interfaz append-only sanitizada y `dispatchBusinessEvent` conecta eventos internos con triggers. Agenda acepta referencias opcionales de Task/FollowUp. Hoy conserva sus resúmenes existentes; la ampliación visual de tarjetas 360 y las consultas conversacionales específicas de Task/FollowUp quedan como limitación real, no como funcionalidad simulada.

## Tests y operación

`package.json` expone las baterías `test:automation-*`, `test:tasks*` y `test:followups*`. Se deben ejecutar junto con Prisma validate/generate/status, typecheck, build y la regresión existente. El endpoint `/api/internal/automations` requiere secreto cron y no expone credenciales.

## Preparación para Parte 3

Pendiente para Parte 3: diseñador visual avanzado, aprobaciones multiusuario, SLA y acciones externas. Continúan prohibidas las comunicaciones externas y mutaciones financieras automáticas.

## Cierre de integraciones

`/hoy` incorpora un resumen compacto con tareas de hoy y atrasadas, seguimientos vencidos, fallos recientes y próxima programación. Cliente, Obra, Factura y Presupuesto muestran hasta tres tareas y seguimientos vinculados, con enlaces filtrados a los centros. Las consultas nunca mezclan datos de otras entidades cuando reciben un identificador específico.

El chat reconoce consultas reales de automatizaciones, tareas y seguimientos antes del parser de creación. Guarda `lastAutomation`, `lastTask` y `lastFollowUp` en el contexto. Las órdenes explícitas soportadas crean Task/FollowUp, registran un intento interno, completan Task, pausan/reanudan Automation y ejecutan dry run. Una referencia sin contexto pide aclaración. No se envían comunicaciones ni se modifican importes.

## RRULE y series

El parser acepta DAILY, WEEKLY, MONTHLY y YEARLY con INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, UNTIL y COUNT. Soporta días laborables mediante BYDAY, intervalos quincenales, ordinales positivos y negativos como primer lunes o último viernes, zona horaria persistida y generación limitada por ventana. La clave `(recurrenceId, occurrenceKey)` impide duplicados. COUNT desactiva la serie al alcanzar el límite.

La edición distingue `this`, `following` y `all`. Nunca modifica ocurrencias completadas en operaciones de serie. Las excepciones quedan preparadas en `exdates`; la UI avanzada de EXDATE individual no forma parte de este cierre.

## Retries, actores y ciclos

AutomationRun conserva `nextRetryAt`, intentos y último error. El backoff fixed, linear o exponential respeta máximo de demora y errores reintentables. El scheduler reclama retries vencidos sin crear otra ejecución y conserva la idempotencia del run.

AutomationConfirmation registra actorType, actorId nullable, origen, acción, entidad, payload sanitizado, correlación e idempotencia. La confirmación se valida contra run, step y action en servidor.

Las dependencias Task se validan recorriendo el grafo completo. Las cadenas de automatización conservan causación, correlación, origen y profundidad, con límite `MAX_AUTOMATION_CHAIN_DEPTH = 10`.

## Cron y plantillas

El endpoint proactivo existente coordina evaluación proactiva y mantenimiento de automatizaciones en paralelo, con resúmenes separados. Procesa schedules, retries, tareas recurrentes y seguimientos vencidos. No se añadió un segundo servicio cron.

Hay nueve plantillas disponibles y desactivadas: facturas vencidas, presupuestos sin respuesta o próximos a caducar, obra inactiva o con margen negativo, visita próxima, déficit previsto y cliente empresa sin CIF.

## Estado de validación

Prisma validate/generate, typecheck, build, las baterías iniciales, las nuevas pruebas de cierre y la regresión existente pasan localmente. La validación visual se realizó sobre PostgreSQL temporal con el esquema completo, sin usar ni alterar producción.

## Cierre definitivo de UI y QA aislado

Las rutas `/tareas/[id]`, `/seguimientos/[id]` y `/automatizaciones/[id]` son funcionales. Task permite editar, asignar, cambiar estado/prioridad/fecha, bloquear con motivo, archivar, comentar, mantener checklist ordenable, crear subtareas, añadir o retirar dependencias, configurar RRULE y elegir el alcance de edición. FollowUp permite editar, cambiar el ciclo de vida, registrar interacciones manuales por canal, próximas acciones y resultados estructurados sin mutaciones sensibles. Automation permite editar únicamente drafts, publicar, versionar, pausar, reanudar, deshabilitar, duplicar, archivar, programar, ejecutar dry run, consultar runs/steps, reintentar y confirmar acciones internas con actor verificado en servidor.

La edición `this` crea una excepción y separa la ocurrencia; `following` divide la serie conservando el histórico anterior; `all` modifica solo ocurrencias futuras no completadas.

Se usó PostgreSQL 18 embebido y temporal, fuera del repositorio y sin modificar `.env`. La prueba desde cero aplicó 13 migraciones, generó 56 tablas y 250 índices, sin cascadas nuevas peligrosas. El flujo transaccional creó cliente, obra, presupuesto, factura, automation, runs, Task, checklist, subtarea, dependencia, FollowUp, intento, resultado, recurrencia, retry y evento de auditoría. El ciclo inverso fue rechazado, el dry run y run finalizaron, y Chat confirmó consulta sin mutación y creación explícita de Task.

La prueba incremental aplicó primero las 12 migraciones anteriores, insertó registros representativos y aplicó únicamente `20260712143000_automation_core_tasks_followups`. Conteos antes/después: clientes 1/1, obras 1/1, presupuestos 1/1, facturas 1/1, eventos 1/1, recordatorios 1/1 y conversaciones 2/2. Las dos columnas nuevas de Agenda quedaron disponibles y se creó una Task relacionada con datos heredados.

La validación de navegador cubrió 84 combinaciones: ocho rutas principales y cuatro fichas 360 en 320, 375, 390, 430, 768, 1024 y 1440 px. No se detectó overflow horizontal ni errores de render. Se corrigieron etiquetas de dependencia y del compositor de Chat, jerarquía `h1` de Chat y tamaños táctiles transitorios. También se ejecutó en UI la creación de Task, checklist 1/1, subtarea, dependencia, FollowUp, intento, resultado y dry run.

No se afirma conformidad WCAG completa. Se verificaron encabezados, labels, fieldsets, teclado, `aria-current`, `aria-live`, texto de botones y estados no basados únicamente en color.

## Railway y producción

`main` se integró por fast-forward. Railway desplegó el mismo commit tanto en la aplicación como en `capataz-proactive-evaluator`. El preDeploy ejecutó `npm run db:deploy`, encontró 13 migraciones y aplicó `20260712143000_automation_core_tasks_followups` correctamente. Aplicación y cron quedaron en `SUCCESS`.

El smoke HTTP devolvió 200 en `/api/status`, `/hoy`, `/tareas`, `/seguimientos`, `/automatizaciones` y `/capataz`; el healthcheck informó aplicación y base de datos operativas. Se crearon registros técnicos sin datos personales ni importes para Task con checklist y subtarea, FollowUp con intento y resultado, y AutomationRun seco; todos quedaron archivados. Chat productivo validó consultas sin mutación y descubrió una variante lingüística no cubierta para «cuál fue la última ejecución»; se añadió la regla y una regresión transaccional antes del despliegue correctivo.

Limitación operativa preexistente: Railway mantiene `NEXT_PUBLIC_APP_ENV=staging` y `NEXT_PUBLIC_APP_MODE=test` dentro del environment llamado production. No se cambiaron esos valores porque alteran políticas de visibilidad y límites comerciales fuera del alcance funcional de este bloque.

## Cierre del contrato conversacional

El pipeline conserva una única entrada productiva (`runChatCommand`) y añade una capa estructurada antes del parser genérico para mutaciones profesionales. El contexto persistido incluye Task, elemento de checklist, padre, dependencia, FollowUp, intento, próxima acción, AutomationDefinition, versión, run, paso del borrador y una desambiguación temporal con candidatos sin exponer IDs.

Chat permite añadir, completar y reabrir checklist; crear subtareas y abrir su padre; añadir o retirar dependencias con selección explícita; consultar bloqueos; reprogramar seguimientos con fechas naturales; crear y modificar Automation drafts; añadir condiciones; cambiar la acción; simular sin mutaciones; crear una nueva versión draft y archivar borradores, tareas o seguimientos con advertencias según su estado. Los ciclos, profundidad, duplicados, versiones publicadas y referencias ambiguas se validan en servidor.

La idempotencia primaria usa el mensaje persistido de conversación y se complementa con comprobaciones semánticas para checklist, subtareas, dependencias y drafts. `ChatActionLog` registra intención, acción, resultado, candidatos, actor `user`, origen `chat`, conversación e idempotencyKey con payloads reducidos y sin secretos.

`test:automation-chat-contract` ejecuta 37 casos contra la misma capa de routing de producción. Se integra también en la prueba PostgreSQL aislada. Pasan el contrato, las pruebas transaccionales, todos los scripts de regresión, Prisma validate/generate, typecheck y build.

### Auditoría de variables Railway

| Variable | Uso real | Valor auditado | Recomendación | Riesgo |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | Healthcheck, detalle de errores, logging y depuración de Chat, obligatoriedad de IA | `staging` | `production` | Bajo y favorable: reduce diagnóstico expuesto; exige validar Chat/voz tras redespliegue |
| `NEXT_PUBLIC_APP_MODE` | Etiqueta UI y límites demo/comerciales mediante `isUnlimitedMode` | `test` | Mantener `test` hasta activar suscripción real | Cambiarlo prematuramente podría activar límites comerciales sin plan configurado |

Decisión: cambiar sólo `NEXT_PUBLIC_APP_ENV` a `production` en Railway después del commit y conservar `NEXT_PUBLIC_APP_MODE=test`. No es una migración de datos ni una afirmación basada únicamente en la etiqueta; la aplicación, base, cron y rutas se validan por separado.
