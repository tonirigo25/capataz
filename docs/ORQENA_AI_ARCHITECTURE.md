# Arquitectura conversacional de Orqena

El motor se divide en conversación, constructor de contexto, router de consultas, resolución de entidades, completitud, planificación, confirmación, ejecución, presentación, memoria y fuentes bajo `lib/orqena`.

Flujo: sesión → empresa → conversación → contexto de ruta → entidades validadas → memoria confirmada → intención → consulta o propuesta → confirmación → ejecución → auditoría. El modelo interpreta y redacta; Prisma, permisos, relaciones, impuestos y ejecución permanecen en servicios deterministas.

El contexto tiene límites explícitos: 12 mensajes, 12 recuerdos, 5 documentos y 10 entidades. Una respuesta operativa puede adjuntar fuente, fecha, fiabilidad y enlace interno. El contenido documental nunca altera permisos ni se interpreta como instrucción del sistema.
## Privacidad conversacional por usuario

Cada conversación nueva exige `companyId` y `ownerUserId`. El repositorio conversacional combina ambos campos en listar, abrir, buscar, mutar mensajes, recuperar tareas y procesar propuestas. Los logs guardan empresa y actor. La memoria originada en chat solo se recupera cuando la conversación pertenece al usuario activo. Orqena no eleva privilegios: las consultas económicas se omiten completamente cuando falta la capability correspondiente.

## PortalManifest y contexto mínimo

`PortalManifest` es el contrato de servidor compartido por shell, Hoy, navegación, búsqueda, Crear, notificaciones, configuración, móvil y Orqena. Describe perfil, paquetes, scopes, autoridades, campos, clases documentales y herramientas disponibles. El constructor del chat solo consulta módulos incluidos: clientes y trabajos se filtran por IDs autorizados; facturas, presupuestos, materiales, agenda, recordatorios, inteligencia y datos societarios no se consultan si falta su capability. Los perfiles limitados reciben consulta dentro de alcance y nunca un volcado completo que después se oculte en la interfaz.
