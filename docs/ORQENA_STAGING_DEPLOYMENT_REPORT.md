# Despliegue de staging independiente

- Proyecto: `orqena-staging` (`5a501cb4-639e-4dd3-a1fb-08ae1c839ebb`)
- Entorno: `staging` (`8c1eb538-d7a4-4963-bb7d-5567ecf93ac2`)
- URL: `https://orqena-web-staging.up.railway.app`
- Aplicación: `orqena-web` (`99a739da-4212-4c56-a407-dc198553c505`)
- PostgreSQL: `44a39d4f-5bbe-4ebd-91c2-57b7f767aeda`
- Cron desactivado: `a58a07b4-a295-46d0-865a-65a880823dbf`
- Volúmenes: documentos `c2033d13-0fa1-4c96-96a0-f7499db688c0`; PostgreSQL `ab483991-24c6-48b9-b1a0-cab35c39c5ab`.

`DATABASE_URL` usa `${{Postgres.DATABASE_URL}}`. Se configuraron, sin documentar secretos: `APP_ENV`, `APP_MODE`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_MODE`, `NEXT_PUBLIC_WEB_BASE_URL`, `APP_BASE_URL`, `CAPATAZ_MOBILE_SERVER_URL`, `DOCUMENT_STORAGE_ROOT`, `EMAIL_PROVIDER`, `HOSTNAME`, `PROACTIVE_CRON_SECRET` y `CRON_SECRET`. Billing y correo son locales; OpenAI es opcional y está desactivado.

La prueba de no interferencia conservó invariables en production los deployments `135dcb92…` y `bb681f97…`, ambos `main/a5d384f`.
