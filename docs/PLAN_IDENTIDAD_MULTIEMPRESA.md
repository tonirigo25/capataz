# Plan de identidad y aislamiento multiempresa

## Objetivo

Convertir Capataz en un SaaS con:

- registro real;
- inicio de sesión;
- cierre de sesión;
- verificación de correo;
- recuperación de contraseña;
- sesiones;
- empresas independientes;
- membresías;
- roles;
- aislamiento total de datos;
- demo separada.

## Principios

1. Ninguna entidad operacional puede consultarse sin contexto empresarial.
2. Nunca se confiará en `companyId` recibido desde el navegador.
3. La empresa se obtendrá de la sesión autenticada.
4. Todas las acciones del servidor validarán membresía.
5. Las consultas por ID deberán incluir propiedad empresarial.
6. Los cron procesarán cada empresa de manera aislada.
7. Los PDFs utilizarán la identidad de la empresa propietaria.
8. El chat solo podrá acceder al conocimiento de la empresa actual.
9. Los archivos tendrán rutas o claves separadas por empresa.
10. La demo utilizará una empresa sandbox independiente.

## Modelos previstos

### User

- id
- email normalizado
- passwordHash
- emailVerifiedAt
- status
- lastLoginAt
- failedLoginCount
- lockedUntil
- createdAt
- updatedAt

### Company

- id
- slug
- nombre comercial
- razón social
- datos fiscales
- timezone
- locale
- status
- demo
- createdAt
- updatedAt

### CompanyMembership

- userId
- companyId
- role
- status
- joinedAt
- invitedAt
- acceptedAt

### Session

- id
- userId
- tokenHash
- expiresAt
- revokedAt
- ipHash opcional
- userAgent reducido

### EmailVerificationToken

- userId
- tokenHash
- expiresAt
- usedAt

### PasswordResetToken

- userId
- tokenHash
- expiresAt
- usedAt
- requestedAt

### SecurityAuditEvent

- companyId nullable
- userId nullable
- type
- outcome
- requestId
- metadata sanitizada
- createdAt

## Fases de migración

### Fase A — Identidad

- Añadir modelos de usuario, empresa, membresía y sesión.
- Añadir registro y login.
- Añadir verificación.
- Añadir recuperación.
- Añadir middleware.

### Fase B — Empresa nullable

- Añadir `companyId` nullable a entidades operacionales.
- Crear la empresa propietaria de datos existentes.
- Backfill.
- Añadir índices.

### Fase C — Dual read/write

- Introducir contexto empresarial central.
- Modificar lecturas.
- Modificar escrituras.
- Modificar consultas agregadas.
- Modificar chat.
- Modificar cron.
- Modificar PDFs.

### Fase D — Aislamiento obligatorio

- Verificar cero filas huérfanas.
- Hacer `companyId` obligatorio.
- Añadir constraints únicos por empresa.
- Eliminar consultas globales inseguras.

### Fase E — Demo

- Crear empresa sandbox.
- Crear usuario demo restringido.
- Restauración periódica de datos.
- Bloqueo de acciones sensibles.
- Separación total de clientes reales.

## Tests obligatorios

- Empresa A no puede leer un cliente de B.
- Empresa A no puede actualizar un cliente de B.
- Empresa A no puede descargar PDF de B.
- Empresa A no puede consultar chat de B.
- Empresa A no puede adivinar IDs de B.
- Cron de A no procesa datos de B.
- Búsqueda global de A no devuelve B.
- Exportaciones de A no incluyen B.
- Numeraciones pueden repetirse entre empresas.
- Tokens son de uso único.
- Tokens caducados son rechazados.
- Cerrar sesión revoca la sesión.
- Cambio de contraseña revoca sesiones anteriores.
- Demo no accede a datos reales.

## No incluir en el mismo release

- Migración completa Float → Decimal.
- Eliminación general de cascadas.
- Nuevo diseñador visual.
- OCR.
- WhatsApp.
- Suscripciones.
- Portal del cliente.

Estas tareas deben tratarse en releases independientes.
