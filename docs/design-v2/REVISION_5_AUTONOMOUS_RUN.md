# Revisión 5 autónoma — sitio público y vídeo 35 s

Fecha de cierre: 31 de julio de 2026

Rama: `design/orqena-field-os-v2`

PR: `#63` (`Draft`)
Entorno exclusivo: Railway Review `orqena-review-continuous`

## 1. SHA inicial y final de implementación

- SHA inicial recibido: `1cd26084a6608767ae5a6c0001c24db4648697f4`.
- SHA final de código validado y desplegado antes de este commit de evidencia: `106b4f36038c4cd868f8c87101e211e4de1524d3`.
- El commit que contiene este documento y las dos capturas finales es únicamente de evidencia; el SHA exacto de cierre se registra en el handoff de la PR y puede obtenerse con `git rev-parse HEAD`.

## 2. Commits de la revisión

1. `46b1c48` — publica el vídeo de producto optimizado de 35 s.
2. `7143178` — completa la Revisión 5 del sitio público.
3. `969dda1` — centraliza la identidad estructurada del producto.
4. `131ddc6` — endurece los gates de vídeo y SEO de Review.
5. `93863ec` — experimento de estabilización de render; no llegó a Review por CI y fue corregido antes del despliegue.
6. `2eeeae0` — preserva la reproducción pública entre navegadores y revierte el experimento inseguro.
7. `106b4f3` — fija un perfil Lighthouse móvil controlado y corrige accesibilidad real.

## 3. Master de vídeo seleccionado

- Archivo local: `C:\Users\Toniet\Downloads\ORQENA_FIELD_OS_CORTO_DINAMICO_35S.mp4`.
- Duración: 35,3 s.
- Imagen: 1920 × 1080, 30 fps, H.264.
- Audio: no contiene pista de audio.
- Tamaño: 41.137.146 bytes.
- SHA-256: `FC7F3C89774834FB7D495FAA430A2670207AE062D245098CFB53C266229CEC74`.
- Validación visual: nueve fotogramas y una hoja de contacto; sin datos personales, secretos ni marcas de terceros detectadas.

## 4. Entregables web MP4, WebM y poster

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/media/marketing/orqena-video-01-35s.mp4` | 7.102.462 | `05818C286EF524F117BAC449F8EE854F1FA1A6D1940B2B26A77DD74FF4A7F680` |
| `public/media/marketing/orqena-video-01-35s.webm` | 5.530.539 | `D6ECED8BD78D700495F467839DCE6E8A8A9A799AA4A58EEA1DAE2129A2A6E6DF` |
| `public/media/marketing/orqena-video-01-poster.webp` | 98.146 | `4383B3889885DA0C64ACE8B23B0D0C0F4814EEAAC9DC792564E90C2B97FA43A6` |

El reproductor ofrece ambos formatos, poster, `preload="metadata"`, controles accesibles y fallback. Empieza cuando la sección lleva aproximadamente dos segundos visible, se limita a dos reproducciones automáticas y respeta `prefers-reduced-motion`.

## 5. Deployment del vídeo

- Commit: `46b1c48f1d2df9e7a7b717bf1f32234c81ff555d`.
- Deployment Railway: `0e42bcd1-dd17-4dd8-a5aa-ca6180519996`.
- Resultado en su publicación: `SUCCESS`; posteriormente reemplazado de forma normal por deployments de la misma rama.
- URL estable: `https://orqena-review-web-review.up.railway.app`.

## 6. Deployment final Review de la implementación

- Commit de implementación: `106b4f36038c4cd868f8c87101e211e4de1524d3`.
- Deployment: `98330635-074c-4aaa-89e3-10e73c42ddc0`.
- Estado: `SUCCESS` / instancia `RUNNING`.
- Servicio: `orqena-review-web`.
- Environment: `review`.
- Proyecto: `orqena-review-continuous`.
- Healthcheck: `/api/health/ready`.
- Sin `preDeployCommand`, migraciones ni escrituras de base durante esta revisión.

El commit de evidencia que contiene este documento puede sustituir este deployment sin cambiar el runtime; el handoff final registra su ID y SHA exactos.

## 7. Segundo vídeo preparado y no publicado

