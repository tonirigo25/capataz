# Stripe Billing v1 — contrato operativo

Estado de esta entrega: `STRIPE_READY_FOR_FINAL_LIVE_AUTHORIZATION` sólo cuando
los gates automáticos, Sandbox, Review y Staging sean verdes. La presencia de
productos, precios, portal y webhook Live no autoriza cobros.

## Límites de activación

- `BILLING_ENABLED=false`.
- `ORQENA_PUBLIC_REGISTRATION_ENABLED=false`.
- Checkout Live sólo para España y únicamente después de la autorización final.
- `EU_B2B_CROSS_BORDER_ENABLED=false`.
- Ningún Customer, Checkout Session, Subscription, Invoice o PaymentIntent Live
  forma parte de la preparación.
- Stripe no es la autoridad de entitlements: el catálogo interno y el estado
  persistido por empresa siguen siendo la autoridad funcional.
- Una `success_url` nunca concede acceso. Los cambios de acceso proceden de
  eventos Stripe verificados y de jobs idempotentes.

## Catálogo aprobado

Todos los importes son netos, más impuestos, en EUR. Los únicos límites
comerciales aprobados en esta fase son los usuarios.

| planKey | Producto | Mensual | Anual | Usuarios |
| --- | --- | ---: | ---: | ---: |
| `starter` | Capataz Inicial | 39 EUR | 390 EUR | 2 |
| `pro` | Capataz Equipo | 79 EUR | 790 EUR | 5 |
| `business` | Capataz Control | 149 EUR | 1.490 EUR | 15 |

