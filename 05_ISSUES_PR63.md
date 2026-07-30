# ISSUES OBLIGATORIOS DE LA PR #63

Resolver todos los threads abiertos con evidencia.

## P1 — Origin marketing

El POST desde `https://orqenatech.com` puede ser rechazado antes del host routing. Incluir el origen canónico explícitamente, mantener allowlist cerrada, CSRF/Origin y probar el formulario desde hostname marketing.

## P1 — Hover bridge

El gap y `overflow:hidden` pueden cerrar el mega menú antes de alcanzar los links. Mover el bridge al root no recortado, eliminar el gap o usar un patrón estable. Probar ratón, teclado, Escape, click exterior y touch.

## P2 — CTA demo

`/demo#solicitar-acceso` no existe. Usar `/contacto?motivo=demo` o una ancla real probada.

## P2 — Fragmentos inexistentes

Corregir rutas/IDs de trabajo, dinero, IA, control, clientes, documentos y equipo. Cada item debe probar su destino final.

## P2 — Visual diff focal

Intersectar `diffViewportKeys` con `screenshotViewportKeys`. Añadir test con subconjunto de viewports.

## P2 — APP_RELEASE_SHA

Normalizar con `trim()` y fallback único a Railway SHA, Git SHA o `unknown`. Reutilizar helper en health, logger, release metadata, request context y synthetic smoke.

## Cierre de threads

Para cada issue:

1. test rojo o reproducción;
2. fix;
3. test verde;
4. respuesta al comentario;
5. resolver thread;
6. evidencia en PR.
