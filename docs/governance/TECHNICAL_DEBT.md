# Technical debt register

| ID | Decision / limitation | Trigger to revisit | Owner class |
| --- | --- | --- | --- |
| TD-001 | Modular monolith and shared PostgreSQL | Measured scaling, compliance isolation or team ownership need | Architecture |
| TD-002 | Existing script suites coexist with Vitest/Playwright | Migrate only when coverage and failure semantics remain equivalent | QA |
| TD-003 | Capacitor wrapper delegates business state to web backend | Native-only capability with measurable value and privacy design | Mobile |
| TD-004 | Provider adapters default to off/fake | Approved provider, data profile, budget and live smoke | Platform |
| TD-005 | Public legal texts are review-required drafts | Signed legal approval and version publication | Legal |
| TD-006 | Railway preview mutation is not automated | Isolated resources, scoped credential and teardown evidence approved | DevOps |

Every item preserves a safe current behavior. None authorizes a production shortcut.
