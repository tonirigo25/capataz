# Known issues and launch limitations

Updated for readiness F11. These are release gates, not hidden assurances.

- Public indexing remains disabled until brand/domain clearance and final legal approval.
- OpenAI live validation remains `READY_FOR_EXTERNAL_INPUT`; only fake/injected transports are evidenced.
- Email domain, billing, fiscal public transmission, private storage providers and recurring remote observability retain their existing external activation gates.
- Existe un `review` Railway persistente y aislado; el preview efímero por PR
  anterior sigue sin existir y no se usa como sustituto.
- A signed Android AAB, iOS archive and device/WebView E2E remain external.
- Production GitHub environment reviewers and immutable-release policy require repository-admin confirmation.
- El restore lógico remoto aislado pasó; backup/PITR nativo sigue
  `READY_FOR_EXTERNAL_INPUT` porque requiere cobertura Pro y una política de
  retención autorizada.
- Brand, contributor assignments, asset title and transition hours require legal/commercial records outside this repository.
- On the Windows validation host, `npm ls` reports platform/tooling optional packages as extraneous after a clean `npm ci`; audit remains clean and the SBOM intentionally uses the reproducible lockfile-only graph. CycloneDX-npm emits unresolved nested graph references from that lockfile while retaining every component record; the validator records the count instead of deleting those references. Linux CI still installs from the same lockfile before all gates.

No item above is represented as a completed live validation.
