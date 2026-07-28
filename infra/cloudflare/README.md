# Cloudflare launch infrastructure

The synchronizer manages only these full zones: `orqenatech.com`, `orqena.es`,
`orqenatech.es`, and `orquenatech.com`.

`npm run infra:cloudflare:plan` is read-only against Cloudflare and is the
default. `npm run infra:cloudflare:apply` requires `--apply` internally and
refuses to mutate unless `ARSYS_DNS_EXPORT_DIR` contains an export that proves
the human mail records are present. Export files are read in place and are
never copied into the repository.

Required variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `ARSYS_DNS_EXPORT_DIR` for apply

The scripts never print token values. They preserve unrelated DNS records and
unrelated redirect rules, remove only the explicitly retired root/www/wildcard
records, keep mail records DNS-only, configure Full SSL without HSTS during the
migration, and write non-secret zone IDs and assigned nameservers to
`activation-plan.json`.

Nameserver changes, DNSSEC, transfers, ownership data, and Arsys product changes
remain manual and out of scope.
