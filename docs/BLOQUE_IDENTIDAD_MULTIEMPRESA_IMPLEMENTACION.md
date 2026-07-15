# Identidad, autenticación y multiempresa — estado de implementación

Fecha de revisión: 15 de julio de 2026

## Cierre operativo productivo — 15 de julio de 2026

Decisión vigente: **CAPATAZ OPERATIVO — LISTO PARA CONTINUAR MEJORAS**.

El cierre final quedó integrado en `main` mediante el PR #7 y desplegado en Railway sobre el merge commit `ffb4e0e0c2cd47466830c27fbe75b57bf92827ac`. El commit funcional incluido fue `ae325140fcfaa9c1429749d89e99c851c3e2eb57` (`fix: scope proactive intelligence by company`).

La corrección final elimina el último residuo funcional detectado en producción: señales y recomendaciones proactivas sin `companyId`. `BusinessSignalState` y `BusinessRecommendation` quedan evaluadas y persistidas por empresa; los fingerprints incorporan scope empresarial y las páginas/acciones privadas pasan siempre el `companyId` obtenido desde `requireCompanyContext()`.

Validaciones de cierre:

- Railway proyecto `merry-quietude`, entorno `production`, servicio web `capataz`, cron `capataz-proactive-evaluator` y PostgreSQL `Postgres`.
- Deployment web final `bcf5f3ab-5b56-4a43-9701-fd3b9c2b0284`, `SUCCESS`, commit `ffb4e0e0c2cd47466830c27fbe75b57bf92827ac`.
- Deployment cron `60a877c3-7da7-43fd-881c-8e6be9de98d2`, `SUCCESS`, mismo commit.
- `prisma migrate status`: 18 migraciones locales; esquema de base de datos actualizado; cero migraciones pendientes y cero fallidas activas.
- `_prisma_migrations`: se conserva la fila histórica revertida de `20260712210000_company_numbering_and_settings`; no se manipuló manualmente.
- Company legacy única vinculada a `empresa-demo`; cero `companyId=NULL` en entidades operacionales revisadas.
- Cero duplicados de numeración por empresa en presupuestos y facturas.
- Healthcheck `/api/status`: HTTP 200 con app y base de datos correctas.
- Regresión local aislada: runner completo `107/107`, sin timeouts, con PostgreSQL embebido loopback y `CAPATAZ_TEST_DATABASE_ISOLATED=true`.
- QA productiva autenticada con fingerprint `qa-final-mrmfut98-203fa0`: CSV, PDFs, rutas privadas, aislamiento A/B, numeración separada y neutralización CSV injection correctos.
- Limpieza QA exacta: 22 filas creadas, 22 eliminadas, segunda pasada no-op, cero residuos. Respaldo QA SHA-256 `c42018330e59e58bcfc17937f37b17f7d5158e0657b5c15013c9d32bfa0937dc`.

Variables productivas por nombre: presentes `DATABASE_URL`, `APP_BASE_URL`, `NEXT_PUBLIC_WEB_BASE_URL` y `PROACTIVE_CRON_SECRET`; ausentes `EMAIL_FROM`, `RESEND_API_KEY` y `CRON_SECRET`. El correo real de verificación y recuperación queda limitado hasta configurar proveedor y remitente. `CRON_SECRET` no bloquea el cron actual porque el código vigente usa `PROACTIVE_CRON_SECRET`.

Las dos vulnerabilidades moderadas conocidas de `next`/`postcss` siguen documentadas; no hay vulnerabilidades altas ni críticas y no se ejecutó `npm audit fix`.

Rama de trabajo: `codex/identity-auth-multitenancy`

Base efectiva: `origin/main` en `404fb14`. Los commits `38c9dcf` y `0074747` se usaron como referencia funcional, pero no son ancestros directos de esta rama; su trabajo había quedado consolidado previamente en el estado de `main`.
Decisión actual (14 de julio de 2026): **LISTO PARA AUTORIZAR PUSH DE LA RAMA**; la incidencia de numeración quedó corregida en local, la regresión aislada completa pasa y los cambios están organizados en commits locales. No se ha hecho push, merge ni despliegue de aplicación.

