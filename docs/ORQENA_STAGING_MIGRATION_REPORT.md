# Migraciones de staging

El PostgreSQL independiente comenzó vacío. Baseline: `%TEMP%\\orqena-independent-staging-baseline-20260722-214259\\baseline.json`; SHA-256 `F139047B96C0BE8212D71DA13860B41B4D8833958709D7EF55D9384C41F09B29`.

`npm run db:deploy` aplicó correctamente las 22 migraciones, desde `20260621000000_init` hasta `20260722190000_orqena_commercial_platform`. No se utilizó `db push`, `migrate dev`, SQL destructivo ni backups de production.

Railway Hobby no ofrece Backups/PITR. Para esta base inicialmente vacía el mecanismo recuperable es recrearla y reaplicar las migraciones. Production deberá contar con snapshot/PITR antes de una promoción futura.
