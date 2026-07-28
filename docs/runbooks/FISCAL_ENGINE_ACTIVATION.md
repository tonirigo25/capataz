# Activación y reversión del motor fiscal

## Precondiciones

1. Fijar SHA de release, versión de software y hash de configuración.
2. Obtener cierre firmado de `FISC-001` para ese release y configuración.
3. Ejecutar `npm run readiness:validate-f3` y `npm run readiness:validate-f3-postgres` en PostgreSQL aislado.
4. Verificar migraciones, backups/restauración y acceso de mínimo privilegio.
5. Instalar referencias de certificado/endpoint en el gestor de secretos; nunca material en repo, base de datos general o logs.
6. Activar por una empresa piloto y en `shadow`; comparar exportación con el sistema anterior.
7. Pasar a `sandbox` con aceptación humana y monitorización de errores/acuse.

## Puertas independientes

- `enabled`: permite que el motor procese una solicitud.
- `allowLiveIssuance`: autoriza emisión live; off por defecto.
- `allowLiveQr`: autoriza URL QR live; off por defecto.
- `allowLiveTransmission`: autoriza transporte fiscal live; off por defecto.
- Factura pública B2B: además exige orden ministerial efectiva, aprobación externa de esquemas y credenciales autorizadas.

Un flag de UI no sustituye ninguna puerta server-side.

## Verificación de activación

- Una entrada inválida no crea `FiscalDocument`, `FiscalRecord`, evento ni secuencia.
- Repetir una `issuanceKey` idéntica devuelve replay; cambiar el contenido con la misma clave falla.
- Alta, evento y outbox se confirman en la misma transacción.
- La huella se recomputa desde `canonicalInput` y la huella anterior.
- La consulta muestra release, configuración, versión, modo y retención.
- Ningún proveedor real recibe tráfico durante shadow o pruebas fake.

## Reversión

Desactivar primero transmisión live, QR live, emisión live y por último el motor. No borrar ni actualizar documentos, registros, eventos, artefactos o declaraciones. Conservar outbox y transmisiones fallidas para diagnóstico. La migración F3 es aditiva y la reversión operativa es lógica; eliminar evidencia fiscal no es un rollback permitido.

## Incidente

Ante desajuste de hash, duplicado, hueco inesperado o error de proveedor: bloquear nuevas emisiones de la empresa afectada, preservar evidencia, exportar manifiesto verificable, registrar release/configuración y escalar a responsable fiscal y seguridad. No corregir una factura emitida por edición: usar rectificativa o anulación según decisión fiscal autorizada.