## Preparación y commits locales — 14 de julio de 2026

Se revisaron exhaustivamente 54 archivos modificados o nuevos. No se detectaron residuos inequívocos versionables: `.codex-backup`, `.next`, logs, dumps, secretos y resultados locales permanecen fuera de Git. El staging se mantuvo explícito por grupos y cada grupo pasó `git diff --cached --check` antes del commit.

Commits creados, sin push:

- `757a7a9dba4d926bffc3b86509a8297ab100699d` — `feat: enforce tenant context and transactional document numbering`
- `4288856912bf746704a5b5ea03e681774b8ff816` — `feat: add guarded identity migration and production recovery tooling`
- `8b648fdd443134aa740c5c0ca405061f72b42638` — `test: enforce isolated regression and numbering contracts`
- `acb9f71307eb2e7c347ac2ce3a1d03a92be94e4e` — `docs: document identity multitenancy and production recovery`

La auditoría de secretos no encontró credenciales reales, URLs productivas ni valores de variables; las credenciales visibles en tests son sintéticas y de loopback. La guardia de tests exige `CAPATAZ_TEST_DATABASE_ISOLATED=true`, PostgreSQL loopback y nombres `capataz_test_*`; autenticación, migraciones de prueba y el runner de 105 tests usan esa protección.

Validación desde el estado local: Prisma format/validate/generate, typecheck, build, `test:database-safety`, `test:multitenancy-core`, `test:numbering-contract` y regresión completa `105/105` en PostgreSQL embebido aislado. Railway, producción y `_prisma_migrations` no se consultaron ni modificaron durante esta fase.

## Deploy controlado y bloqueo de cierre — 14 de julio de 2026

Se verificaron proyecto Railway `merry-quietude`, entorno `production`, servicio PostgreSQL `Postgres`, rama `codex/identity-auth-multitenancy` y HEAD `404fb1424088ff9dd510d01326e9b5342d9b414c`. El SQL de `20260713193000_company_document_sequences` es aditivo y su hash SHA-256 es `399dd61c5ac71a8714e1951eadff07b5244e75d4204f5cd418960336f65d7cbe`. Los audits previos fueron idénticos (hash `03ac6b4f8b8de529425d811193e6985cf49226def53879eac3c2059a036cbd8b`) y el respaldo externo verificable permanece fuera de Git (global `459b455e357e644ab3749ec2dbbb783704a048b4f9fc6980d846247c2bd76364`).

La única operación lanzada fue `npx prisma migrate deploy`. Prisma aplicó `20260713193000_company_document_sequences` y, al mismo tiempo, volvió a aplicar `20260712210000_company_numbering_and_settings`, generando una segunda fila histórica y sustituyendo los índices globales por índices únicos por `companyId`. No hubo SQL manual, `migrate resolve`, `db push`, reset, commit, push, merge ni despliegue de aplicación.

La post-auditoría repetida confirma la Company `cmrjrm83d0000vdzs0o5a27zt` enlazada a `empresa-demo`, una Company/una Empresa, cero nulos operativos, cero duplicados, relaciones coherentes, fingerprints QA a cero, tarea real preservada y tabla/objetos de secuencias presentes. `prisma migrate status` indica el esquema actualizado, pero hay 19 filas históricas para 18 directorios por la reaplicación de la migración revertida. Los contadores proactivos variaron durante la ventana (actividad concurrente), sin pérdida en las tablas operativas controladas.

El párrafo anterior conserva el estado histórico previo a la corrección local; la sección de diagnóstico siguiente registra la validación final `105/105`.

**Estado histórico previo a la corrección local: NO LISTO. La aserción concurrente queda resuelta en la sección de diagnóstico local siguiente.**

## Diagnóstico y corrección local de numeración — 14 de julio de 2026

La fase fue exclusivamente local: no se usó Railway, no se consultó producción, no se leyó la URL productiva y no se modificó `_prisma_migrations`. El snapshot externo del worktree queda fuera de Git.

