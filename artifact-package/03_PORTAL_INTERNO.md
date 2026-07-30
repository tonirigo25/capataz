# PORTAL INTERNO — ESPECIFICACIÓN CANÓNICA

Ejecutar únicamente después de recibir:

`PORTADA_Y_MENU_APROBADOS`

## Referencia principal

`referencias_visuales/02_PORTAL_INTERNO_CLARO.png`

## 1. Shell global

### Desktop

- sidebar oscura;
- topbar clara;
- canvas `#F5F7F6`;
- cards blancas;
- bordes sutiles;
- verde como acento;
- tipografía compacta;
- búsqueda global;
- selector de empresa;
- acción `+ Nuevo`;
- notificaciones;
- perfil.

### Navegación

Agrupar sin eliminar funcionalidades:

```text
Inicio
Clientes
Trabajo
Ventas
Dinero
Compras
Documentos
Planificación
Capataz IA
Equipo
Configuración
```

La visibilidad depende siempre de rol, capability y scope del servidor.

## 2. Hoy

Debe responder:

`¿Qué requiere mi atención ahora?`

Mostrar:

- 3–5 prioridades;
- agenda próxima;
- bloqueos;
- facturas y cobros;
- tareas;
- recomendaciones IA;
- actividad reciente;
- CTA contextual.

No convertirlo en un catálogo de widgets.

## 3. Dashboard

Mostrar:

- ingresos;
- gastos;
- beneficio/margen;
- facturas pendientes;
- cobros pendientes;
- evolución;
- caja;
- gastos por categoría;
- tareas;
- actividad;
- panel IA lateral.

Cada KPI debe enlazar a su origen y respetar permisos económicos.

## 4. Clientes

Patrón desktop:

```text
smart views
+ listado operativo
+ panel de preview
```

Cada fila debe contestar:

- quién;
- situación;
- próxima acción;
- riesgo;
- trabajo activo;
- importe permitido;
- última actividad.

Mover filtros avanzados a drawer. Mantener búsqueda y vistas principales visibles.

### Móvil

- cards;
- padding mínimo 16 px;
- acción principal clara;
- filtros en bottom sheet;
- sin tablas horizontales;
- importes y estados sin cortar;
- acciones táctiles de 44 px.

## 5. Cliente 360

Estructura:

```text
Resumen
Relación
Operación
Dinero
Archivos
```

Panel contextual:

- contacto;
- datos fiscales;
- responsable;
- estado;
- dirección;
- configuración;
- acciones rápidas.

Resumen:

- próxima acción;
- timeline;
- trabajos;
- presupuestos;
- facturas;
- cobros;
- incidencias;
- recomendación IA.

No eliminar información. Reagruparla.

Eliminar frases residuales, nombres internos y copy que no ayude al usuario.

## 6. Trabajo 360

Cockpit:

- progreso;
- responsable;
- tareas;
- bloqueos;
- margen;
- costes;
- documentos;
- actividad;
- siguiente acción;
- recomendación IA.

## 7. Presupuestos

- vistas por estado;
- editor claro;
- partidas;
- coste/margen;
- preview PDF;
- revisión;
- conversión;
- seguimiento.

No alterar cálculos ni reglas fiscales.

## 8. Dinero y tesorería

- facturas;
- cobros parciales;
- saldo;
- vencimientos;
- promesas;
- estados;
- seguimiento;
- caja;
- previsión.

## 9. Compras y documentos

### Compras

- proveedor;
- subcontrata;
- RC;
- caducidad;
- facturas recibidas;
- gasto único;
- pagos;
- saldo.

### Documentos

Patrón inbox:

- cola;
- preview;
- datos extraídos;
- advertencias;
- propuesta;
- confirmación humana.

## 10. IA visible

Desktop:

- rail lateral;
- insight cards;
- cápsula discreta;
- centro de recomendaciones.

Móvil:

- notificación in-app;
- preview de una línea;
- CTA `Ver recomendación`.

La IA no debe bloquear la tarea principal ni aparecer en cada pantalla sin señal real.

## 11. Responsive

Revisar obligatoriamente:

```text
320
360
375
390
430
768
1024
1440
1920
```

Especial atención a:

- safe areas;
- padding;
- viñetas;
- chips;
- importes;
- acciones;
- drawers;
- modales;
- navegación inferior;
- texto pegado a bordes.

## 12. Copy audit

Revisar ruta por ruta:

- placeholders;
- palabras técnicas visibles;
- frases heredadas;
- títulos duplicados;
- ayuda irrelevante;
- estados no traducidos;
- copy que describe implementación en lugar de valor.

## 13. Capturas Puerta 2

Guardar bajo:

```text
artifacts/design-v2/correction-pr63/gate-2/
```

Capturas:

1. Dashboard 1440;
2. Dashboard 390;
3. Clientes 1440;
4. Clientes 390;
5. Cliente 360 1440;
6. Cliente 360 390;
7. Trabajo 360;
8. Dinero;
9. Documentos;
10. IA lateral;
11. notificación IA móvil;
12. menú móvil.

Estado:

`PORTAL_CORRECTION_READY_FOR_OWNER_REVIEW`
