# ADR 0007: motor fiscal inmutable y factura electrónica desacoplada

Estado: aceptada técnicamente en F3; activación live pendiente de aprobaciones externas.

## Decisión

La factura operativa sigue siendo editable durante su preparación. La emisión crea un `FiscalDocument` con snapshot canónico e inmutable. Alta y anulación son registros append-only encadenados por empresa; las rectificaciones crean otro documento y enlazan el original. La numeración se reserva dentro de la misma transacción que documento, registro, evento y outbox.

La semántica fiscal no depende del formato de intercambio. UBL, CII, Facturae y EDIFACT son adaptadores versionados que producen artefactos con hashes propios y un hash semántico común. Entrega y timeline son modelos separados de billing SaaS.

## Razones

- Evitar que una edición operativa reescriba evidencia emitida.
- Hacer reproducibles redondeos, huellas, QR, formatos y exportaciones.
- Conservar aislamiento por empresa, idempotencia y trazabilidad de release.
- Permitir activar proveedores o formatos sin acoplar el núcleo a credenciales live.
- Mantener reversión segura mediante flags sin destruir registros.

## Consecuencias

- Los triggers de PostgreSQL actúan como última barrera de inmutabilidad.
- Los datos legacy se clasifican, no se retrocertifican.
- La declaración responsable se genera como borrador hasta firma independiente.
- La entrega pública falla cerrada mientras falte la orden efectiva o cualquier validación/aprobación.
- Cambiar un contrato semántico, un validador o un esquema exige nueva versión y nuevas golden tests.