Dos reproducciones en bases embebidas nuevas (`capataz_test_trace`, loopback) mostraron el mismo inventario: A y B con solo `P-2026-001`, sin filas de secuencia. Las 12 reservas concurrentes de A devolvieron el conjunto continuo `P-2026-002`…`P-2026-013`; B devolvió `P-2026-002`. El valor `P-2026-004` en el primer elemento del array era correcto: `Promise.all` conserva posiciones de promesa, pero el advisory lock asigna números según el orden real de adquisición. No había doble incremento ni mezcla entre empresas.

Se mantuvo el algoritmo productivo y se añadió `reserveDocumentNumberInTransaction` para que la reserva comparta la transacción de creación. Se corrigieron las acciones de presupuestos, gestión, conversiones, duplicados, plantillas y recorridos Capataz; la página de gestión ya no reserva números al renderizar. `test:multitenancy-core` valida ahora 20 reservas, rango continuo y secuencias A/B sin asumir el orden del array. La nueva suite `test:numbering-contract` cubre primera/segunda reserva, A/B, facturas, series, ejercicios, legacy, secuencias por encima/debajo del máximo, concurrencia de 20, aislamiento cruzado, rollback y reejecución.

Tres ejecuciones limpias de `test:multitenancy-core` pasaron: 21.895 s, 17.898 s y 18.636 s. La regresión completa final aislada pasó `105/105` scripts en `372.357 s` sobre `capataz_test_all` (`127.0.0.1:55480`, `CAPATAZ_TEST_DATABASE_ISOLATED=true`). También pasan Prisma format/validate/generate, typecheck, build y `git diff --check`. No se creó ninguna migración ni se realizó ninguna escritura productiva.

Prisma reaplicó la migración `rolled_back` porque `migrate deploy` la considera pendiente y registra una nueva fila exitosa; las dos filas históricas son esperables y no deben eliminarse. La situación productiva queda cerrada y sin nuevas operaciones en esta fase.

**Decisión de esta fase: LISTO PARA REVISAR LOS CAMBIOS Y PREPARAR COMMITS.**

## Dry-run actual de Company legacy y backfill — 13 de julio de 2026

Tras eliminar y reconciliar exactamente el manifiesto QA de 24 filas, la auditoría productiva de solo lectura confirmó `Empresa=1` (`empresa-demo`), `Company=0`, cierre transitivo QA `0`, fingerprints `4a33f773`, `7a3b51a7` y `7be8432e` a `0`, y la tarea `cmrhm95u80004vd84gufttv29` presente. El script `scripts/audit-legacy-company-backfill.mjs` exige el target Railway exacto y no carga ni imprime secretos.

El manifiesto actual contiene exactamente 228 filas con `companyId=NULL`, seleccionadas por tabla e ID exactos, nunca por fecha. Su SHA-256 es `63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c`; el inventario que añade `companyId`, `createdAt` y `updatedAt` tiene SHA-256 `786d59a475233571b786e4f441d419a6657b9c3ac2915478649a405654b0b7fa`. Distribución: `Client=8`, `Work=16`, `Budget=15`, `Invoice=4`, `Payment=3`, `Reminder=1`, `EventoAgenda=5`, `Notification=9`, `ChatConversation=82`, `BusinessSignalState=21`, `BusinessRecommendation=18`, `AutomationDefinition=5`, `AutomationRun=4`, `Task=33`, `FollowUp=4`; `Contact`, `Expense`, `Material`, `InternalNote`, `FinancialAccount`, `RecurringExpense` y `ExpectedCashFlow` están a cero. Los cuatro grupos excluidos (`Document`, `CashMovement`, `TreasurySettings`, `SecurityAuditEvent`) también tienen cero nulos.

La Company propuesta copia exclusivamente campos presentes en `Empresa`, con `legacyEmpresaId=empresa-demo`, `slug=rigo-asociados`, `timezone=Europe/Madrid`, `locale=es-ES`, `status=active` e `isDemo=false`; no hay conflicto de slug ni taxId. Los campos sin fuente (`defaultConditions`, `legalText`, `logoUrl`, `sealUrl`, `defaultPaymentTerms`) se mantendrán nulos. Las numeraciones `P-2026-001`…`P-2026-015` y `F-2026-001`…`F-2026-004` no presentan duplicados; relaciones padre/hijo no presentan discrepancias de `companyId`.

