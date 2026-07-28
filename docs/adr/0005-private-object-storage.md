# ADR 0005: Private object storage

Status: accepted for production target.

Production documents use private object storage, signed short-lived access, tenant-prefixed keys, integrity hashes, malware scan state, and retention metadata. Legacy local references remain readable during migration; public buckets and permanent object URLs are prohibited.
