# Design QA — Portal interno Orqena

## Resultado

`in_progress`

La ampliación canónica recibida el 1 de agosto de 2026 reabrió la validación visual y funcional. Existen hallazgos P0/P1/P2 pendientes en Cliente 360, Trabajo/Obra y módulos globales; este documento no puede declarar un cierre vigente hasta completar las nuevas comparaciones y gates.

## Fuente visual canónica

- Paquete: `ORQENA_CODEX_PAQUETE_LIGERO_COMPLETO.zip`.
- Contrato global, logo oficial y prompt maestro leídos antes de modificar código.
- Las 18 carpetas `REFERENCIAS/NN` se trataron como pares inseparables de imagen y ficha técnica.
- No se mezclaron referencias entre módulos.

## Implementación validada

- Rama: `design/orqena-field-os-v2`.
- Railway Review: `orqena-review-continuous` / `orqena-review-web`.
- URL: `https://orqena-review-web-review.up.railway.app`.
- El SHA y el deployment exactos se registran en la entrega final después del último gate remoto.
- PR #63 fue encontrada fusionada externamente antes de la corrección focal del Dashboard; no se abrió otra PR ni se modificó `main` desde este trabajo.
- Staging y Production no se modificaron.

## Evidencia comparada

- 18 capturas de implementación a 1440 px: `artifacts/design-v2/portal-interno/implementation/1440/`.
- 18 tableros fuente-vs-Review en una misma imagen: `artifacts/design-v2/portal-interno/comparisons/1440/`.
- Matriz autenticada de perfiles a 390 px y 1440 px: `artifacts/design-v2/portal-interno/runtime-auth/` y `runtime-auth-remaining/`.

Las comparaciones fueron inspeccionadas para jerarquía, densidad, navegación, composición, tipografía, responsive, estados, controles y fidelidad funcional. Las diferencias frente a las referencias son adaptaciones deliberadas a datos sintéticos veraces, permisos reales y límites de producto; no se inventaron saldos, progreso ni previsiones.

## Cobertura funcional y visual

- Login con el logo oficial y shell autenticado compartido.
- Hoy y Dashboard como pantallas distintas.
- Cliente 360 subordinado a Clientes.
- Trabajo, Presupuestos, Dinero, Documentos, Agenda, Equipo y Configuración.
- Orqena IA persistente en la navegación y ayuda contextual por módulo.
- Confirmación humana, posponer y descartar en las propuestas de IA.
- Navegación móvil, panel contextual móvil y layouts de escritorio.
- Perfiles owner, dirección general, administración, ventas, finanzas, compras, proyecto, supervisión, campo, externo y viewer.
- Aislamiento tenant, permisos, acceso de sólo lectura y límites de plan conservados.

## Iteraciones cerradas

| Hallazgo | Severidad | Corrección |
| --- | --- | --- |
| Etiquetas y enlaces heredados no coincidían con el nuevo mapa | P1 | Normalización de navegación y deep links. |
| Ayuda de IA genérica o no contextual | P1 | Rail contextual gobernado por módulo, rol y acción. |
| Datos económicos podían sugerir magnitudes no confirmadas | P1 | Presentación limitada a información autorizada y fixtures explícitos. |
| Logo oficial fallaba a través del optimizador dinámico | P1 | Recurso oficial servido directamente, sin alterar el activo. |
| Secreto TOTP configurado en entorno no coincidía con el factor activo preservado | P1 operacional | Validación autenticada con el factor activo recuperado de forma efímera y sin mutar la base. |
| El panel móvil y el rail de escritorio compartían el mismo identificador de título al abrirse | P1 | Identificadores independientes y relación `aria-labelledby` inequívoca para el diálogo móvil. |

## Gates

- Typecheck: PASS.
- Build: PASS (93/93 rutas).
- Tests focales de portal, permisos, tenant e IA: PASS.
- CI de aplicación, infraestructura, base crítica, supply chain, CodeQL y contrato de backup: PASS.
- Browser: PASS, incluidos 513 E2E y Lighthouse.
- `/api/health/live`: 200.
- `/api/health/ready`: 200.
- Cero migraciones, semillas o cambios de datos ejecutados en esta entrega.

## Resultado histórico anterior

`historical_pass`

