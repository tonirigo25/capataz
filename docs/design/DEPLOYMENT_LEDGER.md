# Ledger de despliegues de diseño

| Bloque | SHA | Railway deployment | Estado | URL | Staging | Producción |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline heredado | `21412ff4a500394ea97939fd604374612b44dcda` | `a121e321-c2a0-4dc5-9117-72532a555bcc` | `SUCCESS` | `https://orqena-review-web-review.up.railway.app` | Sin cambios | Sin cambios |
| D0 baseline | `6485044c9e931e0068f4bc96ad5ac58078a6575e` | `4411a34c-5375-4129-9c7b-b5ffa3979641` | `SUCCESS`; público 12/12; auth interrumpida por timeout de transporte | `https://orqena-review-web-review.up.railway.app` | Sin cambios | Sin cambios |
| D0 audit hardened | `82841ff04d7e52e4935e6a0cd1081b6310ad7767` | `fccc3020-5350-4fa3-998d-52a685174f6d` | `SUCCESS`; público 12/12; auth 1 bloqueo de hidratación pendiente de replay | `https://orqena-review-web-review.up.railway.app` | Sin cambios | Sin cambios |
| D1 shell final | `14932a762c2830d0199ffe32bda828dd02785fb8` | `514a7e60-732e-43b0-bd0a-f2e2f3583e1a` | `SUCCESS`; 43 migraciones, salud pública verde, auth 66 combinaciones y 0 bloqueadores | `https://orqena-review-web-review.up.railway.app` | Sin cambios | Sin cambios |
| D2 público final | `4e3974061d6d283104ffb485952b3b1636fd997a` | `2e28891d-0e56-4a1e-b5e3-1b1f14347701` | `SUCCESS`; público 12/12, formulario persistente y auth 66 combinaciones con 0 bloqueadores | `https://orqena-review-web-review.up.railway.app` | Sin cambios | Sin cambios |

Cada fila posterior debe identificar el SHA exacto, los cambios visibles, las rutas revisables, el acceso sintético rotado y las incidencias conocidas.
