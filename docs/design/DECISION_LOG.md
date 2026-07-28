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

## D-007 - Captura y permisos

La navegación móvil muestra `Capturar` sólo si existe al menos una acción autorizada. La sheet filtra cada acción por capacidad y nunca invoca cámara o micrófono al abrirse; esos permisos sólo pueden solicitarse después de que la persona elija una acción compatible.

## D-008 - Diagnósticos transitorios

Un error de hidratación aislado no se descarta ni se convierte automáticamente en PASS. La misma superficie se repite en un contexto nuevo; sólo un replay limpio permite conservar el primer evento como observación, y una repetición mantiene el bloqueo.

## D-009 - Binarios sintéticos y trazabilidad

Review no fabrica archivos para aparentar una carga real. Un fixture documental sin `storageKey` muestra metadatos, huella y estado, se identifica como sintético y no ofrece descarga. Las rutas de archivo sólo aparecen cuando existe un binario privado real.

## D-010 - Origen de una salida prevista

Una factura recibida vinculada a una obra conserva ambos contextos, pero la línea de Tesorería enlaza el documento económico que origina la cifra. La obra sigue visible como relación; el cambio es de navegación y no altera el cálculo ni duplica el gasto.

## D-011 - Prioridad explicable

Las alertas y recomendaciones no muestran una puntuación desnuda como jerarquía de decisión. El nivel, la regla y la evidencia son legibles; si existe un desglose numérico derivado, sólo aparece dentro de la explicación trazable y nunca sustituye a la confirmación humana.

## D-012 - Propuesta de Orqena separada del efecto

La conversación puede preparar una propuesta, pero el efecto vive en un panel estructurado y separado. Revisar solo enfoca sus campos; guardar exige confirmación explícita y descartar cancela el recibo pendiente. La auditoría remota nunca usa `Guardar y aplicar`.

## D-013 - Matriz de rutas compilada contra el repositorio

La matriz CSV conserva el contenido entregado y añade toda página especializada presente en `app`. Sus dimensiones de estado y permiso viven en `lib/route-experience-manifest.ts` para que sean tipadas y verificables; el gate D9 recompila ambos inventarios y exige correspondencia uno a uno. Una ruta nueva sin fila o sin regla única rompe el gate.

## D-014 - Abortos de Server Action al cerrar un contexto

Una petición fallida no se ignora por contener `ERR_ABORTED`. El auditor sólo la registra como cierre esperado cuando es un `POST` al mismo origen y lleva la cabecera `Next-Action`; cualquier otro aborto, diagnóstico, respuesta 5xx o llamada externa continúa siendo bloqueante.

## D-015 - Viewport adicional del addendum

La matriz D10 conserva los siete viewports maestros y añade 320 px como cobertura focal obligatoria. La evidencia completa de 390, 430, 768, 1024, 1280, 1440 y 1920 no se sustituye: 320 px la amplía para detectar regresiones móviles estrechas.
