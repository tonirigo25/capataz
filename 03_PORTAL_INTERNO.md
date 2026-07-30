# PORTAL INTERNO — ESPECIFICACIÓN CANÓNICA

Ejecutar sólo después de `PORTADA_Y_MENU_APROBADOS`.

Referencia principal: `referencias_visuales/02_PORTAL_INTERNO_CLARO.png`.

## Shell

- sidebar oscura;
- topbar clara;
- canvas `#F5F7F6`;
- cards blancas;
- bordes sutiles;
- verde como acento;
- tipografía compacta;
- búsqueda global;
- selector de empresa;
- `+ Nuevo`;
- notificaciones y perfil.

Navegación agrupada:

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

## Hoy

Responder `¿Qué requiere mi atención ahora?` con 3–5 prioridades, agenda, bloqueos, facturas/cobros, tareas, IA, actividad y CTA contextual.

## Dashboard

Ingresos, gastos, beneficio/margen, facturas y cobros pendientes, evolución, caja, gastos por categoría, tareas, actividad y panel IA lateral. Cada KPI enlaza a su origen y respeta permisos.

## Clientes

Desktop:

```text
smart views + listado operativo + panel de preview
```

Cada fila muestra cliente, situación, próxima acción, riesgo, trabajo, importe permitido y última actividad.

Móvil: cards, padding mínimo 16 px, filtros en sheet, sin tablas horizontales, targets de 44 px.

## Cliente 360

```text
Resumen
Relación
Operación
Dinero
Archivos
```

Panel contextual para contacto, fiscalidad, responsable, estado, dirección, configuración y acciones.

Resumen con próxima acción, timeline, trabajos, presupuestos, facturas, cobros, incidencias y recomendación IA.

No eliminar datos; reagruparlos. Eliminar copy residual y nombres internos.

## Trabajo 360

Progreso, responsable, tareas, bloqueos, margen, costes, documentos, actividad, siguiente acción e IA.

## Presupuestos

Vistas por estado, editor claro, partidas, coste/margen, preview PDF, revisión, conversión y seguimiento. No alterar cálculos.

## Dinero y tesorería

Facturas, cobros parciales, saldo, vencimientos, promesas, estados, seguimiento, caja y previsión.

## Compras y documentos

Compras: proveedor, subcontrata, RC, caducidad, facturas recibidas, gasto único, pagos y saldo.

Documentos: cola, preview, extracción, advertencias, propuesta y confirmación humana.

## IA visual

Desktop: rail lateral, insight cards, cápsula discreta y centro de recomendaciones.

Móvil: notificación in-app, preview de una línea y CTA.

## Responsive

Revisar 320, 360, 375, 390, 430, 768, 1024, 1440 y 1920 px. Especial atención a safe areas, paddings, viñetas, chips, importes, acciones, drawers, modales y texto pegado al borde.

## Copy audit

Eliminar placeholders, estados sin traducir, frases heredadas, títulos duplicados y textos que describan implementación en lugar de valor.

## Capturas Puerta 2

Guardar bajo `artifacts/design-v2/correction-pr63/gate-2/`:

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
