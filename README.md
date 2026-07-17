# Capataz

PWA web móvil para autónomos y pequeñas pymes de construcción, reformas e instalaciones.

Capataz es un asistente IA de obra: ayuda a ordenar leads, presupuestos, obras, gastos, facturas, cobros, materiales pendientes y seguimientos. Esta versión usa datos demo, lógica local para ejecutar acciones controladas, PDFs profesionales en borrador y un motor OpenAI server-side con salida estructurada cuando `OPENAI_API_KEY` está configurada. No integra todavía WhatsApp, email ni Stripe reales.

## Compras, proveedores y subcontratas

El área de compras incorpora módulos separados para:

- proveedores, condiciones económicas, etiquetas, documentos, obras, historial y detección de duplicados;
- subcontratas, oficio, especialidad, seguro RC, caducidad documental, valoración y coste real;
- facturas recibidas, pagos parciales, vencimientos, estados y trazabilidad;
- bandeja documental con clasificación profesional y revisión humana;
- fiscalidad española (IVA, IRPF, NIF/CIF y facturas completas, simplificadas o rectificativas);
- aprendizaje de categoría, obra e IVA habitual, aislado por empresa.

Cada factura recibida crea un único gasto enlazado. Ese gasto alimenta la rentabilidad de la obra y la previsión de tesorería, mientras la factura recibida conserva pagos, saldo pendiente e historial. En esta versión una factura se imputa a una sola obra o se registra como gasto general; el modelo mantiene separada esa relación para permitir repartos futuros.

La descripción técnica y los flujos están en `docs/PROVEEDORES_SUBCONTRATAS_GASTOS.md`.

## Stack

- Next.js + TypeScript.
- Tailwind CSS.
- Prisma con PostgreSQL para despliegue en Railway.
- PWA con manifest, icono y service worker básico.
- Capacitor para empaquetado Android/iOS conectado al backend web.
- Datos demo incluidos con seed.

## Arranque

```bash
npm install
npm run db:deploy
npm run dev
```

Antes de arrancar, configura `DATABASE_URL` con una base PostgreSQL local o de Railway.

Abre la URL local que muestre Next en consola y pulsa **Entrar en demo**.

## Modo demo y modo pruebas

Configura el modo con `.env`:

```bash
NEXT_PUBLIC_APP_MODE="test"
```

Valores disponibles:

- `demo`: demo pública limitada. Mantiene límites de clientes, presupuestos, obras y recordatorios. Los PDFs incluyen marca de agua `Demo Capataz`.
- `test`: modo pruebas/admin ilimitado. Permite crear clientes, obras, presupuestos, facturas, recordatorios y PDFs sin bloqueos.
- `production`: reservado para límites según plan cuando se conecte suscripción real.

La entrega local deja `NEXT_PUBLIC_APP_MODE="test"` para que el propietario pueda probar sin límites. Para ver la demo comercial limitada, cambia el valor a `demo` y reinicia `npm run dev`.

## App móvil con Capacitor

La app móvil no es un export estático de Next. Capataz usa Prisma/PostgreSQL y rutas server-side, así que esta primera versión nativa carga la interfaz desde un backend web configurado con Capacitor.

Configuración creada:

- `capacitor.config.ts`
- `android/`
- `ios/`
- `mobile-web/index.html` como fallback local si no hay backend disponible
- `resources/icon.svg` y `resources/splash.svg` como assets temporales de marca

Valores principales:

- `appId`: `com.capataz.app`
- `appName`: `Capataz`
- `webDir`: `mobile-web`
- `server.url`: `CAPATAZ_MOBILE_SERVER_URL`, `NEXT_PUBLIC_WEB_BASE_URL` o, por defecto, `https://capataz.app`

Android emulador:

```bash
npm install
npm run db:push
npm run dev
npm run build
$env:CAPATAZ_MOBILE_SERVER_URL="http://10.0.2.2:3000"
npx cap sync android
npx cap open android
```

El emulador Android normalmente accede al ordenador host con `http://10.0.2.2:3000`, que es el valor por defecto de `capacitor.config.ts`.

Android físico por USB:

