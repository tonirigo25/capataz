# Auditoría de fixtures en producción — 13 de julio de 2026

Estado actual (14 de julio de 2026): **deploy productivo cerrado; corrección local de numeración validada; LISTO PARA AUTORIZAR PUSH DE LA RAMA**.

## Cierre local y commits — 14 de julio de 2026

Se revisaron 54 archivos modificados o nuevos. No se incluyeron `.codex-backup`, `.next`, logs, dumps, secretos, URLs con credenciales ni resultados de PostgreSQL. Los commits locales creados son:

- `757a7a9dba4d926bffc3b86509a8297ab100699d` — `feat: enforce tenant context and transactional document numbering`
- `4288856912bf746704a5b5ea03e681774b8ff816` — `feat: add guarded identity migration and production recovery tooling`
- `8b648fdd443134aa740c5c0ca405061f72b42638` — `test: enforce isolated regression and numbering contracts`
- `acb9f71307eb2e7c347ac2ce3a1d03a92be94e4e` — `docs: document identity multitenancy and production recovery`

La guardia de pruebas exige `CAPATAZ_TEST_DATABASE_ISOLATED=true`, host PostgreSQL loopback y base `capataz_test_*`; la regresión completa pasó `105/105` en una base embebida limpia. Prisma format/validate/generate, typecheck, build, `test:database-safety`, `test:multitenancy-core`, `test:numbering-contract` y `git diff --check` pasan. Esta fase no consultó ni modificó Railway, producción ni `_prisma_migrations`.

## Intento controlado de `migrate deploy` — 14 de julio de 2026

Se verificaron rama `codex/identity-auth-multitenancy`, HEAD `404fb1424088ff9dd510d01326e9b5342d9b414c`, proyecto Railway `merry-quietude` (ID `ca7ec244-e961-42dc-8573-23835e6db5f5`), entorno `production` (ID `42c14ac1-e933-485b-9b44-01272af389e0`) y servicio PostgreSQL `Postgres` (ID `0f485ee7-0ab3-430d-9abd-791b8e3e2907`). El worktree ya estaba sucio antes y permanece sin staging; no se mostraron valores de variables ni se abrió `.env`.

La migración local autorizada `20260713193000_company_document_sequences` tiene SHA-256 `399dd61c5ac71a8714e1951eadff07b5244e75d4204f5cd418960336f65d7cbe` y solo contiene `CREATE TABLE`, clave primaria, dos índices y una FK `ON DELETE RESTRICT`; no contiene `DROP`, `DELETE`, `UPDATE` ni `TRUNCATE`. Los dos audits previos fueron idénticos (`ok=true`, hash de informe `03ac6b4f8b8de529425d811193e6985cf49226def53879eac3c2059a036cbd8b`) y el respaldo externo final permanece fuera de Git, con SHA-256 global `459b455e357e644ab3749ec2dbbb783704a048b4f9fc6980d846247c2bd76364`.

El único comando ejecutado fue exactamente `npx prisma migrate deploy` (14/07/2026 12:23:37Z–12:23:52Z). Prisma aplicó la migración objetivo y también reaplicó automáticamente `20260712210000_company_numbering_and_settings`, que estaba marcada como revertida. Esto creó una segunda fila histórica para esa migración (`rolled_back_at` en la primera fila y `finished_at`/`applied_steps_count=1` en la segunda) y modificó los índices globales de numeración; no se ejecutó SQL manual, `migrate resolve`, `db push`, reset, commit, push, merge ni despliegue de aplicación.

La auditoría post-deploy repetida fue estable (hash `e1da5a64f33cc1012507b7fe34f3bed5eef775082b23fe9594b6b91593c10d55`): migración objetivo finalizada, `pending=[]`, Company `cmrjrm83d0000vdzs0o5a27zt` enlazada a `empresa-demo`, una Company/una Empresa, cero `companyId=NULL`, cero duplicados, cero discrepancias relacionales, fingerprints `4a33f773`, `7a3b51a7` y `7be8432e` a cero, tarea `cmrhm95u80004vd84gufttv29` presente y tabla/objetos `CompanyDocumentSequence` creados. Tres contadores proactivos variaron durante la ventana (`ProactiveAuditEvent 69→70`, `ProactiveEvaluationRun 65→66`, `ProactiveRuleExecution 688→698`), sin pérdida en las tablas operativas controladas.

`prisma migrate status` devuelve “Database schema is up to date” (18 directorios locales; 19 filas históricas por la duplicación de la migración revertida). Este párrafo conserva el estado histórico previo a la corrección local; la sección siguiente registra la validación final `105/105`.

**Estado histórico previo a la corrección local: NO LISTO. La incidencia quedó resuelta exclusivamente en entorno aislado; no se autoriza ninguna escritura productiva adicional en esta fase.**

## Diagnóstico local de numeración — 14 de julio de 2026

Esta fase no consultó Railway, no usó `railway`, no leyó `DATABASE_URL` productiva y no modificó producción ni `_prisma_migrations`. Se protegió el worktree con un snapshot externo no versionado, diff binario, estado y hashes SHA-256 de `lib/numbering.ts`, `prisma/schema.prisma`, el test de multiempresa y ambas migraciones de numeración.

