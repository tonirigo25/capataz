# DEMO, ADMIN, IA, EMAIL Y DOCUMENTOS

Ejecutar sólo después de `PORTAL_INTERNO_APROBADO`.

## Demo privada

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
Extensión: +3 o +7 días
```

Ciclo:

```text
solicitud → confirmación → aviso a hola@ → revisión → aprobación → provisioning → invitación → primer login → activa → expira → caducada → convertida/revocada
```

Estados: PENDING, REVIEWING, MORE_INFO, APPROVED, INVITED, ACTIVE, EXPIRING, EXPIRED, REJECTED, REVOKED y CONVERTED.

Al aprobar: crear empresa aislada, cargar fixtures sintéticos, crear usuario/membresía, invitación de un solo uso, 48 h, email y reloj desde primer login.

Al expirar: revocar sesiones, bloquear writes e IA, cero Stripe/cargo/renovación, auditoría y retención/anonimización.

Límites de servidor: 100 IA, 20 clientes, 10 trabajos, 10 presupuestos, 10 facturas demo, 25 documentos, 100 MB y proveedores externos desactivados.

## Panel de plataforma

Sólo PLATFORM_OWNER con MFA y auditoría.

Módulos: Overview, Solicitudes, Demos, Empresas, Usuarios, Suscripciones, IA/consumo, Funnel, Email, Soporte, Salud y Auditoría.

Acciones: aprobar, rechazar, pedir información, extender, revocar, convertir, gestionar allowlist y revisar consumo. Aprobar ejecuta provisioning completo, no sólo cambia estado.

## IA proactiva

Arquitectura:

```text
dato/regla determinista → contexto minimizado → redacción → explicación IA → recomendación → confirmación humana → feedback
```

UI: centro global, rail desktop, insight cards, cápsulas, notificación móvil, dismiss, snooze, frequency cap, origen, CTA y feedback.

La cuenta `tonirigo25@hotmail.com` no tiene límites comerciales, pero conserva hard cap, rate limit, alertas, kill switch y auditoría.

## Emails corporativos

Sistema común con preheader, logo, título, cuerpo, CTA, datos, soporte, pie legal y texto plano.

Plantillas: demo recibida, más información, demo aprobada, expira, finalizada, invitación, recuperación, contraseña, contacto, seguridad y billing preparado pero apagado.

Validar Gmail, Outlook, Apple Mail, responsive, imágenes bloqueadas, dark mode razonable, tracking off, links absolutos, outbox, retry, bounce, complaint, suppression y no PII/tokens en logs.

## Facturas y presupuestos

Plantillas: Premium Base, Moderna, Clásica y Compacta.

Configuración segura por empresa: plantilla, logo, color, tipografía permitida, pie legal, condiciones, datos bancarios, firma, sello, QR y notas. No aceptar HTML/JS libre.

Probar presupuesto, factura, multipágina, Unicode, datos largos, IVA/IRPF, rectificativas, impresión, logo, QR y snapshot fiscal. Preservar totales, numeración y fiscalidad.

## Migraciones

Sólo aditivas cuando falte una autoridad real. Posibles entidades: DemoGrant/DemoLifecycle, DemoEvent y DocumentTheme. Probar fresh, upgrade, segunda ejecución y rollback lógico.

## Capturas Puerta 3

Guardar bajo `artifacts/design-v2/correction-pr63/gate-3/`: solicitud, confirmación, panel, aprobación, invitación, demo activa, expiración, demo caducada, admin, IA desktop/móvil, emails, selector y cuatro previews documentales.

Estado:

`FUNCTIONAL_SYSTEMS_READY_FOR_OWNER_REVIEW`
