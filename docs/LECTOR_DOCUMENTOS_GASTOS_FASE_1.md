# Lector de documentos de gasto — fase 1

## Arquitectura

El lector amplía el repositorio `Document` existente y crea el gasto definitivo en el modelo `Expense` actual. No existe un segundo sistema contable. El flujo es: subida validada → almacenamiento privado → extracción opcional → normalización → revisión humana → comprobación de duplicados → confirmación expresa → creación transaccional del gasto y enlace del original.

`DocumentExtractionProvider` desacopla el flujo de la extracción. Incluye:

- `OpenAIDocumentExtractionProvider`: usa el cliente HTTP central de `lib/ai/capataz-ai.ts`, el endpoint Responses API y salida estructurada. Solo se selecciona cuando existe `OPENAI_API_KEY`.
- `DeterministicDocumentExtractionProvider`: genera resultados repetibles para desarrollo y pruebas, sin red. Solo puede activarse fuera de producción o en el runner aislado.
- `UnconfiguredDocumentExtractionProvider`: no lee ni envía el archivo; deja el documento en revisión manual y muestra un error sanitizado.

## Modelo y relaciones

`Document` conserva ownership directo por `companyId` y añade hash SHA-256, estado documental, tipo, estado de extracción, confianza, propuesta JSON normalizada, error sanitizado y columnas de búsqueda de duplicados. Se relaciona opcionalmente con `Expense`, `Work`, `Client` y el `User` que hizo la subida. La migración es aditiva; además permite que `Expense.obraId` sea nulo para representar gastos generales.

Los índices nuevos cubren `companyId + status`, `companyId + sha256`, factura/NIF dentro de empresa y usuario de subida. La migración no contiene `DROP TABLE`, `TRUNCATE`, `DELETE` ni reinterpretación de datos.

## Almacenamiento y seguridad

`DocumentStorage` tiene una implementación local bajo `.capataz-documents` (fuera de `public`). La clave física se genera en servidor; nunca se acepta una ruta del navegador ni se expone al cliente. La escritura usa un temporal y renombrado, y limpia el temporal al fallar.

La descarga pasa por un Route Handler que exige sesión, busca simultáneamente `id + companyId`, devuelve `private, no-store` y `nosniff`, y nunca muestra rutas internas. Las acciones obtienen `companyId` exclusivamente de `requireCompanyContext()`. Obra y cliente se vuelven a consultar dentro de esa empresa antes de enlazarlos.

La validación admite PDF, JPEG, PNG y WEBP, comprueba firma binaria real, MIME declarado, extensión, límite central de 10 MB y nombre saneado. SVG, HTML, ejecutables y contenido desconocido se rechazan.

## Datos y normalización

La propuesta incluye tipo, emisor, NIF/CIF/VAT, número, fechas, moneda, base, IVA y porcentaje, IRPF, otros impuestos, total, método de pago, concepto, categoría, líneas, confianza por campo y advertencias. La capa de normalización valida fechas reales, formatos monetarios españoles e internacionales, porcentajes, importes negativos, NIF/CIF conservador y coherencia aproximada entre base, impuestos y total. Los datos dudosos permanecen `null`.

El prompt declara el documento como contenido no confiable e ignora instrucciones o prompt injection incluidas dentro de la imagen o PDF. No se registran prompts, documentos, respuestas crudas ni secretos.

## Revisión, duplicados y confirmación

La pantalla separa propuesta automática, confianza baja y obligatorios ausentes. El usuario puede editar los campos, guardar el documento sin crear gasto (la subida ya lo deja persistido), reintentar, cancelar volviendo al listado o eliminarlo. `Guardar como gasto` es la única acción de creación y exige una señal explícita del formulario.

Los duplicados se buscan solo dentro de `companyId` por hash, número + NIF, número + emisor y fecha + total + emisor. Se muestran enlaces a coincidencias y se exige una segunda confirmación para continuar. La transacción guarda qué campos fueron corregidos, el actor y si se ignoró una coincidencia, sin duplicar el documento completo en auditoría.

## Variables (solo nombres)

- `OPENAI_API_KEY`
- `OPENAI_DOCUMENT_MODEL`
- `DOCUMENT_EXTRACTION_PROVIDER`
- `DOCUMENT_STORAGE_ROOT`

Sin `OPENAI_API_KEY` el build, las pruebas, la subida, la descarga, la edición manual, los duplicados y la creación de gasto siguen funcionando. Para configurar OpenAI más adelante debe usarse el flujo seguro de creación de claves de Codex y guardarla únicamente en un archivo de entorno ignorado; nunca en Git.

## Pruebas

Prueba específica:

```powershell
npm run test:expense-document-reader
```

La regresión final se ejecuta con el runner PostgreSQL aislado existente:

```powershell
$env:CAPATAZ_TEST_DATABASE_ISOLATED='true'
$env:CAPATAZ_EMBEDDED_POSTGRES_ROOT='<runtime local con embedded-postgres>'
node scripts/run-all-tests-isolated.mjs
```

El test específico cubre los 25 escenarios del alcance mediante pruebas funcionales de validación/normalización/almacenamiento, comprobaciones de los límites de seguridad y una consulta real multiempresa cuando corre dentro del PostgreSQL aislado.

## Limitaciones y extensiones posteriores

- El almacenamiento local es adecuado para un único host persistente; un despliegue con réplicas necesitará implementar `DocumentStorage` para almacenamiento de objetos, sin cambiar el dominio.
- La fase no crea proveedores como entidad porque el esquema actual los representa mediante `Expense.proveedor`; sugiere coincidencias textuales sin inventar registros.
- Las líneas detectadas se conservan en la propuesta documental y se muestran en revisión, pero todavía no crean movimientos de inventario.
- No se amplió el motor general del chat. El estado y la propuesta quedan listos para una integración conversacional posterior con consentimiento explícito.
- No incluye correo entrante, WhatsApp, conciliación bancaria, fiscalidad completa ni procesamiento masivo.
