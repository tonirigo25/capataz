# CAPATAZ — MANUAL MAESTRO DE DISEÑO DE PRODUCTO 2026

**Versión 1.0 · 18 de julio de 2026**

Base examinada: `main` · `ec999c0d5a838a7382344ff3d63476c0a382aa17`

> Fase 4 pausada hasta validar la refundación visual y de experiencia.

# 0. Control del documento

Documento maestro de dirección de producto, experiencia de usuario, interfaz visual y especificación de implementación para Capataz.

| Campo | Valor |
| --- | --- |
| Versión | 1.0 |
| Fecha | 18 de julio de 2026 |
| Producto | Capataz |
| Repositorio | tonirigo25/capataz |
| Base de código examinada | main · ec999c0d5a838a7382344ff3d63476c0a382aa17 |
| Estado de Fase 4 | No iniciada. Queda pausada hasta ejecutar y validar este rediseño. |
| Alcance | Producto, UX, UI, contenido, navegación, responsive, accesibilidad, fotos, notas, IA contextual y contrato para Codex. |
| Fuera de alcance | Railway, producción, despliegues, secretos, migraciones productivas, fiscalidad y cambios remotos. |
| Naturaleza del análisis | Investigación de mercado y análisis estático del repositorio. No sustituye pruebas con usuarios ni auditoría visual en navegador. |

> **Decisión rectora**  
> Capataz tendrá dos superficies iniciales distintas: “Hoy” para actuar y “Dashboard” para comprender el negocio. No se fusionarán ni competirán entre sí.

# 1. Resumen ejecutivo

Capataz ya tiene una amplitud funcional superior a la de un prototipo: CRM, obras, presupuestos, facturación, cobros, compras, proveedores, subcontratas, tesorería, agenda, documentos, automatización e inteligencia. El cuello de botella ya no es funcional. Es de producto: la interfaz expone demasiadas capacidades a la vez y obliga al usuario a interpretar la aplicación antes de trabajar.

La oportunidad no consiste en “hacerla más bonita”. Consiste en convertir una colección de módulos potentes en una experiencia coherente para un autónomo o pequeña empresa de construcción que alterna entre despacho, vehículo y obra, usa el móvil con prisa y necesita confianza inmediata en sus datos.

## Conclusión estratégica

> **Posicionamiento**  
> Capataz será el sistema operativo de trabajo y control de negocio para autónomos y pequeñas empresas de construcción en España: sencillo en superficie, profundo cuando hace falta y acompañado por una IA que explica, prepara y recomienda sin actuar sin permiso.

## Las siete decisiones más importantes

1. Separar Hoy y Dashboard: el primero organiza el día; el segundo analiza números, tendencias, liquidez y rentabilidad.
2. Reducir drásticamente la navegación visible y el número de pestañas. La profundidad seguirá existiendo, pero bajo revelado progresivo.
3. Transformar Cliente en un espacio de relación y Obra en un espacio de ejecución, no en fichas administrativas.
4. Crear una experiencia visual de progreso de obra basada en cronología, fotos, notas, hitos e incidencias.
5. Convertir Capataz IA en una capa contextual discreta, no en una pestaña aislada ni en una sucesión de tarjetas genéricas.
6. Adoptar un sistema visual sobrio: predominio neutro, un color de marca, color semántico reservado y tipografía menos pesada.
7. Implementar por capas y pantallas de referencia antes de rediseñar todo el producto. La coherencia se valida antes de escalar.

## Resultado esperado

Al terminar el programa de rediseño, un usuario nuevo deberá comprender en menos de cinco segundos dónde está, qué está ocurriendo y cuál es la acción principal. Un usuario habitual deberá poder registrar un avance de obra, consultar un cliente, revisar cobros o entender la salud del negocio sin atravesar menús extensos ni leer bloques redundantes.

# 2. Metodología y alcance de investigación

El manual combina cuatro fuentes: estado real del repositorio, productos verticales de construcción, productos de gestión financiera y referentes de diseño de producto. No se copian pantallas. Se extraen patrones transferibles y se adaptan al contexto de Capataz.

## Familias analizadas

| Familia | Referentes principales | Qué se estudia |
| --- | --- | --- |
| Construcción integral | Procore, Buildertrend, Fieldwire, PlanRadar, Raken, Houzz Pro | Resumen de proyecto, captura en campo, progreso, documentos, informes, colaboración y riesgos. |
| Fotografía de obra | CompanyCam | Cronología visual, antes/después, metadatos, galerías y confianza mediante evidencia. |
| Gestión de oficios y servicios | Tradify, Jobber, ServiceTitan, STEL Order, JobTread | Flujo cliente-trabajo-presupuesto-factura, móvil, historial y portal. |
| Negocio y finanzas | Holded, Stripe Dashboard, Billin | Dashboard global, periodos, filtros, ingresos, gastos, flujo de caja, exportación y drill-down. |
| Productividad y diseño | Linear, Notion, Attio, guías de Apple | Jerarquía, densidad, navegación, vistas alternativas, personalización controlada y microinteracciones. |
| Estándares | W3C WCAG 2.2, Comisión Europea, Eurostat, INE | Accesibilidad, contexto de digitalización y perfil estructural del mercado. |

## Criterios de evaluación

- Tiempo hasta comprender la pantalla.
- Claridad de la acción principal.
- Capacidad de trabajar desde móvil y en campo.
- Relación entre datos operativos y económicos.
- Calidad de la trazabilidad visual y documental.
- Tratamiento de densidad, estados, filtros y navegación.
- Capacidad de ofrecer profundidad sin abrumar.
- Confianza, legibilidad y accesibilidad.

> **Límite honesto**  
> Este documento no afirma resultados de usabilidad medidos en Capataz. Las decisiones son hipótesis de producto informadas por mercado y código; deberán validarse con tareas reales y usuarios del sector.

# 3. Mercado y oportunidad

El mercado español de construcción está especialmente alineado con una propuesta simple y móvil. Según el INE, el sector alcanzó 205.204 millones de euros de cifra de negocios en 2024 y el 94,9 % de sus empresas tenía menos de 10 ocupados. La consecuencia de producto es directa: Capataz no debe diseñarse como software para departamentos especializados, sino para personas que concentran venta, administración, obra y cobro en una misma jornada.

Eurostat sitúa todavía a una parte considerable de las pymes europeas en niveles bajos o muy bajos de intensidad digital. La Comisión Europea, en su marco para digitalización de pymes de construcción, destaca procesos internos, financiación, contacto con clientes, cultura y dispositivos móviles. La adopción dependerá más de la facilidad diaria y del valor inmediato que de la cantidad de funciones.

## Implicaciones para Capataz

- El producto debe poder aprenderse usando, sin formación formal extensa.
- La primera experiencia debe demostrar control práctico: qué hacer, qué cobrar, qué obra necesita atención.
- El móvil no es una reducción del escritorio: es la herramienta de captura en obra.
- El escritorio es el entorno de revisión, comparación, preparación documental y análisis global.
- Las funciones avanzadas deben existir sin dominar la navegación.
- La terminología debe ser de oficio y negocio, no de software empresarial.

## Ventana competitiva

Las plataformas grandes resuelven coordinación y control a escala, pero suelen proyectar complejidad. Las herramientas pequeñas resuelven facturación o fotografía, pero fragmentan la información. Capataz puede ocupar el espacio entre ambas: una experiencia ligera que conecta relación con cliente, ejecución de obra, evidencia visual y control económico español.

> **La ventaja no será tener más módulos. Será que todos parezcan una sola forma de trabajar.**

# 4. Benchmark competitivo y lecciones transferibles

La siguiente matriz es cualitativa. No pretende puntuar compañías de forma absoluta; identifica la fortaleza que Capataz debe aprender y el riesgo que debe evitar.

