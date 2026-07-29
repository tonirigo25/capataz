# QA Y RELEASE CHECKLIST

## 1. Web pública

- [ ] Hero comprensible en cinco segundos.
- [ ] Tipografía sin tamaños desproporcionados.
- [ ] Producto visible antes del segundo scroll.
- [ ] Mega menú accesible por ratón, teclado y touch.
- [ ] CTA principal funcional.
- [ ] CTA secundario funcional.
- [ ] Demo pública sin persistencia real.
- [ ] Solicitud demo persistida.
- [ ] Confirmación email.
- [ ] Aviso a `hola@orqenatech.com`.
- [ ] Logo claro/oscuro correcto.
- [ ] Footer y legales.
- [ ] 404/403/500.
- [ ] No redirecciones abiertas.
- [ ] Sin callejones sin salida.
- [ ] Reduced motion.
- [ ] Core Web Vitals.

## 2. Portal

- [ ] Sidebar.
- [ ] Topbar.
- [ ] Mobile bottom nav.
- [ ] Selector de empresa.
- [ ] Búsqueda.
- [ ] `+ Nuevo`.
- [ ] Hoy.
- [ ] Dashboard.
- [ ] Clientes.
- [ ] Cliente 360.
- [ ] Obras.
- [ ] Trabajo 360.
- [ ] Presupuestos.
- [ ] Facturas/cobros.
- [ ] Tesorería.
- [ ] Proveedores.
- [ ] Subcontratas.
- [ ] Documentos/OCR.
- [ ] Agenda.
- [ ] Tareas.
- [ ] Capataz IA.
- [ ] Equipo.
- [ ] Configuración.
- [ ] Plataforma interna.

## 3. Clientes

- [ ] Smart views.
- [ ] Lista + preview desktop.
- [ ] Cards móvil.
- [ ] Próxima acción.
- [ ] Actividad.
- [ ] Contactos.
- [ ] Datos fiscales.
- [ ] Trabajos.
- [ ] Presupuestos.
- [ ] Facturas.
- [ ] Cobros.
- [ ] Saldo.
- [ ] Documentos.
- [ ] Segundo tenant 404/denegado.
- [ ] Texto con padding mínimo 16 px en móvil.

## 4. Demo privada

- [ ] Solicitud.
- [ ] Rate limit.
- [ ] Dedupe.
- [ ] Estado pending.
- [ ] Aprobación por plataforma.
- [ ] MFA/permiso.
- [ ] Invitación 48 horas.
- [ ] Primer login inicia reloj.
- [ ] Siete días.
- [ ] 100 operaciones IA.
- [ ] Límites de datos.
- [ ] Aviso 24 horas.
- [ ] Expiración.
- [ ] Revocación de sesiones.
- [ ] Bloqueo de writes.
- [ ] Cero tarjeta.
- [ ] Cero Stripe.
- [ ] Cero renovación.
- [ ] Extensión +3/+7.
- [ ] Conversión manual.

## 5. IA proactiva

- [ ] Origen de cada señal.
- [ ] Contexto minimizado.
- [ ] PII redactada.
- [ ] No cross-tenant.
- [ ] Frequency cap.
- [ ] Dismiss.
- [ ] Snooze.
- [ ] CTA.
- [ ] Feedback.
- [ ] Confirmación humana.
- [ ] Kill switch.
- [ ] Fallback manual.
- [ ] Coste/tokens.
- [ ] Cuenta interna sin límite comercial pero con seguridad.

## 6. Emails

- [ ] HTML.
- [ ] Texto plano.
- [ ] Gmail.
- [ ] Outlook.
- [ ] Apple Mail.
- [ ] Móvil.
- [ ] Links absolutos.
- [ ] Logo.
- [ ] Preheader.
- [ ] CTA.
- [ ] Pie legal.
- [ ] Delivered.
- [ ] Bounce.
- [ ] Complaint.
- [ ] Suppression.
- [ ] Retry.
- [ ] No tokens en logs.
- [ ] No tracking innecesario.
- [ ] No éxito falso.

## 7. Facturas y presupuestos

- [ ] Premium Base.
- [ ] Moderna.
- [ ] Clásica.
- [ ] Compacta.
- [ ] Logo.
- [ ] Colores.
- [ ] Campos.
- [ ] Pie legal.
- [ ] Condiciones.
- [ ] Firma/sello.
- [ ] QR.
- [ ] Preview.
- [ ] Multipágina.
- [ ] Unicode.
- [ ] Datos largos.
- [ ] IVA/IRPF.
- [ ] Rectificativa.
- [ ] Mismos totales.
- [ ] Snapshot fiscal.
- [ ] Assets privados seguros.

## 8. Estados

Probar cada patrón con:

- [ ] loading;
- [ ] vacío;
- [ ] normal;
- [ ] datos extremos;
- [ ] error;
- [ ] permiso denegado;
- [ ] read-only;
- [ ] IA apagada;
- [ ] límite IA;
- [ ] demo expirada;
- [ ] provider caído.

## 9. Viewports

- [ ] 320 px.
- [ ] 360 px.
- [ ] 375 px.
- [ ] 390 px.
- [ ] 430 px.
- [ ] 768 px.
- [ ] 1024 px.
- [ ] 1440 px.
- [ ] 1920 px.

## 10. Navegadores y accesibilidad

- [ ] Chromium.
- [ ] Firefox.
- [ ] WebKit.
- [ ] iPhone Safari real — gate humano.
- [ ] Android Chrome real — gate humano.
- [ ] Keyboard.
- [ ] Focus visible.
- [ ] Axe.
- [ ] Reduced motion.
- [ ] Zoom 200 %.
- [ ] Zoom 400 %.
- [ ] NVDA — gate humano.
- [ ] VoiceOver — gate humano.

## 11. Seguridad y datos

- [ ] Tenant isolation.
- [ ] Role matrix.
- [ ] MFA plataforma.
- [ ] CSRF/Origin.
- [ ] Rate limits.
- [ ] Idempotencia.
- [ ] Outbox.
- [ ] Auditoría.
- [ ] Secret scan.
- [ ] No PII en logs.
- [ ] Migraciones aditivas.
- [ ] Fresh DB.
- [ ] Upgrade DB.
- [ ] Backup previo.

## 12. Rendimiento

Objetivos:

```text
LCP ≤ 2,5 s
INP ≤ 200 ms
CLS ≤ 0,1
```

- [ ] No paquetes grandes sin análisis.
- [ ] Imágenes optimizadas.
- [ ] Lazy load.
- [ ] No scroll hijacking.
- [ ] No HTML privado cacheado públicamente.

## 13. Release

- [ ] PR pequeñas y apiladas.
- [ ] CI verde.
- [ ] `orqena-review-continuous` actualizado.
- [ ] SHA desplegado documentado.
- [ ] Capturas.
- [ ] Staging.
- [ ] Regresión completa.
- [ ] Rollback.
- [ ] Producción autorizada.
- [ ] Cero 5xx.
- [ ] Cero secretos.
- [ ] Cero pérdida funcional.

## Gate final

No aceptar `PASS` sin evidencia.

Resultado esperado:

```text
ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_REVIEW
```
