# Bloque 2 - Integracion fases 1, 2 y 3

Fecha de auditoria: 2026-07-11.

## 1. Estado inicial de ramas

- `origin/main`: `5c946dc` - Fix chat client name resolution.
- `origin/codex/backoffice-foundations`: `5c852b6` - Crea fundamentos visuales del backoffice premium.
- `origin/codex/dashboard-hoy-premium`: `15da69e` - Crea dashboard Hoy ejecutivo con datos reales.
- `origin/codex/crm-clientes-360`: `9b99df0` - Cierra CRM de clientes 360 y prepara despliegue.

El worktree principal estaba en `codex/crm-clientes-360` y contenia cambios locales ajenos sin stage en chat/PDF. Esos cambios se preservaron y la integracion se hizo en un worktree limpio.

## 2. Relacion real entre ramas

Las ramas estaban correctamente apiladas y sin commits duplicados:

- `origin/main...origin/codex/backoffice-foundations`: `0 1`.
- `origin/codex/backoffice-foundations...origin/codex/dashboard-hoy-premium`: `0 1`.
- `origin/codex/dashboard-hoy-premium...origin/codex/crm-clientes-360`: `0 1`.

`git cherry -v origin/main origin/codex/crm-clientes-360` mostro los tres commits como cambios nuevos unicos.

## 3. Estrategia de integracion

Worktree usado: `C:\Users\Toniet\Documents\Capataz-release`.

La integracion se hizo con fast-forward desde `main` hasta `origin/codex/crm-clientes-360`, porque la rama superior ya contenia Foundations y Dashboard. Esto evita merges duplicados y conserva el historial lineal.

No hubo conflictos de merge.

## 4. Ajuste de release detectado

La rama Dashboard habia agregado scripts en `package.json` para:

- `npm run test:chat-query`
- `npm run test:document-pdf`

pero la pila remota no incluia los archivos ejecutados por esos scripts. Para no dejar `main` con scripts rotos, se incorporo el arreglo minimo:

- `lib/capataz-chat-query.ts`
- `scripts/validate-chat-query.mjs`
- `scripts/validate-document-pdf.mjs`
- ajuste de `lib/document-pdf.ts` para validar PDFs profesionales sin textos internos.

No se incorporo el cambio local grande de `app/(app)/capataz/actions.ts` ni otros cambios ajenos de chat/voz.

## 5. Archivos integrados

La integracion de las tres fases incorpora cambios en:

- Backoffice shell y UI base: `app/globals.css`, `components/app-chrome.tsx`, `components/ui-primitives.tsx`, `tailwind.config.ts` y componentes compartidos.
- Dashboard Hoy: `app/(app)/hoy/page.tsx`, `lib/dashboard-hoy.ts`, `components/dashboard-create-menu.tsx`, `scripts/validate-dashboard-hoy.mjs`.
- CRM Clientes 360: `/clientes`, ficha `/clientes/[id]`, acciones, calculos CRM, status, gestion, migracion Prisma y `scripts/validate-crm-clientes.mjs`.
- Release/test fix: clasificador de consultas de chat, validadores faltantes y PDF profesional.

## 6. Migraciones incluidas

Migraciones presentes y ordenadas:

- `20260621000000_init`
- `20260621001000_document_templates`
- `20260703000000_chat_performance`
- `20260703002000_chat_conversations`
- `20260704010000_chat_conversation_state`
- `20260711143000_client_crm_360_fields`

La migracion CRM es no destructiva: agrega campos nullable/default e indices a `Client`.

## 7. Validacion ejecutada

Instalacion:

- `npm install`: OK. Reporto 2 vulnerabilidades moderadas de dependencias.

Prisma:

