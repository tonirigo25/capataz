# Matriz Stripe — contrato frente a Sandbox remoto

Esta matriz separa dos evidencias que no son intercambiables:

- `contract`: funciones puras, proveedor fake, base aislada o inspección
  estructural ejecutada contra el código de la release;
- `remote-sandbox`: interacción real con la cuenta Stripe Sandbox, Checkout,
  Portal, webhooks y Test Clocks.

`npm run test:stripe-billing` valida el contrato local. No es un E2E de Stripe y
no puede marcar `remote-sandbox=PASS`. El runner
`scripts/validate-stripe-sandbox-remote.ts` hace inventario remoto de sólo
lectura por defecto y rechaza siempre claves Live. El opt-in separado
`STRIPE_SANDBOX_REMOTE_ALLOW_WRITES=true` permite únicamente fixtures
desechables Sandbox con `run_id` y direcciones `example.invalid`. El inventario
o la mera creación de un fixture no convierten Checkout o Test Clock en PASS.

| ID | Escenario | Contrato local | Sandbox remoto requerido | Ejecución remota necesaria |
| --- | --- | --- | --- | --- |
| S01 | starter mensual con tarjeta | Price resolver y Checkout contract | Sí | Checkout real con tarjeta test |
| S02 | pro anual con tarjeta | Price anual | Sí | Checkout real con tarjeta test |
| S03 | business mensual con Link | catálogo y política Link | Sí | Checkout real mostrando Link |
| S04 | trial de 3 días | trial y método obligatorio | Sí | Checkout + Test Clock |
| S05 | fin de trial y primer pago | `invoice.paid` reactiva | Sí | Test Clock + pago test |
| S06 | 3DS requerido | ningún grant por success URL | Sí | tarjeta test 3DS |
| S07 | SEPA en processing | processing no equivale a paid | Sí | Checkout SEPA test |
| S08 | SEPA pagado | `invoice.paid` canónico | Sí | liquidación Sandbox |
| S09 | SEPA fallido | fallo inicia gracia | Sí | fallo asíncrono Sandbox |
| S10 | tax España | automatic tax, dirección y tax exclusive | Sí — PASS 2026-07-29 | cálculo Stripe Tax Sandbox |
| S11 | tax ID español | campos B2B requeridos | Sí | Checkout con NIF test |
| S12 | empresa UE con VAT ID válido | estado `verified` documentado | Sí | `000000000` y webhook |
| S13 | VAT ID inválido | estado `unverified` fail-closed | Sí | `111111111` y webhook |
| S14 | VAT ID pendiente | estado `pending` fail-closed | Sí — PASS 2026-07-29 | `222222222` observado pendiente |
| S15 | cliente sin dirección | colección requerida | Sí | intento de Checkout incompleto |
| S16 | país UE bloqueado en Live | simulación `livemode=true` | No | nunca probar creando objetos Live |
| S17 | evento duplicado | unique event ID y replay | No | fake/DB aislada suficiente |
| S18 | evento fuera de orden | timestamp monotónico | No | fake/DB aislada suficiente |
| S19 | upgrade con prorrata | configuración y contrato | Sí | Subscription API test |
| S20 | downgrade al final | schedule contract | Sí | Subscription Schedule test |
| S21 | cambio mensual/anual | resolver bidireccional | Sí | endpoint OWNER + Subscription test |
| S22 | cancelación al final | `cancel_at_period_end` | Sí | Portal Sandbox |
| S23 | impago días 0–3 | estado y gracia | Sí | Test Clock |
| S24 | sólo lectura desde día 4 | job idempotente con DB fake | Sí | Test Clock + job Staging |
| S25 | recuperación de pago | limpia gracia/read-only | Sí | pago recuperado Sandbox |
| S26 | Portal sin autorización | capability OWNER | No | evidencia app aislada/Staging, no Stripe remoto |
| S27 | companyId cruzado | contexto server-side | No | evidencia app aislada/Staging, no Stripe remoto |
| S28 | segunda suscripción activa | lock/reserva y rechazo | No | concurrencia aislada, no inventario Stripe |
| S29 | success URL sin webhook | no concede acceso | No | contrato app/webhook aislado |
| S30 | billing flag false | efectos externos apagados | No | gate local es la autoridad |
| S31 | aviso de límite al 80 % | motor real de límites | No | fake aislado suficiente |
| S32 | bloqueo al 100 % | nuevas escrituras bloqueadas | No | fake aislado suficiente |
| S33 | lectura tras bloqueo | lectura permitida | No | fake aislado suficiente |
| S34 | no borrado de datos | estado conserva acceso básico | No | revisión DB aislada suficiente |

Estado registrado:

```text
CONTRACT_PASS
REMOTE_SANDBOX_PARTIAL
REMOTE_SANDBOX_PASS=S10,S14
REMOTE_SANDBOX_NOT_RUN=20
LIVE_CHARGES_CREATED=0
```

S10 se ejecutó en Stripe Sandbox con `txcd_10103001`, importe exclusivo de
3.900 céntimos EUR y dirección Madrid 28001. Resultado: impuesto exclusivo
819, total 4.719, tipo efectivo 21 %, `livemode=false`; ID abreviado
`taxcalc_1TyY9…`. La evidencia no sensible está en
`docs/billing/evidence/stripe-sandbox-remote-2026-07-29.json`.

El runner remoto con escritura explícita verificó 3 Products y 6 Prices, creó
cuatro Checkout Sessions, una Portal Session, un Test Clock, un cálculo Tax y
tres Tax IDs exclusivamente Sandbox. Expiró las sesiones y eliminó Customers y
Test Clock sin errores de limpieza. S14 observó el estado `pending`. Los IDs
mágicos destinados a S12 y S13 permanecieron `pending` durante la espera
acotada; por tanto esos dos escenarios siguen `NOT_RUN` y no se sobredeclaran.

El inventario remoto confirmó además configuración de métodos de pago default
Sandbox con Card, Link y SEPA Direct Debit disponibles y preference `on`;
Stripe Tax activo con sede presente; y registro fiscal de prueba ES `active`,
tipo `standard`, `place_of_supply_scheme=standard`. Los IDs se conservan
abreviados (`pmc_…`, `taxreg_…`).

No se aceptan capturas manuales como sustituto de event IDs, timestamps y
resultados sanitizados. Los IDs de Customer, Checkout, Subscription, Invoice y
Test Clock deben ser exclusivamente Sandbox y aparecer abreviados. Link y 3DS
siguen `NOT_RUN` mientras no se complete el Checkout alojado con UI.

La release incorpora una migración aditiva posterior al baseline de 44. El
conteo esperado tras desplegar esta release es 45; sólo una consulta autenticada
al entorno puede afirmar `45 aplicadas / 0 pendientes`. Este documento no
afirma que Review, Staging o Production ya la hayan aplicado.
