# CAPATAZ — BLOQUE CRÍTICO DE IDENTIDAD, AUTENTICACIÓN Y AISLAMIENTO MULTIEMPRESA

## Contexto obligatorio

Trabaja en el repositorio:

C:\Users\Toniet\Documents\Capataz

Antes de modificar nada:

1. Lee `docs/PLAN_IDENTIDAD_MULTIEMPRESA.md`.
2. Audita el estado real de Git.
3. Parte de `origin/main`, no de una rama antigua.
4. Conserva todos los cambios funcionales ya integrados.
5. No abras, imprimas ni expongas `.env`, secretos, tokens o credenciales.
6. No uses `reset`, `force push`, migraciones destructivas ni borrados masivos.
7. No despliegues una entrega parcial.
8. No declares el bloque terminado si no has verificado aislamiento real entre dos empresas.

## Evidencia de auditoría disponible

La auditoría previa ha detectado:

- 55 modelos Prisma.
- 38 enums.
- 13 migraciones.
- 35 campos monetarios Float.
- 0 campos Decimal.
- 21 relaciones Cascade.
- 0 referencias `empresaId`.
- 4 referencias aisladas `companyId`.
- 594 operaciones Prisma detectadas.
- 225 escrituras inicialmente clasificadas como críticas.
- 159 lecturas de riesgo alto.
- 209 consultas generales sin contexto empresarial.
- Solo 1 coincidencia con posible filtro empresarial.
- 38 páginas.
- 35 páginas sin protección detectada.
- 10 rutas API.
- 6 APIs sin protección detectada.
- 86 Server Actions detectadas.
- 65 Server Actions mutantes sin autenticación detectada.
- 59 coincidencias relacionadas con PDFs o exportaciones.
- 63 coincidencias relacionadas con cron o procesos internos.
- 168 casos de aislamiento definidos.
- 117 referencias a `Empresa` o `UsuarioPerfil`.
- 20 supuestos explícitos de empresa única.
- 16 de esos 20 son prioridad P0.

Archivos especialmente sensibles:

- `app/(app)/capataz/actions.ts`
- `app/(app)/capataz/page.tsx`
- `app/(app)/presupuestos/actions.ts`
- `app/(app)/presupuestos/[id]/page.tsx`
- `app/(app)/presupuestos/[id]/pdf/route.ts`
- `app/(app)/dinero/[id]/page.tsx`
- `app/(app)/dinero/[id]/pdf/route.ts`
- `app/(app)/configuracion/page.tsx`
- `app/(app)/gestion/page.tsx`
- `app/(app)/hoy/page.tsx`
- `lib/business-intelligence.ts`
- `lib/numbering.ts`

## Objetivo del bloque

Convertir Capataz de aplicación monousuario/demo a una arquitectura SaaS segura con:

- registro mediante correo y contraseña;
- inicio y cierre de sesión;
- verificación automática de correo;
- recuperación de contraseña;
- sesiones seguras;
- empresas independientes;
- membresías y roles;
- aislamiento transversal de datos;
- tenant demo separado;
- protección de páginas, APIs, Server Actions, PDFs, exportaciones y cron;
- mensajes de error seguros para usuario;
- auditoría de seguridad sanitizada.

## Criterio no negociable

Una empresa nunca puede:

- listar datos de otra;
- consultar un registro ajeno mediante ID;
- actualizar o archivar un registro ajeno;
- descargar un PDF ajeno;
- exportar datos ajenos;
- consultar mediante Capataz datos ajenos;
- activar una automatización sobre datos ajenos;
- recibir recomendaciones o alertas de otra empresa;
- manipular un formulario para inyectar otro `companyId`;
- conseguir información sobre la existencia de registros ajenos.

El `companyId` nunca se aceptará como fuente de confianza desde el navegador.

Debe derivarse siempre de:

1. la sesión autenticada;
2. una membresía empresarial activa;
3. el contexto server-side.

---

# PARTE 1 — RAMA, AUDITORÍA Y PLAN REAL

Crea una rama nueva basada en `origin/main`, por ejemplo:

`codex/identity-auth-multitenancy`

Antes de implementar:

- confirma el commit real de `main`;
- revisa `schema.prisma`;
- revisa las 13 migraciones existentes;
- identifica los campos actuales de `Empresa` y `UsuarioPerfil`;
- identifica todos los usos de `findFirst()` usados para resolver empresa o usuario;
- identifica el sistema demo basado en `localStorage`;
- identifica páginas, APIs y Server Actions sin protección;
- identifica numeraciones globales;
- identifica rutas PDF y exportaciones;
- identifica cron y procesos internos.