1. Arranca Capataz escuchando en red local si lo necesitas: `npm run dev -- --hostname 0.0.0.0 --port 3000`.
2. Obtén la IP local del ordenador, por ejemplo `192.168.1.50`.
3. Sincroniza apuntando a esa IP:

```powershell
$env:CAPATAZ_MOBILE_SERVER_URL="http://192.168.1.50:3000"
npx cap sync android
npx cap open android
```

iOS simulator:

```bash
npm install
npm run db:push
npm run dev
npm run build
```

En Mac, antes de sincronizar:

```bash
export CAPATAZ_MOBILE_SERVER_URL="https://staging.capataz.app"
npx cap sync ios
npx cap open ios
```

iPhone físico:

1. Usa la IP local del ordenador donde corre el backend.
2. En Mac:

```bash
export CAPATAZ_MOBILE_SERVER_URL="http://192.168.1.50:3000"
npx cap sync ios
npx cap open ios
```

Para iOS hace falta Mac con Xcode. Para instalar en iPhone real puede hacer falta cuenta Apple Developer o firma de desarrollo local.

Limitaciones de esta fase móvil:

- La app nativa necesita un backend Next accesible; Prisma/PostgreSQL se ejecutan en el servidor, no dentro del móvil.
- En Android/iOS se permite HTTP local para pruebas. En producción conviene usar HTTPS y backend remoto.
- Los PDFs se abren como respuesta del backend; según dispositivo pueden abrirse en visor externo o descargarse.
- Los iconos/splash son temporales. Los SVG fuente están preparados en `resources/`.
- No se publica en App Store ni Google Play.

## Publicar en App Store y Google Play

Capataz queda preparado para distribución de pruebas y publicación, pero no se publica automáticamente desde este repositorio.

Entornos recomendados:

- `development`: backend local, modo pruebas, `CAPATAZ_MOBILE_SERVER_URL=http://10.0.2.2:3000` en Android emulador.
- `staging`: backend público de pruebas, modo demo/revisión, `CAPATAZ_MOBILE_SERVER_URL=https://staging.capataz.app`.
- `production`: backend público real, `CAPATAZ_MOBILE_SERVER_URL=https://capataz.app`.

Variables:

```bash
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_MODE=production
NEXT_PUBLIC_WEB_BASE_URL=https://capataz.app
NEXT_PUBLIC_SUPPORT_EMAIL=soporte@capataz.app
CAPATAZ_MOBILE_SERVER_URL=https://capataz.app
```

Hay ejemplos en:

- `.env.example`
- `.env.staging.example`
- `.env.production.example`

Cuenta demo para revisión:

- No hay login real todavía. Los revisores pueden pulsar `Entrar en demo`.
- Si Apple/Google solicita credenciales: `reviewer@capataz.app` / `CapatazDemo2026!`.
- Texto de revisión: `Modo demo: los datos son ficticios y no se envía nada fuera de la app.`

Android release para Google Play:

1. Configura backend público, no localhost.
2. Sincroniza:

```powershell
$env:CAPATAZ_MOBILE_SERVER_URL="https://capataz.app"
npm run build
npx cap sync android
```

3. Configura firma release mediante variables seguras:

```powershell
$env:CAPATAZ_ANDROID_KEYSTORE_PATH="C:\ruta\capataz-release.jks"
$env:CAPATAZ_ANDROID_KEYSTORE_PASSWORD="..."
$env:CAPATAZ_ANDROID_KEY_ALIAS="capataz"
$env:CAPATAZ_ANDROID_KEY_PASSWORD="..."
```

4. Genera AAB:

```bash
npm run mobile:android:aab
```

Salida esperada:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

No guardar keystores ni passwords en el repositorio.

iOS release para App Store/TestFlight:

1. En Mac, configura backend público:

```bash
export CAPATAZ_MOBILE_SERVER_URL="https://capataz.app"
npm run build
npx cap sync ios
npx cap open ios
```

2. En Xcode:

- Seleccionar Team Apple Developer.
- Revisar Bundle Identifier `com.capataz.app`.
- Revisar versión `1.0.0` y build `1`.
- Product > Archive.
- Distribute App.
- Upload a App Store Connect.
- Activar TestFlight o enviar a revisión.

