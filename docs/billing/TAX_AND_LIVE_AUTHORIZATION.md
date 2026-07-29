# Stripe Tax y autorización Live

Este documento es un control técnico fail-closed, no asesoramiento fiscal.
Stripe Tax calcula y genera informes; el titular sigue siendo responsable de
registro, presentación y pago. Véanse
[registro fiscal](https://docs.stripe.com/tax/registering),
[filing](https://docs.stripe.com/tax/filing) y
[reporting](https://docs.stripe.com/tax/reports).

## España

Antes de recaudar IVA Live debe existir evidencia externa de:

1. registro doméstico de IVA español del emisor;
2. fecha efectiva del registro;
3. dirección de sede configurada y verificada;
4. esquema de registro confirmado por revisión fiscal;
5. registro español añadido a Stripe Tax con la fecha efectiva correcta.

Estado hasta recibir esa evidencia:

```text
TAX_REGISTRATION_READY_FOR_EXTERNAL_INPUT
BILLING_ENABLED=false
```

Sandbox sí dispone de Tax settings `active`, sede presente y un registro de
prueba ES `active`, tipo `standard`,
`place_of_supply_scheme=standard`. Esto permite probar cálculos, pero no prueba
ni sustituye el registro fiscal Live del emisor. S10 calculó en Sandbox 21 %
sobre 39 EUR netos: 8,19 EUR de impuesto y 47,19 EUR total, con
`livemode=false`. La evidencia sanitizada conserva sólo IDs abreviados.

La documentación de Stripe presenta para una empresa de la UE un registro
doméstico `standard`, pero su esquema y fecha efectiva no se inventan.

Stripe admite `es_cif` para el NIF español, pero no lo valida contra una base
gubernamental ni altera por sí mismo el cálculo fiscal. El flujo Live exige que
el NIF esté presente y sea aceptado por Stripe; un `eu_vat` sólo se considera
verificado cuando su estado VIES es `verified`. La revisión fiscal y la
responsabilidad sobre los datos del cliente siguen fuera de Stripe.

Stripe no calcula IVA español para Canarias, Ceuta ni Melilla aunque exista un
registro español. `BILLING_ALLOWED_COUNTRIES=ES` no distingue esos territorios.
Por tanto quedan bloqueados hasta diseñar y revisar un flujo IGIC/IPSI. Fuente:
[Stripe Tax en España](https://docs.stripe.com/tax/supported-countries/european-union/collect-tax?tax-jurisdiction-european-union=spain).

## ROI/VIES y ventas B2B intracomunitarias

El emisor todavía no está dado de alta en ROI/VIES. Live queda limitado a
España:

```text
BILLING_ALLOWED_COUNTRIES=ES
EU_B2B_CROSS_BORDER_ENABLED=false
```

La futura inversión del sujeto pasivo requiere conjuntamente:

- evidencia de alta ROI/VIES del emisor;
- VAT ID del cliente con estado `verified`;
- coincidencia de nombre y dirección con la información registrada;
- revisión fiscal externa;
- obligación y proceso de Modelo 349 documentados.

Stripe sólo comprueba el formato del VAT ID durante Checkout. La validación
VIES es asíncrona y puede quedar `pending`, `unverified` o `unavailable`.
Además, Stripe Tax puede aplicar reverse charge por formato antes de conocer la
validez. Esos estados nunca autorizan por sí solos una venta intracomunitaria:
se bloquean o pasan a revisión manual. Stripe tampoco revalida de forma
continua. Fuentes:
[tax IDs in Checkout](https://docs.stripe.com/tax/checkout/tax-ids) y
[Customer Tax IDs](https://docs.stripe.com/billing/customer/tax-ids).

Sandbox usa los IDs oficiales para cubrir estados de validación:

| Valor de prueba | Resultado |
| --- | --- |
| `000000000` | verified |
| `111111111` | unverified |
| `222222222` | pending indefinido |

El evento `customer.tax_id.updated` actualiza el estado interno sin confiar en
el valor remitido por el navegador.

## Gate final

Live sólo puede abrir Checkout cuando todos estos controles estén verdes:

- autorización humana final explícita;
- registro fiscal español y fecha efectiva confirmados;
- productos y Prices Live coincidentes con el catálogo;
- secretos y Price IDs Live separados de Sandbox;
- webhook Live verificado;
- Sandbox, Review y Staging verdes;
- `BILLING_ALLOWED_COUNTRIES=ES`;
- territorios españoles excluidos bloqueados;
- `EU_B2B_CROSS_BORDER_ENABLED=false`;
- registro público todavía apagado.

Preparar objetos Live no satisface este gate. La transición final es un cambio
separado, auditable y reversible de `BILLING_ENABLED=false` a `true`.
