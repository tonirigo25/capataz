# Known issues and launch limitations

Updated for readiness F11. These are release gates, not hidden assurances.

- Public indexing remains disabled until brand/domain clearance and final legal approval.
- OpenAI live validation remains `READY_FOR_EXTERNAL_INPUT`; only fake/injected transports are evidenced.
- Email domain, billing, fiscal public transmission, private storage providers and recurring remote observability retain their existing external activation gates.
- A real Railway PR preview has not been created; the workflow is fail-closed and performs no mutation.
- A signed Android AAB, iOS archive and device/WebView E2E remain external.
- Production GitHub environment reviewers and immutable-release policy require repository-admin confirmation.
- PITR/backup activation and a real isolated restore drill require separately authorized infrastructure work.
- Brand, contributor assignments, asset title and transition hours require legal/commercial records outside this repository.
- On the Windows validation host, `npm ls` reports platform/tooling optional packages as extraneous after a clean `npm ci`; audit remains clean and the SBOM intentionally uses the reproducible lockfile-only graph. CycloneDX-npm emits unresolved nested graph references from that lockfile while retaining every component record; the validator records the count instead of deleting those references. Linux CI still installs from the same lockfile before all gates.

No item above is represented as a completed live validation.