Páginas legales:

- `/privacidad`
- `/terminos`
- `/soporte`

Metadatos y checklists:

- `store-assets/store-listing.md`
- `store-assets/screenshots-checklist.md`
- `store-assets/publishing-checklist.md`
- `store-assets/data-safety-notes.md`

Permisos:

- Android sólo declara `INTERNET`.
- iOS no pide cámara, fotos ni notificaciones en esta fase.
- No se activan pagos in-app.

Limitaciones para revisión:

- La app de tiendas no debe apuntar a `localhost` ni `10.0.2.2`.
- Staging/production deben estar en HTTPS para revisión real.
- PDFs, presupuestos, facturas, recordatorios y chat dependen del backend web.
- Facturas siguen siendo documento interno/borrador hasta cerrar facturación legal definitiva.

## Scripts

```bash
npm run dev        # servidor local
npm run build      # build de producción
npm run start      # arranque tras build
npm run typecheck  # comprobación TypeScript
npm run db:deploy  # genera Prisma y aplica migraciones PostgreSQL
npm run db:push    # sincroniza schema con PostgreSQL y ejecuta seed
npm run db:seed    # recarga datos demo
npm run db:studio  # Prisma Studio
npm run mobile:sync:android  # sincroniza Android con Capacitor
npm run mobile:sync:ios      # sincroniza iOS con Capacitor
npm run mobile:open:android  # abre Android Studio
npm run mobile:open:ios      # abre Xcode
```

## Demo incluida

El seed crea:

- 5 clientes.
- 2 clientes extra para agenda: Pedro y Construcciones Ruiz.
- 3 obras.
- 4 presupuestos.
- 6 facturas.
- 2 pagos de ejemplo.
- 8 gastos.
- 6 materiales.
- 5 recordatorios.
- 8 eventos de agenda internos.

## Flujos implementados

- Acceso demo.
- Dashboard Hoy con visitas/avisos, clientes pendientes, presupuestos, facturas vencidas, pendiente de cobrar, materiales y tareas urgentes.
- Clientes/leads con estado, última interacción, presupuesto, obra y facturas pendientes.
- Detalle de cliente con seguimiento de presupuesto por WhatsApp preparado, mensaje visible y confirmación antes de programar.
- Gestión manual con formularios de `Añadir`, `Editar`, `Guardar` y `Cancelar`.
- Obras con estado, cliente, presupuesto aprobado, gasto real, margen estimado, materiales, facturas y notas.
- Presupuestos agrupados por estado.
- Presupuestos con detalle, partidas JSON editables, creación desde plantillas, duplicado, conversión a obra/factura y PDF.
- Gastos y materiales.
- Facturas y cobros con detalle de factura, revisión previa y confirmación antes de registrar pago parcial.
- PDFs de presupuesto y factura/borrador con datos de empresa, cliente, importes, condiciones, observaciones, logo/sello como referencia configurada y marca de agua en modo demo.
- Preparación de recordatorio de cobro sin envío automático.
- Recordatorios con confirmación/cancelación de programación.
- Chat de Capataz con OpenAI server-side, salida estructurada y acciones internas controladas.
- Agenda interna con vistas Hoy, Semana, Mes y Lista.
- Eventos manuales editables asociados a cliente, obra, presupuesto, factura o recordatorio.
- Recordatorios, vencimientos de factura, fechas de obra, materiales pendientes y presupuestos sin respuesta visibles en Agenda.
- Dashboard clicable con filtros reales por módulo.
- Buscador global por clientes, obras, facturas, presupuestos, agenda, materiales, gastos, recordatorios y configuración.
- Clientes y obras en formato compacto con desplegables.
- Sección renombrada a `Facturas y Cobros`, con categorías y tarjetas desplegables.
- Configuración de empresa con datos fiscales, logo, sello, color de marca, IVA y series.
- Respaldo local limitado para desarrollo cuando no hay `OPENAI_API_KEY`.
- Modal de límite freemium demo.

## Gestión manual

Capataz combina dos formas de trabajo:

