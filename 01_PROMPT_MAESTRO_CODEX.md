# PROMPT MAESTRO CODEX — ORQENA FIELD OS V2

## Mandato

Actúa como principal product engineer, diseñador de producto SaaS, desarrollador Next.js y responsable de QA de Orqena / Capataz.

Implanta íntegramente este paquete. No reduzcas el alcance, no elimines funcionalidades existentes y no sustituyas reglas de negocio por prototipos visuales.

Trabaja de forma continua. No te detengas al finalizar una fase. Cuando una validación humana o una decisión externa bloquee una parte, deja la implementación preparada, marca `READY_FOR_EXTERNAL_INPUT` y continúa.

## Base Git

- Ejecuta `git fetch origin --prune`.
- Usa `origin/main` actual.
- Crea un worktree limpio.
- Rama de integración: `design/orqena-field-os-v2`.
- No trabajes directamente en `main`.
- No utilices el directorio local atrasado.
- No uses `git reset --hard`.
- No borres trabajo ajeno.

## Referencias visuales obligatorias

### Embat

Tomar como referencia:

- navegación superior y mega menús;
- estructura financiera clara;
- jerarquía contenida;
- dashboards de excepción;
- credibilidad y orden;
- IA como agente operativo visible.

### Holded

Tomar como referencia:

- producto visible desde el hero;
- demostración interactiva;
- navegación sencilla;
- bloques por funcionalidad;
- facilidad percibida;
- onboarding y presentación modular.

No copiar logos, textos, ilustraciones o código de terceros.

## Reglas absolutas

No modificar por motivos visuales:

- tenant isolation;
- autorización, roles y scopes;
- reglas empresariales;
- importes, saldos y redondeo;
- numeración fiscal;
- migraciones publicadas;
- contratos de proveedor;
- idempotencia;
- outbox;
- auditoría;
- confirmación humana;
- privacidad;
- backups;
- PWA.

Mantener inicialmente:

```text
BILLING_ENABLED=false
ORQENA_PUBLIC_REGISTRATION_ENABLED=false
EU_B2B_CROSS_BORDER_ENABLED=false
```

No activar cobros, registro público, fiscalidad live, analytics no esenciales o indexación durante el rediseño.

## Entornos

Reutilizar:

```text
orqena-review-continuous
```

No crear un segundo Review.

Flujo:

```text
rama / PR
→ CI
→ orqena-review-continuous
→ validación visual y funcional
→ Staging
→ Production sólo con gates completos y autorización
```

Conservar URL, PostgreSQL, volumen, usuarios y datos sintéticos del Review.

---

# D0 — Inventario y baseline

Antes de modificar:

1. inventariar rutas públicas y privadas;
2. inventariar shells, layouts, tablas, cards, modales, drawers y duplicados;
3. identificar componentes que contienen reglas y no deben trasladarse a UI;
4. identificar placeholders, frases residuales y microcopy incoherente;
5. crear `docs/design-v2/ROUTE_INVENTORY.md`;
6. crear `docs/design-v2/COMPONENT_INVENTORY.md`;
7. crear `docs/design-v2/VISUAL_DEBT.md`;
8. capturar baseline de rutas clave en 390, 768 y 1440 px.

No realices una auditoría interminable. Usa la especificación del paquete y completa sólo huecos reales.

Gate D0:

- árbol limpio;
- rutas catalogadas;
- funcionalidad crítica identificada;
- baseline capturado.

---

# D1 — Design system global

Implementar tokens y patrones antes de las páginas.

## Identidad

- Empresa: Orqena Tech.
- Producto: Capataz.
- Firma: Capataz, by Orqena.
- Estética: sobria, premium, tecnológica y accesible.
- Verde como acento, no como relleno dominante.
- Web pública mayoritariamente oscura.
- Portal con navegación oscura y contenido claro.

## Logo

Corregir la baja visibilidad en fondo oscuro.