En dos bases PostgreSQL embebidas nuevas (`capataz_test_trace`, host `127.0.0.1`), el inventario previo fue idéntico: Empresa A y B tenían únicamente `P-2026-001` y `CompanyDocumentSequence` estaba vacío. Doce llamadas concurrentes para A produjeron exactamente `P-2026-002`…`P-2026-013`; B produjo `P-2026-002`; las secuencias terminaron en `nextValue=14` para A y `nextValue=3` para B. El índice 0 de `Promise.all` recibió números distintos entre ejecuciones porque el advisory lock decide el orden de adquisición, no el orden de creación de las promesas. `P-2026-004` era correcto; la aserción `concurrentA[0] === P-2026-002` era el defecto del test.

La corrección no cambia el algoritmo de numeración: se extrajo `reserveDocumentNumberInTransaction`, manteniendo una única transacción, `pg_advisory_xact_lock`, filtro por `companyId + type + scope`, reconciliación `max(documentos, nextValue)+1` e incremento único. Las creaciones del núcleo ERP, duplicados, conversiones, plantillas y recorridos Capataz reservan dentro de la transacción de creación; la página de gestión dejó de consumir números durante el render. No se creó ninguna migración.

Se añadió `scripts/validate-numbering-contract.mjs` y `test:numbering-contract` con 32 llamadas y casos de primera/segunda numeración A, primera B, factura independiente, series y ejercicios independientes, legacy sin secuencia, secuencia superior/inferior al máximo, 20 reservas concurrentes, aislamiento A/B, rollback sin avance y empresa inexistente sin secuencia. `test:multitenancy-core` ahora comprueba el rango continuo de 20 números y los contadores A/B.

Tres ejecuciones limpias de `test:multitenancy-core` pasaron (21.895 s, 17.898 s y 18.636 s). La regresión completa final aislada pasó `105/105` scripts en `372.357 s`, base `capataz_test_all` sobre loopback `127.0.0.1:55480`, con `CAPATAZ_TEST_DATABASE_ISOLATED=true` y sin heredar Railway. También pasan Prisma format/validate/generate, typecheck, build y `git diff --check`.

La duplicación histórica de `_prisma_migrations` queda documentada como comportamiento esperado de Prisma: al encontrar una migración `rolled_back`, `migrate deploy` registra una nueva ejecución exitosa; no se deben borrar ni la fila revertida ni la aplicada. La documentación histórica de producción y la limitación de módulos avanzados bloqueados se conserva sin nuevas escrituras productivas.

**Decisión de esta fase: LISTO PARA REVISAR LOS CAMBIOS Y PREPARAR COMMITS.**

## Dry-run actual de Company legacy y backfill — 13 de julio de 2026

Después de la limpieza QA exacta de 24 filas, se ejecutó una nueva auditoría de solo lectura contra el proyecto Railway de producción. El cierre transitivo volvió a converger en una iteración con `total=0`, `fingerprintExternalHits=[]`, cero ambigüedades y la tarea real `cmrhm95u80004vd84gufttv29` preservada. El informe de cierre de esta pasada tiene SHA-256 `a108c4565b3d9451839d4402616b24d5fd7de7db294a3d69cb3f22c2273f7c1c`.

El script [audit-legacy-company-backfill.mjs](../scripts/audit-legacy-company-backfill.mjs) solo permite modo `dry-run-read-only` en esta fase. Verifica el target Railway exacto, no carga `.env`, no imprime `DATABASE_URL` ni secretos y selecciona por `companyId IS NULL` en un conjunto de tablas controlado; no utiliza fechas como predicado. El informe completo sanitizado queda fuera de rutas versionadas.

### Inventario exacto

Se confirmaron `Empresa=1` con `id=empresa-demo`, `Company=0`, `Company.legacyEmpresaId=empresa-demo=0` y slug propuesto `rigo-asociados` sin colisión. El manifiesto contiene exactamente 228 filas; su SHA-256 de selectores `Tabla:id` es `63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c` y el inventario con `companyId`, `createdAt` y `updatedAt` tiene SHA-256 `786d59a475233571b786e4f441d419a6657b9c3ac2915478649a405654b0b7fa`.

| Tabla | Filas con `companyId=NULL` |
|---|---:|
| Client | 8 |
| Contact | 0 |
| Work | 16 |
| Budget | 15 |
| Invoice | 4 |
| Payment | 3 |
| Expense | 0 |
| Material | 0 |
| InternalNote | 0 |
| Reminder | 1 |
| EventoAgenda | 5 |
| Notification | 9 |
| FinancialAccount | 0 |
| RecurringExpense | 0 |
| ExpectedCashFlow | 0 |
| ChatConversation | 82 |
| BusinessSignalState | 21 |
| BusinessRecommendation | 18 |
| AutomationDefinition | 5 |
| AutomationRun | 4 |
| Task | 33 |
| FollowUp | 4 |
| **Total** | **228** |

`Payment=3` está expresamente dentro del manifiesto; no hay candidatos en `Document`, `CashMovement`, `TreasurySettings` ni `SecurityAuditEvent`. Las tablas protegidas (`User`, `CompanyMembership`, `Session`, tokens, documentos, caja y auditoría) mantienen sus conteos y no forman parte del backfill.

### Company propuesta y controles

