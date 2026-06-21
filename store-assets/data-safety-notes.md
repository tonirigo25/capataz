# Data Safety / Privacy Notes

Capataz puede manejar estos tipos de datos:

- Nombre, email y teléfono del usuario.
- Datos de empresa.
- Datos fiscales y de contacto de empresa.
- Datos de clientes finales.
- Datos de obras.
- Presupuestos.
- Facturas.
- Pagos y cobros.
- Agenda.
- Recordatorios.
- Archivos de logo/sello/fotos/tickets si se activan.
- Mensajes o borradores creados por el usuario o por la asistencia IA.

Uso de datos:

- Se usan para prestar el servicio de gestión de clientes, obras, presupuestos, facturas, agenda, cobros y recordatorios.
- No se venden datos.
- No se envía nada fuera de la app sin confirmación explícita.
- Puede haber IA si está activada; la IA propone acciones o borradores y el usuario mantiene el control final.
- El usuario controla sus datos y puede solicitar eliminación o corrección a soporte.

Notas para Google Play Data Safety:

- Data collection: sí, si hay cuentas reales o backend real.
- Data sharing: no venta de datos. Sólo proveedores necesarios cuando se activen servicios externos.
- Encryption in transit: debe activarse con HTTPS en staging/production.
- Account deletion: documentar proceso por email hasta que exista autoservicio.

Notas para App Store Privacy:

- Contact Info: puede aplicar.
- User Content: puede aplicar por presupuestos, facturas, notas, logos/sellos y documentos.
- Financial Info: puede aplicar por facturas, pagos y cobros, aunque no se procesen pagos reales.
- Diagnostics: sólo si se añade analítica/crash reporting en el futuro.