Este resultado quedó superado por las nuevas referencias y reglas de aceptación aportadas posteriormente por el propietario.

## Revalidación focal — Dashboard canónico 2026-07-31

### Alcance y estado

- Referencia visual: `C:\Users\Toniet\AppData\Local\Temp\orqena-dashboard-audit-20260731\03_dashboard.png` (1586 × 992).
- Ficha técnica: `C:\Users\Toniet\AppData\Local\Temp\orqena-dashboard-audit-20260731\03_dashboard_FICHA_TECNICA.png`.
- Implementación Review: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/dashboard-1586x992-final-full.png`.
- Estado: empresa `Rigo Asociados`, perfil OWNER/Enterprise, periodo `1 jul – 31 jul 2026`.
- La diferencia de cifras y nombres respecto a la captura canónica corresponde a los datos sintéticos autorizados de Rigo Asociados; no se sustituyeron por saldos ficticios de la referencia.

### Cinco pasadas de comparación

1. **Estructura:** sidebar, topbar, cabecera, seis KPI, tres gráficos, pipeline, rentabilidad y rail IA aparecen en el orden canónico.
2. **Geometría:** a 1440 px o más se conservan seis KPI en una fila y los tres gráficos en una fila; el breakpoint incorrecto de 1579 px se redujo a 1399 px.
3. **Tipografía y semántica:** se preservaron jerarquía, iconos del sistema, estados, leyendas y contraste; las variaciones monetarias muestran contexto y el margen usa puntos porcentuales (`pp`).
4. **Funcionalidad:** periodo y filtros abren; el KPI de ingresos navega a `/dinero`; los puntos del gráfico muestran tooltip; ocultar/mostrar Orqena IA funciona; el enlace final apunta a `/recomendaciones`.
5. **Responsive y scroll:** validado en 390 × 844, 768 × 1024, 1024 × 992, 1400 × 1000, 1439 × 1000, 1440 × 1000, 1498 × 932, 1579 × 992, 1580 × 992, 1586 × 992 y 1920 × 1080. No hay desbordamiento horizontal. El rail de escritorio usa el desplazamiento del documento, se estira con el workspace y no tiene scroll vertical independiente.

### Evidencia conjunta fuente vs. Review

- Vista completa: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/comparisons/01-full-reference-vs-review.png`.
- Cabecera y KPI: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/comparisons/02-header-kpis-reference-vs-review.png`.
- Gráficos: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/comparisons/03-main-charts-reference-vs-review.png`.
- Pipeline y rentabilidad: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/comparisons/04-main-bottom-reference-vs-review.png`.
- Rail IA: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/comparisons/05-ai-rail-reference-vs-review.png`.
- Métricas: `artifacts/design-v2/portal-interno-pixel-accurate/dashboard/review-8d7d3f3/responsive-metrics.json`.

### Resultado de la revalidación focal

`passed`

## Revalidación ampliada — 2026-08-01

- Referencias confirmadas: 89 imágenes, incluyendo 78 clasificadas y 11 pantallas globales adicionales.
- Gate actual: Cliente 360 — Resumen.
- Validador focal: 55/55.
- Lint focal: PASS.
- Typecheck: PASS.
- Build de Next: PASS; empaquetado standalone preparado por separado.
- Comparación visual remota del nuevo SHA: pendiente.
- Cliente 360 restante, Trabajo/Obra, módulos globales, Orqena IA, auditoría de accionables y responsive: pendientes.

## Revalidación focal — Presupuestos 2026-08-02

### Fuente, implementación y estado

- Referencia visual canónica: `artifacts/design-v2/correction-pr63/presupuestos-master/07_presupuestos-master.png` (1586 × 992).
- Implementación comparada: `artifacts/design-v2/correction-pr63/presupuestos-master/presupuestos-after.png`.
- Comparación conjunta: `artifacts/design-v2/correction-pr63/presupuestos-master/comparison-after.png`.
- Review validada: `https://orqena-review-web-review.up.railway.app/presupuestos`.
- Estado: `Rigo Asociados`, OWNER/Enterprise, presupuesto real visible `P-0247` seleccionado por defecto.
- SHA: `02402032fa27d6a47e4b4d7fa9e2eaa4b52ea0a7`.
- Deployment: `cc4cc94d-196c-4975-8e56-ec76778881a6` (`SUCCESS`, instancia `RUNNING`).

