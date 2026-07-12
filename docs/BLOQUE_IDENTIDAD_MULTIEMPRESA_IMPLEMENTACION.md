# Decisiones de implementación de identidad y multiempresa

## Arquitectura elegida

Capataz utilizará identidad propia separada de los modelos legacy `Empresa` y `UsuarioPerfil`. La identidad se compone de `User`, `Company`, `CompanyMembership`, `Session`, tokens de verificación y recuperación, y eventos de auditoría sanitizados. El contexto empresarial se deriva exclusivamente de una sesión opaca válida y una membresía activa.

## Autenticación y contraseñas

Se implementa autenticación local por correo y contraseña sin convertir `UsuarioPerfil` en credencial. Las contraseñas usan `scrypt` de Node.js con sal aleatoria, parámetros versionados y comparación de tiempo constante. Esta elección evita incorporar una dependencia nativa adicional y permite evolucionar los parámetros. El email se conserva para presentación, pero la unicidad se aplica sobre `emailNormalized` (`trim` y minúsculas).

## Modelo de sesión

La sesión usa un token opaco de 256 bits generado criptográficamente. El navegador solo recibe el token en una cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción y con expiración explícita. PostgreSQL conserva únicamente SHA-256 del token. Las sesiones son revocables y el cambio de contraseña revoca todas las sesiones existentes.

## Correo

La lógica de identidad depende de una interfaz de correo y no de un proveedor concreto. El adaptador inicial admite Resend mediante HTTPS (`RESEND_API_KEY`) y un modo local seguro sin envío. El modo local no devuelve ni registra tokens completos y está prohibido en producción. Las URLs dependen de `APP_BASE_URL` y el remitente de `EMAIL_FROM`.

## Migración y despliegue compatible

1. Migración aditiva de identidad, sin retirar tablas ni campos legacy.
2. Despliegue de registro, login, verificación, recuperación y sesiones.
3. Creación controlada de una única `Company` para datos legacy y del primer OWNER, sin contraseña hardcodeada.
4. Adición nullable de `companyId`, backfill por lotes con reconciliación y dual-write.
5. Cambio de lecturas/escrituras por lotes y pruebas negativas entre dos empresas.
6. Obligatoriedad de `companyId` y retirada legacy en una migración posterior independiente.

## Riesgos y rollback lógico

- Una migración parcial no habilita acceso multiempresa: las rutas privadas permanecen cerradas si falta sesión o membresía.
- La primera migración no destruye ni reescribe datos operacionales; su rollback lógico consiste en deshabilitar los nuevos puntos de entrada manteniendo las tablas para diagnóstico.
- No se activa el modo local de correo en producción.
- No se hace `companyId` obligatorio hasta reconciliar cero nulos y cero huérfanos.
- El despliegue parcial no se fusiona a `main` ni se aplica a producción.

## Integración con el siguiente bloque

Las nuevas operaciones deben propagar `companyId`, `actorUserId`, `correlationId`, `causationId`, timestamps y ownership. `SecurityAuditEvent` conserva metadatos sanitizados y nunca bodies, credenciales, tokens o stacks destinados al usuario.

## Parte 2: ownership y PostgreSQL aislado

### PostgreSQL utilizado

La validación usa PostgreSQL 18.4 embebido mediante la infraestructura existente de `embedded-postgres`. Cada ejecución crea un clúster y bases efímeras en el directorio temporal del usuario, con contraseña aleatoria, puertos QA locales y eliminación/parada al terminar. Ninguna prueba utiliza Railway ni la URL configurada de producción.

### Migración de ownership

`20260712180000_company_ownership_nullable` añade únicamente columnas nullable, índices y claves foráneas `RESTRICT`. No contiene `DROP`, `DELETE`, `TRUNCATE` ni cambios de datos. Las columnas seguirán nullable hasta completar el despliegue compatible, el backfill real y la reconciliación.

Ownership directo añadido a: `Client`, `Contact`, `Work`, `Budget`, `Invoice`, `Payment`, `Expense`, `Material`, `Document`, `InternalNote`, `Reminder`, `EventoAgenda`, `Notification`, `FinancialAccount`, `CashMovement`, `RecurringExpense`, `ExpectedCashFlow`, `ChatConversation`, `BusinessSignalState`, `BusinessRecommendation`, `AutomationDefinition`, `AutomationRun`, `Task` y `FollowUp`.

Ownership heredado: mensajes y acciones de chat heredan de conversación; líneas y fotos de obra heredan de obra; hijos de automatización heredan de definición/run; checklists, dependencias, comentarios, recurrencias e intentos heredan de `Task` o `FollowUp`. Estas rutas no se habilitarán para multiempresa hasta que la Parte 3 pruebe todas las travesías al padre.

Global legítimo: plantillas estáticas empotradas en el repositorio. No se ha clasificado ningún registro operacional como global.

### Backfill legacy

`db:backfill-company` selecciona la primera `Empresa` legacy por fecha, crea o reutiliza una única `Company` mediante `legacyEmpresaId`, copia solo campos existentes y asigna esa Company a filas sin propietario dentro de una transacción. Si existen datos sin una `Empresa` legacy, falla de forma segura. Repetirlo no crea otra Company ni modifica filas ya asignadas.

El propietario inicial se activa con `auth:activate-legacy-owner -- --email=... --name=...`. El comando crea una credencial aleatoria inutilizable, una membresía OWNER y un token de recuperación enviado por la abstracción de correo. No recibe ni guarda una contraseña administrativa.

### Evidencia aislada disponible

- 15 migraciones desde cero: correctas.
- Actualización incremental desde el esquema anterior: correcta.
- Conteos de fixtures legacy antes/después: idénticos.
- Nulos posteriores al backfill en las 24 tablas directas: cero.
- Registro transaccional y rollback: correctos.
- Email duplicado, hash de contraseña, sesiones, revocación, tokens y auditoría sanitizada: comprobados en PostgreSQL.
- Fixtures Empresa A/B: listados, IDs, mutación cruzada, relaciones, agregados y documentos comprobados mediante `companyCore`.

### Bloqueos antes de cerrar Parte 2

Las páginas, Server Actions y librerías del núcleo todavía contienen consultas Prisma directas sin `companyId`; el servicio central probado aún no está conectado a toda la superficie ERP. Por seguridad, Chat, búsquedas avanzadas, inteligencia, proactivo, automatizaciones, tareas, seguimientos y demo están temporalmente bloqueados por middleware. PDFs, CSV y numeración empresarial siguen pendientes. Los índices unique globales de presupuesto y factura no se han retirado porque esta migración tiene prohibido usar `DROP`; se necesita una decisión explícita para una migración posterior que sustituya esos índices sin pérdida de datos.