Preparar:

- horizontal oscuro;
- horizontal claro;
- icono oscuro;
- icono claro;
- monocromo;
- favicon;
- OG/social;
- email;
- documentos.

## Tipografía

Evitar titulares sobredimensionados.

```text
Hero desktop: 56–64 px máximo
Hero tablet: 46–52 px
Hero mobile: 38–42 px
H2 desktop: 36–42 px
H3: 24–28 px
Body: 16–18 px
Nav: 14 px
Labels: 12–13 px
```

No superar 72 px sin una justificación visual aprobada.

## Componentes compartidos

Consolidar o crear:

- AppShell;
- MarketingShell;
- Sidebar;
- MobileBottomNav;
- Topbar;
- MegaMenu;
- PageHeader;
- KPIGrid;
- StatCard;
- DataTable;
- SmartFilterBar;
- EmptyState;
- ErrorState;
- Skeleton;
- Drawer;
- Modal;
- CommandMenu;
- RecordPreview;
- ActivityTimeline;
- ActionRail;
- InsightCard;
- AINudge;
- NotificationToast;
- TemplateCard;
- DemoStatusBanner.

## Calidad

- touch target mínimo 44 px;
- foco visible;
- reduced motion;
- contraste WCAG;
- claro/oscuro;
- 320–1920 px;
- sin overflow horizontal;
- loading/empty/error/disabled/success.

Gate D1:

- tokens documentados;
- catálogo visual;
- componentes en uso real;
- cero regresiones funcionales.

---

# D2 — Web pública premium

Rediseñar la web como combinación Embat + Holded adaptada a Capataz.

## Header

Compacto, sticky y accesible:

- Producto;
- Soluciones;
- Precios;
- Recursos;
- Empresa;
- Iniciar sesión;
- Solicitar demo.

Producto y Soluciones usan mega menú por hover, foco y click.

Agrupar por resultados:

- Clientes y ventas;
- Trabajo y obra;
- Compras y documentos;
- Dinero y margen;
- IA y automatización;
- Equipo y control.

## Hero

Split 55/45:

- izquierda: propuesta, apoyo y CTA;
- derecha: demo interactiva realista del portal.

Copy orientativo:

```text
Lo que ocurre en obra se convierte en control.
Clientes, presupuestos, costes, documentos, facturas y cobros conectados.
Capataz prepara. Tú revisas y confirmas.
```

CTA principal: `Solicitar demo`.
CTA secundario: `Ver cómo funciona`.

No usar clientes, métricas o testimonios ficticios.

## Storytelling

1. audio / foto / visita / documento;
2. cliente y siguiente acción;
3. presupuesto y margen;
4. trabajo y ejecución;
5. costes y proveedores;
6. factura, pago y vencimiento;
7. caja, resultado y recomendación.

Scroll nativo. Se permite escenario sticky. Prohibido scroll hijacking, wheel trapping o snap global.

## Secciones

- hero;
- producto interactivo;
- prueba y confianza;
- flujo;
- soluciones;
- perfiles;
- IA;
- seguridad;
- demo;
- pricing detrás de flag;
- FAQ;
- CTA;
- footer.

Gate D2:

- comprensión en cinco segundos;
- producto visible antes del segundo scroll;
- CTA funcional;
- tamaños contenidos;
- responsive;
- noindex según flag actual;
- sin regresión de Core Web Vitals.

---

# D3 — Demo pública y captación

Separar:

```text
Demo pública sintética
Demo privada evaluable
Trial comercial futuro
```

## Demo pública

- sin login;
- sin persistencia;
- sin APIs empresariales reales;
- sin emails externos;
- sin Stripe;
- recorrido guiado;
- CTA final a demo privada.

## Formulario demo

Campos:

- nombre;
- email profesional;
- empresa;
- actividad;
- tamaño;
- cargo;
- país;
- qué quiere probar;
- consentimiento.

