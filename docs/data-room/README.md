# Orqena data room boundary

`public/` contains reproducible technical material suitable for the repository.
`private/` must never be committed and is covered by `.gitignore`; it is the only
location intended for signed agreements, identity evidence, provider contracts,
domain records, invoices or personal data. Secrets are never data-room content.

The private package should be encrypted, access logged, independently backed up
and transferred through an approved channel. Its index may reference repository
SHAs, but repository documents must not link to private URLs or expose selectors,
account IDs or credentials.
