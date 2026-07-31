# Auditoría de heroes públicos — Revisión 6

Estado: **CURRENT — PR #63, Revisión 6**

## Criterio

Se preserva cualquier hero que ya equilibra copy y visual. Sólo se sustituye la geometría divergente: títulos encerrados, grids 48/52 vacíos, anchos de 75/82 rem incompatibles o páginas legales sin shell público. No se han tocado reglas de negocio, datos, portal autenticado ni comportamiento de los ejemplos.

| Rutas | Antes | Variante | Visual | Resultado |
| --- | --- | --- | --- | --- |
| `/` | Split interactivo aprobado | Existente, preservado | Demo completa | Sin cambio estructural |
| `/producto` | Split R4 equilibrado | `split` | Producto | Conservado sobre adaptador común |
| `/producto/*` (10) | Hero bespoke + escena duplicada | `split` | Escena real por módulo | Copy 5/12, escena 7/12, sin duplicación |
| `/soluciones` | Split con visual fuerte | `split` | Interfaz de solución | Se conserva el patrón bueno: copy a la izquierda y producto a la derecha |
| `/soluciones/*` (8) | Split R4 | `split` | Interfaz por solución | Conservado sobre adaptador común |
| `/sectores` | Hero bespoke | `wide-editorial` | Leyenda operativa | Hub editorial sin margen arbitrario |
| `/sectores/*` (2) | Hero bespoke | `split` | Escena por sector | Copy y escena equilibrados |
| `/precios` | Split pese a mensaje de decisión | `centered` | Explorador bajo copy | Jerarquía comercial centrada |
| `/planes` | Hero legacy | `centered` | Aviso de beta | Contrato público unificado |
| `/recursos` | Copy estrecho | `wide-editorial` | Escenario de margen | Lectura editorial más amplia |
| `/empresa` | Copy estrecho | `wide-editorial` | Panel de principios | Composición editorial equilibrada |
| `/contacto` | Grid aislado | `split` | Formulario | Formulario conserva 55 % del ancho |
| `/seguridad`, `/estado`, `/soporte` | Mezcla de split vacío y hero suelto | `centered` | Opcional bajo copy | Se elimina el hueco derecho sin perder contenido |
| `/privacidad`, `/terminos`, `/cookies`, `/politicas` | Layout legal aislado | `centered`, compacto | Ninguno | Shell y anchura legal comunes |
| `/legal/*` | Layout interno divergente | `centered`, compacto | Ninguno | Cabecera común, cuerpo legal intacto |
| `/funcionalidades`, `/para-autonomos`, `/para-empresas` | Split sin visual | `centered` | Ninguno | Sin media cabecera vacía |
| `/demo` | Experiencia guiada propia | Split propio preservado | Workspace interactivo | No se rompe la demo aprobada en móvil |

## Inventario revisado

El inventario incluye las 37 rutas canónicas del sitemap y las rutas públicas adicionales de navegación: `/funcionalidades`, `/para-autonomos`, `/para-empresas`, `/planes`, `/politicas` y aliases `/legal/*`. `/capataz` mantiene su redirección a `/producto`.

## Evidencia

Las capturas se guardan en `artifacts/design-v2/correction-pr63/revision-6-desktop-layout/` con carpetas por viewport. La auditoría compara la portada y Producto antes/después y añade las rutas representativas de cada plantilla.