Documenta las decisiones antes de migrar.

---

# PARTE 2 — MODELO DE IDENTIDAD

Añade de forma aditiva modelos equivalentes a los siguientes. Ajusta nombres al estilo real del repositorio, pero conserva el contrato funcional.

## User

Campos mínimos:

- `id`
- `email`
- `emailNormalized`
- `passwordHash`
- `displayName`
- `status`
- `emailVerifiedAt`
- `failedLoginCount`
- `lockedUntil`
- `lastLoginAt`
- `passwordChangedAt`
- `createdAt`
- `updatedAt`

Reglas:

- email normalizado con trim y lowercase;
- índice unique sobre el valor normalizado;
- no guardar contraseña en claro;
- hash resistente y con parámetros apropiados;
- comparación segura;
- bloqueo temporal tras intentos repetidos;
- no revelar si un email existe.

## Company

Campos mínimos:

- `id`
- `slug`
- `nombreComercial`
- `razonSocial`
- `taxId`
- `email`
- `telefono`
- `direccion`
- `codigoPostal`
- `ciudad`
- `provincia`
- `pais`
- `timezone`
- `locale`
- `status`
- `isDemo`
- `createdAt`
- `updatedAt`
- `archivedAt`

Debe coexistir temporalmente con `Empresa`.

No elimines `Empresa` en esta fase.

## CompanyMembership

Campos mínimos:

- `id`
- `userId`
- `companyId`
- `role`
- `status`
- `invitedAt`
- `acceptedAt`
- `joinedAt`
- `createdAt`
- `updatedAt`

Roles iniciales:

- OWNER
- ADMIN
- MANAGER
- MEMBER
- VIEWER

Añade unique compuesto:

`userId + companyId`

## Session

Campos mínimos:

- `id`
- `userId`
- `tokenHash`
- `expiresAt`
- `lastSeenAt`
- `revokedAt`
- `createdAt`
- metadatos reducidos y sanitizados cuando sean necesarios.

Nunca guardes el token de sesión en claro.

## EmailVerificationToken

- token hash;
- expiración;
- uso único;
- fecha de uso;
- invalidación de tokens anteriores cuando proceda.

## PasswordResetToken

- token hash;
- expiración corta;
- uso único;
- fecha de uso;
- invalidación de tokens anteriores;
- revocación de sesiones después del cambio de contraseña.

## SecurityAuditEvent

Registrar como mínimo:

- intento de login;
- login correcto;
- login fallido;
- bloqueo;
- logout;
- solicitud de recuperación;
- contraseña restablecida;
- email verificado;
- sesión revocada;
- cambio de membresía;
- intento de acceso cruzado.

No guardar:

- contraseñas;
- tokens;
- cookies;
- secretos;
- bodies completos;
- stack traces visibles para el usuario.

---

# PARTE 3 — AUTENTICACIÓN

Implementa páginas profesionales:

- `/login`
- `/registro`
- `/verificar-email`
- `/recuperar-contrasena`
- `/restablecer-contrasena`

## Registro

Solicitar como mínimo:

- nombre personal;
- email;
- contraseña;
- confirmación;
- nombre de empresa;
- aceptación de términos.

Al registrar:

1. normalizar email;
2. validar fortaleza de contraseña;
3. crear User;
4. crear Company;
5. crear CompanyMembership OWNER;
6. crear token de verificación;
7. enviar email;
8. no iniciar automáticamente una sesión privilegiada sin decidir explícitamente la política;
9. evitar duplicados e información de enumeración.

La creación de User, Company y Membership debe ser transaccional.

## Login

- correo y contraseña;
- respuesta genérica ante credenciales inválidas;
- control de intentos;
- bloqueo temporal;
- cookie `HttpOnly`;
- `Secure` en producción;
- `SameSite` apropiado;
- expiración real;
- regeneración de sesión;
- actualización de `lastLoginAt`.

## Logout

- revocar la sesión en base de datos;
- limpiar cookie;
- redirigir a login.

## Recuperación de contraseña

La respuesta debe ser siempre equivalente a:

“Si existe una cuenta con ese correo, recibirás las instrucciones.”

Nunca confirmar que un email está registrado.

## Restablecimiento

- comprobar hash del token;
- comprobar caducidad;
- comprobar que no se ha usado;
- cambiar hash de contraseña;
- marcar token usado;
- revocar sesiones anteriores;
- crear evento de auditoría;
- impedir reutilización.

## Verificación de correo

- token de un solo uso;
- caducidad;
- reenvío con rate limit;
- respuesta segura;
- no filtrar datos internos.

