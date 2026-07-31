# Sistema compartido de heroes públicos

Estado: **CURRENT — PR #63, Revisión 6**

## Decisión

La portada existente sigue siendo la referencia del patrón `split`: mensaje y CTA a la izquierda, producto interactivo a la derecha. No se rehace una página que ya mantiene ese equilibrio. El componente compartido normaliza las páginas que antes heredaban una columna estrecha o un hueco vacío.

## Variantes

| Variante | Uso | Regla de escritorio | Móvil |
| --- | --- | --- | --- |
| `centered` | Página sin visual fuerte, estado, soporte y legal | Copy centrado de hasta 56 rem; visual opcional debajo | Una columna, alineación izquierda y misma jerarquía |
| `split` | Producto, solución, sector, formulario o mockup | Rejilla 5/7 con copy y visual equilibrados | Copy antes del visual, sin posiciones absolutas |
| `wide-editorial` | Hub o página editorial con narrativa amplia | Copy hasta 10 de 12 columnas y visual desde la cuarta | Una columna, lectura natural |

## Componentes canónicos

- `PublicPageHero`
- `PublicHeroCopy`
- `PublicHeroVisual`
- `PublicHeroActions`
- `PublicHeroTrust`
- `PublicHeroMetrics`
- `PublicHeroMedia`

La implementación vive en `components/marketing/public-page-hero.tsx` y `public-page-hero.module.css`. `R4Hero` es únicamente un adaptador de contenido histórico; no mantiene otra rejilla.

## Geometría

- Contenedor máximo: 1280 px.
- Gutter: 40 px a 1280, 48 px a 1440 y 80 px desde 1600.
- H1: 48–60 px en escritorio, máximo 64 px.
- Subtítulo: 18–21 px, ancho útil máximo 760 px.
- Separación vertical del hero: 88–124 px.
- Sin márgenes negativos, `translate` ni posicionamiento absoluto para compensar el layout.

## Contrato de validación

Cada hero compartido expone `data-public-layout="hero"` y `data-public-hero-layout`. La matriz focal comprueba 390×844, 1440×1000 y 1920×1080, overflow horizontal, anchura útil y enlace de marca a `/`.
