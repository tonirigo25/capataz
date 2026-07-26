# ADR 0010: Immutable release and supply-chain governance

Status: accepted for readiness F11.

Release candidates are identified by a full Git SHA. Pull requests run pinned,
least-privilege CI; dependencies install from the lockfile; audit, secret scan,
CodeQL, license inventory and CycloneDX SBOM are blocking evidence. Test artifacts
are sanitized and retained for a bounded period.

Production deployment is not performed by the evidence workflow. It requires a
separately configured protected GitHub environment, human approval and an exact
SHA handoff. Preview, staging and production resources must be distinct; absence
of an isolation proof blocks the action.
