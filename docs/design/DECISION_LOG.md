# Decisiones de Orqena Field OS

## D-001 - Base canónica

La rama de diseño nace de `21412ff4a500394ea97939fd604374612b44dcda`, último SHA verde de cierre. No nace de `main`, que permanece ligado al SHA productivo anterior.

## D-002 - Frontera de producción

No se fusiona la PR #37 ni se modifica `main` mientras el go/no-go de producción siga pendiente. Review es el único destino de despliegue automático del rediseño.

## D-003 - Fuente visual

`design/design-tokens.json`, Blueprint, Atlas, prototipo y matriz se interpretan conjuntamente. Las maquetas fijan intención y composición; no sustituyen datos reales, permisos ni estados del producto.

## D-004 - Migraciones y dominio

D0-D11 no abrirán Prisma, migraciones, servicios de dominio o Server Actions por motivos visuales. Si una superficie necesita otro shape, se usará un view model sobre servicios existentes.

## D-005 - Evidencia

Una pantalla no queda terminada por semejanza. Debe conservar rutas y capacidades, pasar typecheck/build/regresión, verificarse en los viewports requeridos y desplegarse por SHA exacto en review.

## D-006 - Entradas externas

Safari real, Chrome Android real, dispositivos físicos, NVDA, VoiceOver, firma y autorización comercial se registran como `READY_FOR_EXTERNAL_INPUT`; no detienen los bloques automatizables.

