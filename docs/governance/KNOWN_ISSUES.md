# Known issues and launch limitations

Updated for readiness F11. These are release gates, not hidden assurances.

- Public indexing remains disabled until brand/domain clearance and final legal approval.
- OpenAI live validation remains `READY_FOR_EXTERNAL_INPUT`; only fake/injected transports are evidenced.
- Email domain, billing, fiscal public transmission, private storage providers and recurring remote observability retain their existing external activation gates.
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

No item above is represented as a completed live validation.
