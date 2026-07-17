# Fundamentos de producción: rutas, PWA, móvil e identidad heredada

## Estado y alcance

Este documento describe la arquitectura vigente tras la estabilización de julio de 2026. No certifica un despliegue actual ni cumplimiento fiscal/legal. No contiene secretos ni credenciales.

## Autenticación y rutas

Las páginas públicas son la landing, autenticación, recuperación/verificación, legales y soporte. Las páginas bajo `app/(app)` requieren `requireCompanyContext()`: la cookie solo permite evitar una redirección temprana en middleware; el token opaco, usuario activo, verificación, membresía y empresa se validan en PostgreSQL.

Los módulos `/capataz`, `/buscar`, `/alertas`, `/recomendaciones`, `/inteligencia`, `/automatizaciones`, `/tareas`, `/seguimientos` y `/demo-guiada` tienen páginas reales y enlaces internos. El bloqueo temporal que los reescribía se retiró; continúan siendo privados y con contexto empresarial. Los endpoints internos conservan su autenticación propia por secreto y los endpoints de estado son públicos y sanitizados.

Un usuario sin sesión va a `/login` con retorno relativo seguro. Una sesión inválida o un usuario sin membresía activa se resuelve de nuevo en el layout server-side y no recibe datos privados. No existe todavía un onboarding separado para usuarios sin empresa.

## PWA

El service worker no cachea HTML autenticado, navegaciones, APIs ni documentos privados. Las navegaciones son network-only y, sin red, muestran `offline.html`, que no contiene datos empresariales. Solo se cachean assets same-origin estáticos y seguros; respuestas `private`, `no-store`, redirigidas, opacas, con error o con `Set-Cookie` se excluyen. La activación elimina únicamente caches antiguas con prefijo propio `capataz-public-`.

No se promete operación offline de negocio. Tras cerrar sesión no hay páginas empresariales en Cache Storage que otro usuario pueda reutilizar.

## Capacitor

`CAPATAZ_MOBILE_MODE` admite:

- `development`: exige localhost o red privada; puede habilitar HTTP local explícito, nunca contenido mixto;
- `staging`: exige URL HTTPS pública;
- `release`: valor por defecto, exige HTTPS y rechaza localhost, IP privada, credenciales y host de staging.

Ejemplo Android local:

```powershell
$env:CAPATAZ_MOBILE_MODE='development'
$env:CAPATAZ_MOBILE_SERVER_URL='http://10.0.2.2:3000'
npm run mobile:sync:android
```

Ejemplo release:

```powershell
$env:CAPATAZ_MOBILE_MODE='release'
$env:CAPATAZ_MOBILE_SERVER_URL='https://capataz.app'
npm run build
npm run mobile:sync
```

iOS no incluye `NSAllowsArbitraryLoads`. Una necesidad local debe resolverse mediante HTTPS de desarrollo o una configuración Debug limitada y no versionada como release.

## Entornos y secretos

- Local/test: PostgreSQL local o aislado; el runner exige loopback, nombre `capataz_test_*` y `CAPATAZ_TEST_DATABASE_ISOLATED=true`.
- Staging/producción: variables privadas solo en backend; ninguna clave usa `NEXT_PUBLIC_`.
- `OPENAI_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL` y secretos de cron nunca se escriben en documentación, cliente o logs.
- El modo demo no sustituye autenticación y debe usar una empresa sandbox.

## Modelos heredados

Los modelos actuales de identidad son `User`, `Company`, `CompanyMembership` y `Session`. `UsuarioPerfil` y `Empresa` se conservan como compatibilidad histórica mientras configuración, PDFs, chat y algunos validadores todavía consumen proyecciones o fallbacks legacy.

Riesgo: retirar las tablas sin reconciliar usos podría perder perfil, identidad fiscal o numeración histórica. Esta fase no modifica Prisma, no hace backfill y no crea migración. No deben añadirse dependencias nuevas a los modelos heredados.

Fase futura de retirada:

1. inventariar lecturas/escrituras productivas restantes;
2. convertirlas a servicios basados en `User`/`Company` de sesión;
3. reconciliar conteos y campos fiscales en una copia aislada;
4. desplegar dual-read con métricas sanitizadas;
5. probar PDFs, configuración, chat y numeración por empresa;
6. retirar modelos solo en una migración posterior, reversible y autorizada.

Criterio de retirada: cero lecturas/escrituras runtime a `UsuarioPerfil`/`Empresa`, cero datos sin reconciliar y regresión multiempresa/PDF/configuración completa.

## Integraciones y límites

La verificación y recuperación pueden usar Resend cuando se configura de forma segura. No existen envíos comerciales de email/WhatsApp, sincronización Google/Outlook, Stripe ni suscripciones reales. El lector OpenAI es opcional y el modo manual permanece disponible. PDFs fiscales requieren revisión especializada antes de uso comercial definitivo.

## Siguiente fase

Tras validar y publicar estos fundamentos, la fase recomendada es **Sistema visual y componentes fundamentales**. Debe conservar rutas y comportamiento, definir tokens y accesibilidad, y no comenzar por un rediseño superficial.
