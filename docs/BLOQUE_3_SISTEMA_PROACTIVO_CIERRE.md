# Bloque 3 · Sistema proactivo · Cierre técnico

## Estado

Parte 3 implementa la capa de cierre del sistema proactivo: reevaluación, lifecycle persistente, auditoría, lock, endpoint interno, control interno, métricas, ruido, cooldown, reactivación explicable y chat de ciclo de vida.

El sistema automatiza comprobaciones, no decisiones. No envía emails, WhatsApp, documentos, pagos, facturas ni comunicaciones externas.

## Arquitectura

- `lib/business-signals.ts`: detección determinista y ciclo de vida de señales.
- `lib/business-recommendations.ts`: recomendaciones derivadas, acciones sugeridas y estados.
- `lib/proactive-rules.ts`: reglas de cambio material, cooldown y hash estable.
- `lib/proactive-audit.ts`: auditoría sanitizada.
- `lib/proactive-evaluation.ts`: run central, lock, batches lógicos, métricas, resumen diario/semanal y control.
- `app/api/internal/proactive-evaluate/route.ts`: endpoint `POST` protegido por secreto.
- `scripts/run-proactive-evaluation.mjs`: runner HTTP de una sola ejecución, sin servidor ni handles persistentes.
- `railway.cron.json`: configuración exclusiva del servicio cron, sin migración ni healthcheck web.
- `app/(app)/recomendaciones/control`: centro de control interno.

## Ciclo De Vida

Señales: `active`, `snoozed`, `dismissed`, `resolved`, `expired`.

Recomendaciones: `active`, `viewed`, `accepted`, `in_progress`, `completed`, `snoozed`, `dismissed`, `obsolete`, `failed`.

Cada transición relevante registra evento en `ProactiveAuditEvent` con estado anterior, estado posterior, motivo, regla, entidad, origen y payload sanitizado.

## Cambio Material

El sistema calcula `changeHash` con los campos materiales de la señal o recomendación: tipo, versión de regla, prioridad por tramos, importe, entidad, cliente, obra, factura, presupuesto y fechas relevantes.

Una descartada o completada solo reaparece si:

- sube la prioridad por encima del umbral de la regla;
- cambia la versión de regla;
- cambia el hash material y además hay empeoramiento mínimo;
- termina un aplazamiento y la causa sigue activa.

## Cooldown Y Caducidad

`proactive-rules.ts` define cooldown por regla:

- factura vencida: 3 días;
- obra sin actividad o margen: 7 días;
- dato incompleto o documento: 14 días;
- tesorería crítica: hasta 1 día.

Las críticas no quedan ocultas por cooldown largo. El centro completo conserva visibilidad; `/hoy` respeta cooldown para reducir ruido.

## Scheduler Y Railway

Endpoint preparado:

`POST /api/internal/proactive-evaluate`

Autorización y contrato:

- header `x-capataz-cron-secret`;
- o `Authorization: Bearer ...`;
- secreto leído solo de servidor: `PROACTIVE_CRON_SECRET` o `CRON_SECRET`.
- body obligatorio `{}`; no se aceptan parámetros de tipo, origen o alcance.
- comparación del secreto mediante digest SHA-256 y `timingSafeEqual`.
- respuesta limitada a estado, identificador de run y métricas sanitizadas.

Railway mantiene el servicio web persistente con `npm run start`. La evaluación debe ejecutarse en un servicio separado llamado `capataz-proactive-evaluator`, sin dominio, healthcheck, volumen ni réplica persistente, con:

- comando: `npm run proactive:evaluate`;
- config-as-code: `/railway.cron.json`;
- horario: `10 * * * *`;
- zona horaria: UTC;
- URL no secreta: `CAPATAZ_INTERNAL_URL=https://capataz-production.up.railway.app`;
- secreto: `PROACTIVE_CRON_SECRET`, compartido de forma segura con el servicio web.

El runner aplica un timeout de 15 minutos (configurable a un valor menor mediante `PROACTIVE_EVALUATION_TIMEOUT_MS`), termina `0` al completar o encontrar un lock normal, `2` ante resultado parcial y `1` ante configuración, autorización, red, timeout o servidor fallido. Al usar HTTP no instancia Prisma; la conexión pertenece al servicio web y su lifecycle normal. No inicia Next.js ni escucha en un puerto.

## Locks Y Errores

`ProactiveEvaluationRun` usa `lockKey` y una unique partial index sobre runs `running`. Si queda un lock huérfano, se recupera tras timeout de 20 minutos.

Si una evaluación falla:

- se marca `failed`;
- se guarda error sanitizado;
- se libera el lock;
- no se borran señales ni recomendaciones;
- el endpoint devuelve error genérico.

No hay reintento dentro del runner para evitar dobles evaluaciones. Railway puede iniciar la siguiente ejecución horaria; el unique lock impide concurrencia y los locks huérfanos expiran a los 20 minutos.

## Lotes Y Rendimiento

La carga de estados de señales se pagina. La evaluación reutiliza los motores existentes, que ya limitan lecturas principales. No hay consultas destructivas ni recálculo por minuto. Las mutaciones relevantes disparan una reevaluación con cooldown interno de 2 minutos para evitar cascadas.

## Recordatorios Y Bucles

Crear un recordatorio real requiere acción explícita o confirmación. Las acciones confirmadas `create_collection_followup` y `create_budget_followup` comprueban si ya existe un seguimiento activo para la misma factura o presupuesto antes de crear otro.

## Auditoría Y Métricas

El centro de control muestra:

- última evaluación;
- estado y duración;
- señales y recomendaciones activas;
- aceptadas, completadas, pospuestas, descartadas y obsoletas;
- errores de runs y acciones;
- reglas con alto descarte o exceso de activas;
- auditoría reciente.

Las métricas son del asistente, no del rendimiento empresarial.

## Preferencias

`ProactiveSystemPreference` consolida frecuencia, límites de `/hoy`, prioridad mínima, horas silenciosas, cooldown por regla, niveles visibles y modo de agrupación.

Horas silenciosas afectan solo a prominencia interna futura; no ocultan centros ni críticas al abrir.

## Chat

Capataz responde con datos reales a:

- cuándo se revisaron las recomendaciones;
- qué se reactivó;
- qué quedó resuelto esta semana;
- qué está pospuesto;
- qué vence hoy;
- por qué volvió una recomendación;
- marcar revisada;
- reactivar;
- historial;
- reglas con más ruido.

Las consultas no mutan. Las mutaciones de chat requieren intención clara y solo cambian estado interno de recomendación.

## Tests

Scripts añadidos:

- `test:proactive-evaluation`
- `test:signal-lifecycle`
- `test:recommendation-lifecycle`
- `test:proactive-scheduler`
- `test:proactive-locking`
- `test:proactive-cooldown`
- `test:proactive-reactivation`
- `test:proactive-audit`
- `test:proactive-maintenance`
- `test:proactive-chat`
- `test:proactive-integration`
- `test:proactive-cron`

## Operación Segura

Ejecución manual: lanzar una ejecución del servicio cron desde Railway. No colocar el secreto en comandos, URLs o logs locales.

Desactivación: deshabilitar únicamente el horario del servicio cron. Mantener endpoint protegido, histórico, modelos y evaluaciones manuales; no borrar recomendaciones.

Rotación: generar un nuevo valor aleatorio de al menos 32 bytes, actualizar primero el servicio web y después el cron mediante referencia segura, redesplegar ambos, probar autorización y retirar el valor anterior. No documentar ni registrar el valor.

## Validación De Producción

Estado validado el 2026-07-12:

- `main` contiene el commit `ebc1e01`.
- GitHub/Railway marcó el despliegue `merry-quietude - capataz` como `success`.
- `https://capataz-production.up.railway.app/api/status` responde 200 con base de datos `ok`.
- `https://capataz-production.up.railway.app/recomendaciones/control` responde 200 sin página de error.
- `https://capataz-production.up.railway.app/hoy` responde 200 y contiene resumen proactivo.
- `https://capataz-production.up.railway.app/recomendaciones` responde 200 y contiene historial/enlace al control.
- `POST /api/internal/proactive-evaluate` responde 503 sin secreto porque `PROACTIVE_CRON_SECRET`/`CRON_SECRET` no está configurado en producción.

La migración se considera aplicada en producción porque el centro de control consulta las tablas nuevas y responde 200. No se pudo inspeccionar el log interno de Railway desde Codex porque Railway CLI no está instalado.

## Limitaciones

- La fecha y métricas de la primera ejecución programada deben añadirse tras observar una ejecución disparada por el horario real; una ejecución manual no basta.
- La reevaluación tras mutaciones reutiliza los motores globales existentes con límites y cooldown; una fase posterior puede convertirla en selección estricta por entidad.
- No se implementan acciones externas, OCR, machine learning ni agentes autónomos.

## Decisión

PROMPT 3 NO COMPLETADO OPERATIVAMENTE hasta configurar el secreto, desplegar el servicio cron separado y verificar al menos una ejecución disparada por el horario real.