- Ruta local: `C:\Users\Toniet\Downloads\ORQENA_FIELD_OS_CORTO_PROFESIONAL_52S.mp4`.
- Tamaño: 45.505.058 bytes.
- SHA-256: `E4AD08538F6C049D791024A042D3B6CC5A7A761EA166C8FFCEC5D757F5B2BAA4`.
- Estado: preparado para descarga del propietario; no está versionado ni publicado.

## 8. Páginas y superficies modificadas

- Portada `/`: hero, tabs completos, gráficos, producto en movimiento, flujo público, vídeo, CTA y footer.
- `/producto`, `/demo`, `/precios`, `/recursos`, `/empresa`, `/contacto`, `/seguridad` y `/estado`.
- `/soluciones` y sus rutas públicas.
- Menús, navegación pública, formularios, FAQ, metadata, datos estructurados, noindex de Review y allowlist de rutas públicas.
- No se modificó el portal autenticado.

## 9. Auditorías realizadas

- Inventario y coherencia de rutas públicas.
- Validación de identidad y datos estructurados de organización/producto.
- Contrato del vídeo, MIME, rangos HTTP y reproducción entre navegadores.
- SEO técnico, canonical y `noindex` de Review.
- Accesibilidad automática, teclado y reducción de movimiento.
- Responsive automatizado en móvil, tablet y escritorio.
- Lighthouse en siete rutas con perfil móvil controlado: simulación, RTT 40 ms, 10.240 Kbps y CPU 2×; LCP obligatorio `<= 2,5 s`.
- Screaming Frog: `SKIPPED_NOT_INSTALLED`; sustituido por inventario/validator interno y comprobación HTTP de todas las rutas en alcance.

## 10. Fallos corregidos

- El producto del hero ya cambia de interfaz completa y no sólo de etiqueta.
- Los carruseles y flujos comparten temporización coherente y no remountan el mockup raíz en cada salto.
- La demo guiada, el producto en movimiento y la demo privada tienen contenido realista, control y densidad adecuada.
- El reproductor ya no depende de una única fuente ni de un comportamiento específico de Chromium.
- Se retiró antes de desplegar un experimento de `content-visibility` incompatible con Firefox/WebKit.
- Se corrigieron contraste y tamaño táctil en `/empresa`.
- Se eliminó ambigüedad en datos estructurados de marca y producto.
- Se estabilizaron SEO, rutas y assets bajo el hostname de Review.

## 11. QA

- `npm run build`: PASS, 92 rutas.
- Typecheck: PASS.
- `node scripts/design/validate-revision-5-public.mjs`: PASS, 13 comprobaciones.
- Playwright: Chromium, Firefox y WebKit; vídeo, interacción, reduced motion, responsive y matriz pública: PASS en CI.
- GitHub required checks: application, browser, CodeQL/codeql, supply-chain, launch-infrastructure, critical-database, backup-contract y production-backup: PASS para `106b4f3`.
- Smokes remotos: `/`, `/producto`, `/demo`, `/precios`, `/recursos`, `/empresa`, `/contacto`, `/api/health/live` y `/api/health/ready`: HTTP 200 y `noindex`.
- Review: cero 5xx observados en las rutas verificadas.

## 12. Evidencia

- `artifacts/design-v2/correction-pr63/revision-5/video-master-validation/`.
- `artifacts/design-v2/correction-pr63/revision-5/review-home-desktop.png`.
- `artifacts/design-v2/correction-pr63/revision-5/review-demo-desktop.png`.
- La matriz responsive y las capturas adicionales permanecen en `artifacts/design-v2/correction-pr63/gate-1-revision-5/`.

## 13. Estado de la PR

- PR `#63`: abierta y `Draft`.
- Rama: `design/orqena-field-os-v2`.
- No se abrió otra PR y no se hizo merge.

## 14. Production y otros entornos

- Production: intacta.
- Staging: intacto.
- Railway Review existente: reutilizado; no se creó otro entorno ni servicio.
- Base, migraciones, providers, DNS, flags y portal autenticado: sin cambios.

## 15. Input humano pendiente

Únicamente queda la revisión visual y aprobación del propietario sobre Railway Review. Los tests automáticos no sustituyen esa aprobación.

Estado técnico alcanzado: `PUBLIC_SITE_REVISION_5_READY_FOR_OWNER_REVIEW`.