### Iteraciones de comparación

1. **Composición:** se reemplazó la pantalla sobredimensionada por la secuencia de la maestra: cabecera, cuatro KPI, tabla, embudo, detalle y rail IA contextual.
2. **Densidad:** se compactaron KPI, filas, estados, acciones y panel inferior; el área central ocupa 977 px y la vista completa encaja sin scroll horizontal a 1586 × 992.
3. **Datos veraces:** se conservaron los registros permitidos de Rigo Asociados; las cifras no se sustituyeron por las de muestra.
4. **Acciones:** filtros, creación desde cero, plantillas, apertura, edición, seguimiento, duplicado, vista PDF, descarga PDF y detalle completo mantienen destinos reales.
5. **Contexto IA:** el rail muestra el presupuesto seleccionado, margen, importe, partidas y acciones de revisión sin modificar importes ni estados automáticamente.

### Responsive y navegador

- Escritorio medido en navegador: cabecera 56,7 px; KPI 92 px; listado 361,1 px; bloque inferior 330 px; rail IA alineado con la altura de la página.
- Móvil comprobado a 390 × 844: ancho de contenido 375 px, sin desbordamiento horizontal; longitud vertical 3098 px y título visible.
- Menú de acciones de fila abierto y comprobado con cinco destinos y la acción de duplicar.
- Filtros y menú de nuevo presupuesto abiertos y comprobados.
- Consola: cero errores; únicamente el evento informativo de observabilidad.
- Diferencias deliberadas respecto a la muestra: datos reales del entorno Review y shell global preservado. No se inventaron versiones, fechas ni saldos ausentes del modelo.

### Resultado focal

`passed`

Final result: `in_progress`

## Revalidación focal — Orqena IA 2026-08-02

### Fuente y alcance

- Referencias visuales canónicas: `12_orqena_ia_general.png` a `17_orqena_ia_equipo.png`, todas a 1586 × 992.
- Rutas: `/orqena-ia`, `/orqena-ia/comercial`, `/orqena-ia/operaciones`, `/orqena-ia/finanzas`, `/orqena-ia/documentos` y `/orqena-ia/equipo`.
- Las seis referencias se trataron como composiciones distintas sobre una arquitectura compartida; no se reutilizó una tabla genérica como sustituto visual.
- No se copiaron cifras de las capturas. Probabilidad comercial, horas ahorradas, clima, carga porcentual o beneficio atribuible a IA sólo se muestran si existe una fuente persistida; en su ausencia se presentan indicadores reales alternativos o estados honestos.

### Reconstrucción

1. **Densidad:** título de 28 px, tabs de 34 px, KPI de 88 px, valores monetarios truncados de forma segura y tablas de 49 px por fila.
2. **General:** cinco KPI, bandeja de recomendaciones, automatizaciones, cuatro bloques de contexto real y actividad reciente.
3. **Comercial:** pipeline de presupuestos con cliente, trabajo, seguimiento, margen, importe, estado y acción real.
4. **Operaciones:** cola de tareas con trabajo, bloqueo, responsable, vencimiento, prioridad, estado y acción.
5. **Documentos:** revisión con tipo, entidad, extracción, confianza, trabajo vinculado y apertura del documento seleccionado.
6. **Finanzas:** facturas con total, pagado, pendiente, vencimiento, estado y acceso al detalle financiero.
7. **Equipo:** miembros reales, rol, perfil funcional, última actividad, tareas abiertas y detalle conservado en URL.
8. **Contexto:** cada área tiene cuatro grupos de indicadores agregados reales y un rail específico con capacidades, origen, salvaguardas y confirmación humana.

### Accionables y seguridad

- KPI con drill-down únicamente cuando existe ruta real y permiso.
- Recomendaciones conservan `estado=all` al abrir una selección.
- Documentos conservan `documento=<id>` y Equipo `perfil=<membershipId>`.
- Automatizaciones sólo abren su revisión; no se activan desde el workspace.
- Todas las consultas mantienen `companyId`, capabilities y scopes de entidades/tareas.
- Los submenús ya no añaden breadcrumbs que desplacen la geometría respecto a la maestra.

### Responsive y gates locales

