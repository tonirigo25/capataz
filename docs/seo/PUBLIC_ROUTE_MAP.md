# Mapa canónico de rutas públicas

Estado de la revisión: preparado, con indexación desactivada. `Review`, `Staging` y el host de aplicación deben responder siempre con `noindex`. La publicación del sitemap no autoriza por sí sola la indexación de Production.

## Contrato común

Cada ruta canónica debe tener un solo H1, `title` y `description` propios, canonical absoluto sobre `https://orqenatech.com`, Open Graph, navegación interna y un CTA útil. Los datos estructurados se limitan a hechos verificables. No se generan páginas programáticas vacías.

| Ruta | Tipo | Intención principal | Objetivo | CTA | Schema apto |
|---|---|---|---|---|---|
| `/` | Inicio | software de gestión para construcción y servicios | Presentar el sistema completo | Solicitar demo | `Organization`, `WebSite`, `SoftwareApplication` |
| `/producto` | Producto | plataforma Orqena | Tour interactivo del producto | Ver demo | `SoftwareApplication`, `BreadcrumbList` |
| `/soluciones` | Hub | soluciones de gestión por necesidad | Orientar hacia un flujo concreto | Explorar soluciones | `CollectionPage`, `BreadcrumbList` |
| `/soluciones/clientes-y-presupuestos` | Solución | clientes y presupuestos para reformas | Conectar oportunidad y propuesta | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/obras-y-trabajo` | Solución | gestión de obras y trabajo | Coordinar ejecución, equipo e incidencias | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/control-costes-y-margen` | Solución | control de costes de obra | Explicar coste, desviación y margen | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/facturacion-y-cobros` | Solución | facturación para construcción | Unir ejecución, factura y cobro | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/proveedores-y-subcontratas` | Solución | proveedores y subcontratas | Dar trazabilidad a compras y terceros | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/documentos-y-ocr` | Solución | facturas recibidas y OCR | Reducir transcripción y conservar revisión | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/equipo-y-agenda` | Solución | agenda y equipo de obra | Coordinar responsables, tareas e hitos | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/soluciones/ia-operativa` | Solución | IA para gestión empresarial | Mostrar asistencia revisable y control humano | Solicitar demo | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/precios` | Comercial | planes y precios | Comparar capacidad, usuarios e IA | Solicitar acceso | `SoftwareApplication`, `BreadcrumbList`, `FAQPage` |
| `/recursos` | Recursos | herramientas de gestión de obra | Acceso a guías y utilidades reales | Usar recurso | `CollectionPage`, `BreadcrumbList` |
| `/empresa` | Empresa | Orqena Tech | Explicar propósito, principios y forma de trabajo | Contactar | `Organization`, `BreadcrumbList` |
| `/contacto` | Contacto | solicitar información o demo | Recoger una solicitud explícita | Enviar solicitud | `ContactPage`, `BreadcrumbList` |
| `/demo` | Demo | demostración de software de gestión | Recorrer un caso sintético y controlado | Solicitar demo privada | `SoftwareApplication`, `BreadcrumbList` |
| `/seguridad` | Confianza | seguridad y control de acceso | Explicar límites, aislamiento y reporte | Consultar política | `WebPage`, `BreadcrumbList` |
| `/estado` | Confianza | estado del servicio | Comunicar disponibilidad sin exponer datos | Consultar estado | `WebPage`, `BreadcrumbList` |

## Exclusiones

- Rutas autenticadas, API, PWA privada y `app.orqenatech.com` no entran en el sitemap.
- `/capataz` es un alias técnico: en el host público redirige a `/producto`; en el host de aplicación conserva la ruta autenticada.
- Los entornos de validación siguen cerrados a rastreadores aunque una página tenga metadata completa.