Resultado: `ok=true`, `execution.requested=false`, `performed=false`, `companyCreated=0`, `rowsUpdated=0`. No se creó el backup lógico porque solo debe generarse tras recibir la autorización exacta y justo antes de escribir. La frase requerida es:

`AUTORIZO EXCLUSIVAMENTE LA CREACIÓN DE UNA ÚNICA COMPANY LEGACY VINCULADA A EMPRESA-DEMO Y EL BACKFILL TRANSACCIONAL DE LOS 228 REGISTROS DEL MANIFIESTO SHA-256 63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c. NO AUTORIZO NINGUNA OTRA MODIFICACIÓN.`

La auditoría histórica de migraciones documenta el estado previo al deploy. El estado actual, tras la única ejecución autorizada, contiene una fila revertida y una fila finalizada para `20260712210000_company_numbering_and_settings`, además de la migración aditiva finalizada.

## Ejecución autorizada de Company + backfill — 13 de julio de 2026

Tras recibir la autorización literal del manifiesto `63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c`, se repitió el dry-run y se verificó el mismo hash. El backup lógico quedó fuera de Git, SHA-256 `1f303c5a3d114b768027fcd45aad39194135f4ecfa2d127b4f79db86e7f05066`.

La única transacción de escritura creó `Company.id=cmrjrm83d0000vdzs0o5a27zt` enlazada a `Empresa.id=empresa-demo` y actualizó exactamente 228 filas: `Client=8`, `Work=16`, `Budget=15`, `Invoice=4`, `Payment=3`, `Reminder=1`, `EventoAgenda=5`, `Notification=9`, `ChatConversation=82`, `BusinessSignalState=21`, `BusinessRecommendation=18`, `AutomationDefinition=5`, `AutomationRun=4`, `Task=33`, `FollowUp=4`; las demás tablas controladas tuvieron `0` actualizaciones.

La reconciliación productiva devolvió `Company=1`, `Empresa=1`, cero filas operacionales con `companyId=NULL`, conteos totales invariantes, cero duplicados de numeración, relaciones coherentes, cero fingerprints QA, y la tarea `cmrhm95u80004vd84gufttv29` intacta salvo el ownership `companyId` previsto. La segunda ejecución fue no-op (`alreadyBackfilled=true`, `performed=false`, `updated=0`). El informe final permanece fuera de Git.

Un primer intento fue abortado por una comprobación demasiado estricta del `companyId` de la tarea; la transacción hizo rollback completo y no dejó cambios parciales. Se ajustó la comprobación para permitir solo el ownership autorizado y la ejecución posterior pasó todas las validaciones. No se ejecutaron migraciones, commit, push, merge ni despliegue.

## Resolución administrativa de la migración fallida — 14 de julio de 2026

Se confirmó el target Railway productivo: proyecto `ca7ec244-e961-42dc-8573-23835e6db5f5`, entorno `production` `42c14ac1-e933-485b-9b44-01272af389e0` y servicio `Postgres` `0f485ee7-0ab3-430d-9abd-791b8e3e2907`. La rama permaneció `codex/identity-auth-multitenancy` en HEAD `404fb1424088ff9dd510d01326e9b5342d9b414c`; no hubo staging ni commit.

El estado previo sanitizado de `_prisma_migrations` se respaldó fuera del repositorio, SHA-256 `fae56a7bd6a7d81b557ee75fbe2ed88201862b8622e0e81936688045ddaefdb5`. `20260712210000_company_numbering_and_settings` estaba fallida, con `finished_at=NULL`, `rolled_back_at=NULL`, `applied_steps_count=0` y logs presentes; se conservaron únicamente longitud, hash y clasificación sanitizada de logs.

Las comprobaciones previas confirmaron Company `cmrjrm83d0000vdzs0o5a27zt` enlazada a `empresa-demo`, exactamente una Company vinculada, cero `companyId=NULL`, fingerprints QA a cero y la tarea real presente. Se ejecutó exclusivamente:

```text
npx prisma migrate resolve --rolled-back 20260712210000_company_numbering_and_settings
```