---

# PARTE 4 — INFRAESTRUCTURA DE CORREO

Crea una abstracción de correo desacoplada del proveedor.

Debe permitir:

- verificación de correo;
- recuperación de contraseña;
- confirmación de cambio sensible;
- futuras invitaciones a empresa.

No acoples la lógica de negocio directamente a un proveedor.

Define variables mediante nombres, sin exponer valores:

- `APP_BASE_URL`
- `AUTH_SESSION_SECRET` si la arquitectura elegida lo necesita
- `EMAIL_FROM`
- variable o variables del proveedor de correo
- duración de sesión
- duración de tokens
- límites de intentos

Actualiza `.env.example`, nunca `.env`.

En desarrollo, permite un modo seguro que no envíe correos reales y muestre únicamente información sanitizada en servidor.

En producción, nunca escribas tokens completos en logs.

---

# PARTE 5 — CONTEXTO SERVER-SIDE

Crea helpers centrales equivalentes a:

- `requireAuthenticatedUser()`
- `getOptionalSession()`
- `requireCompanyContext()`
- `requireCompanyMembership()`
- `requireCompanyRole()`
- `requireCompanyEntity()`

El contexto debe devolver al menos:

- `userId`
- `companyId`
- `membershipId`
- `role`
- `isDemo`

Ninguna Server Action debe confiar en:

- `companyId` de FormData;
- `userId` de FormData;
- parámetros ocultos;
- localStorage;
- query string empresarial;
- cookies manipulables sin validación server-side.

## Respuesta ante acceso cruzado

Para IDs de otra empresa:

- preferir 404 o respuesta neutra;
- no confirmar que el registro existe;
- crear auditoría interna;
- no mostrar IDs, `companyId` ni detalles técnicos.

---

# PARTE 6 — MIGRACIÓN MULTIEMPRESA NO DESTRUCTIVA

No intentes cambiar las 594 consultas en una única edición ciega.

Hazlo en despliegues compatibles.

## Fase A

Crear:

- User
- Company
- CompanyMembership
- Session
- EmailVerificationToken
- PasswordResetToken
- SecurityAuditEvent

Sin eliminar modelos existentes.

## Fase B

Crear una Company propietaria de los datos legacy.

No inventar varias empresas.

Copiar datos disponibles desde `Empresa`.

Mantener trazabilidad del origen legacy.

Crear el primer OWNER mediante un flujo controlado y documentado. No hardcodear una contraseña real.

## Fase C

Añadir `companyId` nullable e indexado a las entidades operacionales.

Incluye, según el esquema real:

- Client
- Contact
- Work
- Budget
- Invoice
- Payment
- Expense
- Material
- Document
- InternalNote
- Reminder
- EventoAgenda
- Notification
- FinancialAccount
- CashMovement
- RecurringExpense
- ExpectedCashFlow
- ChatConversation
- BusinessSignalState
- BusinessRecommendation
- AutomationDefinition
- AutomationRun
- Task
- FollowUp
- entidades directas adicionales detectadas durante la auditoría.

Para entidades hijas, decide explícitamente si necesitan `companyId` directo o si se hereda con integridad suficiente. Prioriza seguridad y consultas auditables.

## Fase D

Backfill por lotes.

Antes y después:

- contar filas por tabla;
- verificar que no desaparece ninguna;
- verificar cero duplicados nuevos;
- verificar integridad de relaciones;
- verificar tiempo y locks;
- guardar informe de reconciliación.

## Fase E

Activar dual-write:

- toda nueva escritura añade `companyId`;
- cero filas nuevas sin empresa;
- preservar compatibilidad con la versión anterior durante el despliegue.

## Fase F

Cambiar lecturas a contexto empresarial.

Solo cuando:

- el backfill esté completo;
- exista sesión;
- exista membership;
- los tests negativos funcionen.

## Fase G

Convertir `companyId` en obligatorio en una migración posterior, no en la primera.

No retirar todavía:

- `Empresa`;
- `UsuarioPerfil`;
- campos legacy;
- relaciones legacy.

---

# PARTE 7 — AISLAMIENTO POR LOTES

## Lote 1 — identidad y configuración

Eliminar el uso de:

- `Empresa.findFirst()`
- `UsuarioPerfil.findFirst()`

para resolver empresa o usuario activo.

Configuración debe trabajar con la Company de sesión.

El perfil personal debe provenir del User autenticado.

Los datos fiscales deben provenir de la Company autenticada.

## Lote 2 — núcleo ERP

Aislar:

- clientes;
- contactos;
- obras;
- presupuestos;
- facturas;
- pagos;
- gastos;
- materiales;
- tesorería;
- gestión;
- agenda;
- recordatorios;
- documentos.

Toda operación por ID debe comprobar:

`id + companyId`

No basta con comprobar el ID y después mirar la empresa.

## Lote 3 — Capataz Chat y búsqueda

El Chat solo puede consultar:

- datos de su Company;
- conversaciones de su Company;
- tareas de su Company;
- documentos de su Company;
- métricas de su Company;
- alertas y recomendaciones de su Company.

Aislar:

- consultas agregadas;
- comparaciones;
- búsqueda semántica o textual;
- `lastQuery`;
- contexto conversacional;
- acciones;
- creación de entidades;
- historial;
- tarjetas y enlaces.

Las respuestas deben guardar referencias internas a fuentes empresariales seguras.

## Lote 4 — automatizaciones y sistema proactivo

Aislar:

- automatizaciones;
- versiones;
- ejecuciones;
- pasos;
- tareas;
- subtareas;
- dependencias;
- seguimientos;
- intentos;
- alertas;
- señales;
- recomendaciones;
- auditoría proactiva;
- cron.

Cada ejecución debe incluir `companyId`.

Locks, idempotencia, fingerprints y cooldown deben incorporar empresa.

Una ejecución de A nunca debe deduplicar, bloquear o modificar una ejecución de B.

## Lote 5 — PDFs, exportaciones y archivos

Presupuesto, factura, CSV y documento deben comprobar:

- sesión;
- membership;
- companyId;
- propiedad de la entidad;
- propiedad del documento.

Empresa A nunca puede descargar un PDF de B manipulando la URL.

La identidad visual y fiscal del PDF debe proceder de la Company propietaria.

## Lote 6 — numeraciones

Cambiar numeraciones globales por numeraciones empresariales.

Añadir constraints equivalentes a:

- `companyId + numeroPresupuesto`
- `companyId + numeroFactura`

Dos empresas pueden tener `P-2026-001` o `F-2026-001` simultáneamente.

La generación debe ser segura ante concurrencia.

---

# PARTE 8 — PROTECCIÓN DE RUTAS

Actualmente existen 38 páginas y 10 APIs.

Mantener públicas únicamente las rutas expresamente públicas:

- landing;
- login;
- registro;
- verificación;
- recuperación;
- restablecimiento;
- términos;
- privacidad;
- healthcheck sanitizado;
- endpoints de autenticación estrictamente necesarios.

Todo el grupo `(app)` debe exigir sesión y membership.

No confíes únicamente en middleware.

Cada página, API y Server Action sensible debe comprobar autorización server-side.

## APIs internas

`/api/internal/*`:

- deben seguir usando secretos server-side cuando corresponda;
- no deben depender de sesión humana;
- comparación segura;
- método restringido;
- body controlado;
- respuesta sanitizada;
- iteración por Company;
- cero secretos en respuestas.

---

# PARTE 9 — TENANT DEMO

Eliminar la falsa seguridad basada exclusivamente en:

`localStorage.setItem("capataz-demo", "true")`

Crear:

- Company marcada `isDemo`;
- usuario demo real o sesión demo real;
- membresía limitada;
- datos totalmente separados;
- bloqueo de acciones sensibles;
- reinicio o restauración controlada;
- cero acceso a empresas reales.

La demo guiada debe operar dentro de ese tenant.

Nunca mezclar datos demo y producción en consultas globales.

---

# PARTE 10 — INFORMACIÓN TÉCNICA VISIBLE

Audita y elimina de la interfaz de usuario referencias como:

- DATABASE_URL;
- OPENAI_API_KEY;
- Prisma;
- PostgreSQL;
- Railway;
- migración pendiente;
- API interna;
- backend;
- nombres de variables;
- stack traces;
- modo staging;
- arquitectura preparada;
- healthcheck técnico;
- rutas internas.

Crear una capa de errores:

## Error visible

Debe explicar:

- qué no se completó;
- si los datos se conservaron;
- qué puede hacer el usuario;
- identificador de soporte cuando proceda.

## Log interno

Puede contener:

- código técnico;
- requestId;
- módulo;
- stack;
- causa;
- metadatos sanitizados.

Nunca mostrar el log interno al usuario.

Revisar especialmente:

- Chat;
- transcripción;
- configuración;
- PDFs;
- endpoints;
- acciones de creación;
- errores de Prisma.

---

# PARTE 11 — TESTS OBLIGATORIOS

Crear al menos dos empresas:

