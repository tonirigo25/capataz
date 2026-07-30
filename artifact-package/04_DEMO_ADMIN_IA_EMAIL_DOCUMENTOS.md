# DEMO, PANEL ADMIN, IA, EMAIL Y DOCUMENTOS

Ejecutar sólo después de recibir:

`PORTAL_INTERNO_APROBADO`

# A. Demo privada

## Contrato aprobado

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
Extensión manual: +3 o +7 días
```

## Ciclo

```text
solicitud
→ confirmación al solicitante
→ aviso a hola@orqenatech.com
→ revisión
→ aprobación
→ provisioning
→ invitación
→ primer login
→ activa
→ expira en 24 h
→ caducada
→ convertida o revocada
```

## Estados

- PENDING
- REVIEWING
- MORE_INFO
- APPROVED
- INVITED
- ACTIVE
- EXPIRING
- EXPIRED
- REJECTED
- REVOKED
- CONVERTED

## Provisioning al aprobar

1. Crear empresa aislada.
2. Marcarla como demo.
3. Cargar fixtures sintéticos.
4. Crear usuario y membresía.
5. Generar invitación de un solo uso.
6. Caducidad de invitación: 48 horas.
7. Encolar correo corporativo.
8. No iniciar el reloj de siete días hasta el primer login correcto.

## Expiración

- revocar sesiones;
- bloquear escrituras;
- bloquear consumo IA;
- mostrar pantalla de demo finalizada;
- cero Stripe;
- cero cargo;
- cero renovación;
- auditoría;
- retención/anonimización según política.

## Límites

- 100 operaciones IA;
- 20 clientes;
- 10 trabajos;
- 10 presupuestos;
- 10 facturas de demo;
- 25 documentos;
- 100 MB;
- emails externos desactivados;
- proveedores live desactivados.

Todos los límites se aplican en servidor y no sólo en UI.

# B. Panel interno de plataforma

Sólo para `PLATFORM_OWNER`, con MFA y auditoría.

## Módulos

- Overview;
- Solicitudes;
- Demos;
- Empresas;
- Usuarios;
- Suscripciones;
- IA y consumo;
- Funnel;
- Email;
- Soporte;
- Salud;
- Auditoría.

## Acciones

- aprobar;
- rechazar;
- pedir más información;
- extender;
- revocar;
- convertir en piloto;
- gestionar allowlist IA;
- revisar consumo;
- ver incidencias operativas.

Aprobar debe ejecutar el provisioning completo, no limitarse a cambiar un estado.

No mostrar contenido tenant privado por defecto. Usar agregados y acceso temporal auditado cuando sea imprescindible.

# C. IA proactiva

Reutilizar señales, recomendaciones, memoria, feedback, scheduler y gateway OpenAI existentes.

## Arquitectura

```text
dato o regla determinista
→ contexto minimizado
→ redacción
→ explicación IA
→ recomendación
→ confirmación humana
→ feedback
```

El LLM no debe inventar una señal de negocio.

## Formatos UI

Desktop:

- centro global de recomendaciones;
- rail lateral;
- insight cards;
- cápsulas;
- toast sólo para urgencia real.

Móvil:

- notificación in-app;
- preview de una línea;
- CTA `Ver recomendación`.

## Comportamiento

- dismiss;
- snooze;
- frequency cap;
- origen visible;
- CTA;
- feedback;
- estados leída/aceptada/rechazada/resuelta;
- no repetición;
- no acción sensible sin confirmación.

## Cuenta interna

La cuenta asociada a `tonirigo25@hotmail.com`:

- sin límites comerciales;
- sí hard cap de seguridad;
- rate limit antiabuso;
- alertas de coste;
- kill switch;
- auditoría.

# D. Sistema corporativo de emails

Construir un sistema común, no plantillas sueltas.

## Layout

- preheader;
- logo correcto;
- título;
- cuerpo;
- CTA;
- bloque informativo;
- soporte;
- pie legal;
- versión texto.

## Plantillas mínimas

- solicitud demo recibida;
- petición de más información;
- demo aprobada;
- demo expira mañana;
- demo finalizada;
- invitación;
- recuperación de contraseña;
- contraseña cambiada;
- contacto recibido;
- seguridad;
- eventos billing preparados pero no activados.

## Requisitos

- Gmail;
- Outlook;
- Apple Mail;
- responsive;
- imágenes bloqueadas;
- dark mode razonable;
- tracking desactivado;
- links absolutos;
- outbox;
- retry;
- bounce;
- complaint;
- suppression;
- no tokens ni PII en logs;
- no éxito falso.

# E. Facturas y presupuestos

## Plantillas

- Premium Base;
- Moderna;
- Clásica;
- Compacta.

## Configuración por empresa

- plantilla;
- logo;
- color principal;
- tipografía permitida;
- pie legal;
- condiciones;
- datos bancarios;
- firma;
- sello;
- QR;
- notas.

No aceptar HTML o JavaScript libre.

## Preview y pruebas

- presupuesto;
- factura;
- multipágina;
- Unicode;
- nombres y direcciones largas;
- IVA/IRPF;
- rectificativas;
- impresión;
- logo claro y oscuro;
- QR;
- snapshot fiscal.

Preservar totales, numeración, fiscalidad e inmutabilidad de documentos emitidos.

# F. Migraciones

Crear sólo migraciones aditivas y únicamente cuando no exista una autoridad equivalente.

Posibles modelos/campos:

- DemoGrant o DemoLifecycle;
- DemoEvent;
- DocumentTheme;
- campos mínimos de estado y expiración.

Probar:

- fresh database;
- upgrade desde snapshot sintético;
- segunda ejecución;
- no pérdida;
- rollback lógico.

# G. Capturas Puerta 3

Guardar bajo:

```text
artifacts/design-v2/correction-pr63/gate-3/
```

Capturas/evidencias:

1. solicitud demo;
2. correo de confirmación;
3. panel de solicitudes;
4. aprobación;
5. invitación;
6. demo activa;
7. aviso de expiración;
8. demo caducada;
9. panel admin;
10. IA desktop;
11. IA móvil;
12. emails corporativos;
13. selector de plantillas;
14. cuatro previews documentales.

Estado:

`FUNCTIONAL_SYSTEMS_READY_FOR_OWNER_REVIEW`