La lectura posterior confirmó la duplicación histórica descrita arriba. `npx prisma migrate status` reporta el esquema actualizado; no se ejecutó ningún segundo deploy.

Conteos funcionales invariantes, Company/backfill intactos, cero nulos operacionales, cero fingerprints y tarea preservada. Pasaron `npx prisma validate`, `npx prisma generate`, `npm run typecheck` y `git diff --check`; no se ejecutó build. No hubo cambios funcionales, commit, push, merge ni despliegue.

## Cierre transitivo pendiente (13 de julio de 2026)

La protección local y el snapshot de trabajo ya están preservados. Se añadió `scripts/audit-production-fixture-closure.mjs` para recorrer todas las tablas públicas y referencias físicas/blandas hasta punto fijo, partiendo del respaldo verificado de 252 filas, los ocho residuos conocidos y los fingerprints de las ejecuciones QA. El script es de solo lectura, no usa fechas como selector, excluye la tarea real `cmrhm95u80004vd84gufttv29` y aborta ante target productivo ausente o incorrecto.

La auditoría productiva consecutiva fue idéntica en ambas pasadas: 24 candidatos, manifiesto SHA-256 `d254c661524e65620f29a07c0c4d6c03f7beaae3f1d3842048ffbde5b58dc4e3`, informe SHA-256 `b680259356ef9d33b20ef8783510a187b4cbebef0662ea25462e29c38fe90888`, cero fingerprints externos, cero ambigüedades y tarea real preservada. La auditoría específica de `F-7be843e2` confirmó como QA el Client, el Work y sus ocho relaciones, sin referencias externas. Con autorización literal, se respaldaron y eliminaron exactamente esos 24 IDs en transacción `Serializable`; backup SHA-256 `504f11dc8f2bc89ca4852aae29efa1c9dfced90abe42d3a4dd59cef67ace14c4`, `deleted=24`. La segunda ejecución fue no-op (`alreadyClean=true`, `deleted=0`). Company, backfill, migraciones, Git y despliegue siguen bloqueados por contrato.

## Arquitectura y seguridad

Capataz usa identidad propia separada de los modelos legacy `Empresa` y `UsuarioPerfil`: `User`, `Company`, `CompanyMembership`, `Session`, tokens de verificación/recuperación y auditoría sanitizada. El contexto empresarial se deriva de una sesión opaca válida y una membresía activa.

Las contraseñas usan `scrypt` con sal aleatoria, parámetros versionados y comparación en tiempo constante. El email se normaliza para la unicidad. El token de sesión es aleatorio, solo se entrega mediante cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción y PostgreSQL conserva únicamente su SHA-256. Un cambio de contraseña revoca las sesiones existentes.

El correo está abstraído del proveedor. El adaptador inicial admite Resend y un modo local que no envía ni revela tokens completos; el modo local queda prohibido en producción. Antes de habilitar autenticación por correo en Railway deben decidirse/configurarse `APP_BASE_URL`, `EMAIL_FROM` y `RESEND_API_KEY` (en la inspección de nombres de variables no estaban presentes).

## Núcleo ERP conectado a `companyCore`

Se ha aplicado ownership por empresa a las lecturas y mutaciones sensibles del núcleo: clientes, obras, presupuestos, facturas/cobros, gestión, tesorería, agenda y recordatorios. Las operaciones por ID comprueban simultáneamente el identificador y `companyId`; los accesos cruzados devuelven ausencia o rechazo y no revelan datos.

Las rutas PDF de presupuesto y factura obtienen tanto el documento como la empresa mediante `companyCore`; ya no resuelven una empresa global. Las exportaciones y documentos cubiertos por el núcleo conservan el mismo límite empresarial. La regresión negativa valida aislamiento de listados, IDs, mutaciones, relaciones, agregados y documentos.

No quedan usos ejecutables de `Empresa.findFirst()` ni `UsuarioPerfil.findFirst()` en el código de aplicación, librerías o scripts. Los textos que aún contienen esas cadenas son artefactos históricos de auditoría o documentación, no código ejecutable. El backfill legacy exige exactamente una empresa candidata: si no existe o hay más de una, aborta de forma explícita.