La propuesta es una única fila derivada de `Empresa`, sin inventar datos: `legacyEmpresaId=empresa-demo`, `slug=rigo-asociados`, `timezone=Europe/Madrid`, `locale=es-ES`, `status=active` e `isDemo=false`. Se copiarían únicamente los campos legacy presentes (identidad, contacto, dirección, web, contacto personal, IBAN, color, IVA, moneda, validez, series y prefijos). `defaultConditions`, `legalText`, `logoUrl`, `sealUrl` y `defaultPaymentTerms` quedarían nulos por no tener fuente. No hay conflicto de slug ni de taxId.

Las numeraciones candidatas son `P-2026-001`…`P-2026-015` en `Budget` y `F-2026-001`…`F-2026-004` en `Invoice`; no hay duplicados ni numeraciones de obra. La auditoría relacional devuelve cero discrepancias de `companyId` y cero grupos duplicados. Los fingerprints `4a33f773`, `7a3b51a7` y `7be8432e` están a cero.

El dry-run terminó con `ok=true`, `execution.requested=false`, `performed=false`, `companyCreated=0` y `rowsUpdated=0`. No se creó backup lógico todavía porque la autorización exige hacerlo inmediatamente antes de la primera escritura. No se ejecutó `migrate resolve`, `migrate deploy`, commit, push, merge ni despliegue.

La lectura de `_prisma_migrations` sigue mostrando `20260712180000_company_ownership_nullable` finalizada (`applied_steps_count=1`) y `20260712210000_company_numbering_and_settings` pendiente (`finished_at=NULL`, `rolled_back_at=NULL`, `applied_steps_count=0`, con logs). El orden seguro no cambia: autorización literal, backup, Company + backfill, reconciliación, y solo después resolver/reintentar migraciones en una fase separada.

## Ejecución autorizada y reconciliación — 13 de julio de 2026

Se recibió la autorización literal para el manifiesto `63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c`. Se repitió el dry-run inmediatamente antes de escribir y devolvió de nuevo `228/228`, el mismo hash, cero bloqueos, cero fingerprints, cero discrepancias relacionales y la tarea real presente.

Se creó el backup lógico fuera de Git, con 465797 bytes y SHA-256 `1f303c5a3d114b768027fcd45aad39194135f4ecfa2d127b4f79db86e7f05066`. Contiene la propuesta de Company, los 228 selectores, filas completas, conteos previos y fingerprint de la tarea.

La transacción `Serializable` creó exactamente una Company: `companyId=cmrjrm83d0000vdzs0o5a27zt`, `slug=rigo-asociados`, `legacyEmpresaId=empresa-demo`, `status=active`. Actualizó exactamente 228 filas: Client 8, Work 16, Budget 15, Invoice 4, Payment 3, Reminder 1, EventoAgenda 5, Notification 9, ChatConversation 82, BusinessSignalState 21, BusinessRecommendation 18, AutomationDefinition 5, AutomationRun 4, Task 33 y FollowUp 4; el resto de tablas controladas quedó en cero actualizaciones.

La reconciliación confirmó `Company=1`, `Empresa=1`, `companyId=NULL` operacional `0`, conteos totales invariantes, cero duplicados empresariales, relaciones coherentes, fingerprints `4a33f773`, `7a3b51a7` y `7be8432e` a cero, y la tarea `cmrhm95u80004vd84gufttv29` preservada con el único cambio autorizado de ownership. La segunda ejecución fue no-op: `alreadyBackfilled=true`, `performed=false`, `updated=0`, sin duplicar Company ni alterar conteos.

El informe de la segunda pasada permanece fuera de Git. Un primer intento abortó antes del commit por una validación demasiado estricta del `companyId` de la tarea; Prisma revirtió la transacción completa, se corrigió la validación para permitir únicamente ese cambio de ownership y la ejecución posterior pasó todas las puertas.

No se ejecutaron `prisma migrate resolve`, `prisma migrate deploy`, commit, push, merge ni despliegue. La migración `20260712210000_company_numbering_and_settings` continúa pendiente y requiere una fase posterior separada.

## Resolución administrativa de la migración fallida — 14 de julio de 2026

Se verificaron exactamente el proyecto Railway `ca7ec244-e961-42dc-8573-23835e6db5f5`, entorno `production` `42c14ac1-e933-485b-9b44-01272af389e0` y servicio PostgreSQL `Postgres` `0f485ee7-0ab3-430d-9abd-791b8e3e2907`. La rama local siguió siendo `codex/identity-auth-multitenancy`, HEAD `404fb1424088ff9dd510d01326e9b5342d9b414c`; el worktree ya estaba sucio antes de la fase y no se hizo staging ni commit.

El snapshot sanitizado previo de `_prisma_migrations` se guardó fuera de Git, SHA-256 `fae56a7bd6a7d81b557ee75fbe2ed88201862b8622e0e81936688045ddaefdb5`. La migración fallida tenía `started_at=2026-07-12T15:12:05.210Z`, `finished_at=NULL`, `rolled_back_at=NULL`, `applied_steps_count=0`, logs presentes de 1357 caracteres, clase sanitizada `error-like` y hash de logs `c9b125130f86350cfeae0c635bbbcb7c6e1a041795e79e938b0f0ade00cc55f9`; no se imprimió su contenido.

Las puertas productivas previas pasaron: Company única `cmrjrm83d0000vdzs0o5a27zt`, `legacyEmpresaId=empresa-demo`, `Company` vinculada exactamente una vez, `Empresa=1`, cero filas operacionales con `companyId=NULL`, fingerprints QA `4a33f773`, `7a3b51a7` y `7be8432e` a cero y tarea `cmrhm95u80004vd84gufttv29` presente.

