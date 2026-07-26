# Perfil técnico de factura electrónica

Estado: núcleo semántico, serialización, almacenamiento, entrega privada y timeline implementados; validación externa oficial/partner pendiente antes de live.

## Base normativa y formatos

El [Real Decreto 238/2026](https://www.boe.es/eli/es/rd/2026/03/25/238/con) contempla CII, UBL, EDIFACT INVOIC y Facturae como formatos estructurados. Su aplicación efectiva depende de una orden ministerial futura y de sus plazos; por tanto, la solución pública permanece bloqueada. La versión oficial publicada de [Facturae es 3.2.2](https://www.facturae.gob.es/formato/ultima-version).

| Formato | Perfil versionado | Validador local | Puerta externa |
| --- | --- | --- | --- |
| UBL | `UBL-2.1-EN16931:2017` | XML, raíz, campos semánticos, hash golden | XSD y reglas EN16931 oficiales |
| CII | `UNCEFACT-CII-D16B-EN16931:2017` | XML, raíz, campos semánticos, hash golden | XSD y reglas EN16931 oficiales |
| Facturae | `Facturae-3.2.2` | XML, raíz, semántica y adaptador de firma | XSD oficial y XAdES con certificado autorizado |
| EDIFACT | `UN-EDIFACT-INVOIC-D16B` | segmentos obligatorios y hash golden | perfil/intercambio acordado con partner |

El contrato exacto está en `contracts/einvoice/v1/manifest.json`. Los cuatro formatos proceden del mismo `CanonicalInvoice` y registran `semanticVersion`, `validatorVersion`, versión de esquema, hash de contenido y hash semántico.

## Entrega, estado y conservación

- Canales modelados: descarga, email seguro, plataforma privada y solución pública.
- Todo adaptador recibe empresa, artefacto, clave de almacenamiento, hash, destinatario e idempotency key; devuelve referencia y acuse.
- El destinatario persistido se redacta y se conserva su hash normalizado.
- La línea temporal append-only admite aceptación, rechazo, pago total, pago parcial y fecha de pago. Rechazo y pago parcial exigen sus datos específicos.
- Artefactos, estados y acuses conservan política de retención; la restauración desde almacenamiento reproduce los bytes y el hash originales.
- Los modelos `ElectronicInvoice*` están separados de `Billing*`; la factura B2B no comparte numeración ni estado con Stripe.

## Puertas que permanecen cerradas

La solución pública solo puede habilitarse si coinciden cuatro condiciones: flag explícito, orden ministerial efectiva, validación externa de esquema/interoperabilidad y credenciales live autorizadas. El código rechaza la entrega si falta cualquiera.

`EINV-002`, `EINV-003`, `EINV-004` y `EINV-012` quedan `READY_FOR_EXTERNAL_INPUT`: existe implementación y golden suite local, pero se requiere validación independiente de UBL/CII, Facturae/XAdES y el perfil EDIFACT antes de declararlos interoperables. No se confunde la validación estructural local con aprobación oficial.
