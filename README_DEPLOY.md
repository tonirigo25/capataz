# Deploy de Capataz en Railway

Esta guía prepara Capataz para desplegarse en Railway sin depender del ordenador local.

## Stack de producción

- Next.js con build standalone.
- Prisma.
- PostgreSQL gestionado por Railway.
- Deploy automático desde GitHub.

## Scripts necesarios

```bash
npm run typecheck
npm run build
npm run start
npm run db:deploy
npm run db:seed
```

`db:deploy` ejecuta:

```bash
prisma generate && prisma migrate deploy
```

Railway lo ejecuta automaticamente como pre-deploy command mediante `railway.json`, antes de arrancar la nueva version.

## Variables de entorno

Configura estas variables en el servicio web de Railway:

```bash
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
NEXT_PUBLIC_APP_MODE=test
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_WEB_BASE_URL=
NEXT_PUBLIC_SUPPORT_EMAIL=soporte@capataz.app
```

Para staging/revisión, `NEXT_PUBLIC_APP_MODE=test` deja Capataz sin límites demo durante pruebas. Para demo pública limitada se puede usar `demo`. Para producción comercial futura, `production`.

`DATABASE_URL` debe venir como variable referenciada desde el servicio PostgreSQL de Railway.

`OPENAI_API_KEY` es privada y debe configurarse solo en el backend de Railway, nunca con prefijo `NEXT_PUBLIC`. Activa el motor de chat con salida JSON estructurada y herramientas internas controladas. `OPENAI_MODEL` es opcional; si no se configura, Capataz usa `gpt-5.5` por defecto.

No existe autenticacion real en esta version, por lo que el codigo no usa `NEXTAUTH_SECRET`, `AUTH_SECRET` ni variables de proveedores OAuth.

Variables opcionales:

```bash
CAPATAZ_MOBILE_SERVER_URL=
CAPATAZ_CHAT_DEBUG=false
```

`CAPATAZ_MOBILE_SERVER_URL` solo es necesaria si el binario Capacitor debe apuntar a una URL distinta de `NEXT_PUBLIC_WEB_BASE_URL`. `CAPATAZ_CHAT_DEBUG` solo activa logs de diagnostico del chat.

## Pasos de despliegue

1. Sube el repositorio a GitHub.
2. En Railway, crea un proyecto nuevo.
3. Selecciona Deploy from GitHub repo y elige el repositorio de Capataz.
4. Añade una base de datos PostgreSQL en el mismo proyecto.
5. En el servicio web de Capataz, añade la variable `DATABASE_URL` como referencia al PostgreSQL.
6. Añade `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXT_PUBLIC_APP_MODE`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_WEB_BASE_URL` y `NEXT_PUBLIC_SUPPORT_EMAIL`.
7. Comprueba que Railway detecta `railway.json`. Ese archivo fija:

```text
Build: npm run build
Pre-deploy: npm run db:deploy
Start: npm run start
Healthcheck: /api/status
```

8. Despliega el servicio.
9. Genera una URL pública en Networking.
10. Actualiza `NEXT_PUBLIC_WEB_BASE_URL` con la URL pública y redeploy.
11. Si quieres cargar datos demo iniciales, ejecuta una vez:

```bash
npm run db:seed
```

No ejecutes seed sobre una base real con datos de clientes, porque borra y recrea datos demo.

## PostgreSQL y Prisma

`prisma/schema.prisma` usa:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Las migraciones están en `prisma/migrations/`. Railway debe ejecutar `prisma migrate deploy`, no `prisma db push`, en despliegues de producción.

El archivo local ignorado `prisma/dev.db` no se incluye en Git ni se usa en Railway. La aplicacion desplegada solo admite una `DATABASE_URL` PostgreSQL.

## Start command

El proyecto genera build standalone de Next.js. El start script es:

```bash
npm run start
```

Internamente ejecuta:

```bash
node scripts/start-standalone.mjs
```

El wrapper define `HOSTNAME=0.0.0.0` en Linux/Railway y `127.0.0.1` en Windows local. Usa `PORT` si Railway lo proporciona. Si no existe `PORT`, usa `8080`.

El wrapper conserva una segunda comprobacion de migraciones al arrancar. La migracion principal se ejecuta en pre-deploy; si falla, Railway no publica la version nueva.

## Assets estáticos en standalone

Railway arranca el servidor standalone desde `.next/standalone/server.js`. Para que Tailwind, JavaScript, iconos e imágenes carguen correctamente, el build ejecuta:

```bash
node scripts/prepare-standalone.mjs
```

Ese script copia:

```text
.next/static -> .next/standalone/.next/static
public       -> .next/standalone/public
```

Si esos directorios no existen dentro de `.next/standalone`, la app puede arrancar pero verse como HTML básico sin CSS.

## Subidas, logo, sello y PDFs

Ahora mismo logo y sello se guardan como URL o ruta configurada en `Datos de empresa`. Los PDFs se generan al vuelo desde el backend y se devuelven como respuesta HTTP.

En Railway, el almacenamiento local del contenedor no debe considerarse persistente. Si más adelante se suben archivos reales, hay que migrarlos a storage externo, por ejemplo Railway Volumes, S3/R2/Supabase Storage o equivalente.

## Limitaciones pendientes

- No hay autenticación real todavía.
- No hay WhatsApp/email reales.
- No hay Stripe real.
- Seed es destructivo y sólo debe usarse para demo/staging.
- Los archivos de logo/sello necesitan storage externo antes de producción real con uploads.
- Si se usa la app móvil publicada, `CAPATAZ_MOBILE_SERVER_URL` debe apuntar a la URL pública HTTPS.

## Diagnostico del despliegue

La ruta publica `/api/status` devuelve `app`, `database`, `environment` y `timestamp`. Devuelve HTTP 200 solo cuando PostgreSQL responde y las variables publicas obligatorias estan configuradas; en caso contrario devuelve HTTP 503 sin exponer credenciales.

Tambien devuelve `ai.openai` como `ok` o `missing` y el modelo configurado, sin mostrar la clave. Si `NEXT_PUBLIC_APP_ENV=production`, `OPENAI_API_KEY` pasa a ser obligatoria para el healthcheck.
