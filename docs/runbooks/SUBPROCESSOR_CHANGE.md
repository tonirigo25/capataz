# Cambio de subencargado y aviso

Estado: proceso operativo listo; cualquier cambio real requiere validación contractual/jurídica y aprobación del responsable autorizado.

1. Crear o actualizar `Subprocessor` con finalidad, datos, ubicaciones, salvaguardas, fecha efectiva, revisión y hash.
2. Abrir `SubprocessorChange` antes de activar el proveedor: tipo, resumen, fecha límite y si exige aviso.
3. Evaluar contrato/DPA, transferencias, seguridad, retención, borrado, continuidad y EIPD.
4. No activar credenciales hasta registrar aprobación y completar el aviso exigible.
5. Conservar contenido, hash, audiencia, canal, fecha de envío y evidencia; actualizar el listado contractual/público sólo tras verificación.
6. Mantener rollback: credenciales antiguas revocables, export/borrado del proveedor saliente y prueba de no tráfico.

## Plantilla de aviso

Asunto: `Cambio previsto de subencargado · <proveedor> · efectivo <fecha>`

Contenido mínimo: servicio y finalidad, categorías de datos, ubicaciones/transferencias y garantías, fecha efectiva, impacto esperado, medidas, enlace a inventario versionado, canal para dudas/objeciones cuando proceda y contacto de privacidad. No incluir datos personales ni secretos.
