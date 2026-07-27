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

Estado: `LOCAL_PASS / REMOTE_PENDING`.

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

### Pendiente remoto D3

- Commit, push y despliegue del SHA exacto a Railway Review.
- Verificar OWNER, FINANCE, SALES, PROCUREMENT y WORKER en 390 y 1440 px.
- Probar navegación al origen, ausencia de datos restringidos, Axe, overflow, consola y estados representativos.
