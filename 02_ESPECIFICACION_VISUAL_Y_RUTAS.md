# ESPECIFICACIÓN VISUAL Y DE RUTAS

## Concepto aprobado

```text
Embat:
orden + navegación + finanzas + inteligencia operativa

Holded:
producto visible + facilidad + interacción + onboarding

Orqena Field OS V2:
potencia vertical + calma visual + acción siguiente + control humano
```

## Dirección visual

### Web pública

- fondo oscuro sofisticado;
- verde como acento;
- mockup real del producto;
- tipografía contenida;
- header compacto;
- mega menú accesible;
- CTA claro;
- scroll nativo;
- secciones limpias;
- producto visible pronto.

### Portal

- sidebar oscura;
- contenido claro;
- cards blancas;
- gráficos simples;
- verde para éxito/acción;
- ámbar/rojo para excepción;
- búsqueda y `+ Nuevo`;
- acciones rápidas;
- IA lateral/contextual;
- información jerarquizada.

## No hacer

- texto hero desproporcionado;
- exceso de degradados;
- cards sin jerarquía;
- feature wall;
- dashboards sin prioridades;
- IA como burbuja vacía;
- scroll secuestrado;
- tablas desktop encogidas en móvil;
- texto pegado al borde;
- logos/testimonios/cifras inventadas.

## Tokens recomendados

```text
Ink: #101814
Ink 2: #17211B
Dark surface: #111821
Dark surface 2: #17212C
Canvas: #F5F7F6
Paper: #FFFFFF
Line: #D8DED7
Muted: #66736C
Green: #20B862
Green dark: #168C55
Green soft: #E7F7EE
Blue: #2D5DE0
Amber: #D58A1F
Red: #C8453B
```

## Tipografía

- Inter, Geist o sistema equivalente;
- hero desktop 56–64 px;
- hero móvil 38–42 px;
- H2 36–42 px;
- H3 24–28 px;
- body 16–18 px;
- labels 12–13 px;
- line-height de texto 1,45–1,65.

## Patrones de página

### Work queue

Para Hoy, alertas, seguimientos y cobros.

### Lista + preview

Para clientes, trabajos, proveedores, subcontratas y presupuestos.

### Record + action rail

Para Cliente 360, Trabajo 360, factura y proveedor.

### Editor + live preview

Para presupuesto, factura, plantillas y emails.

### Inbox + review

Para documentos, OCR y facturas recibidas.

### Analytical canvas

Para Dashboard, tesorería, margen y plataforma.

### Guided setup

Para onboarding y configuración.

## Rutas y diseño objetivo

| Ruta | Objetivo | Desktop | Móvil | Acción principal |
|---|---|---|---|---|
| `/` | Entender valor | Hero split + demo | Stack con demo táctil | Solicitar demo |
| `/producto` | Ver capacidades | Outcomes + screenshots | Cards | Explorar flujo |
| `/funcionalidades` | Buscar solución | Módulos agrupados | Accordion/cards | Ver detalle |
| `/demo` | Probar sin riesgo | Recorrido guiado | Steps | Solicitar demo privada |
| `/contacto` | Captar lead | Form + contexto | Una columna | Enviar |
| `/precios` | Entender planes | Comparador | Cards | Acceso anticipado |
| `/login` | Entrar | Card compacta | Full width | Iniciar sesión |
| `/hoy` | Prioridades | Queue + agenda + IA | Cards | Abrir acción |
| `/dashboard` | Analizar | KPIs + gráficos | Resumen apilado | Abrir origen |
| `/clientes` | Operar cartera | Smart views + split pane | Cards | Abrir/actuar |
| `/clientes/[id]` | Cliente 360 | Resumen + action rail | Sections | Siguiente acción |
| `/obras` | Operar trabajos | Lista + preview | Cards | Registrar avance |
| `/obras/[id]` | Trabajo 360 | Cockpit + rail | Sections | Registrar avance |
| `/presupuestos` | Gestionar pipeline | Tabla/lista | Cards | Crear presupuesto |
| `/presupuestos/[id]` | Editar | Editor + PDF | Steps | Revisar |
| `/dinero` | Cobrar/pagar | Action queue | Cards | Registrar pago |
| `/tesoreria` | Caja | Calendario + previsión | Timeline | Registrar movimiento |
| `/proveedores` | Compras | Lista + preview | Cards | Nuevo proveedor |
| `/subcontratas` | Compliance | Lista + rail | Cards | Pedir documento |
| `/documentos` | Triage | 3 panes | Cola + detalle | Subir/revisar |
| `/agenda` | Planificar | Semana | Lista día | Nueva visita |
| `/tareas` | Ejecutar | Lista/kanban ligero | Mías | Nueva tarea |
| `/capataz` | Asistencia | Historial + chat + propuesta | Chat + cards | Confirmar borrador |
| `/equipo` | Permisos | Lista + preview | Cards | Invitar |
| `/configuracion` | Administrar | Sidebar + secciones | Sections | Guardar |
| `/plataforma` | Operar SaaS | Control center | Resumen | Revisar solicitud |

## Clientes

### Lista

Vistas inteligentes:

- necesitan acción;
- activos;
- todos;
- sin actividad;
- pendiente de cobro;
- datos incompletos.

Cada fila debe mostrar:

- cliente;
- estado;
- próxima acción;
- última actividad;
- trabajo activo;
- importe/riesgo permitido;
- acciones.

### Cliente 360

Agrupar en:

1. Resumen;
2. Relación;
3. Operación;
4. Dinero;
5. Archivos.

Datos fiscales y secundarios en panel contextual, no en el primer plano.

## Responsive

- padding lateral mínimo 16 px;
- safe areas iOS;
- touch target 44 px;
- importes sin cortar;
- títulos con wrap controlado;
- acciones principales sticky cuando proceda;
- tablas convertidas a cards o disclosure;
- filtros en drawer/sheet.

## Logo

Crear versiones light, dark y monocroma. El icono completo debe verse sobre negro y verde. Preparar favicon, email y PDF.
