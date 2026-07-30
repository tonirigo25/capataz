# QA FINAL, CAPTURAS Y GATES

Ejecutar después de recibir:

`FLUJOS_Y_SISTEMAS_APROBADOS`

## 1. Funcional

Validar:

- formulario demo real;
- confirmación al solicitante;
- aviso a `hola@orqenatech.com`;
- aprobación;
- provisioning;
- invitación 48 horas;
- primer login inicia siete días;
- aviso 24 horas;
- expiración;
- extensión;
- revocación;
- cero cobro;
- 100 operaciones IA;
- emails;
- plantillas;
- dos tenants;
- roles;
- modo read-only.

## 2. Rutas públicas

- `/`
- `/producto`
- `/funcionalidades`
- `/demo`
- `/contacto`
- `/precios`
- `/seguridad`
- `/privacidad`
- `/terminos`
- `/cookies`
- `/login`

Comprobar CTA, links, anclas, canonical y noindex de Review.

## 3. Rutas privadas

- `/hoy`
- `/dashboard`
- `/clientes`
- cliente individual
- `/obras`
- obra individual
- `/presupuestos`
- `/dinero`
- `/tesoreria`
- `/documentos`
- `/agenda`
- `/capataz`
- `/equipo`
- `/configuracion`
- `/plataforma`

## 4. Viewports

```text
320
360
375
390
430
768
1024
1440
1920
```

## 5. Engines

- Chromium;
- Firefox;
- WebKit.

## 6. Estados

- populated;
- loading;
- empty;
- error;
- restricted;
- read-only;
- demo active;
- demo expiring;
- demo expired;
- AI disabled;
- AI allowance exhausted;
- provider error;
- offline;
- reduced motion.

## 7. Accesibilidad

Automatizada:

- Axe;
- teclado;
- foco visible;
- reflow;
- reduced motion;
- forced colors;
- target size;
- contraste.

Humana `READY_FOR_EXTERNAL_INPUT`:

- iPhone Safari;
- Android Chrome;
- NVDA;
- VoiceOver;
- zoom 200 %;
- zoom 400 %.

No inventar resultados humanos.

## 8. Rendimiento

Objetivos:

```text
LCP ≤ 2,5 s
INP ≤ 200 ms
CLS ≤ 0,1
```

Comprobar:

- HTML;
- CSS;
- JS;
- imágenes;
- fonts;
- cold/warm;
- redirects;
- middleware;
- no scroll hijacking;
- lazy loading;
- bundle impact.

## 9. Seguridad

- origin canónico;
- CSRF;
- MFA de plataforma;
- rate limits;
- tenant isolation;
- no secretos;
- no PII en logs;
- R2 privado;
- outbox;
- idempotencia;
- autorización directa de rutas;
- sesión revocada al caducar demo.

## 10. Railway Review

Reutilizar:

```text
orqena-review-continuous
https://orqena-review-web-review.up.railway.app
```

Comprobar:

- mismo SHA;
- noindex;
- health;
- cero 5xx;
- cero errores graves de consola;
- base y volumen preservados;
- datos sintéticos.

No crear otro Review.

## 11. Staging

Sólo después de las tres aprobaciones humanas.

Desplegar exactamente el mismo SHA y repetir smokes focales.

## 12. Production

No modificar en esta tarea.

La entrega final sólo puede declarar:

`ORQENA_FIELD_OS_V2_READY_FOR_PRODUCTION_DECISION`

El merge y la promoción requieren una autorización posterior.

## 13. Evidencia final

Adjuntar:

- índice de capturas;
- reportes machine-readable;
- rutas;
- engines;
- viewports;
- Axe;
- vitals;
- threads resueltos;
- migraciones;
- rollback;
- diferencias respecto al SHA rechazado.
