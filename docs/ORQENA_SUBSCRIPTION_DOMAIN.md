# Dominio de suscripción

`Subscription` registra plan, estado, trial, periodo, cancelación, proveedor, referencias externas opcionales y cambio programado. El historial es append-only. Los estados son `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCELED` y `EXPIRED`.

`LocalBillingProvider` es la implementación inicial. No cobra, no necesita secretos y permite pruebas reproducibles. Un proveedor externo futuro debe implementar la misma interfaz; no existe integración Stripe operativa.
