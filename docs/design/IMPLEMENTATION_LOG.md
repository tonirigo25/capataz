# Orqena Field OS - registro de implementación

## Programa

- Programa: `PROMPT_MAESTRO_IMPLEMENTACION_DISENO_ORQENA.md`
- Rama: `feat/orqena-field-os-design-system`
- SHA base verde: `21412ff4a500394ea97939fd604374612b44dcda`
- Frontera: diseño, arquitectura de información, responsive, accesibilidad y experiencia.
- Exclusiones: reglas de negocio, fiscalidad, numeración, importes, autorización, scopes, aislamiento tenant, providers, migraciones previas, idempotencia, outbox, auditoría, confirmación humana, estados documentales, pagos, saldos e IA.
- Producción: no autorizada para el rediseño hasta superar gates visuales, funcionales y de regresión.

## Recepción de fuentes

| Fuente | SHA-256 | Resultado |
| --- | --- | --- |
| `Paquete_maestro_diseno_Orqena_2026-07-26.zip` | `B319FD7B90089D4D5C3533A720123E45A2C623334ACA63CFA29B2863445AE479` | Recibido; manifiesto interno completo verificado |
| `PROMPT_MAESTRO_IMPLEMENTACION_DISENO_ORQENA.md` | `703DC1BAA1295E59501B8A17916CCA3F2AAC3C968397B0EA4E4883E2541ABA2A` | Coincide con la copia del paquete |
| `Blueprint_diseno_web_y_producto_Orqena_2026-07-26.pdf` | `D5E8C81F3187D3ED54AB3A6D0F98BF1761C520BD6037BDB2649A81694D7FAF45` | 15 páginas leídas y renderizadas |
| `Atlas_visual_desktop_mobile_Orqena_2026-07-26.pdf` | `9D1AB4EB410A38837F824A4E7497DC248DED464D298D891054B0717945A8512F` | 23 páginas leídas y renderizadas |
| `matriz_rutas_componentes.csv` | `D175993629E33D111CE4FE9DC4E1AFDCFF08EB152B9EE8C73E353C898A78D34E` | Coincide con la copia del paquete; 43 rutas |
| `Prototipo_visual_Orqena_Field_OS.zip` | `BFB61A3FF3F61C61F856721D643348096314E51A3BDD643D39662E7F00B8F967` | Coincide con el prototipo maestro; añade render script y captura de prueba |

Las maquetas se usan como contrato de jerarquía, densidad, responsive y microcopy. El HTML estático no se copiará a producción.

## Checkpoint heredado de cierre externo