Protecciones:

- validación;
- rate limit;
- deduplicación;
- idempotencia;
- honeypot o control compatible con privacidad;
- auditoría;
- no éxito falso.

Enviar confirmación profesional al solicitante y aviso a `hola@orqenatech.com`.

Gate D3:

- persistencia real;
- correo;
- trazabilidad;
- redirección correcta;
- cero callejones sin salida.

---

# D4 — Shell interno por perfil

La aplicación autenticada debe ser compacta, rápida y orientada a acción.

## Desktop

- sidebar oscura;
- topbar clara;
- búsqueda;
- selector de empresa;
- `+ Nuevo`;
- notificaciones;
- ayuda;
- perfil.

## Móvil

- bottom navigation;
- máximo cinco accesos;
- resto en `Más`;
- safe areas;
- drawers;
- no tablas desktop encogidas.

## Roles

El shell y las rutas deben respetar:

- OWNER;
- dirección;
- ventas;
- finanzas;
- compras;
- responsable de trabajo;
- supervisor;
- trabajador;
- colaborador;
- auditor/viewer;
- plataforma.

No basta con ocultar menús; el acceso directo por URL debe seguir protegido.

Gate D4:

- navegación coherente;
- sin textos residuales;
- permisos;
- responsive.

---

# D5 — Hoy y Dashboard

## Hoy

Responder: `¿Qué requiere mi atención ahora?`

Mostrar:

- 3–5 prioridades;
- agenda;
- cobros/facturas;
- bloqueos;
- tareas;
- recomendaciones;
- actividad;
- CTA contextual.

No construir un mosaico genérico de widgets.

## Dashboard

- ingresos;
- gastos;
- beneficio/margen;
- pendiente de cobro;
- facturas vencidas;
- evolución;
- caja;
- excepciones;
- recomendaciones.

Cada dato enlaza a su origen.

Gate D5:

- permisos;
- trazabilidad;
- móvil;
- estados vacíos útiles.

---

# D6 — Clientes y Cliente 360

Fase prioritaria.

## Lista

Patrón:

```text
vistas inteligentes
+ lista operativa
+ preview lateral
```

Vistas:

- necesitan acción;
- activos;
- todos;
- sin actividad;
- pendiente de cobro;
- datos incompletos.

Cada fila responde:

- quién;
- situación;
- importe/riesgo;
- siguiente acción.

Filtros avanzados en drawer.

## Cliente 360

Reagrupar, no eliminar:

1. Resumen;
2. Relación;
3. Operación;
4. Dinero;
5. Archivos.

Panel lateral:

- contacto;
- fiscalidad;
- responsable;
- estado;
- acciones.

Resumen:

- próxima acción;
- timeline;
- trabajos;
- presupuestos;
- facturas;
- saldo;
- incidencias;
- recomendación.

## Móvil

- cards de acción;
- 16 px mínimo lateral;
- importes y estados sin cortar;
- acciones compactas;
- filtros en sheet.

Gate D6:

- CRUD;
- contacto vs empresa fiscal;
- saldos;
- permisos;
- documentos;
- seguimiento;
- segundo tenant;
- 320/390/1440 px.

---

# D7 — Trabajo, ventas, dinero, compras y documentos

## Trabajo 360

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
- IA.

## Presupuestos

- lista por estado;
- editor claro;
- partidas;
- coste/margen;
- preview PDF;
- revisión;
- conversión;
- seguimiento.

## Dinero

- facturas;
- pagos parciales;
- saldo;
- vencimientos;
- promesas;
- seguimiento;
- tesorería.

## Compras

- proveedor;
- subcontrata;
- RC;
- caducidad;
- facturas recibidas;
- gasto único;
- pagos;
- saldo.

## Documentos

Inbox:

- cola;
- preview;
- datos extraídos;
- advertencias;
- propuesta;
- confirmación.

Gate D7:

- mismas reglas y aritmética;
- no duplicación;
- PDFs;
- OCR;
- R2;
- tenant;
- móvil.

---

# D8 — Demo privada completa

Contrato:

```text
Duración: 7 días naturales
Inicio: primer login correcto
Invitación: 48 horas
Usuarios: 1
Empresas: 1
Plan: Professional Demo
IA: 100 operaciones totales
Pago: ninguno
Tarjeta: no
Renovación: no
Extensión: +3 o +7 días manual
```

Estados:

```text
pending
reviewing
more_info
approved
invited
active
expiring
expired
rejected
revoked
converted
```

Seguridad:

- empresa aislada;
- datos sintéticos;
- revocar sesiones al expirar;
- bloquear writes;
- bloquear IA;
- no Stripe;
- no fiscal live;
- no automatizaciones externas;
- auditoría.

Límites:

- 20 clientes;
- 10 trabajos;
- 10 presupuestos;
- 10 facturas demo;
- 25 documentos;
- 100 MB;
- 100 operaciones IA.

Jobs:

- caducidad de invitación;
- aviso 24 h;
- expiración;
- revocación;
- retención/anonimización;
- idempotencia;
- auditoría.

Gate D8:

- aprobación con rol de plataforma y MFA;
- correo;
- primer login inicia reloj;
- expiración real;
- cero cobro;
- cero cruce tenant.

---

# D9 — Panel interno de plataforma

Ruta interna sólo para plataforma.

Módulos:

- Overview;
- Solicitudes;
- Demos;
- Empresas;
- Usuarios;
- Suscripciones;
- IA/consumo;
- Funnel;
- Soporte;
- Salud;
- Auditoría.

Acciones:

- aprobar;
- rechazar;
- pedir información;
- revocar;
- extender;
- convertir a piloto;
- asignar plan;
- gestionar allowlist IA;
- ver consumo;
- ver incidencias.

Preferir agregados. El contenido tenant sólo con autorización temporal y auditoría.

Gate D9:

- PLATFORM_OWNER;
- MFA;
- auditoría;
- minimización;
- no acceso cliente.

---

# D10 — IA proactiva

La IA no es sólo chat.

Formatos:

- panel lateral;
- insight card;
- cápsula;
- toast;
- notificación móvil;
- centro de recomendaciones.

Categorías:

- recomendación;
- advertencia;
- recordatorio;
- oportunidad;
- anomalía;
- bloqueo;
- resumen diario.

Ejemplos:

- presupuesto sin seguimiento;
- cliente inactivo;
- factura vencida;
- margen bajo;
- documentación a caducar;
- gasto anómalo;
- conflicto de agenda;
- caja prevista.

Arquitectura:

```text
regla/dato verificable
→ contexto minimizado
→ redacción
→ explicación IA
→ revisión/acción humana
→ feedback
```

Memoria:

- company scope;
- user scope;
- conversation scope;
- resúmenes;
- preferencias;
- retención;
- borrado;
- no cross-tenant.

Cuenta `tonirigo25@hotmail.com`:

- sin límites comerciales;
- mantiene hard cap de seguridad;
- rate limit;
- alertas;
- kill switch;
- auditoría.

Gate D10:

- frequency cap;
- dismiss/snooze;
- origen;
- CTA;
- feedback;
- PII;
- coste;
- confirmación;
- fallback manual.

---

# D11 — Sistema corporativo de email

Crear un único layout versionado:

- preheader;
- header;
- logo;
- título;
- cuerpo;
- CTA;
- bloque informativo;
- soporte;
- pie legal;
- texto plano.

Plantillas mínimas:

- solicitud demo recibida;
- demo aprobada;
- solicitud de información;
- demo expira;
- demo finalizada;
- invitación;
- recuperación;
- cambio de contraseña;
- contacto;
- suscripción futura;
- cambio de plan;
- cancelación;
- impago;
- aviso operativo;
- seguridad.

