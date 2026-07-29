# Known issues and launch limitations

Updated for readiness F11. These are release gates, not hidden assurances.

- Public indexing remains disabled until brand/domain clearance and final legal approval.
- GPT-5 no está accesible todavía para la organización del proveedor. La activación controlada usa snapshots compatibles de GPT-4.1 y mantiene el cambio de modelo dentro de la configuración gobernada; no se degrada a un modelo no aprobado de forma silenciosa.
- La extracción IA de documentos sigue apagada: enviar bytes requiere un contrato específico de minimización y redacción. Texto, respuesta estructurada y transcripción sí tienen evidencia live sintética en Staging.
- El límite de gasto de la aplicación es fail-closed, pero la alerta presupuestaria del proveedor sigue siendo un control externo complementario y no sustituye los límites por empresa y usuario.
- El correo live se limita a recuperación, invitaciones y contacto. No están autorizados campañas, tracking ni avisos generales, y una clave de envío de mínimo privilegio no permite consultar por API el estado detallado de cada mensaje.
- Billing, transmisión fiscal pública, analytics, indexación y los providers no mencionados conservan sus gates de activación.
- Existe un `review` Railway persistente y aislado; el preview efímero por PR
  anterior sigue sin existir y no se usa como sustituto.
- El presupuesto estricto C3 todavía no cierra: la medición Lighthouse local
  reproducible de `/` registró LCP de `2623 ms` frente al máximo de `2500 ms`.
  Las pruebas de ráfaga remota no sustituyen este gate de experiencia.
- La matriz autenticada identifica trece observaciones no bloqueantes de
  jerarquía de acción primaria en presupuestos, plantillas, factura, tesorería,
  subcontratas, facturas recibidas, tareas, recomendaciones, configuración,
  soporte y salud de plataforma. No hay hallazgo de autorización asociado, pero
  requieren una decisión de diseño antes del lanzamiento comercial.
- El primer barrido autenticado agotó conexiones porque los bundles standalone
  no compartían el `PrismaClient` global en producción. El singleton global y
  el límite explícito del pool ya están aplicados en `review`; la evidencia
  antes/después no se presenta como prueba de capacidad de producción.
- La repetición MFA descubrió que el reloj determinista de prueba pasaba epoch
  en milisegundos a `otplib` v13, que exige segundos. El camino normal sin reloj
  inyectado no estaba afectado; el test focal se corrigió para impedir otro
  falso verde.
- A signed Android AAB, iOS archive and device/WebView E2E remain external.
- Production GitHub environment reviewers and immutable-release policy require repository-admin confirmation.
- El restore lógico remoto aislado pasó; backup/PITR nativo sigue
  `READY_FOR_EXTERNAL_INPUT` porque requiere cobertura Pro y una política de
  retención autorizada.
- Brand, contributor assignments, asset title and transition hours require legal/commercial records outside this repository.
- On the Windows validation host, `npm ls` reports platform/tooling optional packages as extraneous after a clean `npm ci`; audit remains clean and the SBOM intentionally uses the reproducible lockfile-only graph. CycloneDX-npm emits unresolved nested graph references from that lockfile while retaining every component record; the validator records the count instead of deleting those references. Linux CI still installs from the same lockfile before all gates.

Ningún elemento pendiente anterior se representa como una validación completada. Las validaciones live autorizadas de IA y correo se documentan por separado en `docs/operations/AI_AND_TRANSACTIONAL_EMAIL_LIVE_CONTROLLED_2026-07-29.md`.
