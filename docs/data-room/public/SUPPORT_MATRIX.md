# Support matrix

| Component | Supported baseline | Policy |
| --- | --- | --- |
| Node.js | 22.18.x | Pin in CI; reassess before Node 22 EOL |
| npm | Lockfile-compatible npm bundled with Node 22 | `npm ci` required |
| PostgreSQL | 17 for CI; managed target must support current Prisma schema | Restore test before upgrade |
| Next.js | Locked 15.5.x | Security updates through reviewed lockfile change |
| Prisma | Locked 6.x | Migration and fresh-schema gates required |
| Chromium | Playwright-managed locked release | Install from Playwright lock |
| Android/iOS | Capacitor 8 wrapper; signed-device matrix external | No publication claim |
| OpenAI, Stripe, Resend, S3, fiscal | Off/fake until independently approved | Provider runbook and kill switch |

Actual provider SLA, regions and retention are not implied by package support.