La única operación autorizada fue el comando exacto:

```text
npx prisma migrate resolve --rolled-back 20260712210000_company_numbering_and_settings
```

Prisma confirmó la migración marcada como revertida. La lectura posterior muestra `rolled_back_at=2026-07-14T11:58:38.984Z`, `finished_at=NULL`, `applied_steps_count=0` y logs sin cambios. `npx prisma migrate status` encontró 18 migraciones y dejó como única pendiente `20260713193000_company_document_sequences`; terminó con código no-cero únicamente por esa migración pendiente y no ejecutó ningún deploy.

La reconciliación posterior confirmó conteos funcionales invariantes, Company y backfill intactos, cero nulos operacionales, cero fingerprints y tarea preservada. Pasaron `npx prisma validate`, `npx prisma generate`, `npm run typecheck` y `git diff --check`; no se ejecutó build. No hubo `migrate deploy`, modificaciones funcionales, commit, push, merge ni despliegue.

## Auditoría transitiva de cierre — estado de esta sesión

Se preservó el estado local en un snapshot externo no versionado (manifiesto de la copia `756F8E2708E4607E63CA4B0BE4F3F0B22E0A8CA9346520184136BFB654DF66C7`), sin staging, commit, push, merge ni cambios de producción. La rama sigue `codex/identity-auth-multitenancy`, en `404fb1424088ff9dd510d01326e9b5342d9b414c`.

Se preparó [audit-production-fixture-closure.mjs](../scripts/audit-production-fixture-closure.mjs), un auditor de solo lectura que verifica el respaldo histórico de 252 filas, introspecciona todas las tablas públicas y sus relaciones, recorre IDs/fingerprints/idempotencias y JSON/texto hasta punto fijo, y clasifica referencias reales y ambigüedades preservando explícitamente `Task:cmrhm95u80004vd84gufttv29`. Genera manifiesto y hash de informe deterministas mediante `--output=...`, sin imprimir filas completas ni variables secretas.

La ejecución productiva doble sí se realizó después de recuperar el entorno local. Railway quedó verificado en proyecto `ca7ec244-e961-42dc-8573-23835e6db5f5`, entorno `42c14ac1-e933-485b-9b44-01272af389e0` y servicio `Postgres` `0f485ee7-0ab3-430d-9abd-791b8e3e2907`; solo se comprobó presencia de variables, sin mostrar valores. Ambas pasadas convergieron en 2 iteraciones y devolvieron exactamente 24 filas, cero ambigüedades, 240 nulos operacionales (12 candidatos y 228 legacy/otros), tarea real preservada y cero fingerprints externos.

Resultado estable: manifiesto SHA-256 `d254c661524e65620f29a07c0c4d6c03f7beaae3f1d3842048ffbde5b58dc4e3`; informe SHA-256 `b680259356ef9d33b20ef8783510a187b4cbebef0662ea25462e29c38fe90888`. Los informes sanitizados están fuera de Git.

El manifiesto estable contiene: `Budget=1`, `BusinessRecommendation=4`, `BusinessSignalState=4`, `Client=1`, `Invoice=1`, `ProactiveAuditEvent=12` y `Work=1`. La auditoría específica de `F-7be843e2` confirma que `Client:cmrhkz1jv0000vdd0tdyuykem` (`nombre=QA 7be843e2`, `tipo=particular`, `origen=test`) y `Work:cmrhkz1xc0002vdd01gjz7kni` (`titulo=Obra QA 7be843e2`, `tipoTrabajo=test`) son padres QA. Sus ocho relaciones directas son Budget, Invoice, dos señales, dos recomendaciones y dos eventos proactivos; no existen referencias no-QA, pagos, gastos, materiales, documentos/PDF, agenda, recordatorios, tareas, seguimientos ni chats fuera de ese grafo. Las dos auditorías específicas son idénticas (SHA-256 de archivo `BBB86BE60E09033095500901FF491AB7951B233F3FABDE1F7DDFA5A55EC1BA36`) y clasifican 8/8 relacionadas como `QA_CONFIRMADO`, 0 `REAL_CONFIRMADO`, 0 `AMBIGUO`.

## Limpieza autorizada y reconciliada

Se recibió la autorización literal para limpiar exclusivamente los 24 registros del manifiesto `d254c661524e65620f29a07c0c4d6c03f7beaae3f1d3842048ffbde5b58dc4e3`. El dry-run interno repitió dos auditorías consecutivas con el mismo total, conteos, hash, cero ambigüedades, cero referencias externas, cero fingerprints externos y tarea real preservada.

Se creó el backup lógico fuera de Git, con 24 filas y SHA-256 `504f11dc8f2bc89ca4852aae29efa1c9dfced90abe42d3a4dd59cef67ace14c4`.

La única ejecución de escritura fue transaccional `Serializable`, por IDs exactos y en orden hijo → padre: `ProactiveAuditEvent=12`, `BusinessRecommendation=4`, `BusinessSignalState=4`, `Invoice=1`, `Budget=1`, `Work=1`, `Client=1`. Resultado: `deleted=24`. La segunda ejecución fue no-op: `alreadyClean=true`, `performed=false`, `deleted=0`.

