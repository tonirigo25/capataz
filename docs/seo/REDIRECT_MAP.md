# Mapa de redirecciones y compatibilidad

Estado: contrato preparado en PR #63. Las redirecciones conservan ruta y query cuando corresponde; nunca trasladan una sesión entre hosts.

| Origen | Destino | Código | Query | Motivo |
|---|---|---:|---|---|
| `https://orqenatech.com/capataz` | `https://orqenatech.com/producto` | 301 | Conservada | Sustituir la ruta pública antigua por la canónica de producto |
| `https://www.orqenatech.com/*` | `https://orqenatech.com/*` | 301 | Conservada | Unificar host público |
| Dominios defensivos `/*` | `https://orqenatech.com/*` | 301 | Conservada | Unificar host y evitar duplicados |
| `https://app.orqenatech.com/` | `https://orqenatech.com/` | 307 | Conservada | Separar entrada pública de aplicación |
| Rutas públicas abiertas desde `app.orqenatech.com` | Misma ruta en `https://orqenatech.com` | 307 | Conservada | Mantener la frontera entre marketing y aplicación |

## Excepción autenticada

`https://app.orqenatech.com/capataz` continúa temporalmente como alias técnico de la superficie autenticada. No recibe canonical público, no entra en sitemap y permanece `noindex`. En el dominio público, la misma ruta nunca renderiza contenido antiguo: responde 301 a `/producto`.

## Criterios de prueba

- `/capataz?utm_source=legacy` termina en `/producto?utm_source=legacy` con 301.
- `www` y dominios defensivos no producen una cadena adicional al recibir `/capataz`.
- La ruta autenticada no se redirige a marketing.
- No se aceptan destinos externos, dobles barras ni fragmentos inyectados.
