# Orqena Field OS V2 — registro de implementación

## Corrección visual PR #63 — Gate 1, revisión 2

- La portada pública se redujo a la secuencia ejecutiva acordada: header, hero,
  banda breve, capacidades, flujos, demo guiada, CTA y footer.
- El hero contiene cinco superficies completas y diferenciadas para Hoy,
  Clientes, Trabajo, Dinero y Orqena IA; cada una sustituye métricas, gráfico o
  visual funcional, estados, acciones, insight y vista móvil.
- Se añadieron flujos interactivos de venta, operación y control documental.
- La demo pública se compactó a tres minutos, con escenario, señal visual,
  navegación sin desbordamiento, revisión y confirmación humana.
- Se rehízo el cierre en escritorio y móvil.
- Evidencia nueva:
  `artifacts/design-v2/correction-pr63/gate-1-revision-2/`.
- El Gate 1 anterior queda superseded por esta revisión. La PR sigue Draft y no
  existe autorización de merge o Production.

> **ESTADO ACTUAL — CORRECCIÓN PR #63, GATE 1.** La portada y los megamenús de
> la implementación anterior fueron rechazados visualmente por el propietario.
> Todo el registro D0–D13 que sigue se conserva como evidencia histórica y no
> constituye aprobación visual ni autorización para Production.

## Corrección visual PR #63 — Gate 1

- Fuente canónica: cuatro PNG del paquete
  `ORQENA_PR63_CORRECCION_COMPLETA_2026-07-30`.
- Alcance: header, logo, megamenús Producto/Soluciones, menú móvil, hero,
  mockup del producto, banda inferior, primera sección clara, enlaces y CTA.
- Seis observaciones técnicas de la PR corregidas con tests focales.
- Ocho capturas en `artifacts/design-v2/correction-pr63/gate-1/`.
- Portal autenticado, reglas de negocio, Prisma, migraciones, providers,
  `main` y Production: sin cambios.
- Estado: pendiente de aprobación visual explícita del propietario mediante
  `PORTADA_Y_MENU_APROBADOS`.

## Registro histórico / superseded

Fecha de ejecución: 2026-07-30  
Rama: `design/orqena-field-os-v2`  
Base de código: `c08ff92f30b8464302ff90760b2c3d28d57fc206`  
Base de Review: `2076a52a7bab4dcc077f0ef63943e9da1e846c24`

## Alcance y límites

El trabajo aplica la dirección visual aprobada del paquete
`capataz-b7d00d2ee15b5ed0bc0048cce95ab1a0ca241980.zip` sin cambiar reglas de
negocio. El paquete se verificó con SHA-256
`2A5015EBDE4AE0DB14AB956BBE7B7B9E0FDBEA5A40ACC2330CDE64F6579A600B`.

Se conservaron:

- aislamiento por empresa;
- permisos y superficies por rol;
- fiscalidad, importes, saldos y numeración;
- proveedores y sus gates;
- idempotencia, outbox y auditoría;
- confirmación humana antes de acciones con efectos;
- flags comerciales y de indexación apagados.

No se modificaron `schema.prisma` ni las migraciones. No se creó ningún
environment, servicio, PostgreSQL o volumen.

## Ejecución D0–D13

| Fase | Resultado | Evidencia principal |
|---|---|---|
| D0 | PASS | Inventarios de rutas, componentes y deuda visual; baseline remoto de 12 casos |
| D1 | PASS | Tokens V2 versionados y variables CSS sincronizadas |
| D2 | PASS | Web pública oscura, hero de producto, navegación y megamenús accesibles |
| D3 | PASS | Shell global, jerarquía y navegación conservados por rol |
| D4 | PASS | Inicio operativo y patrones de dashboard ya conectados a datos reales |
| D5 | PASS | Clientes, CRM, presupuestos y ventas: 19 contratos |
| D6 | PASS | Compras, costes y proveedores: 20 contratos |
| D7 | PASS | Trabajo, obra, documentos y operación: 21 contratos |
| D8 | PASS | Administración, dinero, configuración y auditoría: 22 contratos |
| D9 | PASS | 94 rutas verificadas; cero rutas huérfanas |
| D10 | PASS | Matrices pública y autenticada en Railway Review |
| D11 | PASS | IA, documentos, correo y automatización conservan gates y confirmación |
| D12 | PASS | Responsive, accesibilidad, noindex, PWA y estados preservados |
| D13 | PASS_WITH_EXTERNAL_INPUT | Evidencia automatizada cerrada; dispositivo y validación humana quedan fuera |

## Cambios de presentación

- Se actualizó la identidad visual a tinta oscura, superficies claras y acento
  verde, con escala tipográfica y espacios comunes.
- La portada canónica ahora muestra el producto y su ciclo operativo desde el
  primer viewport.
- Se añadieron megamenús de Producto y Soluciones con teclado, `Escape`, clic
  exterior y navegación móvil.
- Se reutilizaron los componentes, rutas, formularios y autoridades de servidor
  existentes. No se creó un producto paralelo.
- La ruta interna que atiende el hostname público usa la misma portada V2 y
  mantiene accesible el endpoint protegido de solicitud de demo.
- La identidad de release admite `APP_RELEASE_SHA` para que los despliegues
  manuales de Review no declaren el SHA histórico inyectado por Railway.

## Correcciones de validadores

- El validador del sistema proactivo apunta a la autoridad refactorizada actual.
- El lector de documentos reconoce la ruta de cuarentena tenant-scoped actual.
- La matriz visual permite registrar una diferencia intencionada contra el
  baseline anterior sin convertir el rediseño aprobado en una regresión.

## Railway Review conservado

- Proyecto: `orqena-review-continuous`
- Environment: `review`
- Servicio web: `orqena-review-web`
- PostgreSQL: `Postgres`
- Dominio: `https://orqena-review-web-review.up.railway.app`
- Deployment anterior: `efc72863-5e79-4bde-ba0c-b20b04b8bcbb`
- Primer deployment V2: `645f961c-39b0-4a31-8c6e-bb8644358f7e`
- Deployment canónico V2: `f64b8b33-e45a-407b-b28a-06991d663b34`

El environment, el dominio, PostgreSQL, los volúmenes y los datos sintéticos
existentes se conservaron. El Review permanece independiente de Staging y
Production.

## Base de datos

La comprobación de solo lectura registró 45 migraciones aplicadas, 0 pendientes
y head `20260729160000_add_billing_customer_company_links`. No se ejecutó una
migración nueva ni se modificaron datos para el rediseño.

## Rollback

El rollback de código consiste en retirar la rama/PR o redeplegar en el mismo
servicio el SHA anterior `2076a52a7bab4dcc077f0ef63943e9da1e846c24`. No
requiere rollback de base de datos, volúmenes, DNS o proveedores.
