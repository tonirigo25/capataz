# Backups, PITR, restore drill y aislamiento

Estado: automatización y puertas listas; activación/inspección de políticas Railway y el primer restore remoto necesitan autorización externa porque cambian infraestructura persistente o crean un servicio.

## Puerta fail-closed

En `preview`, `staging` y `production` el runtime exige `DEPLOYMENT_ENVIRONMENT_ID`, `DATABASE_RESOURCE_ID`, `STORAGE_RESOURCE_ID` y `CREDENTIAL_SCOPE`. Preview/staging deben recibir los IDs y SHA-256 de referencia de producción; preview también los de staging. El proceso calcula el SHA-256 de su propia `DATABASE_URL` en memoria, nunca la imprime, y bloquea coincidencias. Storage, base y credenciales deben tener scopes distintos.

Esta puerta se ejecuta en arranque, no durante el build, para evitar que secretos sellados se copien a artefactos. Un preview sin recursos propios no arranca.

## Política objetivo a activar

- Volúmenes: daily + weekly + monthly, con la retención que permita Railway y alerta ante ejecución ausente/fallida.
- PostgreSQL: PITR habilitado, primer base backup confirmado y ventana visible.
- Almacenamiento de objetos: versionado/retención del proveedor y export de manifest/hashes independiente.
- Revisión mensual de restaurabilidad y trimestral de restore completo.

Referencia oficial Railway para backups de volúmenes: https://docs.railway.com/volumes/backups

## Restore drill

1. Congelar `source service ID`, timestamp objetivo, release y checksum lógico sin imprimir secretos.
2. Crear un servicio PostgreSQL nuevo mediante la acción oficial “Restore to this moment”. Nunca restaurar sobre el origen.
3. Verificar que el origen sigue healthy y que su deployment/volume no cambió.
4. Conectar un validador read-only al servicio restaurado; contar migraciones, tenants y registros críticos, y comparar checksum lógico.
5. Medir `RPO = target timestamp - last recoverable transaction` y `RTO = validation complete - drill start`.
6. Registrar evidencia, desconectar y eliminar sólo el servicio temporal con autorización explícita.

Railway documenta que PITR crea un servicio hermano nuevo y no toca el origen: https://docs.railway.com/volumes/point-in-time-recovery

## Puertas de cierre

`STOR-008` no pasa hasta ver políticas/alertas activas. `STOR-009` no pasa hasta ejecutar el restore real y medir RPO/RTO/checksum. `STOR-007` requiere IDs/credenciales/buckets reales separados. El código y el simulacro local no sustituyen estas pruebas.