- Empresa A
- Empresa B

Crear usuarios y memberships separados.

Para cada entidad sensible comprobar:

1. A lista únicamente datos de A.
2. B lista únicamente datos de B.
3. A puede leer un registro de A.
4. A no puede leer un registro de B.
5. A no puede actualizar un registro de B.
6. A no puede archivar un registro de B.
7. A no puede eliminar un registro de B.
8. A no puede exportar datos de B.
9. A no puede descargar PDF de B.
10. La respuesta no revela que el registro de B existe.

Aplicar a:

- Client
- Contact
- Work
- Budget
- Invoice
- Payment
- Expense
- Material
- Document
- InternalNote
- Reminder
- EventoAgenda
- FinancialAccount
- CashMovement
- ChatConversation
- BusinessSignalState
- BusinessRecommendation
- AutomationDefinition
- AutomationRun
- Task
- FollowUp

También probar:

- login correcto;
- login incorrecto;
- bloqueo temporal;
- logout;
- cookie revocada;
- sesión expirada;
- email duplicado;
- token de verificación usado;
- token de verificación caducado;
- token de reset usado;
- token de reset caducado;
- solicitud de reset anti-enumeración;
- cambio de contraseña revoca sesiones;
- role insuficiente;
- membership archivada;
- company archivada;
- demo contra datos reales;
- cron A contra B;
- numeraciones repetibles entre empresas;
- concurrencia en numeración;
- Chat no mezcla agregados;
- búsqueda no devuelve otra empresa;
- PDF no muestra identidad fiscal ajena.

La batería debe incluir pruebas negativas, no solo happy paths.

---

# PARTE 12 — VALIDACIONES TÉCNICAS

Ejecutar:

- instalación reproducible;
- `npx prisma validate`;
- `npx prisma generate`;
- auditoría manual de la migración;
- migración en PostgreSQL aislado;
- conteos antes y después;
- reconciliación;
- tests nuevos;
- regresión existente;
- typecheck;
- build;
- `git diff --check`;
- responsive;
- accesibilidad básica;
- consola sin errores;
- cero secretos versionados.

No ejecutar una migración en producción hasta que la base aislada y los tests pasen.

---

# PARTE 13 — INTEGRACIÓN Y DESPLIEGUE

Solo cuando todo esté correcto:

1. Crear commits claros.
2. Subir la rama.
3. Integrar en `main` sin force push.
4. Confirmar que Railway despliega el commit exacto.
5. Aplicar migraciones mediante el flujo configurado.
6. Verificar estado de Prisma.
7. Verificar producción usando la URL Railway funcional.
8. Probar registro.
9. Probar verificación.
10. Probar login/logout.
11. Probar recuperación.
12. Probar dos empresas.
13. Probar páginas privadas.
14. Probar APIs privadas.
15. Probar Server Actions.
16. Probar Chat.
17. Probar PDFs.
18. Probar exportaciones.
19. Probar cron.
20. Verificar consola.
21. Verificar que no se muestran datos técnicos.

No crear datos QA permanentes. Archivar o eliminar de forma controlada únicamente los datos de prueba creados por este release.

---

# NO INCLUIR EN ESTE RELEASE

No mezclar aquí:

- migración general Float a Decimal;
- eliminación general de Cascade;
- rediseño visual completo;
- OCR;
- WhatsApp;
- portal del cliente;
- Stripe;
- cambio global de tipografía;
- diseñador visual de workflows.

Esos bloques deben hacerse después de estabilizar identidad y multiempresa.

---

# ENTREGABLE FINAL OBLIGATORIO

El informe final debe incluir:

- rama;
- commits;
- migraciones;
- modelos añadidos;
- modelos con companyId;
- backfill ejecutado;
- conteos antes/después;
- filas huérfanas;
- sesiones;
- cookies;
- proveedor de correo;
- rutas públicas;
- rutas privadas;
- APIs protegidas;
- Server Actions protegidas;
- PDFs protegidos;
- exportaciones protegidas;
- cron por empresa;
- numeraciones por empresa;
- demo aislada;
- mensajes técnicos eliminados;
- tests de aislamiento;
- regresión;
- typecheck;
- build;
- estado Git;
- estado Railway;
- validación productiva;
- limitaciones reales pendientes.

La decisión final solo puede ser una:

- `LISTO PARA EL SIGUIENTE BLOQUE`
- `NO LISTO`, indicando exactamente cada bloqueo.

No declarar listo basándose únicamente en build, rutas 200 o tests unitarios. Debe existir evidencia de aislamiento real entre dos empresas.
