# Proveedores, subcontratas y gastos avanzados

## Alcance

Esta fase introduce un núcleo de compras multiempresa sin sustituir los modelos existentes de gastos, obras, documentos o tesorería.

Las interfaces públicas son independientes:

- `/proveedores`
- `/subcontratas`
- `/facturas-proveedor`
- `/facturas-subcontratas`
- `/gastos-materiales/lector`

Proveedores y subcontratas comparten el modelo `BusinessPartner`, pero mantienen navegación, textos, campos y objetivos operativos distintos.

## Modelo funcional

`BusinessPartner` contiene la identidad fiscal, contacto, dirección, etiquetas, condiciones de pago y estado. Para subcontratas añade oficio, especialidad, seguro RC, tipo legal, valoración y estado/caducidad documental.

Las relaciones auxiliares proporcionan:

- `BusinessPartnerHistory`: historial inmutable de acciones relevantes.
- `BusinessPartnerWork`: relación explícita con obras realizadas.
- `PartnerLearning`: preferencias confirmadas de categoría, obra e IVA, siempre limitadas por `companyId`.
- `PurchaseInvoice`: factura recibida de proveedor o subcontrata.
- `PurchaseInvoicePayment`: pagos parciales.
- `PurchaseInvoiceHistory`: trazabilidad de alta, pago y anulación.

`Document` y `Expense` incorporan relaciones opcionales con el tercero y la factura recibida. Los datos anteriores permanecen válidos porque las columnas nuevas son anulables.

## Flujo manual de factura recibida

1. El usuario selecciona un proveedor o una subcontrata activa.
2. Decide una obra o gasto general.
3. Revisa tipo fiscal, fechas, base, IVA, IRPF y total.
4. Capataz valida que `base + IVA - IRPF = total` con tolerancia contable.
5. Una transacción crea la factura recibida, el gasto enlazado, el historial y la relación con la obra.
6. Tesorería usa el gasto enlazado como única salida prevista. Si existen pagos parciales, usa el saldo pendiente de la factura.
7. La obra incorpora el gasto a materiales, subcontratas o costes generales y recalcula beneficio, margen y desviación.

No se implementa reparto entre varias obras. `PurchaseInvoice.workId` representa la imputación única actual y permite evolucionar posteriormente hacia una tabla de asignaciones sin mezclar pagos o documentos.

## Flujo documental

La bandeja distingue pendiente, analizando, pendiente de revisión, pendiente de proveedor, pendiente de obra, posible duplicado, listo, registrado, error y archivado.

El proveedor de extracción propone:

- emisor y NIF/CIF;
- clasificación entre materiales, combustible, restauración, herramientas, maquinaria, transportes, subcontratas, servicios, suministros u otros;
- factura, fechas, base, IVA, IRPF y total.

Después de la extracción, Capataz busca el tercero únicamente dentro de la empresa activa. Si existe aprendizaje confirmado para ese tercero, propone su categoría, obra e IVA habituales. Ningún dato se guarda hasta que el usuario confirma el formulario.

Si el documento tiene proveedor y número de factura, la confirmación crea `PurchaseInvoice` y `Expense` en la misma transacción. Los tickets o documentos incompletos pueden seguir guardándose como gasto manual.

## Fiscalidad

La arquitectura conserva país y moneda en las entidades económicas. La implementación funcional actual es España:

- NIF/CIF normalizado;
- IVA;
- retención IRPF;
- factura completa;
- factura simplificada;
- factura rectificativa.

No se aplican reglas fiscales de otros países.

## Seguridad multiempresa

- `companyId` se deriva siempre de `requireCompanyContext()`.
- Los identificadores de tercero, obra, cliente, factura y documento se vuelven a consultar con ese `companyId`.
- El aprendizaje, las búsquedas de duplicados y las sugerencias nunca consultan datos de otra empresa.
- Los formularios no aceptan un `companyId` enviado por el cliente.
- Los documentos continúan almacenados fuera de `public` y se descargan mediante la ruta autenticada existente.

## Migración

`20260717120000_procurement_management`:

- amplía los enums documentales y de categorías;
- crea las tablas del núcleo de compras;
- añade relaciones opcionales a `Expense` y `Document`;
- no transforma ni elimina datos anteriores.
