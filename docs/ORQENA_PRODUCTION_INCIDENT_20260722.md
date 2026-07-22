# Incidente de production · 22 de julio de 2026

## Resumen y causa

Al conectar la rama de staging a un entorno duplicado dentro de `merry-quietude`, Railway modificó la fuente del servicio lógico compartido. Esto generó deployments de `611c818` y `d068e97` también en `production`. La causa raíz fue asumir que la fuente Git era específica de la instancia de entorno.

## Cronología, contención y restauración

- Estado válido anterior: app `cf703cba-87cb-49e4-b6c3-bb3932b79fcb`, cron `bf68a285-d15a-4e84-b3ef-31b0c3bef098`, `main/a5d384fd749e37f6e3f761e7dacc844933b6d375`.
- Accidentales finales: app `34a40ec4-56e6-425d-9eb7-3bba8d9b363f`, cron `e118d1f8-abfc-4a4b-bb6b-ec0324466601`, ambos `d068e97`.
- Restaurados: app `135dcb92-1ec0-43a9-91a4-5057fb77cb7a`, cron `bb681f97-398e-46a9-a4f9-0ab189c07615`, ambos `SUCCESS` en `main/a5d384f`.
- Healthcheck público, landing y login respondieron 200 por HTTPS; no quedaron deployments pendientes.

No se consultaron filas ni contenidos empresariales. El predeploy de restauración encontró 20 migraciones y registró `No pending migrations to apply`; no aplicó migraciones. El cron accidental ejecutó una evaluación programada: sus logs técnicos declararon cero errores, dos señales actualizadas y dos recomendaciones actualizadas. No se inspeccionaron las entidades afectadas.

## Prevención

Staging no compartirá proyecto ni servicio lógico con production. El staging válido vive en `orqena-staging` (`5a501cb4-639e-4dd3-a1fb-08ae1c839ebb`).

## Retirada del staging fallido

Con autorización separada se eliminó exclusivamente el environment fallido `7af806c2-99b7-4c70-9499-59b4551c5c03` del proyecto `merry-quietude`. Antes de retirarlo se inventariaron sus service instances, deployments, dominio y volume instances. Los IDs lógicos `document-reader-volume` y `postgres-volume` también existían en production, por lo que no se borraron individualmente; Railway eliminó únicamente sus instancias del environment retirado y conservó las de production.

Tras la operación, `merry-quietude` solo enumeró el environment `production`; `capataz-staging.up.railway.app` dejó de estar asociado y respondió 404. Production conservó `main/a5d384fd749e37f6e3f761e7dacc844933b6d375`, deployment `135dcb92-1ec0-43a9-91a4-5057fb77cb7a`, health 200 y sus volúmenes en estado `READY`. El staging independiente conservó `2786acdc44e64ff55ee436ada3617945bc4b5166`, health 200, PostgreSQL y volúmenes propios. No se ejecutaron migraciones, deployments ni cambios de variables durante la retirada.