- Modo IA: el usuario habla o escribe y Capataz propone acciones.
- Modo manual: el usuario entra en cada módulo y añade, edita o corrige datos directamente.

El profesional siempre mantiene el control final. Desde la app se puede crear y editar manualmente clientes, obras, presupuestos, facturas, pagos, gastos, materiales, recordatorios y eventos de agenda, incluyendo cambios de estado. Los formularios manuales están disponibles desde los botones `Añadir` y `Editar` de cada módulo.

## Agenda interna

Abre `/agenda` desde la pestaña inferior **Agenda**.

Vistas disponibles:

- `Hoy`: visitas, seguimientos, vencimientos, materiales y tareas internas del día.
- `Semana`: eventos agrupados por día.
- `Mes`: calendario mensual sencillo con puntos de eventos por día.
- `Lista`: próximos eventos ordenados por fecha.

Cómo probar:

1. Ejecuta `npm run db:push`.
2. Ejecuta `npm run dev`.
3. Abre `/agenda`.
4. Revisa la visita de Marta mañana a las 10:00, la llamada a Pedro, la compra de material de Juan y el vencimiento de Construcciones Ruiz.
5. Pulsa `Añadir` para crear un evento manual.
6. En un evento propio, usa `Reprogramar`, `Realizado` o `Cancelar`; cada acción pide confirmación antes de ejecutarse.

Crear una visita manual:

1. Ve a `/agenda`.
2. Pulsa `Añadir`.
3. Elige tipo `Visita`, cliente, fecha/hora y dirección.
4. Pulsa `Guardar`.

Crear una visita desde el asistente:

1. Ve a `/capataz`.
2. Escribe `Agenda visita con Marta mañana a las 10.`
3. Capataz muestra una tarjeta editable de evento tipo visita.
4. Revisa campos y pulsa `Guardar visita`.

Frases de agenda que reconoce el asistente de Capataz:

- `Agenda visita con Marta mañana a las 10.`
- `Recuérdame llamar a Pedro el viernes.`
- `Pon seguimiento a Juan por la factura el lunes.`
- `¿Qué tengo mañana?`
- `¿Qué visitas tengo esta semana?`
- `Cambia la visita de Marta al jueves a las 12.`
- `Marca la visita de Pedro como realizada.`

La Agenda conecta con:

- Clientes: próximas citas y creación de visita/llamada desde ficha.
- Obras: inicio, fin previsto, tareas y compras de material.
- Presupuestos: seguimientos por fecha de seguimiento.
- Facturas: vencimientos y seguimientos de cobro.
- Recordatorios: aparecen como eventos derivados.

No hay integración todavía con Google Calendar, Outlook, WhatsApp ni email. En una fase posterior habrá que añadir sincronización externa, gestión de permisos, resolución de conflictos, webhooks y confirmaciones antes de enviar avisos reales.

## Fase 4 UX/Productividad

Dashboard clicable:

- Abre `/hoy`.
- Pulsa tarjetas como `Eventos de hoy`, `Facturas vencidas`, `Pendiente cobrar`, `Presupuestos pendientes`, `Clientes sin responder`, `Material pendiente`, `Obras activas` o `Recordatorios`.
- Cada tarjeta lleva al módulo con filtro aplicado mediante query string.

Buscador global:

- Abre `/buscar`.
- Prueba `Marta`, `factura vencida`, `cemento cola`, `Juan 500`, `logo` o `datos fiscales`.
- También hay buscador arriba en el dashboard y acceso de lupa en la cabecera.

Agenda mejorada:

- `/agenda?vista=semana`: días compactos con resumen y desplegable.
- `/agenda?vista=mes`: calendario visual con leyenda de colores.
- `/agenda?vista=lista&tipo=cobros`: lista filtrada por tipo.

Clientes desplegables:

- Abre `/clientes`.
- Usa filtros por estado.
- Abre una tarjeta para ver datos completos, presupuestos, facturas, obras, agenda, recordatorios y acciones rápidas.

Obras desplegables:

