# Activación controlada de IA y correo transaccional

Fecha: 2026-07-29

Estado: `AI_AND_TRANSACTIONAL_EMAIL_LIVE_CONTROLLED` al promover esta release y completar sus gates remotos

Alcance: Capataz, by Orqena

## Autorización y límites

La autorización cubre IA real con fixtures sintéticos, voz y transcripción, y
correo transaccional para recuperación, invitaciones y contacto. En Production
la IA se limita a la empresa controlada mediante allowlist; no queda abierta a
todas las empresas.

Límites iniciales:

- 25 EUR al mes globales;
- 5 EUR al mes por empresa;
- 50 solicitudes al día por usuario;
- límites de entrada y salida fijados por entorno;
- kill switch global, por entorno y por empresa;
- fallback manual cuando el proveedor o un límite impide continuar.

Permanecen apagados:

- `BILLING_ENABLED=false`;
- `ORQENA_PUBLIC_REGISTRATION_ENABLED=false`;
- `EU_B2B_CROSS_BORDER_ENABLED=false`;
- `BILLING_ALLOWED_COUNTRIES=ES`;
- fiscalidad live, analytics no esenciales e indexación;
- extracción IA de documentos;
- campañas y tracking de correo.

## Controles de IA

Todas las llamadas reales pasan por un único gateway de servidor. El gateway:

- valida empresa y usuario en servidor y aplica allowlist;
- minimiza y redacta el contenido antes de salir;
- envía `store=false` y no registra prompts ni respuestas sensibles;
- usa claves de idempotencia ligadas a empresa, actor, operación, modelo,
  snapshot y esquema;
- aplica presupuestos globales y por empresa, límite diario por usuario y topes
  de tokens;
- registra sólo uso y trazas operativas no sensibles;
- mantiene confirmación humana antes de acciones con efecto;
- corta llamadas con circuit breaker y conserva el provider fake como fallback
  probado, sin sustituirlo.

La transcripción añade al alcance idempotente el hash del audio. No se habilita
cualquier hostname o modelo arbitrario: el endpoint y los snapshots se validan
contra configuración gobernada.

## Modelos validados

La cuenta respondió correctamente con los snapshots:

- rápido: `gpt-4.1-mini-2025-04-14`;
- razonamiento: `gpt-4.1-2025-04-14`;
- transcripción: `gpt-4o-mini-transcribe-2025-12-15`.

Los snapshots GPT-5 consultados devolvieron `model_not_found` porque la
organización del proveedor requiere verificación adicional. No se bloqueó la
activación autorizada: se aplicó el fallback explícito y probado anterior. El
cambio futuro de modelos deberá repetir los gates y actualizar la configuración
por entorno.

## Evidencia segura

### Local e integración

- build y typecheck: PASS;
- lint focal de IA y correo: PASS;
- validador runtime IA: 10/10;
- validación funcional F6: 44/44;
- validación PostgreSQL aislada F6: 8/8 con 45 migraciones;
- validación estática de correo F4: 15/15;
- matriz webhook firmada: 6/6;
- invitaciones: PASS;
- plataforma de lanzamiento: 66 comprobaciones PASS;
- contratos de providers: PASS, con cero llamadas externas durante esos tests;
- privacidad y seguridad F5: 18/18;
- escaneos de secretos: PASS.

### Review

- entorno persistente conservado, sin recrear base ni volumen;
- provider fake con política, presupuestos y allowlist activos;
- raíz, login, health live y health ready: HTTP 200;
- `noindex` conservado;
- endpoints de estado protegidos sin sesión.

### Staging

- provider real activado sólo después de desplegar y validar la release;
- prueba sintética rápida: completada, 115 tokens de entrada, 20 de salida,
  coste estimado 0,02 EUR;
- prueba sintética de razonamiento: completada, 115 tokens de entrada, 24 de
  salida, coste estimado 0,05 EUR;
- transcripción WAV sintética en español: completada, coste estimado 0,02 EUR;
- `store=false` confirmado por contrato;
- raíz, login, health live y health ready: HTTP 200;
- cuatro correos sintéticos aceptados por Resend usando sus destinatarios
  oficiales de prueba para delivered, bounced, complained y suppressed;
- outbox en estado enviado, sin tracking y sin contenido sensible en logs.

La clave de Resend es de envío con mínimo privilegio. Por diseño no puede leer
el detalle de mensajes mediante API; la matriz de webhook firmada y replay-safe
cubre el tratamiento de delivered, bounced, complained y suppressed. Esta
restricción se conserva en vez de ampliar privilegios para obtener evidencia
adicional.

## Correo transaccional

El outbox reclama cada mensaje de forma atómica, recupera leases vencidos y no
declara entrega antes de la aceptación del proveedor. Los webhooks verifican
firma, toleran replay y no conceden acceso ni efectos de negocio cuando el gate
correspondiente está apagado.

Sólo se habilitan:

- recuperación de cuenta;
- invitaciones;
- contacto.

No se envían campañas, recordatorios generales, facturas ni comunicaciones
fiscales. Las pruebas live usan exclusivamente destinatarios oficiales de
Resend y fixtures sintéticos.

## Promoción y rollback

La misma release validada debe pasar Review, Staging, los checks obligatorios de
GitHub, merge humano, Wait for CI de Railway y healthchecks antes de activar las
oleadas de Production.

Orden de activación en Production:

1. desplegar con los gates live apagados;
2. cargar política y allowlist sin imprimir secretos;
3. activar IA y voz, ejecutar smokes sintéticos y confirmar health;
4. activar correo transaccional, ejecutar destinatarios oficiales de Resend y
   confirmar health;
5. conservar billing, registro, fiscal, analytics e indexación apagados.

Rollback no destructivo: poner en `false` los kill switches de IA y correo y
volver al provider fake/manual. No requiere migraciones, borrado de datos ni
rotación de credenciales.

## Limitaciones honestas

- `store=false` evita almacenamiento de respuestas por la API, pero no se
  declara Zero Data Retention contractual;
- la envolvente mínima necesaria para replay/idempotencia se conserva siete
  días, sin prompts ni respuestas sensibles en logs;
- la alerta presupuestaria del proveedor es un control externo complementario;
- la validación con fixtures sintéticos no sustituye la aceptación humana de
  exactitud, accesibilidad o utilidad en casos reales;
- documentos, billing, registro público, fiscalidad live, analytics e
  indexación requieren autorizaciones separadas.
