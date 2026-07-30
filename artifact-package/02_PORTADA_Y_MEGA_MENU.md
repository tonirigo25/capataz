# PORTADA Y MEGA MENÚ — ESPECIFICACIÓN CANÓNICA

## Objetivo

La portada y navegación deben reproducir la dirección de las referencias aprobadas, no limitarse a cambiar tokens, copy o colores sobre la composición anterior.

## 1. Header desktop

### Composición

- altura visual: 68–74 px;
- fondo `#101814`;
- blur muy ligero;
- borde inferior sutil;
- ancho de contenido: 1240–1320 px;
- logo Orqena Tech completo y visible a la izquierda;
- navegación centrada;
- acciones a la derecha.

### Orden

```text
Producto
Soluciones
Precios
Recursos
Empresa
Iniciar sesión
Solicitar demo
```

### Logo

Comprobar:

- versión clara;
- versión oscura;
- lockup horizontal;
- icono aislado;
- favicon;
- email y PDF.

El icono no puede desaparecer sobre fondos oscuros.

## 2. Mega menú

Eliminar el desplegable oscuro, estrecho y de dos columnas de la primera implementación.

### Apariencia

- fondo blanco o marfil muy claro;
- texto oscuro;
- ancho: 1080–1200 px;
- centrado respecto al viewport;
- 3–4 columnas;
- sombra suave;
- borde fino;
- radio 14–18 px;
- padding amplio;
- iconos pequeños y sobrios;
- franja inferior con CTA.

### Producto

#### Clientes y ventas

- Clientes
- Seguimientos
- Presupuestos
- Facturas
- Cobros

#### Trabajo y obra

- Obras y trabajos
- Agenda
- Tareas
- Equipo
- Evidencias

#### Compras y documentos

- Proveedores
- Subcontratas
- Facturas recibidas
- OCR documental
- Gastos

#### Dinero e inteligencia

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

Agrupar por resultado:

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
- teclado;
- foco;
- Escape;
- click exterior;
- `aria-expanded`;
- corredor de hover real;
- transición 150–220 ms;
- no parpadeo;
- no enlaces a fragmentos inexistentes.

### Móvil

No reutilizar el mega menú desktop.

Crear drawer full-height:

- acordeones Producto y Soluciones;
- targets mínimos 44 px;
- scroll interno;
- CTA sticky inferior;
- cierre claro;
- safe areas;
- bloqueo del scroll de body;
- retorno de foco.

## 3. Hero

### Layout desktop

```text
45 % copy
55 % producto visual
```

### Fondo

- oscuro premium;
- halo verde discreto;
- sin degradados excesivos;
- sin grid visual dominante.

### Copy aprobado

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

No decir “prueba gratuita”.

### Tipografía

- desktop: 54–62 px;
- tablet: 46–50 px;
- móvil: 38–42 px;
- máximo absoluto: 64 px;
- line-height: 0.98–1.05.

## 4. Producto visual del hero

No reutilizar un shell genérico si no reproduce la referencia.

Debe mostrar:

- dashboard realista de Capataz;
- ingresos;
- gastos;
- beneficio/margen;
- facturas pendientes;
- gráfico;
- actividad;
- recomendación IA;
- mockup móvil superpuesto.

Prioridad:

1. componentes reales con fixtures sintéticos;
2. screenshot real de Review;
3. composición HTML/CSS fiel al producto.

Tabs accesibles:

```text
Hoy
Clientes
Trabajo
Dinero
Capataz IA
```

El cambio de tab no debe consultar datos empresariales reales.

## 5. Banda inferior del hero

Cuatro beneficios:

1. Todo conectado
2. IA con control humano
3. Datos aislados y seguros
4. Acceso web y móvil

Cada elemento incluye icono, título y una sola línea.

No mostrar logos de clientes ficticios.

## 6. Primera sección clara

Título:

```text
Todo lo que necesitas para llevar el control
```

Grid de ocho cards:

- Clientes y ventas
- Presupuestos
- Trabajo y obra
- Costes y compras
- Facturas y cobros
- Documentos y OCR
- Equipo y agenda
- Capataz IA

Cada card:

- icono;
- título;
- máximo dos líneas;
- hover discreto;
- enlace real;
- espaciado generoso.

Debajo:

```text
Así funciona Capataz por dentro
```

Con screenshot real y CTA `Ver demo interactiva`.

## 7. Rutas y CTA

Todos los links deben apuntar a rutas o IDs existentes.

CTA de solicitud recomendado:

```text
/contacto?motivo=demo
```

Si se utiliza una ancla, debe existir y probarse en la misma página de destino.

## 8. Archivos concentrados

Modificar principalmente:

- `app/marketing-v2/_components/marketing-header.tsx`
- `app/marketing-v2/_components/hero-demo.tsx`
- `app/marketing-v2/_components/landing-sections.tsx`
- `app/marketing-v2/page.module.css`
- `components/brand/brand-mark.*`
- componentes nuevos bajo `app/marketing-v2/_components/v2/`

No tocar todavía las páginas autenticadas.

## 9. Capturas de la Puerta 1

Guardar bajo:

```text
artifacts/design-v2/correction-pr63/gate-1/
```

Capturas obligatorias:

1. portada 1440 × 1000;
2. portada 390 × 844;
3. header desktop;
4. Producto abierto;
5. Soluciones abierto;
6. drawer móvil;
7. primera sección clara;
8. comparación lado a lado con la referencia principal.

Estado final de esta fase:

`VISUAL_CORRECTION_READY_FOR_OWNER_REVIEW`
