# Bloque 3 - Recomendaciones proactivas

## Arquitectura

La capa central vive en `lib/business-recommendations.ts`. Consume señales reales desde `lib/business-signals.ts` y las convierte en recomendaciones operativas con acciones estructuradas.

Separación de responsabilidades:

- `lib/business-signals.ts`: detecta señales y riesgos.
- `lib/recommendation-actions.ts`: registro central de acciones permitidas.
- `lib/business-recommendations.ts`: genera, deduplica, sincroniza estado y ejecuta acciones confirmadas.
- `/recomendaciones`: centro operativo de recomendaciones.
- Integraciones de lectura: `/hoy`, Cliente 360, Obra 360, Tesorería y Capataz Chat.

Capataz propone. El usuario decide.

## Modelos

Modelos nuevos:

- `BusinessRecommendation`
- `RecommendationActionLog`
- `RecommendationPreference`

Enums nuevos:

- `BusinessRecommendationStatus`
- `RecommendationActionLogStatus`

La migración `20260711233000_proactive_recommendations` es no destructiva: solo crea enums, tablas e índices. No modifica tablas de clientes, obras, facturas, pagos ni señales.

No hay claves foráneas hacia entidades de negocio. Se guardan identificadores y contexto para conservar histórico aunque una entidad cambie o se archive.

## Relación Con Señales

Una señal activa puede generar una recomendación. La recomendación guarda `signalFingerprint` para trazabilidad, pero tiene estado propio.

Ejemplos:

- `invoice_overdue` -> `invoice_collection`
- `work_low_margin` -> `work_cost_review`
- `client_data_incomplete` -> `client_data_completion`
- `treasury_negative_cash` -> `treasury_review`

No se crean varias recomendaciones idénticas para la misma señal. Una recomendación contiene acción principal y acciones alternativas.

## Estados

Estados persistentes:

- `active`
- `viewed`
- `accepted`
- `in_progress`
- `completed`
- `snoozed`
- `dismissed`
- `obsolete`
- `failed`

Reglas principales:

- `snoozed` reaparece al vencer si la señal sigue activa.
- `dismissed` no reaparece salvo cambio material de prioridad o versión de regla.
- `completed` conserva histórico.
- si la señal origen desaparece, la recomendación activa pasa a `obsolete`.
- una acción fallida deja la recomendación en `failed`, no en completada.

## Acciones

Las acciones están registradas en `lib/recommendation-actions.ts`.

Tipos implementados:

- `navigate`
- `open_preview`
- `create_draft`
- `confirm_then_execute`
- `server_action`
- `ask_for_missing_data`
- `snooze`
- `dismiss`

Acciones reales incluidas:

- abrir factura;
- registrar pago como borrador de flujo;
- crear seguimiento interno de cobro confirmado;
- abrir cliente;
- completar datos de cliente;
- abrir obra;
- revisar costes de obra;
- programar visita como borrador;
- abrir presupuesto;
- crear seguimiento interno de presupuesto confirmado;
- abrir PDF de presupuesto o factura;
- abrir tesorería;
- consultar escenario conservador;
- abrir alertas, documentos, agenda, recordatorios y gastos.

No se guardan funciones en JSON. Se guardan `actionId`, datos y contexto; el servidor resuelve el handler permitido.

## Confirmación

Las acciones que modifican datos requieren confirmación explícita.

Ejemplo:

- primera vista: `Crear seguimiento`;
- panel de confirmación: muestra recomendación, entidad y motivo;
- botón final: `Confirmar`.

Crear un seguimiento no marca una factura como cobrada ni resuelve automáticamente el problema.

## Idempotencia

`RecommendationActionLog` guarda `idempotencyKey`.

Si el usuario pulsa dos veces la misma acción confirmada, el servidor detecta el evento previo y no duplica la acción.

## Seguimiento Y Reevaluación

El motor sincroniza recomendaciones al cargar el centro o las integraciones. Si una señal deja de existir, la recomendación pasa a `obsolete`.

Los estados `accepted` e `in_progress` permiten seguir una acción creada sin fingir que el problema ya está resuelto.

## Centro

Ruta nueva:

- `/recomendaciones`

Incluye:

- filtros por estado, nivel, origen y texto;
- métricas;
- prioridad principal;
- agrupación;
- tarjetas con explicación;
- acción principal;
- acciones alternativas;
- posponer;
- descartar;
- marcar revisada;
- confirmación para acciones mutantes.

## Integración

Integraciones implementadas:

- `/hoy`: muestra máximo 3 recomendaciones principales.
- Cliente 360: muestra recomendaciones filtradas por `clientId`.
- Obra 360: muestra recomendaciones filtradas por `workId`.
- Tesorería: muestra recomendaciones de origen `tesoreria`.
- `/alertas`: enlace al centro de recomendaciones.
- Navegación principal y móvil: enlace a `/recomendaciones`.

## Chat

Capataz Chat entiende:

- “qué me recomiendas hacer hoy”;
- “qué debería hacer primero”;
- “qué recomendaciones importantes tengo”;
- “qué puedo resolver rápido”;
- “por qué me recomiendas esto”;
- “hazlo”;
- “mejor el viernes”;
- “recuérdamelo mañana”;
- “descarta esta recomendación”.

El chat guarda `lastRecommendation` con fingerprint, entidad, acción y estado.

“Hazlo” no ejecuta acciones sensibles automáticamente. Si la acción requiere confirmación, devuelve vista previa e indica que debe confirmarse.

“Recuérdamelo mañana” pospone la recomendación. No crea una tarea real salvo petición explícita y flujo correspondiente.

## Preferencias Y Métricas

`RecommendationPreference` permite preparar preferencias simples:

- tipos desactivados;
- delta de prioridad;
- importe mínimo;
- máximo de recomendaciones en Hoy.

`RecommendationActionLog` registra utilidad operativa:

- vista;
- aceptada;
- ejecutada;
- pospuesta;
- descartada;
- fallida;
- idempotencia.

No hay ML ni entrenamiento en esta fase.

## Tests

Scripts nuevos:

- `npm run test:recommendation-engine`
- `npm run test:recommendation-actions`
- `npm run test:recommendation-followup`
- `npm run test:recommendation-deduplication`
- `npm run test:recommendation-chat`
- `npm run test:recommendation-center`
- `npm run test:recommendation-integration`

También debe ejecutarse regresión de señales, BI, tesorería, CRM, obras, chat, PDF, IA, `typecheck` y `build`.

## Railway Y Producción

Railway debe ejecutar `npm run db:deploy` antes del arranque productivo.

Validación esperada:

- migración `20260711233000_proactive_recommendations` aplicada;
- `npx prisma migrate status` al día;
- `/api/status` 200;
- `/recomendaciones` 200;
- `/hoy` 200;
- `/clientes` y ficha Cliente 360 200;
- `/obras` y ficha Obra 360 200;
- `/tesoreria` 200;
- `/capataz` 200.

## Limitaciones

- No envía emails.
- No envía WhatsApp.
- No registra pagos por sugerencia.
- No cambia importes.
- No cierra obras.
- No archiva clientes.
- No ejecuta acciones sensibles sin confirmación.
- No recomienda financiación ni productos financieros.
- No hay automatizaciones autónomas ni ML.

## Parte 3 Pendiente

Queda fuera de esta parte:

- comunicaciones externas;
- automatizaciones autónomas;
- OCR;
- ML;
- recomendaciones predictivas avanzadas;
- permisos multiusuario avanzados.