| Producto | Fortaleza observable | Adoptar en Capataz | Evitar |
| --- | --- | --- | --- |
| Procore | Conecta campo, documentación y finanzas de proyecto. | Visibilidad de riesgo y rentabilidad con acceso al dato de origen. | Complejidad de plataforma empresarial para un usuario pequeño. |
| Buildertrend | Resumen de proyecto, daily logs, fotos, archivos y portal cliente. | Registro diario ligero y resumen de proyecto accesible desde móvil. | Replicar demasiadas herramientas al mismo nivel. |
| Fieldwire | Trabajo de campo rápido, tareas con contexto, fotos y planos, incluso offline. | Priorizar velocidad, contexto y acciones concretas en obra. | Convertir la aplicación en un gestor técnico de planos fuera del foco. |
| CompanyCam | Cronología fotográfica, metadatos automáticos y antes/después. | Biblioteca visual de progreso como evidencia y relato. | Separar fotos del resto de decisiones de la obra. |
| PlanRadar | Medios y observaciones ligados a incidencias y documentación. | Relacionar foto, nota, incidencia, fecha, fase y responsable. | Sobrecargar al autónomo con taxonomías rígidas. |
| Raken | Informe diario fácil con notas, fotos, voz y resumen. | Acción “Registrar avance” como flujo central de móvil. | Crear formularios diarios largos u obligatorios. |
| Houzz Pro | Espacio de cliente con comunicación, documentos, fotos, agenda y pagos. | Cliente como relación y visión agregada de sus obras. | Mezclar experiencia interna y portal externo sin permisos claros. |
| Tradify / Jobber | Flujo lineal desde consulta a cobro. | Mantener continuidad cliente → presupuesto → obra → factura → cobro. | Simplificar tanto que se pierda rentabilidad real de obra. |
| Holded | Dashboard financiero global y rentabilidad de proyectos. | Lectura de negocio por periodo y drill-down. | Reproducir la amplitud y densidad de un ERP generalista. |
| Stripe Dashboard | Informes separados, filtros y exportación. | Dashboard analítico reproducible y filtrable. | Usar lenguaje financiero inaccesible sin explicación. |
| Linear | Jerarquía, vistas, agrupación y densidad disciplinada. | Listas limpias, personalización limitada y acciones por teclado. | Imitar estética oscura o patrones de equipos de software. |
| Notion | Misma información en lista, galería, calendario o timeline. | Vistas adecuadas al objeto: tabla para comparar, galería para fotos, timeline para evolución. | Ofrecer personalización ilimitada que rompa consistencia. |

## Síntesis del benchmark

> **Fórmula de producto**  
> Capataz debe unir la rapidez de Fieldwire/Raken, la evidencia visual de CompanyCam, la relación de Houzz Pro, el control financiero de Holded/Stripe y la disciplina visual de Linear; todo reducido al contexto de una microempresa española.

# 5. Diagnóstico del producto actual

El análisis estático de main confirma que Capataz dispone de buena materia prima, pero la presenta con una densidad y una jerarquía insuficientemente selectivas.

| Superficie actual | Evidencia en código | Problema de producto |
| --- | --- | --- |
| Hoy | Prioridades, CTA de IA, tesorería, resumen de flujo, datos incompletos, 6 KPI, agenda, acciones rápidas, actividad, cobros, presupuestos y obras. | Demasiadas respuestas simultáneas. El usuario no sabe qué bloque es realmente el primero. |
| Cliente | 12 pestañas, 6 KPI, 4 hechos de cabecera y 8 acciones principales/secundarias. | La relación se percibe como inventario de datos y no como historia del cliente. |
| Obra | 20 pestañas, 6 KPI en cabecera, acciones, recomendaciones y 11 métricas financieras en resumen. | La obra se fragmenta en módulos y duplica información crítica. |
| Navegación | 6 destinos principales y más de 18 secundarios agrupados en “Más”. | La amplitud funcional es visible incluso cuando no es necesaria. |
| Sistema visual | Inter, superficies blancas, bordes frecuentes, varias tarjetas, font-black, iconos Lucide y tokens legacy. | Demasiado peso tipográfico, exceso de cajas y nombres de tokens que ya no representan el color real. |

## Causas raíz

1. Se ha diseñado cada capacidad como un bloque visible en lugar de priorizar una narrativa por pantalla.
2. Las tarjetas se usan como estructura por defecto, no como una decisión semántica.
3. Las acciones tienen pesos parecidos y compiten entre sí.
4. La IA aparece como destino o módulo, no como ayuda vinculada al momento.
5. La navegación refleja la arquitectura del sistema más que el modelo mental del usuario.
6. Las pantallas de entidad crecen mediante pestañas en lugar de agrupar tareas por intención.

## Qué se conserva

- Lógica de negocio, aislamiento por empresa, fiscalidad, pagos parciales y trazabilidad.
- Flujo cliente → presupuesto → obra → factura → cobro.
- Flujo documento/factura recibida → revisión → gasto → pago → tesorería → coste de obra.
- Datos reales, filtros existentes, estados y confirmaciones humanas.
- Inter como familia tipográfica inicial y Lucide como base iconográfica.
- Responsive y accesibilidad ya iniciados, reforzándolos en vez de descartarlos.

# 6. Posicionamiento y promesa de producto

## Categoría

Capataz no se presentará como ERP, CRM ni gestor de proyectos. Internamente contiene capacidades de esas categorías, pero externamente se define como “control de obras y negocio para profesionales de la construcción”.

## Promesa

> **Saber qué hacer hoy, cómo va cada obra y dónde está tu dinero, sin perder tiempo en administración.**

## Personalidad

| Capataz es | Capataz no es |
| --- | --- |
| Directo y útil | Corporativo o grandilocuente |
| Calmado ante problemas | Alarmista |
| Profesional sin tecnicismos innecesarios | Infantil o informal |
| Visual y basado en evidencia | Decorativo |
| Proactivo con permiso | Autónomo sin control humano |
| Profundo bajo demanda | Denso por defecto |

## Tres sensaciones objetivo

- Control: sé qué está pasando y puedo llegar al origen de cada número.
- Tranquilidad: la aplicación ordena lo importante y no me castiga con ruido.
- Profesionalidad: puedo usarla delante de un cliente, asesor o colaborador con confianza.

# 7. Usuarios, contextos y trabajos principales

El diseño se optimiza primero para autónomos y pequeñas empresas de reformas, construcción e instalaciones. No se supone un equipo administrativo dedicado.

| Contexto | Condición real | Necesidad de diseño |
| --- | --- | --- |
| En obra | Móvil, una mano, luz exterior, guantes o suciedad, interrupciones. | Acciones grandes, captura rápida, pocos campos, confirmación clara, tolerancia a conectividad irregular. |
| En vehículo | Consultas breves entre desplazamientos; no se debe fomentar interacción conduciendo. | Resúmenes legibles y voz solo cuando el usuario está detenido; mensajes de seguridad adecuados. |
| En despacho | Portátil o escritorio, comparación y preparación de documentos. | Tablas, filtros, periodos, edición más densa y análisis global. |
| Con cliente | Necesidad de mostrar progreso y documentos sin exponer notas internas. | Separación de visibilidad, presentación limpia y lenguaje comprensible. |
| Fin de jornada | Memoria imperfecta y necesidad de registrar lo ocurrido. | Flujo “Registrar avance” con voz, fotos, nota y revisión antes de guardar. |

## Trabajos que el producto debe resolver

- Decidir la siguiente acción del día.
- Registrar progreso de una obra en menos de un minuto.
- Encontrar todo lo relacionado con un cliente sin navegar por módulos separados.
- Entender si una obra va bien en plazo, coste, cobro y documentación.
- Saber cuánto se ha facturado, cobrado, gastado y ganado en un periodo.
- Preparar documentos y seguimientos sin perder trazabilidad.
- Conservar evidencia de decisiones, incidencias, fotos y comunicaciones.

# 8. Principios de diseño no negociables

1. Una pantalla, una pregunta principal. Todo bloque debe ayudar a responderla.
2. Una acción primaria por contexto. Las demás se agrupan o bajan de peso.
3. Resumen antes que detalle; detalle antes que configuración.
4. La información crítica se muestra; la administrativa se revela bajo demanda.
5. El color comunica estado o acción, nunca rellena espacio.
6. El número siempre incluye contexto: periodo, fuente o comparación.
7. Las fotos son evidencia vinculada a la obra, no archivos decorativos.
8. Las notas son eventos con autor, fecha, tipo y visibilidad, no textos aislados.
9. La IA explica y prepara. Nunca oculta el dato real ni ejecuta sin confirmación.
10. Móvil captura; escritorio organiza y analiza.
11. La consistencia prima sobre la personalización ilimitada.
12. No se inventa progreso, salud ni recomendaciones sin datos suficientes.

## Prueba de cinco segundos

- [ ] ¿Puedo decir dónde estoy?
- [ ] ¿Puedo decir qué está ocurriendo?
- [ ] ¿Puedo identificar la acción principal?
- [ ] ¿Puedo distinguir un problema real de información secundaria?
- [ ] ¿Puedo anticipar dónde encontrar el detalle?

# 9. Arquitectura de información

## Modelo mental propuesto

La arquitectura se organiza por cuatro preguntas del usuario, no por tablas o dominios internos:

| Pregunta | Superficie | Contenido |
| --- | --- | --- |
| ¿Qué debo hacer? | Hoy | Prioridades, próxima cita, bloqueos y captura rápida. |
| ¿Cómo va el negocio? | Dashboard | Ingresos, cobros, gastos, liquidez, margen, tendencias y rentabilidad. |
| ¿Con quién y dónde trabajo? | Clientes y Obras | Relaciones, ejecución, progreso, archivos, actividad y equipo. |
| ¿Qué documentos y dinero muevo? | Presupuestos, Dinero, Compras | Documentos comerciales, facturas, cobros, proveedores, subcontratas y gastos. |

## Navegación de escritorio

| Orden | Destino | Razón |
| --- | --- | --- |
| 1 | Hoy | Entrada operativa diaria. |
| 2 | Dashboard | Lectura global separada. |
| 3 | Clientes | Relación comercial y contexto. |
| 4 | Obras | Núcleo de ejecución. |
| 5 | Presupuestos | Entrada de venta y conversión. |
| 6 | Dinero | Facturas emitidas, cobros y acceso a tesorería. |
| 7 | Agenda | Tiempo, visitas, hitos y recordatorios. |
| — | Más | Compras, proveedores, subcontratas, documentos, automatización, configuración y áreas menos frecuentes. |

Capataz IA no necesita ocupar dos lugares. Se mantiene como acción persistente en cabecera y como ayuda contextual dentro de entidades. El chat completo sigue accesible, pero no compite con la navegación principal.

## Navegación móvil

| Posición | Destino |
| --- | --- |
| 1 | Hoy |
| 2 | Obras |
| 3 | Crear / registrar |
| 4 | Agenda |
| 5 | Más |

Clientes, Dashboard, Dinero y Presupuestos permanecen a un toque dentro de “Más” y se pueden promover dinámicamente solo mediante accesos recientes, sin alterar la barra base.

## Reglas

- Ninguna ruta bloqueada se mostrará como destino activo.
- Máximo siete enlaces visibles en escritorio antes de “Más”.
- Máximo cinco destinos en barra móvil.
- Los títulos de navegación usarán palabras del usuario, no nombres internos.
- El estado activo se comunica por contraste, forma y texto; no solo color.
- La búsqueda global se abre desde cabecera y atajo, sin convertirse en sección principal.

# 10. Hoy: superficie operativa

## Pregunta que responde

> **¿Qué merece mi atención ahora y cuál es el siguiente paso?**

## Contenido permitido sobre el primer scroll

1. Saludo, fecha y una frase-resumen de una línea.
2. Hasta tres prioridades reales, ordenadas por urgencia e impacto.
3. La próxima cita o visita, solo si existe.
4. Una acción principal: “Registrar avance” o “Hablar con Capataz”, según contexto.
5. Un resumen económico compacto de máximo tres cifras, enlazado al Dashboard, nunca seis tarjetas.

## Contenido secundario

- Agenda de hoy completa.
- Actividad reciente resumida.
- Acciones rápidas, dentro de un menú Crear; no como seis tarjetas permanentes.
- Cobros, presupuestos y obras solo si generan una prioridad o como listas breves debajo del primer scroll.

**Blueprint escritorio**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Buenos días, Antonio                                      18 julio  │
│ Hoy hay 3 asuntos que requieren atención.                            │
│                                                                      │
│ NECESITA TU ATENCIÓN                         [Registrar avance]       │
│  1  Cobro vencido · MURHOTEL          18.500 €        [Revisar]      │
│  2  Material pendiente · Obra Alicante              [Abrir obra]    │
│  3  Visita en 55 min · Reforma Centro               [Ver agenda]    │
│                                                                      │
│ PRÓXIMO                       PULSO DEL NEGOCIO                       │
│ 10:30 · Visita MURHOTEL       42.300 cobrado · 18.500 pendiente     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Agenda de hoy                    Actividad reciente                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Reglas de prioridad

| Nivel | Criterio | Tratamiento |
| --- | --- | --- |
| Crítica | Vencido, riesgo de caja inmediato, documento obligatorio caducado o bloqueo real de obra. | Primera posición, lenguaje directo, color danger limitado. |
| Alta | Acción en 24 horas, visita próxima, presupuesto sin respuesta relevante, material que bloquea. | Posición alta, semántica warning. |
| Normal | Seguimiento útil sin fecha inmediata. | No ocupa el bloque principal salvo ausencia de urgencias. |

## Prohibiciones

- No comenzar con seis KPI iguales.
- No repetir la misma factura en prioridad, KPI y lista de cobros.
- No mostrar secciones vacías largas.
- No usar una gran tarjeta oscura de IA como protagonista fija si no aporta una observación concreta.
- No superar tres prioridades visibles sin interacción.

# 11. Dashboard: superficie analítica global

## Pregunta que responde

> **¿Cómo va mi negocio en este periodo y dónde está el riesgo o la oportunidad?**

El Dashboard no contiene agenda, tareas ni acciones rápidas. Es una vista global, estable y reproducible. Cada cifra debe indicar el periodo y permitir llegar al detalle filtrado.

## Cabecera y filtros

- Título “Dashboard” y subtítulo del periodo.
- Selector: Mes, trimestre, año, personalizado.
- Comparación opcional: periodo anterior o mismo periodo del año anterior.
- Filtro por obra o cliente solo como refinamiento, no como requisito.
- Estado de actualización y fuente cuando un cálculo pueda no ser instantáneo.
- Exportar se ubica en menú secundario.

## Jerarquía de métricas

| Nivel | Métricas | Presentación |
| --- | --- | --- |
| 1. Resultado | Facturado, cobrado, gastos, beneficio/margen. | Una banda de cuatro cifras, sin iconos decorativos, con variación y periodo. |
| 2. Caja | Saldo disponible, pendiente de cobro, pendiente de pago, previsión 30 días. | Bloque propio con advertencias accionables. |
| 3. Tendencia | Ingresos, gastos y cobros por tiempo. | Gráfico de línea o barras con leyenda mínima y tabla accesible. |
| 4. Rentabilidad | Obras con mayor/menor margen, desviación y beneficio. | Tabla ordenable; no galería de tarjetas. |
| 5. Riesgos | Vencidos, concentración por cliente, obras desviadas, documentos críticos. | Lista breve con enlaces al origen. |

**Blueprint Dashboard**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard                 [Este mes ▾] [vs. mes anterior ▾] [•••]   │
│                                                                      │
│ FACTURADO       COBRADO         GASTOS          BENEFICIO            │
│ 72.800 €        54.300 €        39.600 €        14.700 € · 20,2 %   │
│ +8 %            +4 %            +11 %           -2,1 pp             │
│                                                                      │
│ EVOLUCIÓN DEL PERIODO               CAJA A 30 DÍAS                   │
│ [gráfico accesible]                  Saldo / cobros / pagos previstos │
│                                                                      │
│ RENTABILIDAD POR OBRA                RIESGOS                          │
│ Obra · ingreso · coste · margen      3 vencidos · 1 desviación alta  │
└──────────────────────────────────────────────────────────────────────┘
```

## Reglas de gráficos

- Máximo dos gráficos principales por vista inicial.
- No usar donuts para comparar más de cuatro categorías.
- Todo gráfico dispone de resumen textual y tabla de datos accesible.
- Los colores se mantienen consistentes: ingresos, cobros, gastos y previsión no cambian entre gráficos.
- Tooltip con fecha, valor, definición y enlace cuando corresponda.
- Cero datos no se dibujan como progreso positivo.

# 12. Clientes: espacio de relación

## Pregunta que responde

> **¿Cómo va mi relación con este cliente y qué trabajo o dinero está abierto?**

La ficha actual debe dejar de abrir con una cuadrícula de datos fiscales y múltiples KPI. El nombre, la situación actual y las obras dominan. Los datos administrativos permanecen disponibles en un panel de detalles.

## Estructura propuesta

1. Hero de relación: nombre, tipo, estado, última interacción y siguiente acción.
2. Resumen compacto: obras activas, pendiente de cobro, último contacto y una señal relevante.
3. Obras del cliente como bloque visual principal.
4. Actividad cronológica que combina notas, visitas, presupuestos, facturas, cobros y documentos.
5. Archivos y fotos agregados desde sus obras, sin duplicar el archivo original.
6. Datos de contacto y fiscales en “Detalles del cliente” mediante panel lateral o sección final.

## Navegación interna reducida

| Pestaña | Contenido |
| --- | --- |
| Resumen | Estado de relación, obras activas, próximos pasos, dinero abierto y actividad reciente. |
| Obras | Todas las obras con filtros de estado y acceso a su progreso visual. |
| Dinero | Presupuestos, facturas, cobros y rentabilidad agregada. |
| Actividad | Cronología completa, visitas, seguimientos y notas. |
| Archivos | Documentos y biblioteca visual agregada por obra. |

Contactos y datos no necesitan una pestaña principal permanente. Se abren desde “Detalles” o desde acciones contextualizadas.

**Blueprint cliente**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Clientes                                                           │
│ MURHOTEL SL          Cliente activo                     [Nueva obra] │
│ Último contacto hace 4 días · Próxima acción: confirmar acabado      │
│                                                                      │
│ 2 obras activas     18.500 € pendiente     1 asunto importante       │
│                                                                      │
│ [Resumen] [Obras] [Dinero] [Actividad] [Archivos]        [Detalles]  │
│                                                                      │
│ OBRAS                                                                │
│ [Foto] Hotel Murcia      En ejecución · 82 %* · margen 18 %          │
│ [Foto] Reforma recepción Finalizada · ver evolución                  │
│                                                                      │
│ CAPATAZ · La factura F-104 vence hace 6 días.           [Revisar]    │
│                                                                      │
│ ACTIVIDAD RECIENTE                                                   │
│ 18 jul · Nota · Cliente confirma porcelánico                         │
│ 17 jul · 4 fotos · Instalaciones                                     │
└──────────────────────────────────────────────────────────────────────┘
* Solo mostrar porcentaje si existe una fuente de progreso válida.
```

