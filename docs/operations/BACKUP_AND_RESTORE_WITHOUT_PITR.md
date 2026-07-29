# Backup y restore sin PITR

Estado: `PASS_WITH_SNAPSHOT_RECOVERY`

Este procedimiento cubre el sistema operativo de snapshots y restore lógico
cuando no existe PITR. El primer snapshot y un restore local efímero ya fueron
ejecutados y verificados; no se afirma recuperación a un punto arbitrario.

## Modelo operativo

- Fuente: PostgreSQL de Production en lectura durante la exportación.
- Destino: bucket R2 privado en la UE.
- Snapshots PostgreSQL: cada 6 horas y en cada `push` a `main`; RPO objetivo
  `6 h`.
- Railway Production: `Wait for CI` activado; el snapshot del `push` debe
  terminar antes del despliegue.
- Backup, retención y restore comparten un grupo de concurrencia; ninguna
  operación de restic poda o restaura mientras otra modifica el repositorio.
- Documentos: copia diaria en `current` y versión fechada en `versions`.
- Versiones de documentos: retención de 365 días, aplicada sólo al prefijo
  `documents/versions`; no afecta al repositorio Restic.
- Retención restic: últimos 28, diarios 14, semanales 8 y mensuales 12.
- Restore periódico: PostgreSQL local efímero, aislado y destruido al final.
- Alertas: issue genérica en fallo; cierre tras dos éxitos consecutivos.
- Fallback local: secreto de recuperación con DPAPI y tarea diaria a las
  `04:53`, estado `Ready`.
- Secretos GitHub: 10 secretos aislados en el environment
  `backup-production`; no permanecen copias a nivel de repositorio.
- R2: token GitHub de lectura/escritura limitado a `orqena-backups-eu` y
  token GitHub de solo lectura limitado al bucket fuente de documentos,
  ambos separados de las credenciales de la aplicación y validados antes de
  revocar los tokens sustituidos.
- Claves Restic: dos claves activas verificadas; automatización y recuperación
  local DPAPI.
- El head, el número de migraciones y la versión de PostgreSQL se derivan del
  propio archivo de `pg_dump`; no se consultan en sesiones vivas posteriores.
- El restore fija el ID completo del snapshot validado antes de leer datos.
- El fallback se ejecuta con PowerShell 7, propaga la ruta exacta del almacén
  DPAPI y registra el SHA del deployment `SUCCESS` actual de Railway. Si la
  consulta autenticada no está disponible, identifica explícitamente el SHA
  como último conocido al instalar.

El RPO es un objetivo de programación, no una garantía de PITR. No existe
rango continuo recuperable.

## Primera evidencia ejecutada

El `2026-07-29T07:28:10Z` se completó el primer snapshot:

- tamaño `1.155.255` bytes;
- checksum SHA-256 registrado sólo como prefijo `ae61715af3aa`;
- snapshot restic registrado sólo como prefijo `8d412d8df4e9`;
- `restic check`: `PASS`;
- 44 migraciones, 0 pendientes y head
  `20260728180000_add_stripe_billing_foundation`.

No se registran el checksum completo, el nombre privado del objeto, URLs
firmadas ni credenciales.

## Restore drill ejecutado

El snapshot se restauró en un PostgreSQL local efímero:

- estado: `PASS`;
- RTO observado: `226 s`;
- `pg_restore`: `PASS`;
- checksum: `PASS`;
- `restic check` completo: `PASS`;
- 44 migraciones, 0 pendientes y head esperado;
- 7 tablas verificadas;
- relaciones huérfanas: 0;
- agregados no PII, en el orden de la evidencia:
  `5|6|10|18|5|3`.

Production no se modificó. El contenedor, la red y los demás temporales del
drill fueron eliminados después de conservar la evidencia no sensible.

## Documentos

La automatización diaria mantiene una réplica `current`; los objetos
reemplazados o eliminados del espejo se mueven a un prefijo fechado bajo
`versions`. El canario pasó con un origen vacío, lo que valida el contrato de
rutas y el comportamiento sin documentos; no prueba todavía restauración de
un corpus productivo no vacío.

La copia versionada del canario se recuperó a un directorio temporal local:
`PASS`, 32 bytes y checksum validado. El archivo temporal se eliminó. Esta
prueba demuestra recuperación del objeto sintético, no de un corpus real
todavía inexistente en el bucket fuente.

## Procedimiento de siguientes ejecuciones

1. Confirmar SHA, deployment, head y número de migraciones productivos.
2. Confirmar por nombre, sin imprimir valores, las referencias de base y R2.
3. Exportar de forma consistente y calcular checksum/tamaño antes de subir.
4. Ejecutar `restic check` y guardar sólo metadatos no sensibles.
5. Restaurar exclusivamente en un PostgreSQL efímero aislado.
6. Verificar checksum, migraciones, tablas, agregados y aislamiento tenant.
7. Eliminar temporales sólo después de preservar la evidencia.

## Fallo seguro

- Si el checksum cambia, no restaurar.
- Si el destino no es inequívocamente aislado, abortar.
- Si hay divergencia de conteos o tenant, no declarar recuperabilidad.
- Si una migración es incompatible, usar forward-fix probado; nunca destruir
  datos ni revertir a ciegas.
- No apuntar `DATABASE_URL` de Production al restore.

## Evidencia vigente

- Configuración: `docs/operations/evidence/backup-setup.json`.
- Primer backup: `docs/operations/evidence/first-backup.json`.
- Restore: `docs/operations/evidence/restore-drill.json`.
