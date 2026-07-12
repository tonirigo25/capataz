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
