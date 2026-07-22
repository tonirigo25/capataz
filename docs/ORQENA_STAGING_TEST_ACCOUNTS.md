# Cuentas sintéticas de staging

- `owner@staging.orqena.invalid`: OWNER y PLATFORM_OWNER.
- `multi@staging.orqena.invalid`: OWNER de dos empresas.
- `admin@staging.orqena.invalid`, `manager@staging.orqena.invalid`, `member@staging.orqena.invalid` y `viewer@staging.orqena.invalid`: roles correspondientes.

No se versionan contraseñas. La credencial temporal se guarda cifrada con Windows DPAPI fuera del repositorio y puede regenerarse ejecutando `npm run commercial:provision-staging` con sus guards remotos.
