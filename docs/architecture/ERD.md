# Target ERD

The canonical target is `prisma/schema.prisma`. Run `npm run readiness:generate-schema-docs` after every schema change.

- [Generated data dictionary](./generated/DATA_DICTIONARY.md)
- [Detailed Mermaid ERD](./generated/ERD.mmd)
- [Generated visual overview](./generated/ERD.svg)
- [Generation manifest](./generated/schema-manifest.json)

The generator records the Prisma SHA-256 and fails in F1 validation if output is stale. The visual overview is navigational; the Mermaid file and dictionary are the field-level evidence.