El motor proactivo avanzado todavía opera con supuestos globales. Para impedir que una mutación ya aislada reactive ese camino, las reevaluaciones originadas desde el núcleo con `companyId` no ejecutan el motor global. El dashboard `/hoy` dejó de consultar señales/recomendaciones globales; la inspección visual confirmó que vuelve a renderizar sin colisiones entre empresas.

## Numeración empresarial y migraciones

La migración `20260712210000_company_numbering_and_settings` realiza preflight de `companyId` nulo y duplicados dentro de la misma empresa. Solo después retira los índices de unicidad global de obra, presupuesto y factura y crea unicidad compuesta por empresa. Este `DROP INDEX` está justificado porque:

1. no elimina tablas ni filas;
2. aborta antes de modificar índices si el backfill no está completo o existen duplicados empresariales;
3. un índice global impediría que dos empresas usaran legítimamente la misma numeración;
4. la unicidad compuesta mantiene la protección que realmente corresponde al dominio.

La migración aditiva `20260713193000_company_document_sequences` crea `CompanyDocumentSequence` con unicidad `(companyId, type, scope)` y FK `RESTRICT`. La reserva del siguiente número se serializa con advisory lock y se persiste dentro de la secuencia. Esto corrige la ventana en la que dos solicitudes concurrentes podían leer el mismo máximo después de liberar el lock y antes de crear el documento. La prueba ejecuta 12 reservas simultáneas, todas únicas, y demuestra que otra empresa puede usar la misma serie independientemente.

Orden de despliegue recomendado, pendiente de autorización:

1. desplegar el código de recuperación y ambas migraciones en una ventana controlada;
2. detectar exclusivamente el fallo pendiente esperado de `20260712210000_company_numbering_and_settings`;
3. ejecutar backfill idempotente y reconciliar cero nulos/duplicados;
4. marcar esa migración fallida como rolled back y volver a ejecutar `prisma migrate deploy`;
5. ejecutar smoke tests autenticados por empresa y verificar PDFs/numeraciones;
6. solo entonces habilitar progresivamente módulos avanzados.

> Nota de lectura: las secciones de diagnóstico y estados de migración que siguen conservan la trazabilidad histórica de las fases anteriores (incluidos recuentos de 240 y residuos ya limpiados). El dry-run de 228 filas documentado al inicio es el estado vigente y supersede esas cifras.

## Fallo Railway diagnosticado y recuperación corregida

El despliegue `914dc86` compiló pero falló con Prisma `P3018`: la migración de numeración detectó que el backfill de `companyId` no estaba completo. El despliegue posterior `404fb14` intentó recuperar, pero Prisma respondió `P3009` porque ya existía una migración fallida registrada; el script solo reconocía `P3018` y nunca llegaba al backfill ni al `migrate resolve`.

`scripts/deploy-database.mjs` ahora comprueba `_prisma_migrations`, solo acepta exactamente una migración fallida sin resolver y exige que sea la migración esperada. Reconoce tanto el primer `P3018` como el `P3009` de una ejecución posterior, ejecuta el backfill, resuelve únicamente esa migración y reintenta el deploy. La validación PostgreSQL aislada reproduce deliberadamente la secuencia `P3018 -> P3009 -> backfill -> resolve -> deploy` y termina correctamente.

Railway sigue mostrando el servicio online con un despliegue antiguo, mientras el despliegue más reciente está fallido. No se modificaron variables, base de datos, despliegues ni servicio durante esta auditoría.

La lectura de `_prisma_migrations` confirma que `20260712180000_company_ownership_nullable` finalizó y que `20260712210000_company_numbering_and_settings` sigue sin `finished_at`, sin `rolled_back_at` y con cero pasos aplicados. Antes de la limpieza había 305 filas con `companyId IS NULL`; después de eliminar los 252 fixtures, el recuento bajó exactamente en las 65 filas operacionales esperadas y quedan **240 filas legacy**.

El backfill fue autorizado, pero su dry-run abortó con `LEGACY_COMPANY_COUNT_MISMATCH:0`. Producción contiene una única `Empresa` (`empresa-demo`) y ninguna fila `Company`; por ello no existe un `companyId` válido ni puede verificarse `legacyEmpresaId`. El script ya no hace `upsert` ni modifica ajustes de empresa: exige que la `Company` exista previamente y que el enlace sea inequívoco. No se ejecutó ninguna escritura de backfill.