- Abre `/obras`.
- Filtra por `En curso`, `Pendiente material`, `Pendiente remates`, `Pendiente cobro`, `Finalizada` o `Cerrada`.
- Despliega una obra para revisar margen, gastos, materiales, facturas, agenda y acciones rápidas.

Presupuestos:

- Abre `/presupuestos`.
- Usa categorías `Borradores`, `Revisión`, `Enviados`, `Sin respuesta`, `Aceptados`, `Rechazados`, `Caducados` y `Todos`.
- Pulsa `Añadir` para crear manualmente, o `Plantilla` para crear desde oficio.
- En el detalle puedes añadir/editar/eliminar partidas, duplicar, cambiar estado, preparar seguimiento, convertir a obra/factura, abrir vista previa PDF o descargar PDF.
- Los datos de empresa configurados en `/configuracion` se aplican automáticamente a los PDFs.

Facturas y Cobros:

- Abre `/dinero`.
- Usa categorías `Pendientes de emitir`, `Emitidas`, `Enviadas`, `Pendientes`, `Vencidas`, `Parciales`, `Pagadas`, `Reclamadas`, `Próximas` y `Todas`.
- Despliega una factura para ver pagos, registrar pago parcial, marcar pagada con confirmación, preparar recordatorio, editar, abrir cliente/obra, ver PDF o descargar PDF.
- La factura sigue siendo documento interno/borrador. Revisa con gestoría antes de usarla como factura legal.

Recordatorios corregidos:

- Abre `/recordatorios`.
- Los contadores muestran hoy, pendientes, programados, vencidos, enviados simulados, cancelados y realizados.
- Cada recordatorio es desplegable y mantiene confirmación antes de programar, cancelar o marcar realizado.

Configuración de empresa:

- Abre `/configuracion`.
- Edita datos fiscales, IBAN, logo URL, sello URL, color de marca, IVA y series.
- Logo y sello se previsualizan y sus rutas se incluyen en los PDFs generados.

Usar Capataz como app:

- En `/configuracion` está la guía para instalar como PWA en iPhone y Android.

IA real controlada:

- `lib/ai/capataz-ai.ts` llama a OpenAI desde servidor, valida JSON estructurado y devuelve intención, entidades, plan de acción, campos pendientes y confirmación.
- La UI mantiene tarjetas editables para acciones sensibles antes de guardar.
- El chat guarda mensajes en PostgreSQL antes de interpretar, usa `idempotencyKey` para evitar duplicados y registra tiempos internos por fase en `ChatActionLog`.
- No se ejecutan acciones sensibles sin confirmación explícita.

## Recorrido demo recomendado

1. Entra en modo demo.
2. Abre el dashboard `Hoy`.
3. Ve a `Clientes` y abre `Marta López`.
4. Revisa su presupuesto `P-2026-002`, enviado y pendiente de respuesta.
5. Pulsa `Preparar seguimiento`.
6. Revisa el mensaje redactado, canal WhatsApp y fecha de mañana a las 10:00.
7. Pulsa `Confirmar y programar` y confirma en el modal.
8. Abre `Recordatorios` y verifica que el seguimiento aparece como `Programado`.
9. Ve a `Dinero` y abre `F-2026-011`, factura parcialmente pagada.
10. Registra un nuevo pago parcial desde `Revisar y confirmar pago`.
11. Confirma el pago en el modal.
12. La app vuelve a `Hoy`; comprueba que `Pendiente de cobrar` se ha actualizado.

## Reglas de seguridad del producto

Capataz no envía WhatsApp, email, presupuestos, facturas ni reclamaciones sin confirmación explícita del usuario. En este MVP, los recordatorios externos se guardan como `pendiente_confirmacion`; confirmar sólo los deja programados dentro de la app demo.

## Próximos pasos

- Añadir autenticación real.
- Preparar storage externo para logos, sellos y uploads reales.
- Integrar WhatsApp Business y email transaccional.
- Integrar Google Calendar y Outlook con consentimiento explícito.
- Mejorar el motor PDF con plantillas visuales avanzadas y cumplimiento legal definitivo.
- Añadir Stripe y planes de suscripción.
- Añadir tests unitarios para estados de facturas y server actions.