Reconciliación posterior: cierre transitivo `total=0`, cero ambiguos, cero referencias externas, cero fingerprints externos, 228 filas operacionales con `companyId=NULL` (todas legacy/otras), `Empresa=1`, `Company=0`, `User=0`, memberships=0, sesiones=0, tarea `cmrhm95u80004vd84gufttv29` presente. Los padres QA `Client` y `Work` ya no existen. No se ejecutó ninguna otra escritura productiva.

## Limpieza de cuatro residuos bloqueada por cuatro referencias entrantes

Se autorizó auditar, respaldar y eliminar exclusivamente dos `BusinessSignalState` y dos `BusinessRecommendation`. El dry-run específico revalidó los cuatro IDs y el manifiesto autorizado SHA-256 `6d5edee4d1d163c9d4f0fad09eb6a8966fd8b09c8c23d08e47dd4603b7f4569d`, pero abortó antes del respaldo y de configurar la aprobación al encontrar cuatro filas relacionadas adicionales:

| Tabla | ID | Evento | Referencia |
|---|---|---|---|
| ProactiveAuditEvent | `cmrjjtdio01c4ml0pg5aiqnvj` | `signal_created` | señal de datos del cliente fixture |
| ProactiveAuditEvent | `cmrjjtdio01c5ml0pbhpykyio` | `signal_created` | señal de vencimiento de factura fixture |
| ProactiveAuditEvent | `cmrjjtdsv01ctml0pyz3qqbat` | `recommendation_created` | recomendación de revisión de factura fixture |
| ProactiveAuditEvent | `cmrjjtdsv01cuml0pselcd8vh` | `recommendation_created` | recomendación de completar cliente fixture |

Los cuatro eventos tienen `origin=evaluation`, `runId=NULL` y contienen los fingerprints e IDs exactos de las mismas entidades eliminadas. Son trazabilidad derivada, no `SecurityAuditEvent`, pero constituyen referencias entrantes y “candidatos relacionados” según la puerta impuesta. El dry-run devolvió `EXTERNAL_REFERENCES_PRESENT` y no permitió continuar.

El inventario relacional residual completo asciende por tanto a 8 filas: 2 señales, 2 recomendaciones y 4 eventos proactivos. Su SHA-256 ordenado es `eeaaf3bc0b2f1b96d450913764aeda3ff634e8d0cf53cac6faa4b6cab29ab96e`. No se creó el respaldo específico porque la fase de auditoría no superó sus condiciones; no se eliminó ninguna fila y la variable temporal nunca se configuró.

La autorización de cuatro IDs no se amplió implícitamente. Hace falta decidir y autorizar expresamente si los cuatro eventos proactivos deben conservarse como auditoría histórica o incluirse en un nuevo manifiesto exacto antes de cualquier borrado.

## Creación de Company legacy bloqueada por residuos derivados

Se autorizó exclusivamente crear una `Company` desde `Empresa.id = empresa-demo`. El nuevo dry-run global confirmó de nuevo una `Empresa`, cero `Company`, 240 filas operacionales con `companyId IS NULL`, slug propuesto sin llegar a escritura y tarea excluida presente. Sin embargo, la búsqueda global encontró cuatro referencias a los fingerprints/IDs de fixtures fuera del inventario original:

| Tabla | ID | Referencia eliminada |
|---|---|---|
| BusinessSignalState | `cmrjjtdha01c0ml0pymwqg02u` | factura `cmrjjgwd50006vdj093l9wqpo`, cliente `cmrjjgvgb0000vdj0ld4qby02`, obra `cmrjjgvr90002vdj0xz2fq0sb` |
| BusinessSignalState | `cmrjjtdhm01c1ml0pqzw68bo7` | cliente `cmrjjgvgb0000vdj0ld4qby02` |
| BusinessRecommendation | `cmrjjtdqo01ceml0p2jq147u2` | factura, cliente y obra anteriores |
| BusinessRecommendation | `cmrjjtdr801chml0pov3igtwc` | cliente anterior |

Son señales/recomendaciones generadas a partir de entidades del fixture transaccional y conservan `companyId = NULL`. El inventario de 252 no incluía `BusinessSignalState` ni `BusinessRecommendation`, por lo que la comprobación anterior de fingerprints era demasiado estrecha. No se usa su fecha como selector; la atribución se basa en los IDs exactos de las entidades eliminadas y en sus fingerprints de señal/recomendación.

Consecuencias:

- la condición obligatoria de cero fingerprints no se cumple;
- al menos 4 de las 240 filas nulas no son legacy y no deben recibir el futuro `companyId`; los cuatro eventos adicionales no tienen `companyId` y no alteran ese conteo;
- el conjunto legacy máximo pasa a 236 hasta completar una nueva auditoría;
- no se creó `Company` y producción continúa con `Company=0`;
- no se modificó ni eliminó ninguna de estas cuatro filas porque la autorización solo permitía crear Company.

Decisión histórica de esa fase: **NO LISTO**. El tratamiento productivo de residuos no se reabrió en esta fase.

El dry-run de creación que quedó bloqueado había calculado, sin escribir:

- slug determinista `rigo-asociados`, sin colisiones;
- `legacyEmpresaId = empresa-demo`;
- `timezone = Europe/Madrid`, `locale = es-ES`, `status = active`;
- `isDemo = false`, porque existen 240 filas operacionales y el ID de origen no basta para clasificar datos reales como demo;
- cero conflictos de `taxId`;
- campos disponibles para copiar: identidad fiscal y de contacto existente, dirección, localidad, país, web, contacto, IBAN, color, IVA, moneda, series y prefijos;
- campos ausentes que quedarían nulos: `defaultConditions`, `legalText`, `logoUrl`, `sealUrl` y `defaultPaymentTerms`.

La variable temporal de aprobación de creación nunca se configuró y `execution.performed=false`, `created=0`.

## Backfill legacy autorizado pero bloqueado

Se recibió autorización para asignar las 240 filas con `companyId IS NULL` a la única `Company` legacy previamente supuesta. El dry-run fue endurecido para no crear ni actualizar `Company`, exigir target Railway exacto, conteos por tabla, transacción `Serializable`, relaciones coherentes, cero duplicados prospectivos y una aprobación separada para `--execute`.

El dry-run abortó antes de cualquier escritura con `LEGACY_COMPANY_COUNT_MISMATCH:0`. La auditoría adicional de solo lectura confirmó:

- una única fila legacy en `Empresa`, con ID `empresa-demo`;
- cero filas en `Company`;
- cero `Company` con `legacyEmpresaId`;
- por tanto, ningún `companyId` válido al que aplicar el backfill y ninguna coincidencia posible con `legacyEmpresaId`.

El recuento posterior sigue siendo exactamente 240 filas con `companyId IS NULL`, con la misma distribución por tabla documentada tras la limpieza. La tarea excluida permanece presente. Una auditoría global posterior encontró cuatro residuos derivados en señales/recomendaciones, por lo que la afirmación previa de cero fingerprints queda corregida. No se ejecutó `--execute`, no se creó ninguna empresa y no se modificó ninguna fila operacional.

Decisión: **BACKFILL BLOQUEADO**. Crear y enlazar una `Company` desde `Empresa` sería una operación de producción distinta y estaba expresamente fuera de esta autorización. Requiere una autorización independiente y un dry-run nuevo antes de retomar el backfill.

## Ejecución autorizada

El propietario autorizó literalmente la eliminación exclusiva de los 252 IDs del manifiesto auditado. Antes de escribir se repitió el dry-run y se confirmó total 252, SHA-256 `2e245d34ca11f4fc23ee665594ca4178bdc048edae496fa4e0973325ac5eb881`, conteos exactos, cero fingerprints externos, `companyId = NULL` y tarea excluida presente.

Se creó un respaldo lógico local fuera de Git con las 252 filas completas. La lectura posterior verificó 234672 bytes y SHA-256 `99430534df8d51dc28022f57adea4915ee7800cadd3eb18831eacaf151d8c9a7`; su contenido no se imprimió.

La única ejecución con `--execute` devolvió `requested=true`, `performed=true` y `deleted=252`. Cada tabla fue validada antes y después del `deleteMany` exacto dentro de una transacción `Serializable`.

La auditoría posterior devolvió:

- `total=0` y todos los conteos candidatos a cero;
- `alreadyClean=true`;
- `cleanupManifestMatches=true`;
- `companyValidationPassed=true`;
- `fingerprintExtrasCount=0`;
- `execution.requested=false`, `performed=false`, `deleted=0`;
- tarea `cmrhm95u80004vd84gufttv29` todavía presente e intacta.

El recuento operacional con `companyId IS NULL` descendió de 305 a **240**, exactamente las 65 filas de fixture previstas. No se ejecutó backfill, `migrate resolve` ni `migrate deploy`.

## Resultado

El inventario inicial de 244 filas era incompleto. La identificación por fingerprints y relaciones encuentra **252 filas inequívocamente atribuibles** a las dos ejecuciones de prueba, una diferencia de **+8**.

Las ocho filas omitidas en el primer conteo son: `Budget` (1), `Invoice` (1), `Client` (1), `Work` (1), `BusinessEvent` (1), `FollowUpOutcome` (1) y `TaskChecklistItem` (2).

| Tabla | Candidatas |
|---|---:|
| ChatActionLog | 102 |
| ChatMessage | 59 |
| ChatConversation | 30 |
| Task | 22 |
| AutomationAction | 4 |
| AutomationDefinition | 3 |
| AutomationRun | 4 |
| AutomationTrigger | 4 |
| AutomationVersion | 4 |
| AutomationCondition | 2 |
| AutomationStepRun | 2 |
| FollowUp | 2 |
| FollowUpAttempt | 2 |
| TaskChecklistItem | 2 |
| TaskDependency | 2 |
| Budget | 1 |
| BusinessEvent | 1 |
| Client | 1 |
| FollowUpOutcome | 1 |
| Invoice | 1 |
| TaskRecurrence | 1 |
| TaskStatusHistory | 1 |
| Work | 1 |
| **Total** | **252** |

Comprobados con resultado cero: `AutomationConfirmation`, `AutomationSchedule`, `CashMovement`, `Company`, `CompanyMembership`, `Document`, `EmailVerificationToken`, `PasswordResetToken`, `Payment`, `SecurityAuditEvent`, `Session`, `TaskAssignment`, `TaskComment`, `TaskEntityLink` y `User`.

## Criterio exacto de identificación