La autorización posterior para crear una única `Company` tampoco llegó a escritura: el dry-run global detectó dos `BusinessSignalState` y dos `BusinessRecommendation` que apuntan a los IDs exactos del cliente, obra y factura de fixture eliminados. Estas cuatro filas estaban fuera del manifiesto original de 252. Permanecen entre las 240 filas nulas y no deben ser convertidas en datos legacy; el máximo provisional realmente legacy es 236. La precondición de cero fingerprints falló y `Company` continúa vacía.

La autorización exacta para limpiar esas cuatro filas también quedó bloqueada en dry-run: existen cuatro `ProactiveAuditEvent` entrantes con eventos `signal_created`/`recommendation_created`, `origin=evaluation` y los mismos fingerprints/entidades fixture. El manifiesto relacional completo es de 8 filas y SHA-256 `eeaaf3bc0b2f1b96d450913764aeda3ff634e8d0cf53cac6faa4b6cab29ab96e`. No hubo respaldo específico ni borrado porque la autorización solo cubría cuatro IDs.

La propuesta bloqueada era `slug=rigo-asociados`, `legacyEmpresaId=empresa-demo`, timezone `Europe/Madrid`, locale `es-ES`, estado activo e `isDemo=false` por existir datos operacionales reales. No había conflictos de slug ni taxId. Quedarían pendientes `defaultConditions`, `legalText`, `logoUrl`, `sealUrl` y `defaultPaymentTerms`. No se configuró la aprobación temporal ni se creó ninguna fila.

La inspección de presencia de variables, sin mostrar valores, confirma `DATABASE_URL`, `NEXT_PUBLIC_WEB_BASE_URL` y `PROACTIVE_CRON_SECRET`; faltan `APP_BASE_URL`, `EMAIL_FROM`, `RESEND_API_KEY` y `CRON_SECRET`. El cron proactivo permanece bloqueado aunque su secreto exista. No hay `SESSION_SECRET`, `AUTH_SECRET` ni `NEXTAUTH_SECRET`, pero la implementación actual usa tokens opacos con hash en base de datos y no consume esas variables, por lo que no se clasifican como faltantes del diseño vigente.

## Evidencia de validación local

- `npm ci`: correcto; árbol de dependencias consistente.
- Prisma format/validate: correcto.
- TypeScript: correcto.
- Build Next.js 15.5.19: correcto.
- Regresión completa: 104/104 scripts `test:*` aprobados, forzando `DATABASE_URL` a PostgreSQL embebido loopback con `CAPATAZ_TEST_DATABASE_ISOLATED=true` y base `capataz_test_*`.
- Migraciones aisladas: 18 migraciones, 64 tablas y 304 índices; conteos legacy invariantes; recuperación `P3009` comprobada.
- Multiempresa: aislamiento de listados, IDs, mutaciones, relaciones, agregados y documentos; unicidad empresarial y 12 reservas concurrentes aprobadas.
- `git diff --check`: correcto (solo avisos de conversión LF/CRLF del entorno Windows).
- El proyecto no define script `lint`; no se inventó un sustituto como criterio de aprobación.
- Evidencia visual previa registrada: 390, 768 y 1440 px sin overflow horizontal ni pantallas de error en login/registro/recuperación/verificación, `/hoy`, clientes, obras, presupuestos, facturas, documentos, agenda, gastos, recordatorios, tesorería y configuración. No se repitió en estas fases 0–3; la validación productiva pertenece a la fase 10. Las rutas PDF sí pasan contrato y aislamiento local.
- Los módulos avanzados bloqueados redirigen/muestran correctamente “Esta función no está disponible temporalmente”.

## Dependencias y vulnerabilidades

`npm audit --omit=dev` informa 2 vulnerabilidades moderadas y ninguna alta o crítica: `next` directo y `postcss` transitivo bajo Next.js. No se ejecutó `npm audit fix` ni se alteró el lockfile; la remediación queda para una actualización de dependencias separada, con revisión de compatibilidad y regresión completa.

