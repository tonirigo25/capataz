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

Estado: `IN_PROGRESS` — baseline público y despliegue reproducibles; la matriz autenticada completa conserva un único replay pendiente.

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

### Pendiente para cerrar D0

- Repetir de forma aislada y registrada la superficie `/dinero`; si el fallo reaparece, corregirlo, y si no, conservarlo como observación transitoria.
- Rotar y entregar un acceso sintético de un solo uso después del último replay verde.

### Gates locales D0

- `npm run design:validate`: PASS; 37 tokens, 43 rutas fuente, 12 perfiles, 11 estados y 18 arquetipos.
- `npm run typecheck`: PASS.
- `npm run test:visual-foundations`: PASS después de sustituir la comparación obsoleta de la paleta histórica por el contrato Field OS.
- `npm run test:product-shell-navigation`: PASS.
- `npm run test:route-access`: PASS, 52 casos.
- `npm run test:public-indexing`: PASS.
- `npm run build`: PASS, 76/76.
- `npm run readiness:validate-all-static`: PASS completo F1-F11, addenda, C3, C5, C6, C7, PWA, móvil e identidad.
- `npm run test:orqena-experience-v4`: 123/129; las seis aserciones restantes inspeccionan literales de la home V4.1 retirada (`home-v41`) y no se declaran PASS. D2 las reemplazará por un contrato Field OS sin debilitar indexación, pricing, seguridad o persistencia.
- `RouteExperienceManifest`: las 13 rutas reales que el contrato V4.1 no reconocía quedaron cubiertas sin cambiar autorización ni comportamiento.

## D1 - Fundaciones visuales y shell

Estado: `IN_PROGRESS`.

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

### Pendiente D1

- Commit/push y despliegue exacto en Review.
- Capturas públicas y autenticadas por perfil/viewport.
- Confirmar cero overflow, permisos correctos, foco/teclado y cero bloqueantes axe.
