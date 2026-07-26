# Respuesta a incidentes y brechas

## Severidad y comunicación

| Nivel | Ejemplo | Acuse interno | Objetivo de restauración | Comunicación |
|---|---|---:|---:|---|
| Sev1 | Pérdida de aislamiento tenant, exfiltración o caída total | 10 min | 60 min | Incident commander, seguridad, dirección y afectados cuando proceda |
| Sev2 | Degradación crítica, worker detenido o proveedor esencial | 20 min | 4 h | Incident commander, ingeniería y afectados |
| Sev3 | Impacto parcial con alternativa | 60 min | 24 h | Ingeniería y soporte |
| Sev4 | Riesgo bajo o defecto sin impacto actual | 4 h | 72 h | Responsable del área |

Plantilla inicial: `INCIDENTE <clave> · <Sev> · investigando · impacto confirmado/no confirmado · siguiente actualización <hora>`. No incluir datos personales, payloads ni hipótesis no verificadas.

## Flujo

1. Detectar y registrar hora, alcance conocido, entorno, release y fuente.
2. Nombrar incident commander, operaciones, seguridad/privacidad, comunicación y relator.
3. Contener con acciones reversibles; no destruir evidencia ni tocar el origen durante un restore drill.
4. Si afecta datos personales, abrir `DataBreachIncident`, valorar riesgo y mantener el reloj de 72 horas. La notificación real requiere decisión humana autorizada.
5. Erradicar, restaurar, verificar checksum/aislamiento y monitorizar recurrencia.
6. Cerrar con root cause, timeline, decisiones, comunicaciones y al menos una acción con responsable y fecha.

## Simulacro mínimo

Ejecutar en base aislada: crear incidente Sev2, añadir detección/contención/comunicación, abrir brecha de prueba, decidir notificación, cerrar con postmortem y comprobar que el verificador de auditoría detecta una fila manipulada. No enviar comunicaciones reales.

## Plantillas

- Actualización interna: `Estado / impacto / medidas / riesgos / siguiente decisión / hora`.
- Afectados: hechos confirmados, datos/categorías, medidas, acciones recomendadas y contacto; revisión jurídica previa.
- Postmortem: resumen, impacto, timeline UTC, causa, factores, detección, respuesta, qué funcionó/no funcionó y acciones rastreables.
