# PORTADA Y MEGA MENÚ — ESPECIFICACIÓN CANÓNICA

## Header desktop

- altura visual: 68–74 px;
- fondo `#101814`;
- blur muy ligero;
- borde inferior sutil;
- ancho: 1240–1320 px;
- logo completo Orqena Tech a la izquierda;
- navegación centrada;
- acciones a la derecha.

Orden:

```text
Producto
Soluciones
Precios
Recursos
Empresa
Iniciar sesión
Solicitar demo
```

El logo debe conservar icono y palabra sobre fondos oscuros y claros.

## Mega menú

Eliminar el panel oscuro, estrecho y de dos columnas de la primera versión.

Diseño:

- fondo blanco o marfil;
- texto oscuro;
- ancho 1080–1200 px;
- centrado en viewport;
- 3–4 columnas;
- sombra suave;
- borde fino;
- radio 14–18 px;
- padding amplio;
- iconos sobrios;
- franja inferior con CTA.

### Producto

**Clientes y ventas**

- Clientes
- Seguimientos
- Presupuestos
- Facturas
- Cobros

**Trabajo y obra**

- Obras y trabajos
- Agenda
- Tareas
- Equipo
- Evidencias

**Compras y documentos**

- Proveedores
- Subcontratas
- Facturas recibidas
- OCR documental
- Gastos

**Dinero e inteligencia**

- Tesorería
- Rentabilidad
- Alertas
- Capataz IA
- Automatizaciones

Footer:

```text
Explorar todas las funcionalidades
Solicitar una demo
```

### Soluciones

- Vender y presupuestar
- Ejecutar trabajos
- Controlar costes y margen
- Facturar y cobrar
- Coordinar proveedores
- Ordenar documentos
- Gestionar equipo
- Trabajar con Capataz IA

### Interacción

- hover estable;
- click;
- teclado y foco;
- Escape;
- click exterior;
- `aria-expanded`;
- corredor de hover real;
- transición 150–220 ms;
- sin parpadeo;
- ningún link a fragmentos inexistentes.

### Móvil

Drawer full-height con acordeones, targets de 44 px, scroll interno, CTA sticky, safe areas, cierre claro, bloqueo de body y retorno de foco.

## Hero

Layout desktop:

```text
45 % copy
55 % producto visual
```

Fondo oscuro premium y halo verde discreto.

Eyebrow:

```text
CAPATAZ · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS
```

H1:

```text
Gestiona tu empresa.
Ahorra tiempo.
Toma el control.
```

Resaltar en verde:

```text
Ahorra tiempo. Toma el control.
```

Subcopy:

```text
Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA conectados en un único sistema. Capataz prepara; tú revisas y confirmas.
```

CTA:

```text
Solicitar demo
Ver cómo funciona
```

Microconfianza:

```text
Sin tarjeta
Demo privada de 7 días
Datos aislados
```

Tipografía: desktop 54–62 px; tablet 46–50 px; móvil 38–42 px; máximo 64 px.

## Producto visual

Mostrar un dashboard realista con ingresos, gastos, beneficio/margen, facturas pendientes, gráfico, actividad, recomendación IA y móvil superpuesto.

Prioridad: componentes reales con fixtures sintéticos; después screenshot de Review; después composición HTML/CSS fiel.

Tabs:

```text
Hoy
Clientes
Trabajo
Dinero
Capataz IA
```

## Banda inferior

- Todo conectado
- IA con control humano
- Datos aislados y seguros
- Acceso web y móvil

No usar logos de clientes ficticios.

## Primera sección clara

Título:

```text
Todo lo que necesitas para llevar el control
```

Cards:

- Clientes y ventas
- Presupuestos
- Trabajo y obra
- Costes y compras
- Facturas y cobros
- Documentos y OCR
- Equipo y agenda
- Capataz IA

Debajo: `Así funciona Capataz por dentro`, screenshot real y CTA `Ver demo interactiva`.

## Rutas

Todos los enlaces deben apuntar a rutas o IDs existentes. CTA de demo recomendado:

```text
/contacto?motivo=demo
```

## Archivos concentrados

- `marketing-header.tsx`
- `hero-demo.tsx`
- `landing-sections.tsx`
- `page.module.css`
- `brand-mark.*`
- componentes nuevos bajo `marketing-v2/_components/v2/`

No tocar todavía páginas autenticadas.

## Capturas Puerta 1

Guardar bajo `artifacts/design-v2/correction-pr63/gate-1/`:

1. portada 1440 × 1000;
2. portada 390 × 844;
3. header desktop;
4. Producto abierto;
5. Soluciones abierto;
6. drawer móvil;
7. primera sección clara;
8. comparación con la referencia.

Estado:

`VISUAL_CORRECTION_READY_FOR_OWNER_REVIEW`
