# F2 isolated Railway security validation

Date: 2026-07-26

## Result

SEC-005 and SEC-006 pass against an isolated temporary Railway environment running exact commit `30fad8740557ebccdf982fd95b854a2b43ac90cd`. The validation started with CSP report-only, then redeployed the same commit with `CSP_ENFORCE=true`. Staging and production were not deployed or modified.

The CSP uses a fresh request nonce, `strict-dynamic`, no `unsafe-eval`, and a documented `style-src 'unsafe-inline'` compatibility exception. The inline theme bootstrap receives the request nonce. The collector accepts both legacy CSP reports and the modern Reporting API shape without logging report bodies or user data.

## Temporary topology and isolation

- Railway project: `5a501cb4-639e-4dd3-a1fb-08ae1c839ebb` (`orqena-staging`).
- Temporary environment: `c2d804a0-e325-423f-ba71-9dd997449335` (`orqena-readiness-f2-staging`).
- Temporary web service: `d73d0a69-9cf8-4ba4-83cf-99021487025b`.
- Final temporary PostgreSQL service: `4a7d7b7a-15f5-4628-a992-e3198622699e`.
- Web volume: `1d28f3ec-3f6d-4576-9fdf-f4a5cc31b975`, mounted at `/data/orqena/documents`.
- PostgreSQL volume: `9dfae14c-cc5f-48b2-8c7a-e448806cc699`, mounted at `/var/lib/postgresql/data`.
- The environment contained exactly the temporary web and PostgreSQL instances. `DATABASE_URL` was a Railway reference to that PostgreSQL service; its value was never printed.
- The guarded seed verified the original internal temporary PostgreSQL host, database and credentials against the one-time proxy before writing one synthetic tenant/owner. The proxy was then deleted and its list was empty.
- No external provider call was made. Test credentials existed only in process memory and were not written to disk, logs or Git.

An initial PostgreSQL service (`b647e58c-37bb-427c-8fb7-054b239d67ec`) was removed before seeding because its generated password was not URL-safe. Its failed web deployment reached no migration or application write. The replacement used URL-safe credentials.

## Deployments

| Mode | Web deployment | PostgreSQL deployment | Result |
| --- | --- | --- | --- |
| Report-only | `94d5dae2-03d8-4175-96f7-0291d98d6685` | `8bcb5b61-aa3a-4ade-b96b-52af7fa0e60f` | `SUCCESS` |
| Enforce | `8f4c0558-7753-4e99-b5bd-4dbd24f34671` | `8bcb5b61-aa3a-4ade-b96b-52af7fa0e60f` | `SUCCESS` |

The two successful web deployments reported exact release `30fad8740557ebccdf982fd95b854a2b43ac90cd`. One earlier web attempt failed at `npm ci` before build because the lockfile was incompatible with Railway npm 10; another built but failed before migration because the first database password was not a valid URL. Both failure causes were corrected without touching persistent environments.

## Browser and HTTP evidence

The report-only and enforce passes rendered these twelve representative surfaces: `/`, `/demo`, `/privacidad`, `/hoy`, `/dashboard`, `/clientes`, `/obras`, `/presupuestos`, `/dinero`, `/capataz`, `/documentos`, and `/gestion?tipo=cliente&returnTo=/clientes`.

Observed interactive behavior under enforce:

- authenticated navigation remained usable;
- the desktop **Más** menu opened and closed;
- theme changed from dark to system;
- a client form accepted a name and `Empresa` selection without submission;
- the PDF preview returned HTTP 200, `application/pdf`, an inline filename and private cache policy.

Both browser runs produced five captured CDP events and **zero CSP findings**. Deployment logs contained **zero `csp_violation` records**. No report payload or credential was retained.

HTTP scan results:

- report-only: **12/12 PASS**;
- enforce: **11/11 PASS**;
- HSTS, nonce, `strict-dynamic`, `frame-ancestors`, nosniff, Referrer, Permissions, COOP, CORP, noindex and expected cache policies were present;
- `unsafe-eval` and `X-Powered-By` were absent;
- API responses were `no-store`;
- protected `/dashboard` redirected, controlled `/ready` returned 404, and a cross-site POST returned 403.

## Cost, duration and teardown

Railway usage at `2026-07-26T09:38:43.9637828Z` attributed:

- web: `$0.001993875350722791`;
- final PostgreSQL: `$0.0013033593013913472`;
- removed initial PostgreSQL service: `$0.0002933458842881043`;
- attributable total: **`$0.0035905805364022424`**.

The usage response also contained `$0.0018888763183602779` for an anonymous deleted volume with no service ID. It cannot be proved to belong to this run, so it is excluded from the attributable total; including it gives a conservative upper bound of `$0.00547945685476252`.

The pre-teardown validation window was 4,212 seconds (70 min 12 s). Create-to-final teardown verification was approximately 72 min 39 s.

Teardown deleted both active temporary services and environment `c2d804a0-e325-423f-ba71-9dd997449335`. The final project snapshot showed the temporary environment, all three temporary service IDs and their volume instances absent. Persistent baselines remained unchanged and successful:

- staging deployment `dc3ce593-3bc8-4abb-9167-9b9d2f774549` — `SUCCESS`;
- production deployment `2e266e66-be53-4008-a1b9-cbfaca21c750` — `SUCCESS`.

No secret value was printed or committed.