Requisitos:

- Gmail/Outlook/Apple Mail;
- responsive;
- alt text;
- links absolutos;
- no tracking innecesario;
- no tokens en logs;
- outbox/retry;
- bounce/complaint/suppression;
- no éxito falso.

Gate D11:

- HTML y texto;
- snapshots;
- envíos oficiales controlados;
- eventos de entrega.

---

# D12 — Plantillas de factura y presupuesto

Crear sistema, no PDF rígido.

Plantillas:

- Premium Base;
- Moderna;
- Clásica;
- Compacta.

Personalización segura:

- logo;
- colores;
- tipografía aprobada;
- columnas;
- pie;
- términos;
- pago;
- firma;
- sello;
- QR;
- notas.

No permitir HTML/JS libre.

Guardar configuración JSON versionada por empresa.

Validar:

- factura;
- presupuesto;
- multipágina;
- Unicode;
- datos largos;
- IVA/IRPF;
- rectificativa;
- QR;
- logo;
- mismos totales;
- snapshot fiscal.

Gate D12:

- golden tests;
- preview fiel;
- personalización;
- totales;
- fiscalidad;
- seguridad de assets.

---

# D13 — QA y despliegue

## Rutas mínimas

Públicas:

- `/`;
- `/producto`;
- `/funcionalidades`;
- `/demo`;
- `/contacto`;
- `/precios`;
- `/seguridad`;
- legales.

Privadas:

- `/hoy`;
- `/dashboard`;
- `/clientes`;
- cliente;
- `/obras`;
- trabajo;
- `/presupuestos`;
- `/dinero`;
- `/tesoreria`;
- `/documentos`;
- `/agenda`;
- `/capataz`;
- `/equipo`;
- `/configuracion`;
- `/plataforma`.

## Estados

- vacío;
- normal;
- datos extremos;
- loading;
- error;
- read-only;
- permiso denegado;
- segundo tenant;
- demo activa;
- demo expirada;
- IA apagada;
- límite IA.

## Viewports

```text
320 360 375 390 430 768 1024 1440 1920
```

## Navegadores

- Chromium;
- Firefox;
- WebKit;
- iPhone Safari real posterior;
- Android Chrome real posterior.

## Accesibilidad

- teclado;
- foco;
- zoom 200/400;
- reduced motion;
- Axe;
- NVDA/VoiceOver como gate humano.

## Rendimiento

```text
LCP ≤ 2,5 s
INP ≤ 200 ms
CLS ≤ 0,1
```

## Deploy

Cada bloque verde:

```text
CI → orqena-review-continuous → evidencia
```

Después:

```text
Staging → regresión completa → Production con aprobación
```

No declarar una ruta terminada sin abrirla en Review.

---

# Estrategia de PR

Rama de integración:

`design/orqena-field-os-v2`

PR apiladas recomendadas:

1. `design/v2-foundations-shell`
2. `design/v2-public-site`
3. `design/v2-portal-clients`
4. `design/v2-work-finance-documents`
5. `feat/demo-approval-admin`
6. `feat/ai-proactive-experience`
7. `feat/corporate-email-system`
8. `feat/document-template-system`
9. `test/v2-regression-release`

Cada PR debe apuntar a la rama de integración, tener CI verde, desplegar Review y conservar evidencia.

---

# Entrega final

Informar:

1. rama y PR;
2. SHA;
3. estado D0–D13;
4. archivos por bloque;
5. migraciones;
6. componentes;
7. rutas;
8. demo;
9. admin;
10. IA;
11. emails;
12. documentos;
13. pruebas;
14. capturas;
15. Review y deployment;
16. Staging;
17. Production;
18. rollback;
19. `READY_FOR_EXTERNAL_INPUT`;
20. cero secretos;
21. cero pérdida funcional.

Resultado esperado:

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_REVIEW`
