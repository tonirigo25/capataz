# Entradas externas pendientes

Este registro separa lo técnicamente verificable de lo que exige personas,
dispositivos, datos, firmas o autorizaciones externas. Ninguna fila cuenta como
PASS y ninguna detiene los bloques que pueden seguir ejecutándose con datos
sintéticos.

| Fase | Estado | Entrada externa necesaria |
| --- | --- | --- |
| C3/C5 | READY_FOR_EXTERNAL_INPUT | Safari en iOS y Chrome en Android físicos; zoom real 200%/400%; NVDA y VoiceOver; aprobación humana de baselines visuales |
| C4 | READY_FOR_EXTERNAL_INPUT | marca y dominio definitivos, identidad legal, textos aprobados, consentimiento para casos/logos/testimonios y autorización explícita de indexación |
| C4/C9 | READY_FOR_EXTERNAL_INPUT | sesiones de comprensión moderadas, 30 entrevistas y autorización de contacto/outreach |
| C6 | READY_FOR_EXTERNAL_INPUT | una ola aprobada e independiente por provider, con credenciales, sandbox/live boundary, observabilidad, kill switch y rollback |
| C7 | READY_FOR_EXTERNAL_INPUT | plan Railway con backup/PITR, política de retención y restore nativo; revisores protegidos de GitHub; pentest independiente; DPIA/DPA y firmas legales/IP |
| C8 | READY_FOR_EXTERNAL_INPUT | dominio y asociaciones App/Universal Links; Android/iOS objetivo; PDFs, picker, uploads y share en dispositivo; JDK/macOS/Xcode, firma y cuentas de store |
| C9 | READY_FOR_EXTERNAL_INPUT | 5–10 empresas piloto reales, al menos 5 pagadas, contratos/consentimientos, entrevistas, facturas de providers, uso y horas de soporte verificadas, decisión de pricing |
| C10 | READY_FOR_EXTERNAL_INPUT | snapshot representativo autorizado y protegido; backup previo; gate completo de staging; aprobación humana go/no-go |
| C11 | READY_FOR_EXTERNAL_INPUT | 30–90 días de operación real: MRR, retención, soporte, costes, incidentes, backups y resultados de pilotos |

## Datos representativos

El restore lógico de `review` usa datos sintéticos de esquema actual. No se
clasifica como ensayo de 43 migraciones/backfills sobre una copia
representativa. Para D1 se necesita un snapshot cuya titularidad, propósito,
protección, anonimización y destino estén autorizados antes de copiarlo.

## Providers

Indexación, billing, email, fiscal, AI, analytics y otros transports live
permanecen apagados. Una entrada externa para un provider no autoriza los demás.

## Producción

La autorización condicional del propietario no es una aprobación inmediata:
`C10_GO_NO_GO.md` permanece en NO-GO hasta que todos los gates de staging →
producción estén documentados como PASS y exista una decisión humana final.