No se usa una ventana de fechas como selector. Las fechas se presentan únicamente como evidencia secundaria.

### Ejecución transaccional

- Sufijo capturado y confirmado en producción: `4a33f773`.
- Automatización raíz: nombre exacto `QA automation 4a33f773` y estructura de versión/trigger/action creada por el script.
- Idempotencias de ejecución: `qa:dry:4a33f773`, `qa:run:4a33f773` y `qa:retry:4a33f773`.
- Cliente raíz: nombre `QA 4a33f773`, teléfono `000000000`, dirección `QA`, tipo `particular` y origen `test`.
- Obra: `Obra QA 4a33f773` y tipo `test`.
- Presupuesto: numeración `Q-4a33f773` y título `Presupuesto QA`.
- Factura: numeración `F-4a33f773` y concepto `Factura QA`.
- Tareas/seguimientos: sufijo `4a33f773`, prefijos exactos `Task QA`, `Subtarea QA`, `FollowUp QA`, relaciones con los runs anteriores y descendencia directa.
- Evento: correlationId `4a33f773` y tipo producido por el test.

### Ejecución de contrato de chat

- Sufijo capturado en el runner: `7a3b51a7`.
- Idempotencias de mensajes y acciones: prefijo exacto `contract-7a3b51a7-`.
- Automatizaciones raíz capturadas: IDs `cmrjjjpid0053vdz0039mb3ug` y `cmrjjkb0v006rvdz0lv1i706s`; la segunda se llama `Publicada 7a3b51a7`.
- Tareas y seguimientos: sufijo exacto en los títulos, descendencia desde esas tareas y relaciones creadas por el contrato.
- Conversaciones: únicamente las que contienen mensajes con las idempotencias anteriores; después se incluyen sus mensajes y logs relacionados por `conversationId`/`messageId`.

La confianza es **muy alta** para las raíces y **alta** para los hijos obtenidos exclusivamente mediante FK o IDs de conversación/mensaje. La auditoría falla si no encuentra exactamente una automatización y un cliente para el fingerprint transaccional.

## IDs, timestamps y relaciones

El dry-run imprime el manifiesto completo de IDs por tabla. Sin `--summary`, también imprime por registro todos los campos disponibles entre `companyId`, `createdAt`, `updatedAt`, `fechaCreacion`, `recordedAt`, `attemptedAt`, IDs padre/hijo, numeraciones, idempotencias y correlationIds:

```powershell
railway run --service Postgres --environment production --no-local -- node scripts/cleanup-production-fixtures.mjs
```

El dry-run previo devolvió `execution.requested=false`, `execution.performed=false` y `execution.deleted=0`, y listó los 252 IDs exactos. El rango observado de los registros candidatos es compatible con la ejecución del runner, pero no forma parte del criterio de selección. Después de la limpieza, el mismo dry-run devuelve un inventario vacío y no-op.

El manifiesto ordenado como `Tabla:id`, separado por saltos de línea, tiene SHA-256 `2e245d34ca11f4fc23ee665594ca4178bdc048edae496fa4e0973325ac5eb881`. Dos dry-runs independientes devolvieron el mismo hash. El script exige ese hash además de los conteos por tabla; sustituir un ID por otro no puede superar la puerta aunque el total permanezca en 252.

Todos los registros candidatos que tienen columna `companyId` conservan `companyId = NULL`. No se encontró ningún `Company`, `User`, `CompanyMembership` o `Session` creado por estos fingerprints.

Se detectó una referencia a la tarea preexistente `cmrhm95u80004vd84gufttv29`, creada el 12 de julio y titulada `Contrato ee888a36 para mañana`. La ejecución la leyó y guardó su ID en el contexto/log del chat, pero no coincide con los fingerprints actuales. Está **expresamente excluida** del manifiesto y nunca debe eliminarse.

No se encontraron PDFs/documentos, pagos ni movimientos de caja relacionados con las raíces de fixture. Las auditorías asociadas son 102 `ChatActionLog` y un `BusinessEvent`; no existen `SecurityAuditEvent` candidatos.

## Dependencias y orden de eliminación propuesto

El script [cleanup-production-fixtures.mjs](../scripts/cleanup-production-fixtures.mjs) delega en [audit-production-fixtures.mjs](../scripts/audit-production-fixtures.mjs). Su modo por defecto es dry-run. El modo de escritura requiere simultáneamente `--execute`, el valor de aprobación exacto, coincidencia de todos los conteos, total 252, SHA-256 idéntico, cero fingerprints externos, la tarea excluida presente, objetivo Railway exacto, `companyId = NULL` en todas las raíces y una transacción `Serializable`.

Checksums SHA-256 del código auditado:

- `audit-production-fixtures.mjs`: `BF2E01BDF6E6A99CD08D6DEDAD39DFBF3EDDF244F90E29E2607128AD79028B68`.
- `cleanup-production-fixtures.mjs`: `CECE8C679A9EF6091DB015AA80D0C1623AD05FCC390B23E4717FF2BD20641D05`.
- `production-fixture-cleanup-guards.mjs`: `99AD1095E58898675203693E1477DE0E144DE5B07D1520F6B6BCCF116AEAC4B7`.

Orden hijo → padre preparado:

1. logs, mensajes y conversaciones de chat;
2. checklist, dependencias, historial y demás hijos de tareas;
3. intentos/resultados de seguimiento, seguimientos y tareas;
4. recurrencias;
5. confirmaciones/steps/runs de automatización;
6. schedule, conditions, triggers, actions, versions y definitions;
7. eventos de negocio;
8. movimientos, pagos y documentos relacionados (actualmente cero);
9. factura, presupuesto, obra y cliente;
10. auditorías de seguridad, sesiones, tokens, memberships y usuarios (actualmente cero).

Cada `deleteMany` futuro usaría exclusivamente `id IN (<manifiesto exacto>)`; el script comprueba el conteo antes y después de cada tabla y revierte toda la transacción ante cualquier diferencia. Una segunda ejecución completamente limpia devuelve `alreadyClean=true` y elimina cero filas; cualquier estado parcial aborta.

Las pruebas adversariales puras confirman que el guardia aborta ante 251 o 253 filas, hash distinto (incluye ID ausente, sustituido o añadido), fingerprint fuera del manifiesto, `companyId` no nulo, tarea excluida ausente, Railway project/environment/service incorrectos o frase de aprobación ausente. No se activó `--execute` para probar estos casos.

## Respaldo propuesto antes de una futura escritura

Antes de autorizar la fase de borrado deben existir dos mecanismos independientes: snapshot/backup verificable del volumen PostgreSQL en Railway y un `pg_dump` lógico en formato custom guardado fuera del volumen. El dump debe verificarse con `pg_restore --list`; no basta con que el comando termine. Esta fase no creó respaldos porque eso requiere una operación y una ubicación explícitamente autorizadas.

El comando de limpieza preparado, **no ejecutado**, sería el siguiente únicamente después de verificar respaldo y recibir la frase de autorización literal indicada por el propietario:

```powershell
$env:CAPATAZ_FIXTURE_CLEANUP_APPROVAL = 'DELETE-252-4a33f773-7a3b51a7'
railway run --service Postgres node scripts/cleanup-production-fixtures.mjs --execute
Remove-Item Env:CAPATAZ_FIXTURE_CLEANUP_APPROVAL
```

Ante cualquier error, Prisma revierte la transacción completa. El mecanismo de recuperación adicional sería restaurar el dump/snapshot previo; no se continuaría con backfill o migraciones.

## SQL propuesto, no ejecutado

El equivalente SQL de revisión es el siguiente patrón. Los `INSERT` del manifiesto deben contener exclusivamente los IDs emitidos por el dry-run y ser revisados antes de sustituir `ROLLBACK` por `COMMIT`:

```sql
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

CREATE TEMP TABLE fixture_manifest (
  table_name text NOT NULL,
  id text NOT NULL,
  PRIMARY KEY (table_name, id)
) ON COMMIT DROP;

-- INSERT INTO fixture_manifest(table_name, id) VALUES
--   ('ChatMessage', '<id exacto del dry-run>'), ...;

DO $$
BEGIN
  IF (SELECT count(*) FROM fixture_manifest) <> 252 THEN
    RAISE EXCEPTION 'fixture manifest total mismatch';
  END IF;
END $$;

-- Ejemplos del patrón exacto; repetir en el orden hijo → padre anterior.
DELETE FROM "ChatActionLog" WHERE id IN (SELECT id FROM fixture_manifest WHERE table_name = 'ChatActionLog');
DELETE FROM "ChatMessage" WHERE id IN (SELECT id FROM fixture_manifest WHERE table_name = 'ChatMessage');
DELETE FROM "ChatConversation" WHERE id IN (SELECT id FROM fixture_manifest WHERE table_name = 'ChatConversation');
-- ...resto de tablas, siempre por manifiesto exacto...

ROLLBACK;
```

No se ha ejecutado ninguna sentencia de este bloque SQL.

## Estado de migraciones relacionado

El recuento de 305 nulos y 240 filas legacy pertenece al estado histórico anterior a la limpieza de fixtures y queda supersedido por el dry-run actual. La lectura productiva actual confirma 228 filas controladas con `companyId IS NULL`, distribuidas en el manifiesto de esta fase y sin nulos en las tablas excluidas.

La migración `20260712180000_company_ownership_nullable` terminó correctamente. `20260712210000_company_numbering_and_settings` permanece sin finalizar, sin rollback y con cero pasos aplicados. Por tanto, el orden seguro recomendado es:

1. recibir la frase literal de autorización del manifiesto SHA-256 `63d5827d37cdb0f760b0f247e58d35b00e375292c065b12475dbf613ef81df5c`;
2. repetir el mismo dry-run y verificar el mismo hash;
3. crear el respaldo lógico fuera de rutas versionadas;
4. crear una única Company y actualizar exactamente las 228 filas en una transacción `Serializable`;
5. reconciliar cero nulos, conteos invariantes, relaciones, numeraciones, tarea real y segunda ejecución no-op;
6. resolver como rolled back únicamente la migración fallida y ejecutar `prisma migrate deploy` solo en una autorización posterior.

## Decisión final vigente

La migración objetivo terminó aplicada y la duplicación histórica de Prisma se conserva sin tocar. La causa de `P-2026-004` quedó demostrada como orden no determinista del test; la lógica productiva mantiene unicidad y secuencias por empresa. Decisión única: **LISTO PARA REVISAR LOS CAMBIOS Y PREPARAR COMMITS**. No se ha hecho commit, push, merge ni despliegue.