## Módulos que permanecen cerrados

Chat/Capataz, búsqueda avanzada, alertas, recomendaciones, inteligencia, automatizaciones, tareas, seguimientos y demo continúan bloqueados por middleware. Contienen recorridos Prisma o motores globales que todavía no han demostrado aislamiento completo. No se consideran parte habilitada del núcleo ERP hasta que cada lectura, mutación, relación, agregado, exportación y ejecución asíncrona propague `companyId` y pase pruebas negativas A/B.

## Incidente de pruebas contra producción

La primera invocación del runner de regresión heredó inadvertidamente el `DATABASE_URL` del entorno local, que resolvía hacia PostgreSQL de Railway. La ejecución fue detenida al detectarlo, pero ya había creado fixtures en producción. La auditoría exacta posterior no usa fechas como selector: correlaciona los fingerprints `4a33f773` y `7a3b51a7`, idempotencias `qa:*`/`contract-*`, nombres QA, numeraciones y relaciones padre/hijo.

| Tabla | Filas nuevas |
|---|---:|
| AutomationAction | 4 |
| AutomationCondition | 2 |
| AutomationDefinition | 3 |
| AutomationRun | 4 |
| AutomationStepRun | 2 |
| AutomationTrigger | 4 |
| AutomationVersion | 4 |
| Budget | 1 |
| BusinessEvent | 1 |
| ChatActionLog | 102 |
| ChatConversation | 30 |
| ChatMessage | 59 |
| FollowUp | 2 |
| FollowUpAttempt | 2 |
| FollowUpOutcome | 1 |
| Invoice | 1 |
| Client | 1 |
| Task | 22 |
| TaskChecklistItem | 2 |
| TaskDependency | 2 |
| TaskRecurrence | 1 |
| TaskStatusHistory | 1 |
| Work | 1 |
| **Total** | **252** |

El inventario inicial de 244 omitía ocho filas; el total correcto es 252. Tras autorización literal se creó y verificó un respaldo lógico completo, se ejecutó una única transacción y se eliminaron exactamente 252 filas. El dry-run posterior devuelve `total=0`, `alreadyClean=true`, `performed=false` y `deleted=0`. El informe completo, criterios, IDs, relaciones, respaldo y ejecución están en [PRODUCTION_FIXTURE_AUDIT_20260713.md](./PRODUCTION_FIXTURE_AUDIT_20260713.md).

Todos los candidatos empresariales tenían `companyId = NULL`. No se encontraron ni modificaron usuarios, memberships, sesiones, tokens, documentos/PDFs, pagos, movimientos ni auditorías de seguridad. La tarea preexistente del 12 de julio permanece presente después de la limpieza.

Los tests mutantes directos exigen ahora `CAPATAZ_TEST_DATABASE_ISOLATED=true`, host loopback y nombre de base `capataz_test_*` o de las categorías aisladas permitidas; rechazan Railway, hosts remotos, ausencia de URL y fallback silencioso. `test:database-safety` comprueba la barrera y `run-all-tests-isolated.mjs` crea una base nueva para la regresión completa.

## Criterios para cambiar la decisión a LISTO

1. Completado: autorización literal recibida para el manifiesto auditado de 252 filas.
2. Completado: limpieza exacta, segundo dry-run no-op, cero fingerprints y tarea excluida preservada.
3. Revisar el diff y autorizar commits; actualmente no hay commit, push, merge ni despliegue de este bloque.
4. Configurar/confirmar las variables de correo y URL pública necesarias.
5. Autorizar y observar un despliegue Railway nuevo con migraciones completas.
6. Ejecutar smoke tests autenticados en Railway y confirmar que la versión activa corresponde al commit aprobado.
7. Mantener bloqueados los módulos avanzados hasta su propia tenantización y regresión.

La fase 4 eliminó exactamente el manifiesto autorizado de 252 filas y la fase de numeración local queda validada. Los módulos avanzados siguen bloqueados por su propio contrato de tenantización; no forman parte de este cierre. La conclusión de esta fase es **LISTO PARA REVISAR LOS CAMBIOS Y PREPARAR COMMITS**.