Cada producto usa el Product Tax Code oficial
[`txcd_10103001`](https://docs.stripe.com/tax/tax-codes):
**Software as a service (SaaS) — business use**. Corresponde a software no
personalizado, usado por empresas, que se presta en la nube sin descarga.

Los seis Prices deben usar:

- `currency=eur`;
- `tax_behavior=exclusive`;
- `recurring.interval=month|year`;
- `active=true`;
- quantity fija en `1`.

Stripe documenta que `tax_behavior` no se puede cambiar después de fijarlo como
`exclusive` o `inclusive`. Un Price incorrecto se archiva y se sustituye; no se
reutiliza. Véase
[tax codes and tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior).

## Fuente canónica de Price IDs

Sandbox y Live tienen valores distintos. No se hardcodean IDs.

| Plan | Mensual | Anual |
| --- | --- | --- |
| starter | `STRIPE_PRICE_STARTER_MONTHLY` | `STRIPE_PRICE_STARTER_ANNUAL` |
| pro | `STRIPE_PRICE_PRO_MONTHLY` | `STRIPE_PRICE_PRO_ANNUAL` |
| business | `STRIPE_PRICE_BUSINESS_MONTHLY` | `STRIPE_PRICE_BUSINESS_ANNUAL` |

El resolver es `planKey + billingInterval -> Price ID`. Los alias
`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` y
`STRIPE_PRICE_KEYS` están deprecados. Los tres alias individuales sólo pueden
representar el precio mensual durante la transición. Si un alias y su valor
canónico difieren, readiness falla. `STRIPE_PRICE_KEYS` no puede coexistir con
la fuente canónica porque no expresa el intervalo de forma inequívoca.
Los seis IDs canónicos deben ser distintos. El Portal usa además
`STRIPE_PORTAL_CONFIGURATION_ID`, también específico de Sandbox o Live.

Configuración aprobada:

```text
STRIPE_TRIAL_DAYS=3
BILLING_PAST_DUE_GRACE_DAYS=3
BILLING_ALLOWED_COUNTRIES=ES
EU_B2B_CROSS_BORDER_ENABLED=false
BILLING_ENABLED=false
```

## Checkout alojado

El servidor crea Checkout con:

- `mode=subscription`;
- quantity `1`;
- trial de 3 días;
- `payment_method_collection=always`;
- Card, Link y SEPA Direct Debit;
- `automatic_tax.enabled=true`;
- `billing_address_collection=required`;
- `tax_id_collection.enabled=true`;
- actualización automática de nombre y dirección del Customer;
- metadata `companyId`, `planKey`, `interval` y `environment`;
- idempotency key derivada de empresa e intento controlado en servidor.

El `companyId` procede de la sesión autenticada, nunca del navegador. Sólo un
OWNER con `company.billing.manage` puede abrir Checkout o Portal. Antes de
crear una sesión se comprueba que la empresa no tenga otra suscripción no
terminal.

El trial debe presentar duración, precio posterior, periodicidad, primera fecha
de cargo, renovación automática y forma de cancelar. Stripe exige cumplir los
requisitos de redes de tarjetas para trials y documenta las notificaciones en
[subscription trials](https://docs.stripe.com/billing/subscriptions/trials).

## Estados y acceso

| Estado | Acceso |
| --- | --- |
| `trialing`, `active` | Plan contratado |
| `past_due`, días 0–3 desde el primer fallo | Acceso completo |
| `past_due`, desde día 4 | Sólo lectura |
| `paused`, `unpaid`, `incomplete_expired` | Sólo lectura |
| `canceled` antes de `current_period_end` | Acceso hasta final de periodo |
| `canceled` después de `current_period_end` | Sólo lectura |

La recuperación confirmada por `invoice.paid` restaura acceso. Ningún estado de
billing elimina datos. Un job idempotente aplica la transición al vencer la
gracia aunque no llegue otro webhook.

## Sobreconsumo v1

- Aviso al alcanzar el 80 %.
- Bloqueo de nuevas operaciones al alcanzar el 100 %.
- Lectura siempre permitida.
- Se ofrece renovación o cambio de plan.
- Auditoría e idempotencia en servidor.
- Sin precios metered y sin cargos automáticos.

No se publican límites no aprobados. Para límites distintos de usuarios se usa
exclusivamente el catálogo interno vigente.

## Customer Portal

El Portal permite actualizar el método de pago, consultar facturas, cancelar al
final del periodo y recoger el motivo. La cantidad no es ajustable.

La configuración de Stripe puede facturar una mejora inmediatamente con
prorrata. Los entitlements superiores sólo cambian después de `invoice.paid`.

Stripe limita el downgrade programado al final del periodo a Prices del mismo
Product. Como Capataz usa tres Products, el Portal alojado no expone cambios de
Price: conserva método de pago, facturas y cancelación. Los upgrades y cambios
mensual/anual pasan por un endpoint OWNER autenticado; los inmediatos usan
prorrata y los downgrades se programan mediante Subscription Schedule. Véanse
[Customer Portal](https://docs.stripe.com/customer-management/configure-portal)
y la
[API de configuración](https://docs.stripe.com/api/customer_portal/configurations/update).

Los cambios de plan durante `trialing` permanecen bloqueados salvo que la
versión API y las pruebas demuestren `trial_update_behavior=continue_trial`.

## SEPA

SEPA Direct Debit admite suscripciones en EUR y Checkout recoge el mandato.
Stripe usa el esquema SEPA Core, válido para cuentas personales o empresariales,
no el esquema SEPA B2B. Es un medio de notificación diferida:

- `processing` no equivale a pago;
- `invoice.paid` es la confirmación canónica;
- se procesan éxito y fallo asíncronos;
- el acceso posterior al trial no supera la gracia aprobada sin pago confirmado.

Fuentes: [SEPA Direct Debit](https://docs.stripe.com/payments/sepa-debit) y
[payment method support](https://docs.stripe.com/payments/payment-methods/payment-method-support).

## Webhooks

El endpoint usa body crudo, firma, `event.id` único, respuesta rápida,
procesamiento idempotente, recuperación del objeto Stripe cuando sea necesaria,
tolerancia a eventos fuera de orden, auditoría y logs sin PII.

Eventos:

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
customer.subscription.trial_will_end
invoice.created
invoice.finalized
invoice.finalization_failed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
customer.tax_id.updated
charge.dispute.created
```

Mientras `BILLING_ENABLED=false`, el webhook puede verificar y registrar, pero
no concede entitlements ni genera efectos externos.

## Niveles de evidencia

La matriz S01–S34 tiene dos columnas independientes. Un `PASS` contractual
significa que el código real o un fake aislado ha ejercitado la invariante; no
significa que Stripe haya creado y procesado los objetos de prueba. Checkout,
Link, 3DS, SEPA, Stripe Tax, Portal y los cambios temporales con Test Clocks
siguen como `REMOTE_SANDBOX_NOT_RUN` hasta ejecutar y conservar evidencia
sanitizada.

El inventario remoto de sólo lectura se ejecuta con
`scripts/validate-stripe-sandbox-remote.ts`. Requiere opt-in explícito, una
clave `sk_test_` o `rk_test_`, los seis Price IDs de Sandbox y
`STRIPE_PORTAL_CONFIGURATION_ID`. El runner rechaza claves Live antes de crear
el cliente Stripe. Por defecto sólo lee.

El modo opcional `STRIPE_SANDBOX_REMOTE_ALLOW_WRITES=true` crea exclusivamente
fixtures Sandbox etiquetados con `run_id` y direcciones `example.invalid`.
Expira Checkout Sessions abiertas y elimina Customers y Test Clocks al final.
Las Tax Calculations y Portal Sessions no ofrecen borrado por API y quedan como
objetos de prueba no cobrables. Un fixture creado no marca PASS una prueba de
UI, pago, webhook o avance temporal que no se haya ejecutado.

La evidencia remota actual confirma el inventario de Card, Link y SEPA, el
registro Tax ES de prueba `standard` y S10. Los demás flujos remotos conservan
`NOT_RUN` con causa concreta. Nunca se crean Customer, Invoice, Subscription o
PaymentIntent Live.