## Tarjeta/fila de obra dentro del cliente

- Miniatura real o fallback neutro; nunca imagen de stock.
- Título y dirección abreviada.
- Estado operativo y fecha/hito siguiente.
- Una sola señal económica: margen o pendiente, según relevancia.
- Último avance con fecha y número de fotos/notas.
- Acción de abrir al pulsar toda la fila; menú de acciones secundarias.

# 13. Obras: espacio de ejecución

## Pregunta que responde

> **¿Cómo va realmente esta obra, qué ocurrió y qué debo hacer después?**

La obra es la superficie central del producto. Su cabecera debe transmitir lugar, cliente, estado y siguiente acción. El registro de avance será la acción primaria. La edición administrativa y el archivo quedan en un menú secundario.

## Navegación interna reducida

| Pestaña | Agrupa |
| --- | --- |
| Resumen | Salud, próxima acción, hitos, riesgos, último avance y resumen económico. |
| Progreso | Cronología, fotos, notas, partes diarios, incidencias y antes/después. |
| Dinero | Presupuestos, facturas, cobros, gastos, materiales, subcontratas y rentabilidad. |
| Planificación | Fechas, agenda, tareas, recordatorios, horas y bloqueos. |
| Archivos | Documentos, planos, contratos, certificados y entregables. |
| Equipo | Contactos, personal, responsables, proveedores y subcontratas relacionados. |

Configuración se mueve al menú de desbordamiento. IA deja de ser pestaña: aparece como insight contextual y acción “Preguntar sobre esta obra”.

## Resumen de obra

| Zona | Contenido exacto |
| --- | --- |
| Hero | Título, cliente enlazado, dirección, estado, prioridad solo si es excepcional, acción Registrar avance. |
| Pulso | Plazo, coste, cobro y documentación con estados “bien / atención / riesgo / sin datos”. |
| Siguiente acción | Una frase y un botón. |
| Último avance | Fecha, autor, texto breve y hasta tres miniaturas. |
| Economía | Presupuestado, coste real, beneficio/margen y pendiente; sin duplicar once cifras. |
| Riesgos | Máximo tres, con causa y origen. |
| Cronología | Cinco eventos recientes y acceso a Progreso. |

