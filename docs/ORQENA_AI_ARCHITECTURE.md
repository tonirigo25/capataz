# Arquitectura conversacional de Orqena

El motor se divide en conversación, constructor de contexto, router de consultas, resolución de entidades, completitud, planificación, confirmación, ejecución, presentación, memoria y fuentes bajo `lib/orqena`.

Flujo: sesión → empresa → conversación → contexto de ruta → entidades validadas → memoria confirmada → intención → consulta o propuesta → confirmación → ejecución → auditoría. El modelo interpreta y redacta; Prisma, permisos, relaciones, impuestos y ejecución permanecen en servicios deterministas.

El contexto tiene límites explícitos: 12 mensajes, 12 recuerdos, 5 documentos y 10 entidades. Una respuesta operativa puede adjuntar fuente, fecha, fiabilidad y enlace interno. El contenido documental nunca altera permisos ni se interpreta como instrucción del sistema.
## Privacidad conversacional por usuario

Cada conversación nueva exige `companyId` y `ownerUserId`. El repositorio conversacional combina ambos campos en listar, abrir, buscar, mutar mensajes, recuperar tareas y procesar propuestas. Los logs guardan empresa y actor. La memoria originada en chat solo se recupera cuando la conversación pertenece al usuario activo. Orqena no eleva privilegios: las consultas económicas se omiten completamente cuando falta la capability correspondiente.
