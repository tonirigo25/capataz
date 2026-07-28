# Continuous Railway review topology

Status: isolated infrastructure created. Baseline deployment and synthetic
access are tracked separately in `LATEST_REVIEW.md`.

## Review

- Project `orqena-review-continuous`: `c54a5065-df2c-46b9-a82b-cfac3be07315`.
- Environment `review`: `e41b5add-511c-4697-b2b5-48164506f49a`.
- Web service: `345992f1-c168-4221-a60d-b440d5a33e30`; instance
  `446a37bc-0474-4f5b-b332-aac371c3239d`.
- PostgreSQL service: `d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b`; instance
  `78273e14-e394-4631-9788-db885ce09327`.
- Web volume: `307e2939-d7a1-468a-b093-2ce3ae45591a`.
- PostgreSQL volume: `b581f782-d8cf-49e3-84c9-0c531260f661`.
- Stable domain: `https://orqena-review-web-review.up.railway.app`.

The project, environment, services, instances, volumes and domain are distinct
from staging and production. SHA-256 fingerprints of all three `DATABASE_URL`
values were compared without printing values; all three were distinct.
`DATABASE_URL` in the web service references only `Postgres.DATABASE_URL`
inside this project.

## Boundaries

Review uses generated review-only encryption, storage, job and token secrets.
No live provider secret was copied. Registration, indexing, billing, email,
fiscal transmission, AI and analytics are disabled. The web volume holds only
review documents and PostgreSQL has its own volume. Staging and production
were inspected read-only and were not modified.