**Blueprint obra**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Obras                                                              │
│ Hotel Murcia · MURHOTEL SL                        [Registrar avance] │
│ En ejecución · Calle Mayor 14                       [•••]             │
│                                                                      │
│ PLAZO Bien       COSTE Atención       COBRO Riesgo       DOCS Bien   │
│                                                                      │
│ Siguiente: confirmar entrega de climatización          [Resolver]    │
│                                                                      │
│ [Resumen] [Progreso] [Dinero] [Planificación] [Archivos] [Equipo]    │
│                                                                      │
│ ÚLTIMO AVANCE · Hoy, 09:42                                           │
│ Se termina instalación del ala norte. [foto] [foto] [foto]          │
│                                                                      │
│ ECONOMÍA                      RIESGOS                                 │
│ 100.000 presupuesto           Factura vencida 18.500 €               │
│ 67.200 coste · 22,8 % margen  Material con entrega retrasada         │
└──────────────────────────────────────────────────────────────────────┘
```

# 14. Biblioteca de progreso visual

La biblioteca no será una carpeta de imágenes. Será la evidencia cronológica y visual de la obra. Debe servir para recordar, coordinar, justificar, informar al cliente y construir un antes/después.

## Principio de propiedad

> **Una fuente de verdad**  
> Cada foto pertenece a una obra. La vista del cliente agrega las fotos de sus obras mediante filtros; no crea copias ni galerías paralelas.

## Vistas

| Vista | Uso | Diseño |
| --- | --- | --- |
| Cronología | Entender qué ocurrió y cuándo. | Grupos por día/fase, notas intercaladas, miniaturas y eventos. |
| Galería | Explorar visualmente. | Cuadrícula adaptable, filtros y selección múltiple. |
| Antes / Después | Comparar transformación. | Parejas manuales o sugeridas, deslizador y fecha visible. |
| Incidencias | Localizar pruebas de problemas. | Lista con foto, estado, responsable, fecha y resolución. |
| Compartible | Mostrar progreso al cliente. | Solo elementos marcados como visibles, sin notas internas ni datos económicos. |

## Fases iniciales de obra

- Antes
- Demolición / preparación
- Estructura / albañilería
- Instalaciones
- Acabados
- Final
- Incidencias
- Materiales y entregas
- Trabajos ocultos
- Seguridad / calidad

Las fases son sugeridas, no obligatorias. Deben poder adaptarse por tipo de obra sin convertir la captura en configuración compleja.

## Metadatos

| Dato | Obligatorio | Comportamiento |
| --- | --- | --- |
| Obra | Sí | Heredada del contexto. |
| Fecha/hora de captura | Sí | Automática y editable con trazabilidad. |
| Autor | Sí | Derivado de sesión. |
| Archivo original | Sí | Privado y autorizado por empresa. |
| Título/nota | No | Entrada rápida; voz editable permitida. |
| Fase/categoría | Recomendada | Sugerencia con valor por defecto. |
| Visibilidad | Sí | Interna por defecto; compartir exige acción explícita. |
| Ubicación | No | Solo con permiso y aviso; nunca requisito. |
| Etiquetas | No | Selección rápida y búsqueda. |
| Relación | No | Incidencia, tarea, nota, material o hito. |

## Flujo móvil “Registrar avance”

1. Abrir desde la obra o botón central Crear.
2. Capturar una o varias fotos/vídeos o continuar sin medios.
3. Dictar o escribir qué se hizo, qué falta y si existe bloqueo.
4. Elegir fase mediante chips; se preselecciona la última usada en la obra.
5. Marcar visibilidad: Interno por defecto; Compartible solo por decisión explícita.
6. Revisar resumen y confirmar guardado.
7. Mostrar éxito con acceso a la cronología; nunca enviar al cliente automáticamente.

## Estado actual y ampliación futura

El modelo actual ya contiene fotos de obra con categoría, título, fecha, notas y URL. El rediseño visual puede organizar esos datos en cronología y galería. La subida privada real, miniaturas, vídeo, permisos, etiquetas, geolocalización y enlaces compartibles requieren una fase funcional y de seguridad separada, con almacenamiento unificado y migraciones expresamente autorizadas.

> **Regla para Codex**  
> Durante la fase visual no inventar uploads funcionales ni crear migraciones. Diseñar estados reales para “no configurado”, “subiendo”, “sin conexión”, “error” y “permiso denegado”; activar solo lo soportado por la base actual.

# 15. Notas, partes y actividad

Las notas deben convertirse en eventos legibles y relacionados. Un textarea aislado pierde autoría, intención y contexto.

## Tipos de entrada

| Tipo | Ejemplo | Visibilidad inicial |
| --- | --- | --- |
| Avance diario | Terminada fontanería de planta 1. | Interna, compartible opcionalmente. |
| Decisión | Cliente aprueba porcelánico modelo X. | Interna. |
| Incidencia | Humedad detectada en muro norte. | Interna. |
| Petición de cliente | Solicita toma adicional en recepción. | Interna. |
| Nota interna | Revisar margen antes de aceptar cambio. | Siempre interna. |
| Hito | Finalizada fase de demolición. | Interna, compartible. |

## Compositor

- Campo de texto de una a cinco líneas con placeholder específico.
- Botones adjuntar foto, documento y voz; voz nunca envía automáticamente.
- Selector de tipo visible pero ligero.
- Visibilidad mostrada con texto: “Solo equipo” / “Se puede compartir”.
- Acción Guardar primaria y Cancelar secundaria.
- Edición conserva historial o marca última edición cuando sea relevante.

## Timeline

- Agrupar por fecha, no encerrar cada evento en una tarjeta completa.
- Mostrar autor, hora, tipo y relación.
- Fotos como miniaturas dentro del evento.
- Eventos automáticos menos prominentes que notas humanas.
- Filtros por tipo, persona, fase y visibilidad.
- Acción de fijar solo para decisiones o información crítica.

# 16. Capataz IA como capa contextual

## Rol

Capataz IA no debe ser un bloque de marketing dentro de cada pantalla. Debe aparecer cuando existe una observación verificable, una explicación útil o una tarea que puede preparar.

## Formatos permitidos

| Formato | Cuándo | Ejemplo |
| --- | --- | --- |
| Insight | Dato anómalo o relación significativa. | “El coste de materiales está un 18 % por encima de lo previsto.” |
| Explicación | El usuario pide interpretar un número. | “El margen baja por dos facturas de subcontrata registradas esta semana.” |
| Preparación | Puede redactar o estructurar una acción. | “Preparar recordatorio de cobro” con revisión. |
| Pregunta contextual | Acceso al chat con entidad precargada. | “Preguntar sobre esta obra”. |

## Reglas visuales

- Máximo un insight contextual sobre el primer scroll.
- No usar icono de destellos repetido en todos los bloques.
- Fondo neutro o brand-soft; no una gran tarjeta oscura permanente.
- Mostrar la evidencia o enlace “Ver por qué”.
- Diferenciar “dato”, “inferencia” y “propuesta”.
- Cuando no hay nada útil, no mostrar un placeholder de IA.

## Reglas de comportamiento

- [ ] Nunca ejecuta una escritura sensible sin confirmación server-side.
- [ ] Nunca envía mensajes, facturas o recordatorios automáticamente.
- [ ] Nunca inventa progreso de obra ni porcentajes.
- [ ] Nunca oculta que falta configuración o una fuente de datos.
- [ ] Toda propuesta es editable antes de confirmar.
- [ ] La empresa activa se deriva exclusivamente de la sesión.

# 17. Sistema visual: dirección de arte

## Concepto

> **Precisión de despacho, resistencia de obra.**

La interfaz será sobria, luminosa y táctil. Debe sentirse profesional en una oficina y legible al aire libre. La construcción se expresa mediante estructura, contraste, materiales visuales y fotografía real; no mediante exceso de amarillo, iconos de casco ni texturas temáticas.

## Proporción visual

| Uso | Proporción orientativa |
| --- | --- |
| Neutros y superficies | 85 % |
| Color de marca | 10 % |
| Color semántico y acento | Hasta 5 % |

## Reglas

- Las secciones se separan primero por espacio y tipografía; el borde es secundario.
- Las tarjetas solo existen cuando el objeto tiene identidad o acción propia.
- No utilizar sombras en todas las superficies. Se reservan para overlays, menús, drawers y elementos flotantes.
- No usar gradientes de marca en la aplicación operativa.
- La fotografía real de obra puede aportar personalidad; las imágenes de stock no.
- La cabecera de página no se convierte en una tarjeta gigante.
- El estado activo se marca con contraste y estructura, no con saturación excesiva.

# 18. Tokens de color

Se mantiene el carácter verde/teal actual, pero se normalizan nombres y usos. Los tokens “obra-yellow” actuales deben migrarse semánticamente porque ya representan tonos verdes y generan deuda de comprensión.

| Token | Valor | Uso |
| --- | --- | --- |
| color.bg.canvas | #F6F7F5 | Fondo general. |
| color.bg.subtle | #F0F3F1 | Subsecciones y controles neutros. |
| color.surface | #FFFFFF | Superficie principal. |
| color.border | #DCE3DF | Divisores y controles. |
| color.border.strong | #B8C5BF | Controles activos o límites fuertes. |
| color.text.primary | #17211E | Texto principal. |
| color.text.secondary | #596761 | Texto secundario. |
| color.text.tertiary | #7C8984 | Metadatos no críticos. |
| color.brand.600 | #176A62 | CTA principal, enlace activo y foco de marca. |
| color.brand.700 | #11574F | Hover/pressed. |
| color.brand.100 | #DDF1ED | Fondos suaves de marca. |
| color.accent.500 | #D99A2B | Acento de obra muy limitado, no CTA principal. |
| color.success.600 | #18794E | Confirmación y estado positivo. |
| color.warning.600 | #9A6700 | Atención real. |
| color.danger.600 | #B42318 | Error, vencido y acción destructiva. |
| color.info.600 | #245EA8 | Información neutral. |

## Uso semántico

- Brand no significa “correcto”; success no significa “marca”.
- Warning no se usa para todo lo pendiente; solo para atención.
- Danger no llena tarjetas completas salvo error crítico.
- Los importes positivos y negativos incluyen signo, texto o icono además de color.
- Contraste mínimo WCAG AA; probar estados hover, disabled y foco.

# 19. Tipografía y números

## Familia

Inter se mantiene para la primera iteración por disponibilidad, legibilidad y coste de implementación. No se introducirá una fuente ornamental. La personalidad se construye mediante escala, peso, ritmo y números tabulares.

| Rol | Escritorio | Móvil | Peso | Uso |
| --- | --- | --- | --- | --- |
| Display | 32/38 | 28/34 | 700 | Saludo o cifra excepcional; uso limitado. |
| Título de página | 28/34 | 24/30 | 700 | Nombre de pantalla o entidad. |
| Título sección | 19/26 | 18/24 | 650/700 | Bloques principales. |
| Título objeto | 15/21 | 15/21 | 600/650 | Filas, tarjetas y eventos. |
| Cuerpo | 15/23 | 15/23 | 400/500 | Texto principal. |
| Metadato | 12/17 | 12/17 | 500/600 | Fecha, autor, etiquetas. |
| Importe KPI | 28/32 | 24/29 | 650/700 | Cifras globales. |
| Botón | 14/20 | 14/20 | 600 | Acciones. |

## Reglas

- Reducir el uso de font-black/900. El producto actual usa demasiado peso máximo.
- No escribir todas las etiquetas en mayúsculas; reservarlas para categorías breves.
- Usar font-variant-numeric: tabular-nums para tablas, KPI e importes.
- Alinear cifras comparables a la derecha en tablas.
- Formato español consistente: 18.500,00 € en documentos; 18.500 € en vistas resumidas.
- No truncar importes críticos en móvil; adaptar la composición.

# 20. Espaciado, layout y superficies

## Escala base

| Token | px | Uso |
| --- | --- | --- |
| space.1 | 4 | Separación mínima interna. |
| space.2 | 8 | Icono-texto, chips. |
| space.3 | 12 | Filas compactas. |
| space.4 | 16 | Padding móvil y controles. |
| space.5 | 20 | Tarjetas de objeto. |
| space.6 | 24 | Separación de bloques. |
| space.8 | 32 | Secciones. |
| space.10 | 40 | Grupos mayores. |
| space.12 | 48 | Ritmo de página. |
| space.16 | 64 | Separación excepcional. |

## Anchos

| Contexto | Regla |
| --- | --- |
| Aplicación general | Máximo 1280 px de contenido, centrado. |
| Lectura/formulario | Máximo 760–880 px según complejidad. |
| Sidebar escritorio | 240 px; puede colapsar en una fase posterior si se valida. |
| Padding móvil | 16 px. |
| Padding tablet | 24 px. |
| Padding escritorio | 32 px. |

## Radios y elevación

| Elemento | Radio | Sombra |
| --- | --- | --- |
| Campo/botón | 8 px | Ninguna. |
| Tarjeta de objeto | 12 px | Ninguna o mínima. |
| Bloque destacado | 16 px | Muy sutil si está elevado. |
| Modal/drawer | 16–20 px | Media. |
| Chip/pill | 999 px | Ninguna. |

## Cuándo usar tarjeta

- Sí: una obra, factura, presupuesto, alerta o insight con acción propia.
- No: envolver cada sección, cada métrica o cada párrafo.
- Las listas comparables se presentan como filas o tabla, no como mosaico.
- Los separadores de sección usan espacio, encabezado y divisor discreto.

# 21. Componentes principales

| Componente | Especificación |
| --- | --- |
| App shell | Sidebar 240 px, cabecera 64 px, búsqueda global y acción Capataz; sin duplicar título móvil/escritorio. |
| Page header | Breadcrumb opcional, título, descripción breve, una acción primaria, menú secundario. Sin cuadrícula de KPI dentro. |
| Entity hero | Identidad, estado, contexto, siguiente acción y metadatos esenciales. |
| Metric strip | 3–4 métricas en línea, sin iconos salvo semántica necesaria, con periodo y drill-down. |
| Object row | Fila clicable con título, estado, 2–3 propiedades y acción secundaria en menú. |
| Data table | Cabecera fija cuando aporta, ordenación, columnas configurables limitadas, responsive a filas apiladas. |
| Timeline | Eje cronológico ligero, eventos agrupados por fecha, medios integrados. |
| Media grid | Miniaturas consistentes, relación de aspecto 4:3, selección y filtros. |
| Insight | Título factual, explicación, evidencia y una acción. |
| Status badge | Texto corto, punto o fondo suave; no más de un badge principal por objeto. |
| Empty state | Explica por qué importa y ofrece una acción real; no repite obviedades. |
| Drawer | Edición secundaria, detalles administrativos y filtros complejos. |
| Command/create menu | Agrupa creación transversal y recuerda acciones recientes sin saturar. |

## Botones

- Primario — fondo brand.600 y texto blanco; máximo uno por contexto.
- Secundario — superficie y borde neutro; máximo dos antes de agrupar.
- Ghost — sin contenedor permanente; según necesidad.
- Destructivo — tratamiento danger suave; solo en menú o zona de peligro y con confirmación.

# 22. Formularios

## Principio

Los formularios se organizan por intención y decisión, no por la estructura de la base de datos.

## Reglas exactas

- Una columna hasta 760 px; dos columnas solo para campos cortos y relacionados en escritorio.
- Etiqueta visible encima; placeholder no sustituye etiqueta.
- Campos obligatorios claramente marcados; evitar llenar la pantalla de asteriscos.
- Ayuda debajo solo cuando evita un error real.
- Errores junto al campo y resumen superior cuando hay varios.
- Guardar permanece accesible en móvil mediante barra inferior; respeta safe area.
- Los bloques secundarios se colapsan bajo “Más datos” sin ocultar campos requeridos.
- Confirmar antes de efectos sensibles, no antes de cada edición corriente.
- No usar modal para formularios largos; preferir página o drawer amplio.
- Preservar datos introducidos ante error de servidor.

## Ejemplo de orden: nueva obra

1. Cliente y nombre de obra.
2. Dirección y tipo de trabajo.
3. Fechas previstas.
4. Responsable y prioridad.
5. Datos económicos iniciales.
6. Información adicional y configuración avanzada.

# 23. Listas, filtros y búsqueda

## Elección de vista

| Objeto | Vista predeterminada | Vista alternativa |
| --- | --- | --- |
| Clientes | Lista enriquecida | Segmentos/embudo cuando exista flujo de leads maduro. |
| Obras | Lista o tarjetas horizontales con imagen | Tablero por estado; mapa solo si aporta y existe dato seguro. |
| Presupuestos | Tabla/lista por estado | Kanban opcional. |
| Facturas | Tabla | No necesita galería. |
| Fotos | Galería | Cronología y antes/después. |
| Actividad/notas | Timeline | Lista filtrada. |
| Agenda | Agenda temporal | Semana/mes/lista. |

## Filtros

- Filtros frecuentes como chips o selectores visibles; el resto en panel.
- El estado del filtro se refleja en URL para compartir y volver.
- Mostrar resumen “24 resultados · 3 filtros”.
- Botón “Limpiar” cuando existe algún filtro.
- Guardar vistas solo en listados donde el valor compense complejidad.
- Los KPI enlazan a la lista con filtros reproducibles.

## Búsqueda

- Resultados agrupados por Clientes, Obras, Presupuestos, Facturas y Documentos.
- Mostrar fragmento y contexto, no solo título.
- Soporte de teclado en escritorio y foco correcto.
- En móvil, pantalla completa con historial reciente.
- No mostrar módulos bloqueados como resultados navegables.

# 24. Agenda y tiempo

## Pregunta

> **¿Qué ocurre ahora, después y durante la semana?**

## Jerarquía

- Ahora / siguiente evento.
- Hoy por horas.
- Próximos siete días.
- Vistas Semana, Mes y Lista como herramientas secundarias.
- Hitos de obra, vencimientos y visitas se diferencian por forma/texto, no por una paleta extensa.

## Móvil

La vista inicial móvil es agenda del día, no una cuadrícula mensual comprimida. Cada evento muestra hora, título, relación y estado; abrir revela detalles y acciones.

# 25. Dinero, compras y documentos

## Dinero

“Dinero” es la superficie operativa de facturas y cobros. El Dashboard es la superficie analítica. Tesorería conserva su profundidad, pero debe abrir con saldo, próximos movimientos y previsión antes de escenarios o configuraciones.

## Compras

- Proveedores y subcontratas se muestran como relaciones económicas con historial, obras y documentos.
- Facturas recibidas mantienen separación legal por tipo, pero comparten patrones visuales.
- El saldo pendiente es la cifra principal; pagos e historial se muestran debajo.
- No duplicar gasto y salida de tesorería en la representación visual.
- Caducidades documentales accionables aparecen en relación y en Hoy solo si requieren atención.

## Documentos

- Vista lista para comparar y buscar; miniatura solo cuando aporta.
- Agrupar por entidad, tipo, fecha y estado de revisión.
- Indicar origen y visibilidad.
- La biblioteca de obra integra documentos relacionados, pero no duplica archivos.
- Previsualización en panel lateral o pantalla dedicada según tamaño.

# 26. Estados de interfaz

| Estado | Regla |
| --- | --- |
| Carga | Skeleton con estructura real; no spinner central para páginas completas. |
| Vacío inicial | Explica el valor del módulo y ofrece una primera acción. |
| Vacío filtrado | Indica que no hay coincidencias y permite limpiar filtros. |
| Error recuperable | Mensaje humano, conservar contexto y ofrecer reintento. |
| Error de permiso | Explicar acceso insuficiente sin revelar datos. |
| Offline | Banner discreto, cola visual para capturas y estado de sincronización. |
| Parcial | Mostrar datos disponibles y qué parte no pudo cargarse. |
| Archivado | Banner y acciones limitadas; no confundir con activo. |
| No configurado | Explicar requisito y acceso a configuración autorizada. |
| Éxito | Confirmación breve y siguiente paso; no modal celebratorio. |

# 27. Microinteracciones y movimiento

| Interacción | Duración | Regla |
| --- | --- | --- |
| Hover/focus de control | 100–140 ms | Cambio de fondo/borde, sin desplazamientos grandes. |
| Pressed | 80–120 ms | Respuesta inmediata, escala máxima 0,98 solo en controles táctiles adecuados. |
| Popover/menú | 160–180 ms | Opacidad + desplazamiento 4–8 px. |
| Drawer/modal | 180–220 ms | Entrada clara, foco gestionado. |
| Reordenación/lista | 180–240 ms | Preservar posición y contexto. |
| Éxito guardado | 150–220 ms | Feedback discreto, no confeti. |

- Respetar prefers-reduced-motion.
- No animar métricas al cargar si dificulta la lectura.
- No usar parallax, fondos animados ni transiciones de página teatrales.
- El movimiento debe explicar relación, estado o resultado.

# 28. Responsive y dispositivos

| Ancho de referencia | Comportamiento |
| --- | --- |
| 390 px | Una columna, navegación inferior, acciones sticky, tablas convertidas en filas, galería 2 columnas, sin scroll horizontal global. |
| 768 px | Una o dos columnas según contenido, filtros adaptables, drawers amplios. |
| 1024 px | Sidebar de escritorio, rejillas de dos columnas, tablas completas cuando caben. |
| 1440 px | Contenido máximo 1280 px, aire lateral y comparación de datos sin expandirse indefinidamente. |

## Reglas de transformación

- Las pestañas extensas se convierten en selector o menú “Secciones” en móvil.
- Las tablas financieras conservan título e importe; columnas secundarias pasan a detalle.
- Los filtros pasan a panel inferior y muestran contador.
- La acción primaria permanece visible sin tapar contenido.
- Las imágenes se cargan en tamaños adecuados y con placeholders estables.
- Los targets táctiles serán al menos 44 × 44 px; idealmente 48 px en acciones de campo.

# 29. Accesibilidad

Objetivo mínimo: WCAG 2.2 AA. La accesibilidad se valida durante la implementación, no al final.

- [ ] Contraste de texto normal mínimo 4,5:1 y texto grande 3:1.
- [ ] Targets de interacción conformes a WCAG 2.2; Capataz adopta 44 px como estándar interno.
- [ ] Foco visible y nunca oculto por cabeceras o barras sticky.
- [ ] Orden de teclado coincide con orden visual.
- [ ] Diálogos y drawers capturan/restauran foco y cierran con Escape.
- [ ] Iconos decorativos con aria-hidden; botones de icono con nombre accesible.
- [ ] Estados no dependen solo del color.
- [ ] Gráficos incluyen resumen y tabla accesible.
- [ ] Imágenes de obra permiten texto alternativo o descripción contextual cuando se comparten.
- [ ] Mensajes de error se asocian al campo y se anuncian.
- [ ] Zoom al 200 % sin pérdida de función ni scroll horizontal global.
- [ ] Reduced motion respetado.
- [ ] Fechas, importes y abreviaturas se leen de forma comprensible.

# 30. Voz y contenido

## Tono

| Situación | Forma correcta | Evitar |
| --- | --- | --- |
| Prioridad | “La factura F-104 venció hace 6 días.” | “¡Alerta crítica! Tienes problemas.” |
| Vacío | “Aún no hay fotos. Registra el primer avance para crear la evolución.” | “No data.” |
| Éxito | “Avance guardado en Hotel Murcia.” | “¡Genialísimo! Todo perfecto.” |
| IA | “El margen ha bajado por dos gastos recientes.” | “Creo que quizás podría…” sin evidencia. |
| Error | “No se pudo guardar. Tus datos siguen aquí; vuelve a intentarlo.” | Códigos técnicos sin explicación. |

## Reglas de microcopy

- Verbo de acción específico: Registrar cobro, Crear presupuesto, Añadir nota.
- Evitar “Gestionar”, “Procesar” o “Continuar” cuando hay una acción más precisa.
- Usar frases cortas y voz activa.
- No mostrar nombres internos de estado con guiones bajos.
- Las confirmaciones explican consecuencia y reversibilidad.
- Los importes pendientes indican si están vencidos o no.

# 31. Analítica de producto y validación

## Hipótesis a medir

| Hipótesis | Métrica orientativa |
| --- | --- |
| Hoy facilita actuar. | Tiempo hasta abrir/resolver primera prioridad; tasa de clic en prioridad. |
| Registrar avance es rápido. | Tiempo de flujo, abandono, número de fotos/notas por obra activa. |
| Cliente concentra contexto. | Navegaciones entre módulos por consulta; éxito en encontrar obra/factura. |
| Dashboard se entiende. | Capacidad de responder preguntas de negocio en test moderado. |
| La navegación es más simple. | Tiempo para encontrar destino, errores de ruta, uso de Más/búsqueda. |
| IA contextual aporta valor. | Apertura de evidencia, aceptación/editado/rechazo de propuestas. |

## Pruebas de tareas

1. Encuentra qué debes hacer primero hoy.
2. Registra tres fotos y una nota de avance de una obra.
3. Muestra todas las obras de un cliente y abre la más reciente.
4. Averigua cuánto debe ese cliente y por qué.
5. Compara margen de dos obras en el Dashboard.
6. Encuentra una foto de una incidencia y la nota relacionada.
7. Prepara un recordatorio de cobro sin enviarlo.
8. Completa una acción a 390 px usando solo teclado/touch según dispositivo.

Objetivo de referencia: al menos cinco usuarios representativos antes de cerrar patrones críticos, combinando autónomos, pequeña empresa y una persona administrativa. No se requiere una muestra estadística para detectar problemas graves de usabilidad, pero sí iteración cualitativa rigurosa.

# 32. Programa de implementación

No se debe rediseñar todo en un solo cambio masivo. La dirección se valida en superficies de referencia y después se extiende.

| Etapa | Alcance | Criterio de salida |
| --- | --- | --- |
| PD-0 · Fundamentos | Tokens semánticos, tipografía, superficies, botones, filas, métricas, estados y documentación viva. | Story/reference page o rutas internas muestran todos los estados; no rompe lógica. |
| PD-1 · Shell | Navegación, cabecera, búsqueda, Crear, Hoy y Dashboard separado. | 390/768/1024/1440; prioridades y analítica no se mezclan. |
| PD-2 · Entidades núcleo | Cliente y Obra con nueva arquitectura, reducción de pestañas y IA contextual. | Tareas principales pasan pruebas de comprensión y navegación. |
| PD-3 · Progreso | Cronología, galería, notas y estados sobre datos existentes. | Sin simular upload; diseño preparado para fase funcional segura. |
| PD-4 · Operaciones | Presupuestos, facturas, agenda, proveedores, subcontratas, gastos y documentos. | Patrones coherentes, tablas/listas correctas y filtros URL. |
| PD-5 · Pulido | Accesibilidad, movimiento, estados, rendimiento visual y QA transversal. | Checklist completa, typecheck/build/runner y pruebas visuales. |

## Orden obligatorio

1. Crear rama local desde main y verificar SHA esperado.
2. Implementar fundamentos y dos pantallas de referencia: Hoy y Obra.
3. Revisar visualmente en los cuatro anchos antes de extender.
4. Aplicar a Cliente y Dashboard.
5. Solo entonces migrar el resto de módulos.
6. No iniciar Fase 4 económica funcional hasta validar el rediseño base.

# 33. Contrato de ejecución para Codex

> **Fuente de verdad**  
> Este manual prevalece sobre instrucciones genéricas como “hazlo moderno”, “usa más tarjetas” o “inspírate en Linear”. Codex debe seguir decisiones medibles y justificar cualquier excepción.

## Autonomía permitida

- Corregir CSS, componentes, imports, accesibilidad, responsive y tests locales.
- Crear componentes de presentación y refactors pequeños que reduzcan duplicación.
- Ajustar copy y jerarquía sin alterar lógica fiscal o económica.
- Resolver errores locales y repetir validaciones.

## Debe detenerse

- Migraciones, cambios de Prisma o almacenamiento real de fotos.
- Cambios de fórmula, fiscalidad, numeración o pagos.
- Railway, producción, despliegue, secretos o variables remotas.
- Push, PR, merge o borrado de ramas.
- Decisiones que contradigan la arquitectura de información aprobada.

## Instrucciones concretas

1. No realizar auditoría global repetida. Inspeccionar solo los archivos necesarios para la etapa.
2. No añadir funcionalidades durante el rediseño, salvo componentes de presentación requeridos.
3. No convertir cada sección en tarjeta. Antes de crear una superficie, explicar qué objeto o límite representa.
4. No introducir más pestañas. Reducir y agrupar según este manual.
5. No duplicar una métrica en hero, summary y sección financiera.
6. No mostrar iconos si el texto ya es inequívoco.
7. No usar font-black como peso predeterminado.
8. No cambiar fórmulas ni inventar progresos.
9. Mantener companyId derivado de sesión y revisión humana de IA.
10. Entregar capturas o evidencia visual de 390, 768, 1024 y 1440 para cada pantalla de referencia.

## Prompt de arranque recomendado

**Texto para Codex**

```text
CAPATAZ — PRODUCT DESIGN REFOUNDATION

