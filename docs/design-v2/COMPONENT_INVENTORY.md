# Orqena Field OS V2 — inventario de componentes

Estado: CURRENT

## Shells y navegación

| Contrato | Implementación actual | Decisión V2 |
| --- | --- | --- |
| AppShell | `components/app-shell.tsx` | conservar protección de servidor |
| AppChrome | `components/app-chrome.tsx` | evolucionar densidad y tokens, sin cambiar permisos |
| Sidebar / Topbar / BottomNav | dentro de `AppChrome` | mantener navegación por perfil y safe areas |
| MarketingShell | `app/marketing-v2` y componentes marketing | consolidar la home canónica en dirección oscura |
| MegaMenu | `MarketingHeader` | añadir interacción hover, foco y click |
| CommandMenu | búsqueda global de `AppChrome` | conservar atajo, foco y alcance |

## Primitivas compartidas

`components/ui-primitives.tsx` ya reúne `PageHeader`, estados empty/error/loading/restricted, skeleton, tabs, tablas responsive, botones, campos, timeline y menús. `components/workspaces.tsx` aporta lista, split view, record y record peek.

Decisión: extender estas autoridades; no crear primitivas V2 duplicadas.

## Patrones operativos en uso

- `components/clients/client-filter-bar.tsx`: smart views y filtros responsive.
- `components/clients/client-split-view.tsx`: lista, preview lateral y cards móviles.
- `components/workspaces.tsx`: layouts de lista, registro y panel contextual.
- `components/capataz-chat.tsx`: conversación, propuestas y confirmación humana.
- `components/purchase-invoices.tsx` y `components/procurement-partners.tsx`: compras y revisión.
- componentes de marketing V2: demo interactiva, recorrido, roles, ROI, confianza y captación.

## Reglas que no pertenecen a UI

No deben trasladarse ni duplicarse en componentes:

- autorización y scope: `lib/commercial/authorization.ts`;
- navegación por capacidades: `lib/commercial/portal-manifest.ts`;
- tenant y contexto: servicios y use-cases de `lib/application`;
- importes y fiscalidad: servicios de billing, finance y documentos;
- idempotencia, outbox y webhooks: servicios de integración;
- IA, límites, redacción y kill switch: `lib/ai` y `lib/application/ai`;
- almacenamiento y R2: `lib/document-storage.ts` y servicios de documentos;
- generación PDF: `lib/document-pdf.ts` y `lib/document-templates.ts`.

## Duplicados controlados

- La web pública conserva componentes históricos usados por rutas secundarias; la home canónica vive en `app/marketing-v2`.
- Las tablas desktop no se encogen en móvil: se usa lista/card responsive.
- Los estados visuales se centralizan en `ui-primitives`; páginas históricas se migran sólo cuando se tocan.
- Los colores legacy continúan como aliases durante la regresión; los nuevos cambios usan exclusivamente tokens `--fos-*`.

## Catálogo V2

Los contratos requeridos por D1 quedan cubiertos por composición de las autoridades anteriores: PageHeader, KPI/MetricStrip, StatCard, tabla responsive, filtros, estados, Drawer/Modal del shell, CommandMenu, RecordPreview/RecordPeek, ActivityTimeline, ActionRail contextual, Insight/AINudge en recomendaciones, notificaciones y banners de demo.

No se declara un componente “nuevo” si sólo cambia el nombre de una primitiva existente.
