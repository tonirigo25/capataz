# Orqena Field OS V2 — deuda visual y decisiones

Estado: CURRENT

## Cerrado por la base Field OS

- Shell responsive por perfil y acceso directo protegido.
- Sidebar desktop, topbar, bottom navigation y captura móvil.
- Smart views, filtros y preview de clientes.
- Cliente y trabajo 360 sin pérdida de datos.
- Estados loading, empty, error, restricted, read-only y reduced motion.
- Demo pública sintética sin persistencia.
- Panel de plataforma, IA proactiva, emails y plantillas documentales conectados a reglas reales.

## Deuda que aborda V2

| Prioridad | Hallazgo baseline | Resolución |
| --- | --- | --- |
| P1 | Home pública demasiado clara y editorial-industrial | fondo oscuro premium y producto visible |
| P1 | Titular de hasta 84 px | escala contenida de 38–64 px |
| P1 | Navegación pública simple | mega menús orientados a resultados |
| P1 | Verde lima dominante | verde `#20B862` sólo como acento y confirmación |
| P2 | Logo textual con poca presencia sobre oscuro | lockup inverso y marca visible |
| P2 | Tokens V1 no coinciden con atlas aprobado | contrato V2 versionado |
| P2 | Varios literales legacy en superficies antiguas | aliases conservados; código V2 sólo con tokens |
| P2 | Evidencia visual dispersa | baseline y QA D13 bajo `design-v2` |

## Deuda no funcional que no justifica una reescritura

- Algunos componentes históricos siguen siendo compactos en una sola línea de JSX.
- Existen wrappers visuales de rutas secundarias que no usa la home canónica.
- Los nombres internos `lime` y algunos aliases legacy se conservan por compatibilidad aunque el valor V2 sea verde.

## Riesgos y límites

- No se eliminan componentes sólo por parecer duplicados si conservan comportamiento de una ruta.
- No se cambia base de datos, migraciones, proveedores, flags ni reglas económicas por una mejora visual.
- Las pruebas físicas iPhone/Android y NVDA/VoiceOver siguen siendo evidencia humana externa.
- Staging y Production no forman parte del despliegue de bloques mientras no terminen los gates y no exista autorización de promoción.