Usa docs/CAPATAZ_PRODUCT_DESIGN_MANUAL.md como fuente de verdad.
Base: main @ ec999c0d5a838a7382344ff3d63476c0a382aa17.
No iniciar Fase 4. No Railway, producción, despliegue, migraciones, secretos,
push, PR ni merge.

Etapa actual: PD-0 + prototipo de referencia PD-1.

1. Crear rama local codex/product-design-refoundation.
2. Implementar tokens semánticos y componentes base sin alterar lógica.
3. Rediseñar únicamente App Shell, Hoy y un Dashboard global separado.
4. “Hoy” debe priorizar acciones; “Dashboard” debe analizar números por periodo.
5. Validar 390/768/1024/1440, teclado, contraste y reduced motion.
6. Ejecutar typecheck, build, pruebas específicas y runner completo al final.
7. Crear commits locales coherentes. No push.
8. Entregar informe visual y funcional; pedir autorización solo para push.

No amplíes el alcance. No inventes datos. No agregues tarjetas por defecto.
```

# 34. Checklist de aceptación de diseño

## Global

- [ ] La pantalla responde una pregunta principal identificable.
- [ ] Existe una sola acción primaria visible.
- [ ] El primer scroll contiene solo información decisiva.
- [ ] No hay bloques duplicados ni métricas repetidas.
- [ ] La jerarquía funciona sin depender del color.
- [ ] Las secciones se distinguen por ritmo y tipografía.
- [ ] No hay scroll horizontal global a 390 px.
- [ ] Los estados loading/empty/error/partial están diseñados.
- [ ] Todos los enlaces y filtros conservan contexto/URL cuando procede.
- [ ] No se muestran datos inventados ni porcentajes sin fuente.

## Hoy

- [ ] Máximo tres prioridades sobre el primer scroll.
- [ ] Agenda y métricas no compiten con prioridades.
- [ ] El usuario puede actuar desde cada prioridad.
- [ ] El resumen económico tiene máximo tres cifras y enlaza al Dashboard.
- [ ] Crear/acciones rápidas están agrupadas.
- [ ] Una entidad no aparece repetida en tres bloques.

## Dashboard

- [ ] Selector de periodo visible y reproducible.
- [ ] Facturado, cobrado, gastos y beneficio están diferenciados.
- [ ] Caja y previsión no se confunden con beneficio.
- [ ] Gráficos tienen alternativa accesible.
- [ ] Rentabilidad por obra se compara en tabla.
- [ ] No contiene agenda ni tareas diarias.

## Cliente

- [ ] Las obras son visibles desde el resumen.
- [ ] Datos fiscales no dominan la cabecera.
- [ ] Pestañas principales reducidas a cinco.
- [ ] Actividad combina eventos y notas.
- [ ] Archivos/fotos se agregan sin duplicar originales.
- [ ] El siguiente paso de relación está claro.

## Obra

- [ ] Acción primaria Registrar avance.
- [ ] Pestañas reducidas a seis.
- [ ] Plazo, coste, cobro y documentación se entienden de un vistazo.
- [ ] Último avance incluye nota y medios cuando existen.
- [ ] Economía muestra solo cifras esenciales y abre detalle.
- [ ] IA es contextual, no pestaña.
- [ ] Progreso reúne fotos, notas e incidencias cronológicamente.

## Visual y accesibilidad

- [ ] Inter usa pesos 400–700 como norma; 900 es excepcional.
- [ ] Primary CTA usa brand, no warning/accent.
- [ ] Bordes y sombras no envuelven todo.
- [ ] Targets táctiles ≥44 px.
- [ ] Foco visible y no oculto.
- [ ] Contraste AA.
- [ ] Reduced motion.
- [ ] Números tabulares y formato español.
- [ ] Iconos decorativos ocultos a tecnologías de asistencia.
- [ ] Diálogos gestionan foco correctamente.

# 35. Patrones prohibidos

| Patrón | Motivo | Sustitución |
| --- | --- | --- |
| Apilar tarjetas sin jerarquía | Todo parece igualmente importante. | Superficie continua con secciones y filas. |
| Seis KPI por defecto | Fuerza escaneo y diluye el foco. | Banda de 3–4 cifras o acceso al Dashboard. |
| 20 pestañas horizontales | Expone arquitectura interna y falla en móvil. | Seis intenciones principales + menú. |
| Icono en cada etiqueta | Añade ruido sin reducir lectura. | Iconos solo para reconocimiento o estado. |
| Font-black generalizado | Reduce refinamiento y jerarquía. | Pesos 600/700 para títulos. |
| Color decorativo | Compite con estados reales. | Neutros + marca + semántica. |
| IA como tarjeta promocional fija | Se vuelve repetitiva y no contextual. | Insight solo cuando aporta evidencia. |
| Textarea de notas sin contexto | Pierde autoría, tipo y cronología. | Compositor + timeline. |
| Galería de enlaces “Abrir foto” | No permite comprender evolución. | Miniaturas, visor y cronología. |
| Tablas en móvil con scroll horizontal obligatorio | Dificulta campo y comparación. | Filas apiladas y detalle progresivo. |
| Estados vacíos con datos simulados | Daña confianza. | Vacío honesto con acción real. |
| Configuración al mismo nivel que trabajo | Aumenta carga cognitiva. | Menú secundario o Más. |

# 36. Decisiones pendientes y gobernanza

## Pendientes que requieren validación de producto

| Decisión | Recomendación inicial | Validar con |
| --- | --- | --- |
| Nombre Dashboard | Mantener “Dashboard” si el público lo comprende; alternativa “Negocio”. | 5 usuarios y copy test. |
| Progreso porcentual | No mostrar salvo fuente explícita; usar fases/hitos. | Modelo de datos y práctica real. |
| Portal cliente | Diseñar visibilidad ahora; implementar después. | Seguridad, permisos y propuesta comercial. |
| Offline real | Diseñar estados; implementar tras política PWA segura. | Arquitectura y threat model. |
| Geolocalización de fotos | Opcional y desactivada por defecto. | Privacidad, consentimiento y valor real. |
| Vídeos | Preparar UI, no activar sin storage/cuotas. | Coste, formatos y rendimiento. |
| Modo oscuro | No prioritario; luz exterior favorece modo claro. | Demanda de usuarios y accesibilidad. |

## Gobernanza

- Toda nueva pantalla documenta pregunta principal, acción primaria y jerarquía.
- Toda excepción al manual se registra con motivo y fecha.
- Los tokens se nombran semánticamente, nunca por color visual heredado.
- Los patrones se incorporan al manual después de validarse en al menos dos módulos.
- La revisión de producto ocurre antes del push; la revisión técnica después de tests locales.
- El manual se versiona en el repositorio y se actualiza con decisiones, no con cambios cosméticos menores.

# 37. Fuentes y referencias

Selección de fuentes oficiales y documentación primaria consultada. Fecha de consulta: 18 de julio de 2026.

1. INE — Estadística Estructural de Empresas: Sector Construcción, año 2024
https://www.ine.es/dyngs/Prensa/EEESCONS2024.htm

2. Eurostat — Digitalisation in Europe, edición 2026
https://ec.europa.eu/eurostat/web/interactive-publications/digitalisation-2026

3. Comisión Europea — Digitalisation of Construction SMEs
https://digital-construction.ec.europa.eu/handbook

4. Procore — Construction Project Management
https://www.procore.com/project-management

5. Procore — Project Financials
https://www.procore.com/project-financials

6. Procore — Registro diario
https://www.procore.com/es-es/calidad-seguridad/registro-diario

7. Buildertrend — Mobile App
https://buildertrend.com/app/

8. Buildertrend — Daily Logs
https://buildertrend.com/project-management/daily-logs/

9. Buildertrend — Files overview
https://buildertrend.com/help-article/files-overview/

10. Fieldwire — Software de gestión de construcción
https://www.fieldwire.com/es/

11. CompanyCam — Features
https://companycam.com/features/

12. CompanyCam — Before & After
https://help.companycam.com/en/articles/6828372-create-a-before-after-photo

13. Raken — Daily Reports
https://www.rakenapp.com/features/daily-reports

14. Houzz Pro — Client Dashboard
https://www.houzz.com/magazine/how-the-houzz-pro-client-dashboard-works-for-you-stsetivw-vs~181667188

15. Houzz Pro — Files and Photos
https://pro.houzz.com/pro-help/r/how-to-access-and-organize-your-files

16. Holded — Panel de control en tiempo real
https://www.holded.com/es/panel-tiempo-real

17. Holded — Rentabilidad de proyectos
https://help.holded.com/es/articles/6899295-facturacion-costes-y-rentabilidad-de-un-proyecto

18. Stripe — Reporting
https://docs.stripe.com/stripe-reports

19. Linear — Display options
https://linear.app/docs/display-options

20. Notion — Views, filters, sorts & groups
https://www.notion.com/help/views-filters-and-sorts

21. Notion — Timeline view
https://www.notion.com/help/timelines

22. W3C — Web Content Accessibility Guidelines 2.2
https://www.w3.org/TR/WCAG22/

23. W3C — What is new in WCAG 2.2
https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

# 38. Dictamen final

> **Dictamen**  
> CAPATAZ ESTÁ FUNCIONALMENTE PREPARADO PARA UNA REFOUNDACIÓN DE PRODUCTO. LA FASE 4 DEBE PERMANECER PAUSADA HASTA VALIDAR PD-0, HOY, DASHBOARD, CLIENTE Y OBRA.

El diseño futuro no debe intentar aparentar complejidad ni demostrar cuántas funciones existen. Debe revelar la herramienta adecuada en el momento adecuado. La diferencia comercial estará en que un autónomo pueda abrir Capataz y sentir control inmediato, registrar la realidad de la obra con mínima fricción y entender sus números sin convertirse en contable.

La biblioteca de progreso, las notas cronológicas y la relación cliente-obras no son añadidos decorativos. Son la forma en la que Capataz conecta el trabajo físico con la gestión, la evidencia y la confianza. El rediseño debe convertirlas en parte central de la experiencia, respetando los límites técnicos y de seguridad de la base actual.

> **Capataz no debe parecer un ERP más sencillo. Debe parecer que alguien que conoce la obra ha ordenado el negocio por ti.**
