# DEMO, ADMINISTRACIÓN, IA, EMAIL Y DOCUMENTOS

## 1. Flujo de demo privada

### Contrato aprobado

```text
Duración: 7 días naturales
Inicio: primer acceso correcto
Invitación: 48 horas
Usuarios: 1
Empresas: 1
Plan: Professional Demo
IA: 100 operaciones totales
Pago: ninguno
Tarjeta: no
Renovación automática: no
Extensión: +3 o +7 días manual
```

### Solicitud

Campos:

- nombre;
- email profesional;
- empresa;
- actividad;
- tamaño;
- cargo;
- país;
- interés;
- consentimiento.

Protecciones:

- rate limit;
- deduplicación;
- idempotencia;
- honeypot o alternativa respetuosa con privacidad;
- auditoría;
- no éxito falso.

### Estados

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

### Efectos

- `approved`: aprobación interna; todavía no crea sesión.
- `invited`: invitación de un solo uso, 48 horas.
- `active`: comienza con primer login correcto.
- `expiresAt`: primer login + 7 días.
- `expiring`: 24 horas antes.
- `expired`: revocar sesiones, bloquear writes e IA.
- `converted`: no activa Stripe automáticamente.

### Límites

- 20 clientes;
- 10 trabajos;
- 10 presupuestos;
- 10 facturas demo;
- 25 documentos;
- 100 MB;
- 100 operaciones IA.

### Correos

1. solicitud recibida;
2. más información;
3. demo aprobada;
4. expira mañana;
5. finalizada;
6. conversión/contacto.

## 2. Panel de plataforma

Ruta sólo para `PLATFORM_OWNER`.

### Secciones

- Overview;
- Solicitudes;
- Demos;
- Empresas;
- Usuarios;
- Suscripciones;
- IA / consumo;
- Funnel;
- Soporte;
- Salud;
- Auditoría.

### Acciones

- aprobar;
- rechazar;
- pedir información;
- revocar;
- extender;
- convertir a piloto;
- asignar plan;
- gestionar allowlist IA;
- ver consumo;
- revisar incidencias.

### Métricas

- solicitudes nuevas;
- tiempo de respuesta;
- aprobaciones;
- demos activas;
- demos por expirar;
- primer login;
- activación;
- uso IA;
- conversión;
- soporte;
- empresas y usuarios;
- salud de proveedores.

Preferir agregados. El contenido tenant requiere acceso temporal y auditoría.

## 3. IA proactiva

### Principio

El LLM no inventa señales.

```text
dato/regla determinista
→ contexto minimizado
→ redacción
→ explicación IA
→ revisión humana
→ acción
→ feedback
```

### Formatos

Desktop:

- panel lateral;
- insight card;
- cápsula;
- toast no intrusivo.

Móvil:

- banner;
- preview de una línea;
- centro de recomendaciones;
- CTA `Ver recomendación`.

### Categorías

- recomendación;
- advertencia;
- recordatorio;
- oportunidad;
- anomalía;
- bloqueo;
- resumen diario.

### Casos

- presupuesto sin seguimiento;
- cliente sin actividad;
- factura vencida;
- promesa incumplida;
- margen bajo;
- gasto anómalo;
- documentación a caducar;
- tarea bloqueada;
- conflicto de agenda;
- caja prevista.

### UX y seguridad

- mostrar origen;
- indicar gravedad;
- frecuencia máxima;
- dismiss;
- snooze;
- no repetir;
- feedback útil/no útil;
- CTA concreta;
- confirmación humana;
- no cross-tenant;
- no PII innecesaria;
- kill switch;
- fallback manual.

### Memoria

- empresa;
- usuario;
- conversación;
- resumen;
- preferencias;
- retención;
- borrado;
- auditoría.

### Cuenta interna

`tonirigo25@hotmail.com`:

- sin límites comerciales;
- mantiene hard cap de seguridad;
- rate limit;
- alertas de coste;
- kill switch;
- auditoría.

## 4. Sistema corporativo de email

### Layout único

- preheader;
- cabecera;
- logo;
- título;
- cuerpo;
- CTA;
- bloque informativo;
- soporte;
- pie legal;
- versión texto.

### Plantillas mínimas

- solicitud demo recibida;
- más información;
- demo aprobada;
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

### Copy demo recibido

**Asunto:** Hemos recibido tu solicitud de demo de Capataz

