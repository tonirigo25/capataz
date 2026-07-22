# Memoria de Orqena

`BusinessMemory` guarda recuerdos controlados por empresa y, cuando corresponde, usuario o entidad. Distingue hechos, preferencias, terminología, procesos, valores por defecto y aliases; conserva origen, estado, confirmante y caducidad.

Una sugerencia no se usa como hecho. Solo se recuperan recuerdos `CONFIRMED`, no archivados y no caducados. Los datos fiscales, bancarios o económicos requieren revisión explícita. La interfaz `/configuracion/memoria` permite buscar, confirmar, rechazar y archivar sin presentar detalles de base de datos.

No se guarda el chat completo como memoria. Las correcciones deben crear o conservar trazabilidad y archivar la versión sustituida.
