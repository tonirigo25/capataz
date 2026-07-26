# Métricas de producto, unit economics y pilotos

Versión: `f8-v1`
Ámbito: producto Orqena y programa privado de pilotos
Estado de datos reales: no inferido; las pruebas usan exclusivamente fixtures sintéticas.

## Principios

- El valor se mide por resultados: activación, conversión, cobro, deuda recuperada y tiempo ahorrado.
- Los eventos first-party aceptan sólo nombres y propiedades del contrato `contracts/analytics/v1/events.json`; no admiten texto libre ni identificadores directos.
- Actor y referencias de evidencia se pseudonimizan. El panel de plataforma sólo devuelve agregados y nunca asuntos, descripciones, prompts, documentos o contenido de tenants.
- `ANALYTICS_ENABLED` es fail-closed. El navegador y `/api/metrics/web-vitals` permanecen inactivos salvo valor explícito `true`.

## Definiciones estables

| Métrica | Definición `f8-v1` | Fuente admitida |
| --- | --- | --- |
| Activación 7d | Empresa con `activation.completed` y `withinSevenDays=true` / empresas activadas | Eventos first-party allowlisted |
| WAU usuarios | hashes de actor distintos con `user.active` en los últimos 7 días | Eventos first-party |
| WAU empresas | empresas distintas con `user.active` en los últimos 7 días | Eventos first-party |
| Retención M1/M2/M3 | empresas elegibles con actividad en el mes relativo 1, 2 o 3 desde su creación | Eventos first-party y fecha de alta |
| MRR / ARPA | suma y media del último snapshot Stripe `MATCHED`, con cero divergencias y MRR no negativo | Reconciliación del proveedor |
| Coste de servir | suma por infraestructura, IA, almacenamiento, email y soporte sólo con fuente verificada | factura de proveedor, uso medido o parte de tiempo |
| Margen bruto | MRR reconciliado menos coste verificado | dos fuentes anteriores |
| Conversión | aceptados / aceptados, rechazados y caducados | presupuestos operativos |
| Plazo de cobro | días entre emisión y pago | facturas y pagos |
| Deuda recuperada | importe pagado después del vencimiento | pagos vencidos |
| Tiempo ahorrado | minutos con metodología `self_reported` o `workflow_baseline_v1` | eventos allowlisted |
| IA aceptada/corregida | resultados agregados, sin prompt ni output | uso/evaluación gobernados |

Los estados locales simulados nunca contribuyen al MRR. Un coste no verificado no contribuye al margen. La ausencia de fuente real se muestra como ausencia de base; no se sustituye por estimaciones inventadas.

## Programa de pilotos

El contrato fija entre 5 y 10 empresas y un mínimo de 5 pilotos de pago. Cada cohorte registra estado, contrato, consentimiento, objetivos, criterios medibles, cadencia semanal o quincenal, inicio/fin de onboarding, resultado y handoff minimizado entre comercial, soporte y producto.

La implantación técnica está operativa con fixtures, pero la captación real, contratos, consentimientos y pagos están en `READY_FOR_EXTERNAL_INPUT`. Ningún fixture cuenta como piloto real.

## Rendimiento y accesibilidad

El presupuesto versionado está en `contracts/observability/v1/web-performance-budget.json`. La puerta local comprueba páginas públicas centrales con axe WCAG 2.2 AA, teclado, foco visible, preferencia de movimiento reducido y LCP/CLS/INP/FCP/TTFB. Los números locales son evidencia de loopback, nunca se presentan como latencia de staging o producción.
