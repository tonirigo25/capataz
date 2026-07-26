# Evaluación técnica de brechas fiscales RRSIF / VERI*FACTU

Estado: implementación técnica F3 validada en entorno aislado; revisión y firma fiscal independiente pendiente.

Fecha de corte normativa: 2026-07-26. Este documento no afirma conformidad jurídica, homologación ni certificación. La decisión legal final corresponde a un especialista fiscal independiente y debe quedar vinculada a un release y una configuración concretos.

## Fuentes primarias verificadas

- [Real Decreto 1007/2023, texto consolidado](https://www.boe.es/eli/es/rd/2023/12/05/1007/con): integridad, conservación, accesibilidad, legibilidad, trazabilidad, inalterabilidad, QR y modalidades del sistema.
- [Orden HAC/1177/2024, texto consolidado](https://www.boe.es/eli/es/o/2024/10/17/hac1177/con): especificaciones técnicas y funcionales del registro de facturación.
- [AEAT - especificación de huella 0.1.2](https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf): orden canónico de campos, UTF-8, SHA-256 y tres vectores oficiales.
- [AEAT - especificación de QR 0.5.0](https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf): parámetros, orden, URLs, leyenda y corrección M.
- [AEAT - ejemplos de declaración responsable 0.5.1](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Verifactu/EjemplosDeclaracionResponsable%28V0.5.1%29.pdf): datos de producto, productor, modalidad, firma y descripción técnica.

## Resultado técnico

| Control | Implementación | Evidencia | Estado |
| --- | --- | --- | --- |
| Documento inmutable | Snapshot canónico independiente de la factura operativa; trigger impide alterar identidad, importes y contenido | `lib/fiscal/engine.ts`, migración F3, PostgreSQL aislado | Técnico completo |
| Decimal y redondeo | `Prisma.Decimal`, cuatro decimales de entrada y HALF_UP por línea/documento | 2 líneas golden y totales exactos | Técnico completo |
| Numeración | Bloqueo transaccional por empresa y secuencia por serie | 8 emisiones concurrentes, 8 números únicos consecutivos | Técnico completo |
| Alta y anulación | Registros append-only, encadenados y con huella previa | 10 registros; recomputación y prueba de manipulación | Técnico completo |
| Huella AEAT | Entrada canónica exacta y SHA-256 mayúsculo | Los tres vectores AEAT 0.1.2 coinciden exactamente | Técnico completo |
| Rectificativas | Sustitución/diferencias, motivo y enlace al original | Prueba conserva original sin sobrescribirlo | Técnico completo |
| QR | Orden `nif`, `numserie`, `fecha`, `importe`; URLs sandbox/live; leyenda por modo | Fixture determinista conforme a especificación 0.5.0 | Técnico completo |
| Firma/certificado | Adaptador inyectable; solo referencias y versiones; material privado fuera de modelo, repo y logs | Fake determinista y rotación v1/v2 | Técnico completo; credencial real no instalada |
| Transmisión | Contrato común fake/HTTP; estado, intentos, acuse, error e idempotencia | 2 llamadas, 1 efecto aceptado, replay sin duplicado | Técnico completo; live bloqueado |
| Libro de eventos | Cadena append-only por empresa, exportable junto con release/configuración | Hash de evento y trigger de base de datos | Técnico completo |
| Declaración responsable | Generador de borrador por producto/release/configuración/capacidades | Borrador marcado inequívocamente como no firmado | Requiere revisión y firma externa |
| Conservación/exportación | Manifiesto canónico con registros, hashes, artefactos, entregas y declaración | Exportación verificada y manipulación detectada | Técnico completo |
| Legacy | Clasificación explícita sin retrocertificación ni transmisión | `LEGACY_NOT_RETRO_CERTIFIED` | Técnico completo |
| Fail closed | Configuración/datos inválidos fallan antes de reservar secuencia | 0 documentos y 0 secuencias tras entrada inválida | Técnico completo |

## Brecha externa restante

`FISC-001` queda `READY_FOR_EXTERNAL_INPUT`. Para cerrarlo como `PASS`, un especialista fiscal independiente debe revisar esta matriz, el contrato `contracts/fiscal/v1/manifest.json`, el borrador de declaración responsable, los resultados ejecutables y el release exacto; después debe registrar identidad, fecha, alcance, reservas y firma. La ausencia de esa firma no bloquea el desarrollo posterior, pero sí impide afirmar conformidad o activar emisión/transmisión real.

## Límites y activación

- Los flags fiscales permanecen desactivados por defecto.
- El modo `live`, el QR live y la transmisión real tienen puertas independientes y fallan cerrados.
- No se ha instalado certificado, endpoint real ni credencial live.
- Una factura histórica no adquiere conformidad por migrarse o exportarse.
- La reversión es lógica: desactivar puertas; la evidencia emitida no se elimina ni reescribe.