Hola, {{name}}:

Gracias por solicitar una demostración de Capataz, by Orqena.

Nuestro equipo revisará la información y te responderá normalmente en un plazo máximo de 24 horas laborables.

Todavía no se ha creado ninguna cuenta, no se ha solicitado ningún método de pago y no se realizará ningún cargo.

**Qué ocurrirá ahora**

1. Revisaremos tu solicitud.
2. Cuando se apruebe, recibirás una invitación personal.
3. Podrás crear tu contraseña y acceder a un entorno aislado.

Un saludo,
Equipo Orqena Tech

### Copy demo aprobada

**Asunto:** Tu demostración de Capataz está preparada

Hola, {{name}}:

Tu solicitud ha sido aprobada.

Dispones de una demo privada durante 7 días naturales a partir de tu primer acceso.

- invitación válida 48 horas;
- un usuario;
- una empresa demo;
- 100 operaciones IA;
- sin tarjeta;
- sin cargos;
- sin renovación automática.

[Crear mi contraseña y acceder]

### Copy expira mañana

**Asunto:** Tu demo de Capataz finaliza mañana

Tu entorno finaliza mañana a las {{time}}. Después se cerrará automáticamente y no se realizará ningún cargo.

[Volver a Capataz]

### Copy finalizada

**Asunto:** Tu demostración de Capataz ha finalizado

El periodo de demostración ha terminado y el acceso se ha cerrado automáticamente.

No existe ninguna renovación ni cargo asociado.

[Contactar con Orqena]

### Requisitos técnicos

- HTML y texto;
- Gmail, Outlook y Apple Mail;
- responsive;
- alt text;
- enlaces absolutos;
- no tracking innecesario;
- outbox;
- retries;
- bounce/complaint/suppression;
- no tokens en logs;
- no éxito falso.

## 5. Facturas y presupuestos

### Plantillas

- Premium Base;
- Moderna;
- Clásica;
- Compacta.

### Personalización

- logo;
- color primario;
- color secundario;
- tipografía aprobada;
- columnas;
- pie;
- condiciones;
- datos bancarios;
- firma;
- sello;
- QR;
- notas.

No permitir HTML/JS libre.

Guardar configuración JSON versionada por empresa.

### Editor

- selector;
- preview;
- logo;
- colores;
- campos visibles;
- pie y términos;
- guardar;
- restaurar;
- duplicar plantilla.

### Validación

- mismos totales;
- IVA/IRPF;
- redondeo;
- multipágina;
- Unicode;
- datos largos;
- rectificativa;
- QR;
- impresión;
- snapshot fiscal;
- assets privados sin SSRF.

## 6. Modelos propuestos

Reutilizar modelos existentes antes de crear otros.

### DemoRequest

- id;
- email normalizado;
- nombre;
- empresa;
- actividad;
- tamaño;
- cargo;
- país;
- interés;
- estado;
- consentimiento;
- source;
- createdAt;
- reviewedAt;
- reviewedBy;
- rejectionReason.

### DemoGrant

- demoRequestId;
- companyId;
- userId;
- invitationId;
- planKey;
- aiAllowance;
- firstLoginAt;
- startsAt;
- expiresAt;
- status;
- extendedUntil;
- revokedAt.

### DemoEvent

- grantId;
- type;
- occurredAt;
- actorId;
- metadata segura;
- idempotencyKey.

### AIInsight

- companyId;
- userId opcional;
- type;
- sourceType;
- sourceId;
- title;
- summary;
- severity;
- status;
- availableAt;
- expiresAt;
- dismissedAt;
- actedAt;
- promptVersion;
- model;
- cost.

### AIFeedback

- insightId/conversationId;
- userId;
- helpful;
- correction;
- createdAt.

### DocumentTheme

- companyId;
- templateKey;
- version;
- configJson;
- active;
- createdBy;
- createdAt.

## 7. Migraciones

Crear sólo cuando no exista modelo equivalente.

Orden:

1. demo lifecycle;
2. platform demo admin;
3. AI insights/feedback;
4. document themes.

Reglas:

- aditivas;
- índices por company/status/date;
- idempotency unique;
- FKs;
- no drop;
- no rename destructivo;
- no editar migraciones publicadas;
- fresh DB;
- upgrade sintético;
- segunda ejecución sin cambios.
