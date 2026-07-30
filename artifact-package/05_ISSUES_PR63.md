# ISSUES OBLIGATORIOS DE LA PR #63

Resolver todos los threads abiertos y dejar respuesta y evidencia.

## P1 — Origin del hostname marketing

Problema: un POST desde `https://orqenatech.com` puede ser rechazado por la validación del navegador antes del host routing.

Corregir:

- incluir el origen canónico de marketing de forma explícita;
- conservar allowlist cerrada;
- no usar wildcard CORS;
- mantener CSRF/Origin;
- probar Review, Staging y configuración equivalente a Production;
- probar el formulario desde el hostname marketing real.

## P1 — Hover bridge del mega menú

Problema: el gap de `0.65rem` y `overflow:hidden` pueden cerrar el panel antes de alcanzar los links con el ratón.

Corregir mediante:

- bridge en root no recortado;
- o eliminar el gap;
- o un patrón accesible de apertura/cierre con retardo controlado.

Pruebas:

- trigger → primer link;
- trigger → último link;
- cambio Producto ↔ Soluciones;
- teclado;
- Escape;
- click exterior;
- touch.

## P2 — CTA demo

Problema: `/demo#solicitar-acceso` no corresponde a una ancla existente.

Usar ruta real, preferentemente:

```text
/contacto?motivo=demo
```

O crear una sección real y comprobar la posición final.

## P2 — Fragmentos inexistentes

No enlazar a IDs inexistentes.

Corregir rutas/IDs de:

- trabajo;
- dinero;
- IA;
- control;
- clientes;
- documentos;
- equipo.

Cada item del mega menú necesita una prueba de destino final.

## P2 — Visual diff focal

El validador no debe intentar abrir screenshots que el run no generó.

Implementar:

```text
diffViewportKeys = standardDiffViewportKeys ∩ screenshotViewportKeys
```

Añadir test con subconjunto de viewports.

## P2 — APP_RELEASE_SHA vacío

Normalizar una sola vez:

```text
trim(APP_RELEASE_SHA)
→ si vacío, Railway SHA
→ si vacío, Git SHA
→ unknown
```

Crear helper canónico y reutilizarlo en:

- health;
- logger;
- release metadata;
- request context;
- synthetic smoke.

## Requisito de resolución

Para cada issue:

1. reproducir o crear test rojo;
2. aplicar fix;
3. ejecutar test verde;
4. responder al comentario;
5. resolver el thread;
6. registrar evidencia en la PR.

No marcar los threads como resueltos sin un commit o una explicación técnica verificable.