- En anchos intermedios las tablas admiten desplazamiento controlado sin cortar celdas.
- A 760 px o menos cada fila se recompone como tarjeta de dos columnas; a 420 px los KPI y contexto pasan a una columna.
- ESLint focal: PASS.
- Typecheck: PASS.
- Contrato estático de seis áreas, tenant, accionables, densidad y rail: 5/5 PASS.
- Captura conjunta fuente-vs-Review, SHA y deployment: pendientes del gate remoto del mismo commit.

Resultado focal actual: `in_progress`.

## Revalidación focal — Equipo 2026-08-02

### Fuente, implementación y estado

- Referencia visual canónica: `C:\Users\Toniet\AppData\Local\Temp\11_equipo.png` (1586 × 992).
- Ruta autenticada: `https://orqena-review-web-review.up.railway.app/equipo`.
- SHA validado inicialmente: `704df13f8403442c2cf2c8a34912cabea5c9a428`.
- Deployment inicial: `151fbf7c-9023-4c8b-a1f9-db5efe3a907a` (`SUCCESS`).
- Empresa y plan observados: `Rigo Asociados`, OWNER/Enterprise, 12 miembros reales del entorno Review.

### Comparación y arquitectura

1. **Composición:** la vista reproduce la secuencia de la maestra: cabecera, filtros por rol, tabla de miembros, paginación, capacidades por rol y rail contextual de Orqena IA.
2. **Geometría:** se eliminó el panel central duplicado que comprimía la tabla; el listado vuelve a ocupar todo el ancho central. Las filas usan 52 px y las tarjetas de capacidades 139 px, con el shell compartido preservado.
3. **Densidad:** se muestran ocho miembros por página y siete capacidades en una fila de escritorio, evitando tarjetas y separaciones sobredimensionadas.
4. **Datos veraces:** no se inventaron fotografías, porcentajes de carga ni disponibilidad. Sin avatar almacenado se muestran iniciales; la carga refleja tareas asignadas directas y secundarias, y el último acceso usa `User.lastLoginAt`.
5. **Contexto IA:** el detalle del miembro seleccionado se trasladó al rail compartido, con área, alcance, estado, último acceso, carga registrada y una acción autorizada real.

### Navegador e interacción

- A 1280 × 720, el shell medido conserva sidebar de 239 px, topbar de 67 px, contenido central de 970 px y cero desbordamiento horizontal. En este ancho intermedio el rail usa su trigger compacto para no comprimir la tabla.
- La primera página muestra 8 de 12 miembros; la página siguiente muestra los 4 restantes y conserva filtro y selección en la URL.
- El filtro `Propietario` devuelve únicamente los dos propietarios reales del entorno.
- Al seleccionar otro miembro, la URL, el detalle del rail y su CTA se actualizan al registro elegido.
- En móvil, las filas pasan a tarjetas legibles mediante el breakpoint compartido; no se crean controles ni datos alternativos.
- La captura automática del navegador conectado no se pudo persistir por timeout de `Page.captureScreenshot`; la comprobación se realizó con DOM accesible, medidas de cajas, rutas, contenido y acciones remotas.

### Gates focales

- `git diff --check`: PASS.
- ESLint focal: PASS.
- Typecheck: PASS.
- Build Railway del mismo SHA: PASS; 93 páginas generadas y healthcheck `/api/health/ready` correcto.
- Cero cambios en reglas de negocio, PostgreSQL, migraciones, Staging o Production.

### Resultado focal

`passed`

Final result: `in_progress`

## Revalidación focal — Documentos y Agenda 2026-08-02

### Documentos

- Referencia visual canónica: `C:\Users\Toniet\AppData\Local\Temp\09_documentos.png` (1586 × 992).
- Ruta autenticada: `https://orqena-review-web-review.up.railway.app/documentos`.
- La vista conserva título, tabs, filtros, orden, lista, visor, OCR, historial y rail contextual en la secuencia de la maestra.
- La rejilla final usa proporciones 32,7 % / 44,7 % / 22,4 % en el navegador conectado; el workspace mide 930 × 822 px y los paneles 704 px de alto a 1280 × 720.
- Los tabs y la selección son reales. Se comprobó Facturas: la URL conservó `tipo=invoice`, el listado pasó a un registro y la selección quedó dentro del filtro.
- Zoom, giro y pantalla completa están conectados también al preview estructurado; la cabecera impide que el visor cubra sus controles en anchos intermedios.
- La relación de presupuesto, factura y gasto se valida contra `companyId`; eliminar exige `documents.delete` y confirmación explícita.
- Plantillas se conserva como submenú de Documentos y la subida permanece disponible desde `+ Nuevo`, sin duplicar controles en la superficie maestra.