- `npx prisma validate`: OK con `DATABASE_URL` ficticia segura en el worktree limpio, porque no se copio `.env`.
- `npx prisma generate`: OK.
- `npx prisma migrate status`: OK en el checkout principal con la configuracion local existente; la base estaba al dia.
- `npm run db:deploy`: OK tras parar el `next dev` local que bloqueaba el binario de Prisma en Windows; no habia migraciones pendientes.

Tests:

- `npm run test:dashboard-hoy`: OK.
- `npm run test:crm-clientes`: OK.
- `npm run test:chat-parser`: OK.
- `npm run test:chat-engine`: OK.
- `npm run test:chat-query`: OK.
- `npm run test:chat-conversations`: OK.
- `npm run test:document-pdf`: OK.
- `npm run test:ai`: OK en fixtures; validacion live omitida al no estar activada.

Calidad/build:

- `npm run typecheck`: OK.
- `npm run build`: OK.
- No existe script `lint` en `package.json`.

## 8. `/api/status`

El endpoint devuelve 503 si no se cumplen todas las condiciones:

- Base de datos OK.
- Sin variables publicas obligatorias faltantes: `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_MODE`, `NEXT_PUBLIC_WEB_BASE_URL`.
- En produccion, sin variables servidor obligatorias faltantes para AI.

En local incompleto, el 503 es esperado si faltan variables publicas. No es un fallo del CRM. En Railway deben existir las variables publicas anteriores y, si el entorno es produccion, la clave servidor de AI correspondiente. `CAPATAZ_MOBILE_SERVER_URL` es recomendada si no se usa `NEXT_PUBLIC_WEB_BASE_URL`.

## 9. Railway y produccion

`railway.json` esta configurado para:

- Build: `npm run build`.
- Predeploy: `npm run db:deploy`.
- Start: `npm run start`.
- Healthcheck: `/api/status`.

Railway CLI no esta instalada y Codex no tiene acceso al dashboard de Railway en esta sesion. GitHub si expuso un status de Railway para el commit de `main`; el status paso a `success`, por lo que Railway detecto el push y marco el deploy como correcto desde GitHub.

Por tanto:

- Se pudo confirmar estado remoto `success` a traves del status de GitHub/Railway.
- No se puede comprobar desde aqui el log remoto de `preDeployCommand`.
- No se puede confirmar desde aqui que Railway haya ejecutado `npm run db:deploy` en remoto.

La URL publica documentada en el repo es `https://capataz.app`. La comprobacion HTTP desde Codex no valido produccion:

- DNS resuelve el dominio.
- HTTPS falla con certificado revocado.
- Con verificacion TLS desactivada, Cloudflare devuelve 403 para `/api/status`, `/hoy`, `/clientes` y `/capataz`.

Por tanto, produccion no queda validada.

Comprobacion manual pendiente en Railway:

1. Confirmar que el servicio despliega desde `main`.
2. Confirmar que el commit final de `main` fue detectado.
3. Revisar logs de build.
4. Revisar logs de preDeploy y confirmar `npm run db:deploy`.
5. Confirmar estado `SUCCESS`/`DEPLOYED`.
6. Abrir `/api/status` y verificar HTTP 200.
7. Validar `/hoy`, `/clientes`, una ficha 360, `/capataz` y rutas PDF.

## 10. Pendientes reales

- Validar deploy y produccion en Railway.
- Contactos reales: no existe tabla `Contact`.
- Documentos reales: no existe entidad `Document`.
- Notas reales: no existe entidad `ClientNote`.
- Multiempresa/ownership: no existe aislamiento por tenant/empresa en entidades operativas.
- Prompt 4 de obras debe partir de estos pendientes, especialmente ownership y modelo real de obra/documentos.

## 11. Decision para Prompt 4

NO LISTO PARA PROMPT 4.

Motivo: `main` puede quedar integrado y validado localmente, pero Railway y produccion real no estan comprobados desde Codex. No debe iniciarse Prompt 4 hasta confirmar deploy remoto, `db:deploy`, `/api/status` en 200 y navegacion basica de produccion.