1. Rama: `codex/orqena-external-closure`.
2. SHA final: `21412ff4a500394ea97939fd604374612b44dcda`.
3. Árbol: limpio; índice limpio; sincronizado con `origin/codex/orqena-external-closure`; `git diff --check` correcto.
4. PR: [#37](https://github.com/tonirigo25/capataz/pull/37), draft, merge state `CLEAN`, checks verdes.
5. Migraciones: 43 aplicadas en review; ninguna pendiente; `npm run db:deploy` es el único predeploy.
6. Railway Review: `SUCCESS`, deployment `a121e321-c2a0-4dc5-9117-72532a555bcc`, SHA exacto `21412ff...`, proyecto aislado `orqena-review-continuous`.
7. Staging: sin cambios; deployment `dc3ce593-3bc8-4abb-9167-9b9d2f774549`, `SUCCESS`.
8. Producción: sin cambios; SHA `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`, deployment `2e266e66-be53-4008-a1b9-cbfaca21c750`, `SUCCESS`.
9. Recursos temporales: ningún servicio, base de datos o volumen Railway transitorio permanece. El proyecto review persistente conserva solo web, Postgres y su volumen. El worktree preexistente `.worktrees/orqena-readiness` no fue creado ni modificado por este programa.
10. Rollback: review puede volver al deployment anterior `19ec8c69-9401-4c78-acae-9ae09842514c` o redesplegar `d22b42454d10baff0873e5a1afccf85db9bf49a5`; producción conserva `64cf8bbb...` y no requiere rollback.
11. Pendientes: C3 LCP local `2623 ms`; dispositivos físicos y lectores de pantalla; snapshot productivo representativo; backup/PITR nativo; gate completo de staging; go/no-go humano; 13 observaciones no bloqueantes de acción primaria.
12. Revisión: `https://orqena-review-web-review.up.railway.app`; rutas públicas `/`, `/demo`, `/login`; autenticadas `/hoy`, `/dashboard`, `/clientes`. El acceso sintético heredado caducó y debe rotarse para D0.

`main` permanece en `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`. No se fusionó la PR de cierre porque producción sigue bajo NO-GO y está conectada a `main`. La rama de diseño parte de la rama canónica de cierre, no del `main` antiguo.

## D0 - Baseline, review y contrato visual

Estado: `PASS`.

### Evidencia reutilizable del SHA base

- Railway Review estable e independiente: proyecto `c54a5065-df2c-46b9-a82b-cfac3be07315`.
- Reporte autenticado exacto del SHA base: 11 perfiles, 66 combinaciones perfil/viewport, 21 permisos, 46 familias OWNER, 6/6 estados, 89 casos Axe y 0 bloqueadores.
- Capturas sintéticas existentes en `artifacts/review-auth/screenshots/`, ignoradas por Git.
- Viewports de baseline ya capturados para `/hoy`: 390, 768, 1024 y 1440 px, además de 320 y 1920 px.
- 93 páginas reales detectadas en `app/`; la matriz fuente contiene 43 patrones de ruta y se ampliará en D9.
- 43 migraciones; no se añade ni modifica ninguna migración en D0.

### Entregables D0

- `design/design-tokens.json`: fuente única recibida.
- `design/field-os-manifest.json`: fuentes, perfiles, estados, fixtures, viewports y recursos review.
- `docs/design/ROUTE_MATRIX.csv`: matriz fuente versionada.
- `scripts/design/validate-field-os.mjs`: gate de tokens y valores visuales arbitrarios.
- `scripts/design/capture-baseline.mjs`: captura pública reproducible y no destructiva.
- `docs/design/BASELINE.md`: comandos, métricas y fronteras de evidencia.

### Evidencia remota D0

- Commit base: `6485044c9e931e0068f4bc96ad5ac58078a6575e`; deployment `4411a34c-5375-4129-9c7b-b5ffa3979641`, `SUCCESS`.
- Commit con reintento de transporte acotado: `82841ff04d7e52e4935e6a0cd1081b6310ad7767`; deployment `fccc3020-5350-4fa3-998d-52a685174f6d`, `SUCCESS`, imagen `sha256:7037b591e94d3cad837c59f94016282f574ece4eb11040611c7c3e11bb1942fd`.
- Predeploy: 43 migraciones encontradas, ninguna pendiente.
- `/api/health/live`, `/api/health/ready`, `/api/status`, `/`, `/demo` y `/login`: 200 con `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- Captura pública exacta: 12/12 casos en 390, 768, 1024 y 1440 px, cero hallazgos.
- Matriz autenticada exacta `82841ff...`: 11 perfiles, 66 combinaciones, 21 permisos, 10 firmas de portal, 46 familias OWNER, 6/6 estados, 3 casos de capacidad y 89 casos axe. Resultado aún no PASS: un `React #418` no reproducido fuera de `/dinero` requiere replay explícito.
- Staging y producción no se modificaron.

### Cierre D0

- El replay aislado de `/dinero` no reprodujo el `React #418`; se conserva como observación transitoria, no como bloqueo.
- El acceso sintético de un solo uso se rotó, se entregó y ya ha caducado.
- La clave SSH temporal de auditoría se retiró de Railway y del equipo local; Railway no conserva claves registradas.
- La validación autenticada final continuó en D1 sobre el SHA exacto `14932a762c2830d0199ffe32bda828dd02785fb8`.

### Gates locales D0

- `npm run design:validate`: PASS; 37 tokens, 43 rutas fuente, 12 perfiles, 11 estados y 18 arquetipos.
- `npm run typecheck`: PASS.
- `npm run test:visual-foundations`: PASS después de sustituir la comparación obsoleta de la paleta histórica por el contrato Field OS.
- `npm run test:product-shell-navigation`: PASS.
- `npm run test:route-access`: PASS, 52 casos.
- `npm run test:public-indexing`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo F1-F11, addenda, C3, C5, C6, C7, PWA, móvil e identidad.
- `npm run test:orqena-experience-v4`: en D0 quedó 123/129 porque seis aserciones inspeccionaban literales de la home V4.1 retirada (`home-v41`). D2 las sustituyó por el contrato Field OS sin debilitar indexación, pricing, seguridad o persistencia; el resultado actual es 131/131.
- `RouteExperienceManifest`: las 13 rutas reales que el contrato V4.1 no reconocía quedaron cubiertas sin cambiar autorización ni comportamiento.

## D1 - Fundaciones visuales y shell

Estado: `PASS`.

### Implementado localmente

- Los aliases runtime `--cap-*` consumen los tokens Field OS sin introducir colores, radios o sombras arbitrarios.
- Sidebar oscura de 248 px, empresa activa visible, búsqueda global central/compacta y acciones Crear, Orqena y notificaciones.
- Navegación móvil perfilada con `Hoy`, destinos autorizados, `Capturar` y `Más`.
- La sheet `Capturar` filtra siete acciones por capacidad y no solicita cámara o micrófono antes de la selección.
- Estados compartidos de loading, empty, error y restricted; rail de registro de 320 px y split pane de 440 px.
- Repetición documentada de un único error de hidratación antes de clasificarlo como bloqueo.

### Gates locales D1

- `npm run design:validate`: PASS.
- `npm run typecheck`: PASS.
- `npm run test:visual-foundations`: PASS.
- `npm run test:product-shell-navigation`: PASS.
- `npm run test:route-access`: PASS, 52 casos.
- `npm run test:public-indexing`: PASS.
- `npm run readiness:validate-all-static`: PASS completo.
- `npm run build`: PASS, 76/76.

### Evidencia remota D1

- SHA exacto: `14932a762c2830d0199ffe32bda828dd02785fb8`.
- Railway Review: deployment `514a7e60-732e-43b0-bd0a-f2e2f3583e1a`, `SUCCESS`, imagen `sha256:37cf44af1b81870e025a9492eba3a88de01957a7860fd523cab9ef9b92b8b6b3`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- Salud pública: `/api/health/live`, `/api/health/ready`, `/api/status`, `/`, `/demo` y `/login` respondieron 200 con `noindex`.
- Auditoría autenticada: 11 perfiles, 66 combinaciones perfil/viewport, 21 permisos, 10 firmas de portal, 46 familias OWNER, 6/6 estados, 3 casos de capacidad y 89 casos Axe; 0 bloqueadores.
- Dos hidrataciones transitorias, en OWNER `/dinero` y `/tesoreria`, pasaron replay limpio y permanecen como observación.
- Staging y producción no se modificaron.

## D2 - Home y demo guiada

Estado: `PASS`.

### Implementado

- Header exacto: Cómo funciona, Resultados, Para quién, Confianza, Entrar y Ver demo.
- Hero “Del audio en la obra al cobro”, dos CTA, demo sintética Audio → Extracción → Presupuesto y franja de cuatro valores.
- Historia oscura de cinco etapas: contacto y visita, presupuesto, trabajo y planificación, compras y costes, factura y cobro.
- Resultados, selector por responsabilidad, captura móvil, confianza, FAQ y formulario persistente conservados.
- `/demo` sin registro, con datos sintéticos editables, operación íntegra por teclado, confirmación simulada, resultado y CTA real.
- Metadata y schema JSON-LD coherentes; indexación pública permanece cerrada.
- Renderizado diferido nativo de contenido bajo el pliegue, sin ocultar contenido a navegación por ancla ni a tecnologías de asistencia.

### Evidencia local D2

- `npm run design:validate-d2`: PASS, 14/14.
- `npm run design:validate`: PASS, contrato Field OS y contraste semántico AA.
- `npm run design:validate-d2-browser`: PASS en `/` y `/demo`, 390×844 y 1440×900; 0 bloqueantes Axe, 0 overflow, reduced motion `0.00001 s`, CLS 0, 0 llamadas externas e INP de laboratorio entre 40 y 152 ms.
- Lighthouse final: `/` LCP 2311 ms, CLS 0, performance 91; `/demo` LCP 2192 ms, CLS 0, performance 98; `/contacto` LCP 2190 ms, CLS 0, performance 89.
- Lighthouse conserva un aviso no bloqueante de `target-size` en el CTA final de la home; el gate Axe serio/crítico es 0 en ambos viewports.
- `npm run build`: PASS, 76/76; `/` 126 kB y `/demo` 116 kB de First Load JS.
- `npm run readiness:validate-all-static`: PASS completo e ininterrumpido hasta F11 e identidad; stderr vacío y ninguna coincidencia de fallo.

### Evidencia remota D2

- SHA exacto: `4e3974061d6d283104ffb485952b3b1636fd997a`.
- Railway Review: deployment `2e28891d-0e56-4a1e-b5e3-1b1f14347701`, `SUCCESS`, imagen `sha256:a7b40ea199a8b6004221de6879783618621156d5399945b597e113e7785a24da`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- Salud y política pública: `/api/health/live`, `/api/health/ready`, `/api/status`, `/`, `/demo` y `/login` respondieron 200 con `noindex`.
- Matriz pública: 12/12 combinaciones en `/`, `/demo` y `/login`, a 390, 768, 1024 y 1440 px; 0 hallazgos, 0 errores de consola/página, 0 HTTP 5xx, 0 hosts externos inesperados y 0 violaciones Axe serias/críticas.
- Formulario persistente: HTTP 202, una fila sintética `PENDING`, un evento de auditoría, origen `home`, consentimiento registrado y ningún envío de correo live.
- Matriz autenticada: 11 perfiles, 66 combinaciones perfil/viewport, 21 permisos, 10 firmas de portal, 46 familias OWNER, 6/6 estados, 3 casos de capacidad y 89 casos Axe; 0 bloqueadores y 13 observaciones de múltiples acciones primarias ya asignadas a sus bloques.
- Acceso OWNER de un solo uso entregado fuera de Git, válido hasta `2026-07-27T01:50:50.100Z`; las credenciales QA y MFA activas permanecen en variables secretas de Review.
- Incidente resuelto: un secreto TOTP intermedio apareció en una salida técnica, se invalidó inmediatamente mediante re-enrolamiento y el secreto activo se guardó por `stdin` sin mostrarse.
- La llave SSH efímera fue revocada y borrada; Railway no conserva llaves SSH registradas.
- Staging y producción no se modificaron. Los providers live, correo live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D2_REVIEW_EVIDENCE.json`.

## D3 - Hoy y Dashboard

Estado: `PASS`.

### Implementado

- `/hoy` abre con un máximo de tres prioridades derivadas del `PortalManifest`; cada una explica motivo, origen, impacto y acción sin consultar módulos ausentes del portal.
- Agenda, pulso compacto y captura rápida permanecen condicionados por perfil y permisos. El pulso cuenta únicamente áreas, citas y capturas visibles; no inventa saldos, progreso ni previsiones.
- El checklist de activación se limita a OWNER y ADMINISTRATIVE por perfil funcional; FINANCE y otros perfiles basados técnicamente en ADMIN ya no reciben pasos comerciales ajenos a su portal.
- El estado sin prioridades ofrece guidance explícita y no convierte Hoy en una rejilla de KPI.
- `/dashboard` limita la primera lectura a cuatro KPI trazables: facturado, cobrado, beneficio facturado y vencido.
- Tendencia y excepciones forman la siguiente lectura; posición económica, cobros, rentabilidad y pipeline permanecen en segundo nivel.
- Cada cifra mantiene enlace a su origen; no se crea un score de salud artificial.
- La autorización permanece intacta: `reports.view` y el conjunto de capacidades company-wide siguen protegiendo el Dashboard; el rediseño no concede acceso a FINANCE, SALES, PROCUREMENT ni WORKER cuando el contrato existente lo deniega.
- La matriz autenticada admite ahora selecciones cerradas de perfiles, viewports y familias para auditar cada bloque sin debilitar la ejecución completa.

### Evidencia local D3

- `npm run test:today-business-dashboard`: PASS, 30/30.
- `npm run test:orqena-experience-v4`: PASS, 131/131.
- `npm run test:core-operational-experience`: PASS, 18/18.
- `npm run test:product-shell-navigation`: PASS, 26/26.
- `npm run test:visual-foundations`: PASS, 18/18.
- `npm run design:validate`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76; `/hoy` y `/dashboard` conservan 108 kB de First Load JS.
- `npm run readiness:validate-all-static`: PASS completo e ininterrumpido hasta F11 e identidad; stderr vacío y ninguna línea de fallo.

### Evidencia remota D3

- SHA funcional exacto: `a5e07de6ab521709143e0c52cafdebb0f5de7e42`.
- Railway Review: deployment `54180680-b64f-47fb-8895-b19b9f07dacb`, `SUCCESS`, imagen `sha256:736380d6f9e59750119d1bd157bf5dee27a8faff5125c8785bf71ae7729e1785`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- `/api/health/live`, `/api/health/ready` y `/api/status`: 200 con `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- Matriz focal final: OWNER, FINANCE, SALES, PROCUREMENT_MANAGER y WORKER; 10 combinaciones perfil/viewport, 14 permisos, 5 firmas de portal, Hoy y Dashboard OWNER, 6/6 estados, 3 casos de capacidad y 26 casos Axe; 0 observaciones y 0 bloqueadores.
- Dashboard móvil OWNER a 390 px: 200, 0 overflow, una acción primaria, cuatro KPI iniciales, contrato D3 correcto y 0 violaciones Axe serias/críticas.
- Una primera ejecución móvil aislada observó `React #418` en la visita de permisos a Dashboard. El validador incorporó replay obligatorio; la repetición final no lo reprodujo y terminó con 0 observaciones y 0 bloqueadores.
- Acceso OWNER de un solo uso rotado y entregado fuera de Git; MFA activa sin cambios, contraseña QA no mostrada y 0 llaves SSH restantes.
- Safari, Chrome Android, NVDA, VoiceOver y zoom real 200–400 % permanecen `READY_FOR_EXTERNAL_INPUT`; no detienen D4.
- Staging y producción no se modificaron. Providers live, correo live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D3_REVIEW_EVIDENCE.json`.

## D4 - Clientes y Cliente 360

Estado: `PASS`.

### Implementado

- `/clientes` abre en la vista inteligente `Necesitan acción`, con accesos a `Activos` y `Todos`.
- La búsqueda permanece visible; estado, tipo, archivo, orden y situaciones operativas viven en un drawer/sheet accesible.
- Desktop usa una lista de 420–480 px y preview derecho. Click, hover y foco actualizan la selección sin perder el listado; la ficha completa mantiene deep link.
- Móvil usa tarjetas compactas sin tabla horizontal, una acción primaria contextual y accesos rápidos autorizados a llamada, mensaje, visita y ficha.
- Cada fila limita la primera lectura a nombre, estado, siguiente acción, riesgo principal, trabajo activo, saldo autorizado, último contacto y CTA contextual.
- Cliente 360 reduce siete pestañas a cuatro áreas: `Resumen`, `Trabajo/Obras`, `Dinero` y `Archivos`.
- Contactos, datos fiscales, dirección, notas y configuración permanecen accesibles en `ContextDrawer` y rail contextual; no se elimina ningún campo ni acción previa.
- El header presenta tipo, contacto, responsable derivado de trabajo real, próxima fecha, estado, siguiente acción y menú secundario.
- El recorrido Cliente → Oportunidad → Presupuesto → Trabajo → Factura → Cobro conserva enlaces compactos a sus cuatro áreas.
- Dinero sigue protegido por las capacidades y scopes existentes. Perfiles parciales no reciben importes ni acciones fuera de alcance.
- No se añade Prisma, migración, escritura económica ni cambio de reglas de negocio.

### Evidencia local D4

- `npm run test:client-work-operating-system`: PASS, 38/38.
- `npm run test:crm-clientes`: PASS.
- `npm run test:economic-control-treasury-experience`: PASS, 27/27.
- `npm run test:route-access`: PASS, 52 casos.
- `npm run test:visual-foundations`: PASS, 18/18.
- `npm run test:product-shell-navigation`: PASS, 26/26.
- `npm run design:validate`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76; `/clientes` 114 kB y `/clientes/[id]` 109 kB de First Load JS.
- `npm run readiness:validate-all-static`: PASS completo hasta F11 e identidad; 0 escrituras en staging y producción.

### Evidencia remota D4

- SHA funcional exacto: `78fe7ffe8cad080db0339be498d1bd30ee6d7d94`.
- Railway Review: deployment `e2bd4b0a-5198-438f-8f6e-fc3a48c31862`, `SUCCESS`, imagen `sha256:25536ca8cc1799f145f62462c73670a7b866ef035dececcc2d283e00882c64ac`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- `/api/health/live`, `/api/health/ready` y `/api/status`: 200 con `noindex`.
- Matriz focal: OWNER, ADMINISTRATIVE, SALES, PROJECT_MANAGER y ADVISOR_AUDITOR; 10 combinaciones perfil/viewport, 12 permisos, 5 firmas de portal, 4 superficies OWNER, 6/6 estados, 3 casos de capacidad y 26 casos Axe.
- Interacciones: 14/14 vistas/filtros, 4/4 deep links, ambos drawers abren, cierran con Escape y restauran foco; Contactos, Datos fiscales y Notas internas permanecen accesibles.
- Revisión visual directa de listado y Cliente 360 en 390 y 1440 px: PASS; 0 overflow, 0 observaciones y 0 bloqueadores.
- El primer gate sobre `a226f7c...` no fue aceptado: detectó dos jerarquías de acción primaria y un falso bloqueo del estado vacío. `78fe7ff...` corrige ambos y supera el replay completo.
- Acceso OWNER de un solo uso rotado y entregado fuera de Git; MFA activa sin cambios y 0 llaves SSH restantes.
- Staging y producción no se modificaron. Providers live, correo live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D4_REVIEW_EVIDENCE.json`.

## D5 — Trabajo, presupuesto, factura y tesorería

Estado: `PASS`.

### Implementado

- Trabajo 360 prioriza estado real, hitos, evidencia, coste previsto/real y margen sólo bajo permiso; declara explícitamente que no inventa porcentaje físico.
- Presupuesto conserva las acciones y autorización existentes, añade editor semántico de partidas y preview viva sin mostrar el JSON interno.
- `Guardar borrador` y `Revisar y enviar` quedan visibles; el envío mantiene confirmación humana y el PDF conserva generador, numeración y cálculos previos.
- Factura y cobro reúne total, cobrado, pendiente, vencimiento, pagos parciales, recordatorios, compromisos y siguiente acción.
- El documento/PDF y el estado fiscal se muestran en un bloque separado; registrar cobro no activa transmisión fiscal.
- Tesorería abre con caja registrada, por cobrar, por pagar y flujo previsto documentado, además de calendario, movimientos y fuentes.
- Cada superficie focal conserva una sola jerarquía primaria visible sin retirar acciones secundarias.
- Los fixtures sintéticos de Review añaden un pago parcial, recordatorio y compromiso, sin provider o comunicación real.
- No se añade Prisma, migración, numeración, cálculo fiscal, movimiento real ni cambio de reglas de negocio.

### Evidencia local D5

- `npm run test:design-d5`: PASS, 19/19.
- `npm run test:client-work-operating-system`: PASS, 38/38.
- `npm run test:economic-control-treasury-experience`: PASS, 27/27.
- `npm run test:document-pdf`, `test:works`, `test:work-detail` y `test:work-profitability`: PASS.
- `npm run test:numbering-contract`: PASS aislado, 32 llamadas y concurrencia 20.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo hasta F11 e identidad; 0 escrituras en staging y producción.

### Evidencia remota D5

- SHA exacto: `cd92c3d24d8fb94772f459d3e059547095e17679`.
- Railway Review: deployment `06408195-96b7-4f06-97d0-fd8f6c63de24`, `SUCCESS`, imagen `sha256:26c5a965ef5b71d15c8b2deeca488d8c946f4b48fd1f7cb3282f4c4b140c226b`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- `/api/health/live`, `/api/health/ready` y `/api/status`: 200 con `noindex`.
- Matriz focal: 6 perfiles, 12 combinaciones perfil/viewport, 23 permisos, 6 firmas de portal, 8 superficies OWNER, 6/6 estados, 3 casos de capacidad y 43 casos Axe.
- Quote-to-cash no mutante: 6/6 — preview viva, dos PDFs, enlaces obra→presupuesto/factura, saldo parcial y forecast documentado.
- Revisión visual directa desktop/móvil de Trabajo, Presupuesto, Factura y Tesorería: PASS; 0 overflow, 0 observaciones y 0 bloqueadores.
- El primer gate detectó 11 bloqueos y 6 observaciones; el segundo redujo a 1/0; el replay exacto final cerró en 0/0 sin reducir cobertura.
- Acceso OWNER de un solo uso rotado y entregado fuera de Git; no se mostró contraseña ni secreto MFA.
- Staging y producción no se modificaron. Providers live, correo live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D5_REVIEW_EVIDENCE.json`.

## D6 — Documentos, proveedores y facturas recibidas

Estado: `PASS`.

### Implementado

- Documentos integra bandeja, original y propuesta de extracción en una composición de tres paneles; en móvil conserva la secuencia Entrada → original → datos extraídos.
- Los estados `UPLOADED`, `PROCESSING`, `REVIEW_REQUIRED`, `POSSIBLE_DUPLICATE`, `READY`, `REGISTERED` y `FAILED` permanecen explícitos y la extracción nunca crea gasto sin confirmación humana.
- La carga conserva tamaño, extensión, MIME, firma binaria y SHA-256; el almacenamiento local pasa por cuarentena privada y promoción atómica dentro del tenant.
- Proveedores y subcontratas reúnen especialidad/oficio, documentación y RC, trabajos, saldo, siguiente acción y preview contextual sin abrir la ficha.
- Facturas recibidas separa revisión, vencimientos, base, IVA, retención, total, pagos parciales, gasto enlazado e historial.
- Tesorería enlaza la factura recibida que origina la salida y mantiene un único gasto económico; no se crea ni muestra una segunda salida.
- Las fichas sintéticas sin binario real dejan de emitir enlaces rotos y se identifican como metadatos de Review.
- Las jerarquías focales conservan una sola acción primaria visible; las demás acciones permanecen disponibles como secundarias.
- No se añade Prisma, migración, provider, regla fiscal, autorización, numeración, pago real ni cambio de aislamiento.

### Evidencia local D6

- `npm run test:design-d6`: PASS, 20/20.
- `npm run test:expense-document-reader`: PASS, 26/26.
- `npm run test:procurement`: PASS, 32/32.
- `npm run test:documents`: PASS.
- `npm run test:multitenancy-documents`: PASS aislado; listado, ID, mutación, relación y agregado por empresa, con concurrencia de numeración 20.
- `npm run test:economic-control-treasury-experience`: PASS, 27/27.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo hasta F11 e identidad; providers live 0 y 0 escrituras en staging/producción.
- `git diff --check`: PASS.

### Evidencia remota D6

- SHA exacto: `b82be783adce2955b5b0922cc60cd5c9f935ae40`.
- Railway Review: deployment `9cc5f1fa-a372-4f75-afa9-05efd6b06638`, `SUCCESS`, imagen `sha256:7246a005466f7d497ce2e3ba9e3a97553d1bb73b3e38e05ab9bc8bcbf29e5339`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente.
- `/api/health/live`, `/api/health/ready` y `/api/status`: 200; raíz y endpoints con `noindex, nofollow, noarchive, nosnippet`.
- Matriz focal: 4 perfiles, 8 combinaciones perfil/viewport, 14 permisos, 4 firmas de portal, 64 familias OWNER, 6/6 estados, 3 casos de capacidad y 86 casos Axe.
- Flujo D6 no mutante: 5/5 — estados documentales/huella, contexto de proveedor, directorio de facturas, pago parcial/gasto único y una sola salida enlazada en Tesorería.
- Revisión visual directa de Documentos, Proveedores y detalle de factura recibida en 390 y 1440 px: PASS; 0 overflow, 0 observaciones D6 y 0 bloqueadores.
- El primer gate sobre `03dfaf4...` detectó 9 bloqueos y 5 observaciones D6. `b82be78...` supera el replay completo sin reducir rutas, perfiles ni estados.
- El reporte global conserva 9 observaciones fuera de D6 para plantillas, tareas, recomendaciones, configuración/plataforma y dos replays de hidratación limpios.
- Acceso OWNER de un solo uso rotado y entregado fuera de Git; MFA no cambió y no se mostró contraseña ni secreto TOTP.
- Staging y producción no se modificaron. Providers live, correo live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D6_REVIEW_EVIDENCE.json`.

## D7 — Operación transversal

Estado: `PASS`.

### Implementado

- Agenda abre en semana y conserva Mes, Lista y Vencimientos como vistas secundarias; muestra resumen de hoy, navegación temporal, leyenda y un cajón de filtros accesible.
- Tareas ofrece `Mías`, `Equipo`, `Bloqueadas` y `Completadas`; usa tablero con volumen alto, lista con volumen bajo y estados vacíos válidos por perfil.
- El detalle de tarea conserva checklist, subtareas, dependencias, recurrencia, bloqueos e historial sin calcular progreso cuando faltan datos.
- Seguimientos funciona como cola con fecha, promesa, último intento, canal, resultado y siguiente acción; su detalle separa edición, intento manual y resultado estructurado.
- Recordatorios distingue preparado, programado y enviado en simulación, y declara que los providers live siguen desactivados.
- Alertas y recomendaciones muestran nivel, origen, entidad, impacto, regla, evidencia, acciones y ciclo de vida sin puntuación opaca visible; cualquier desglose vive dentro de la explicación.
- Automatizaciones expone estado, trigger, próxima ejecución, fallos, retries, cooldown y confirmación humana; Review no ejecuta providers live.
- Estados, prioridades, orígenes, tipos y canales aparecen en español. El detalle de tarea usa nombres de miembros activos y no expone identificadores internos.
- No se añade Prisma, migración, provider, efecto autónomo, cambio de autorización, cálculo económico ni regla de negocio.

### Evidencia local D7

- `npm run test:design-d7`: PASS, 21/21.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo hasta F11 e identidad; providers live 0 y 0 escrituras en staging/producción.
- `git diff --check`: PASS.

### Evidencia remota D7

- SHA exacto: `407b3f16273a01a0cd5cf0af60178222de6f7d39`.
- Railway Review: deployment `0cd2e76a-6db6-432b-a850-1712be1deab1`, `SUCCESS`, imagen `sha256:18363db3afc0e2e66c90d9d417e533597502f48da22c081bd705d19487a0b945`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente; `/api/health/ready` y `/api/status`: 200.
- Matriz focal final: 4 perfiles, 8 combinaciones perfil/viewport, 30 permisos, 4 firmas de portal, 17 superficies OWNER, 6/6 estados, 3 casos de capacidad y 55 casos Axe.
- Interacciones D7: 7/7 — Agenda/filtros, tablero de tareas, cola de seguimientos, estados de recordatorio, ciclo de alertas, jerarquía de recomendaciones y observabilidad de automatizaciones.
- Revisión visual directa de Agenda, tareas, seguimientos, alertas y recomendaciones en 390 y 1440 px: PASS; 0 overflow y 0 bloqueadores.
- El gate inicial detectó 24 bloqueos y 2 observaciones; la primera remediación redujo a 6/0 y distinguió estados vacíos y evidencia transparente; el SHA final cerró en 0 bloqueos.
- Una primera visita de Agenda a 390 px emitió `React #418`; el replay obligatorio quedó limpio. Permanece como observación no reproducida.
- Acceso OWNER de un solo uso rotado fuera de Git; no se mostró contraseña QA ni secreto TOTP.
- Safari, Chrome Android, NVDA, VoiceOver, zoom real 200–400 % y validación con datos/dispositivos reales quedan `READY_FOR_EXTERNAL_INPUT`.
- Staging y producción no se modificaron. Providers live, correo live, cobros live, transmisión fiscal live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D7_REVIEW_EVIDENCE.json`.

## D8 — Orqena, equipo, onboarding y configuración

Estado: `PASS`.

### Implementado

- Orqena reúne historial, conversación y propuesta estructurada en tres paneles desktop y una secuencia móvil; los campos y efectos se revisan antes de guardar.
- `Guardar y aplicar`, `Revisar campos` y `Descartar` conservan la confirmación humana. La auditoría preparó, revisó y descartó una propuesta sintética sin aplicar su efecto.
- Voz, transcripción, historial y memoria siguen disponibles sin mostrar prompts, diagnósticos internos ni datos fuera de la empresa y persona activas.
- Equipo separa lista de personas y portal resultante; resume perfil, modo, MFA, alcance, paquetes, campos económicos, autoridades y equipos.
- Los cambios de acceso mantienen preview antes de aplicar, un solo editor focal y el ciclo completo de invitación, aceptación, aprobación, rechazo y revocación.
- Onboarding muestra cinco hitos de primer valor, objetivo inferior a 15 minutos, continuidad manual, configuración posterior e importación segura con preview, apply y rollback.
- Configuración usa sidebar por áreas, deep links y checklist; separa perfil personal, empresa, fiscal/documentos, equipo, integraciones, seguridad, plan, app, legal y zona sensible sin mega formulario inicial.
- El encabezado móvil de Orqena es visible, Equipo conserva una sola acción primaria y las etiquetas pequeñas de historial cumplen contraste AA.
- No se añade Prisma, migración, provider, regla de negocio, cambio fiscal, numeración, pago, autorización, scope, idempotencia, outbox ni efecto autónomo.

### Evidencia local D8

- `npm run test:design-d8`: PASS, 22/22.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo hasta F11 e identidad; providers live 0 y 0 escrituras en staging/producción.
- `git diff --check`: PASS.

### Evidencia remota D8

- SHA exacto: `6d23f28df2ff2926f7e6d5763279af85c928d2a7`.
- Railway Review: deployment `af161e08-94fb-4f87-894d-14c2fea62286`, `SUCCESS`, imagen `sha256:87bde188e63c8fb2f109cd4d6d47c0f500534caceabef581443e8626af023372`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente; `/api/health/ready` y `/api/status`: 200; `robots.txt` mantiene `Disallow: /`.
- Matriz focal final: 4 perfiles, 8 combinaciones perfil/viewport, 20 permisos, 4 firmas de portal, 8 superficies OWNER, 6/6 estados, 3 casos de capacidad y 36 casos Axe.
- Interacciones D8: 11/11 — composición Orqena, revisión y descarte, portal de persona, invitaciones, cinco hitos, importación segura, separación de configuración, deep link fiscal y MFA.
- Revisión visual directa de Orqena, Equipo, Onboarding y Configuración en 390 y 1440 px: PASS; 0 overflow, 0 observaciones y 0 bloqueadores.
- El primer gate detectó 2 bloqueos y 2 observaciones; el segundo quedó en 1/0 por contraste; el replay final exacto cerró en 0/0 sin reducir cobertura.
- Acceso OWNER de un solo uso rotado fuera de Git; no se mostró contraseña QA ni secreto TOTP.
- Safari, Chrome Android, NVDA, VoiceOver, zoom real 200–400 % y validación con usuarios, datos y dispositivos reales quedan `READY_FOR_EXTERNAL_INPUT`.
- Staging y producción no se modificaron. Providers live, correo live, cobros live, transmisión fiscal live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D8_REVIEW_EVIDENCE.json`.

## D9 — Matriz completa de rutas y estados

Estado: `PASS`.

### Implementado

- La matriz entregada se conserva y amplía de 43 a 93 filas, una por cada `page.tsx` del repositorio. Se incorporan las 50 rutas especializadas que faltaban sin eliminar ninguna fila original.
- `lib/route-experience-manifest.ts` acredita para cada ruta un patrón único, acción primaria, adaptación móvil, loading, empty, error, restricted, read-only, demo, archive, confirmación destructiva y permiso/scope.
- El manifiesto distingue rutas públicas, anónimas, de membership, de capability/scope y de plataforma; no presenta una ruta pública como protegida ni una ruta de plataforma como acceso ordinario.
- `/demo` y `/demo-v2` quedan identificadas como demostraciones públicas sintéticas. Las superficies autenticadas sólo usan fixtures sintéticos seguros en Review.
- Cliente, trabajo, tarea, seguimiento y conversaciones de Orqena acreditan archivo/borrado y confirmación. Trabajo, tarea y seguimiento reciben el mismo diálogo accesible ya usado por Cliente.
- `scripts/design/validate-d9-route-matrix.ts` recompila el inventario directamente desde `app/**/page.tsx`, rechaza duplicados, celdas vacías, huérfanas, reglas ambiguas y dimensiones ausentes, y escribe evidencia estructurada ignorada por Git.
- No se modifica Prisma, migraciones, reglas empresariales, fiscalidad, importes, numeración, autorización, scopes, tenant isolation, providers, pagos, IA, outbox ni idempotencia.

### Evidencia local D9

- `npm run test:design-d9`: PASS, 93/93 rutas, 0 huérfanas y 11/11 controles por ruta.
- `npx tsx scripts/validate-route-experience-manifest.ts`: PASS, 93/93 y una regla exacta por ruta.
- Regresión D5–D8: 19/19, 20/20, 21/21 y 22/22.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo hasta F11, identidad y addenda; providers live 0 y 0 escrituras en staging/producción.
- `git diff --check`: PASS.

### Evidencia remota D9

- SHA exacto: `d5a474fdd4402ef6212917314dfa97f56dcc034b`.
- Railway Review: deployment `0fda8286-7924-4839-993a-1304aee64696`, `SUCCESS`, imagen `sha256:0be7ee73305124af22333868dfa65df34b3a487797a6bed1e4ab04807eb86d2c`.
- Predeploy: 43 migraciones encontradas y ninguna pendiente; `/api/health/ready` y `/api/status`: 200; `robots.txt` mantiene `Disallow: /`; 0 HTTP 5xx observados.
- Matriz focal: 4 perfiles, 8 combinaciones perfil/viewport, 19 permisos, 4 firmas de portal, 8 superficies, 7/7 interacciones, 6/6 estados, 3 casos de capacidad y 35 casos Axe.
- La auditoría recorrió trabajo, tareas, seguimientos y Orqena en escritorio/móvil, y terminó con 0 observaciones y 0 bloqueadores.
- Acceso OWNER de un solo uso rotado fuera de Git; no se persistió el token, la contraseña QA ni el secreto TOTP.
- Safari, Chrome Android, NVDA, VoiceOver, zoom humano y validación con usuarios/datos/dispositivos reales quedan `READY_FOR_EXTERNAL_INPUT`.
- Staging y producción no se modificaron. Providers live, correo live, cobros live, transmisión fiscal live e indexación pública siguen desactivados.
- Evidencia estructurada: `docs/design/evidence/D9_REVIEW_EVIDENCE.json`.

## D10 — Auditoría integral de producto y diseño

Estado: `PASS` en Railway Review.

### Cobertura ejecutada

- Auditoría autenticada amplia: 11 perfiles, 77 combinaciones perfil/viewport, 84 permisos, 10 firmas de portal, 364 superficies OWNER, 58 interacciones D4–D10, un aislamiento tenant, 6/6 estados, 3 casos de capacidad y 470 casos Axe; 0 bloqueadores.
- Auditoría pública completa: 24 rutas, Chromium/Firefox/WebKit y 390, 430, 768, 1024, 1280, 1440 y 1920 px; 504 casos públicos, 504 Axe, 21 capturas, 12 diffs visuales, 7 casos de medios y 0 bloqueadores.
- Addendum móvil: replay completo de las 24 rutas en los tres motores a 320 px; 72 casos públicos, 72 Axe y 0 bloqueadores.
- Rendimiento remoto: LCP mediano 2200 ms, CLS 0 e INP 24 ms en la repetición exacta final, dentro de los presupuestos 2500/0,1/200.
- Gates PostgreSQL críticos en entorno local aislado: F2, F3, F4, F6, F7, F8, C2 y pentest tenant F11, 8/8; 43 migraciones, 0 escrituras en staging o producción.
- `npm run typecheck`: PASS. `npm run build`: PASS, 76/76. `git diff --check`: PASS.

### Hallazgos resueltos

- VIEWER ve en `/auditoria` un aviso explícito de solo lectura sin adquirir permisos de escritura.
- Los abortos al cerrar contextos sólo son esperados si corresponden a un `POST` same-origin con cabecera `Next-Action`; el resto continúa bloqueando.
- La matriz horizontal de `/estado` es ahora una región etiquetada y enfocable a 320 px; el replay pasó en los tres motores.
- Una medición focal de LCP fuera de presupuesto no se descartó. El replay exacto posterior midió 2200 ms y cerró el gate con evidencia.

### Railway Review

- SHA funcional exacto: `a1c0beffed46ce7b9450e14e69535182cf3d6592`.
- Deployment: `1d9097b8-dadd-4f7c-ae21-206cadaa1103`, `SUCCESS`, imagen `sha256:31833c69c9d3846f2041e92001d2d4794a2774d68cb52cbd600188ffe0fb6612`.
- 43 migraciones encontradas, ninguna pendiente; live, ready y status 200; `robots.txt` mantiene `Disallow: /` y las respuestas llevan `X-Robots-Tag: noindex`.
- Rutas recomendadas: `/`, `/demo`, `/estado`, `/hoy`, `/dashboard`, `/capataz`, `/auditoria`, `/clientes`, `/obras`, `/dinero` y `/equipo`.
- Staging y producción no se modificaron durante D10. Providers live, correo live, cobros live, transmisión fiscal live e indexación pública siguen desactivados.
- Safari real, Chrome Android real, NVDA, VoiceOver, zoom real y validación con usuarios/datos/dispositivos reales quedan `READY_FOR_EXTERNAL_INPUT`.
- Evidencia estructurada: `docs/design/evidence/D10_REVIEW_EVIDENCE.json`.

## D11 — Review continuo, staging y frontera de producción

Estado: `PASS_WITH_EXTERNAL_INPUT_GATES`.

### Promoción ejecutada

- El candidato funcional exacto
  `2be6a99040c70c67fe2f91c0737f4c17bd116451` permanece verde en Railway
  Review y fue promovido deliberadamente al proyecto de staging independiente.
- Review sirve deployment `ce516232-0c3e-438f-b276-64773e07ac7d`, imagen
  `sha256:a8fb22cee71d22284f4d3c7b158b9147872c5460224160cb4df82e442f20bbb1`.
- Staging sirve deployment `b4603964-09a0-421a-9d09-f0e96fff7ceb`, imagen
  `sha256:aae594e2be50c7fd2189df5cfeaf42049d48666ad99ad1ce219ebccfd0f03861`.
- El primer despliegue D11 aplicó las 18 migraciones de readiness que faltaban
  en el staging histórico. Los despliegues exactos siguientes encontraron 43
  migraciones y ninguna pendiente, acreditando idempotencia del único
  predeploy.
- Review y staging devuelven 200 en live, ready y status, mantienen
  `X-Robots-Tag: noindex`, `robots.txt` con `Disallow: /` y cero HTTP 5xx en la
  ventana final.
- Providers live: 0. Indexación pública: apagada. Producción no fue modificada.

### Gate público de staging

- 24 rutas × 8 viewports × Chromium/Firefox/WebKit: 576/576 casos y 576 Axe.
- 24 capturas, 12 diffs visuales, 7 casos de medios y 3 muestras de
  rendimiento; 0 bloqueadores.
- Rendimiento mediano: LCP 2180 ms, CLS 0 e INP 24 ms, dentro del contrato
  2500/0,1/200.
- Diez avisos `target-size` de CTAs inicialmente fuera de pantalla pasaron el
  replay después de desplazar el objetivo. Dos diagnósticos React #418
  aislados pasaron su replay limpio. Se conservan como observaciones, no como
  exenciones generales.

### Gate autenticado y journey

- Matriz multiengine: 4 perfiles focales, 8 viewports, 4 logins, 96 casos de
  perfil, 11 rutas OWNER, 264 casos OWNER, 360 Axe y 60 capturas; 0
  observaciones y 0 bloqueadores.
- Las cuatro escrituras declaradas fueron exclusivamente sesiones de
  autenticación sintética autorizadas en staging; no se persistieron
  credenciales y producción recibió 0 escrituras.
- Journey seleccionado: 25/25 superficies, 25 hashes únicos, aislamiento entre
  tenants, gobierno OWNER, scope asignado/no asignado, denegación de mutación
  read-only e invitación aceptada → pendiente → aprobada → activa.
- Una captura completa de `/` agotó su timeout bajo carga concurrente y guardó
  una captura de viewport. La ruta respondió 200 y la matriz pública
  independiente la cubrió en los tres motores y ocho anchos sin bloqueo.

### Cierre técnico

- `npm run readiness:validate-all-static`: PASS completo.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:scan-secrets`: PASS, 1056 archivos.
- `.railwayignore` excluye `.codex-backup/`, `.worktrees/` y `artifacts/`; los
  builds activos de Review y staging usan el contexto saneado.
- No se añadió ninguna migración de diseño ni se cambió dominio, autorización,
  tenant isolation, fiscalidad, importes, numeración, outbox, idempotencia,
  confirmación humana, pagos, saldos o lógica de IA.
- Evidencia estructurada:
  `docs/design/evidence/D11_STAGING_EVIDENCE.json`.

### Frontera externa

Producción permanece `NO-GO`. El gate automatizado de staging sí pasa, pero el
ensayo sobre datos representativos autorizados, backup/PITR nativo y restore,
SHA/tag inmutable desde `main` y go/no-go humano firmado permanecen
`READY_FOR_EXTERNAL_INPUT`. Safari real, Chrome Android real, NVDA, VoiceOver,
zoom humano y validación con personas/dispositivos reales tampoco se presentan
como PASS.