Resultado focal: `passed`.

### Agenda

- Referencia visual canónica: `C:\Users\Toniet\AppData\Local\Temp\10_agenda.png` (1586 × 992).
- Ruta autenticada: `https://orqena-review-web-review.up.railway.app/agenda`.
- La vista semanal conserva filtros por personas, obras y tipo; navegación de periodo, Hoy y vistas secundarias; semana de siete días; Agenda de hoy; carga visible, tareas/visitas y próximos vencimientos.
- Geometría medida en navegador a 1280 × 720: calendario 930 × 433 px, rejilla 662 px, Agenda de hoy 256 px y bloque inferior 930 × 310 px. A partir de 1440 px el rail usa 303 px y comparte el desplazamiento del documento.
- Entre 1200 y 1439 px el rail se presenta mediante su trigger de 44 px para no comprimir ni desbordar el contenido; se comprobó apertura, contenido contextual y cierre.
- Se ejerció el filtro de Diego Martín: la URL persistió persona, fecha, obra y tipo, y el retorno a Agenda restauró el estado base.
- La rejilla de 08:00–18:00 ya no fuerza dentro de ella citas anteriores o posteriores; esos elementos siguen disponibles en Agenda de hoy y vistas de lista cuando corresponda.
- Materiales sin fecha y presupuestos sin seguimiento confirmado no reciben horas o vencimientos inventados.
- El alcance `SELECTED_CLIENTS` se resuelve junto al de obras y las referencias de facturas/presupuestos sólo aparecen con su capacidad económica autorizada.

Resultado focal: `passed`.

Final result: `in_progress`

## Revalidación focal — Dinero 2026-08-02

### Fuente y alcance

- Referencia visual canónica: `C:\Users\Toniet\AppData\Local\Temp\08_dinero_tesoreria.png` (1586 × 992).
- Ruta principal: `https://orqena-review-web-review.up.railway.app/dinero`.
- Dinero queda como único destino financiero visible en la navegación. `/tesoreria` se conserva únicamente como detalle funcional de los drill-down existentes; no se presenta como módulo duplicado.
- No se modificaron Dashboard, reglas de negocio, datos, migraciones, PostgreSQL, Staging ni Production.

### Cinco pasadas de comparación

1. **Arquitectura:** título, cinco KPI independientes, flujo proyectado, cuentas por cobrar/pagar, estado de facturación, rentabilidad por obra, vencimientos y rail financiero siguen el orden de la maestra.
2. **Geometría:** tarjetas KPI separadas por 18 px, rejilla principal 1,04/0,96 y bloque inferior 0,8/1,05/1,1; a 1586 × 992 el contenido termina dentro del viewport sin scroll horizontal artificial.
3. **Información:** cuentas incorpora Estado; rentabilidad conserva Obra, Ingresos, Costes, Margen y Margen %, siempre a partir de registros autorizados de la empresa activa.
4. **Interacción:** KPI, pestañas de cobros/pagos, filas, selector de horizonte, informe, análisis de obra, calendario y rail IA enlazan a rutas reales. Las acciones financieras siguen requiriendo sus permisos y confirmaciones existentes.
5. **Responsive:** escritorio, tablet y móvil conservan una sola columna cuando corresponde; los KPI mantienen sus bordes, las cifras de rentabilidad no desaparecen y los CTA tienen área táctil mínima de 44 px.

### Gates focales

- Validador económico: PASS, 30/30.
- Navegación del shell: PASS.
- ESLint focal: PASS.
- Typecheck: PASS.
- Build Railway: PASS en el SHA final registrado por la entrega.
- Tenant y permisos: agregados económicos limitados a `companyId` y alcance `COMPANY`; los perfiles restringidos conservan su superficie acotada.
- Cero migraciones y cero escrituras de datos.

### Resultado focal

`passed`

Final result: `in_progress`
