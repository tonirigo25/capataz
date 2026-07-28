# Operación de pilotos y soporte

## Alta de una cohorte

1. Verificar fuera de Orqena el contrato y el consentimiento aprobados; no marcar `SIGNED` o `GRANTED` sin evidencia.
2. Registrar empresa, clave de cohorte, pago, fechas, objetivos, criterios de éxito y cadencia.
3. Registrar inicio y fin del onboarding. El fin no puede preceder al inicio.
4. Mantener el handoff limitado a resumen comercial, necesidad de soporte y foco de producto; no copiar documentos ni datos de clientes.
5. Al cerrar, registrar `SUCCESS`, `PARTIAL`, `FAILED` o `WITHDRAWN`, un resumen sanitizado y métricas estructuradas.

## Soporte

Los tickets autenticados tienen prioridad, plazo interno de primera respuesta y resolución, estado, minutos acumulados y código de resolución. Los adjuntos pasan por almacenamiento privado y escaneo. El panel de plataforma no muestra asunto ni descripción.

La valoración NPS/CSAT es opcional y exige consentimiento explícito. El permiso de contacto es separado. Los comentarios se redactan antes de guardar. Los testimonios requieren alcance explícito y pueden retirarse; la retirada se registra sin borrar la trazabilidad de consentimiento.

## Activación futura de analítica

1. Revisar el contrato de eventos y la política de consentimiento aplicable.
2. Verificar que el receptor es first-party, que no acepta texto libre y que la retención está aprobada.
3. Activar `ANALYTICS_ENABLED=true` sólo en el entorno autorizado.
4. Ejecutar la suite de privacidad y confirmar que no aparecen PII, prompts, secretos ni IDs directos.
5. Volver a `false` ante cualquier hallazgo; el estado por defecto y de fallo es desactivado.
