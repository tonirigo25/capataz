# Release candidate de Orqena

El candidato se despliega solo en `orqena-staging` desde `codex/platform-owner-company-switcher`. No existe merge a `main` ni despliegue del código nuevo a production.

Gates: migraciones de staging, health, proveedores locales, datos sintéticos, aislamiento por proyecto, E2E/visual público, suites de Macrofase 1 y 2, typecheck, build, runner aislado y worktree limpio. El SHA final debe coincidir entre GitHub y Railway.

Pendientes externos: correo y billing reales, OpenAI si se habilita, DNS, revisión jurídica, backup/PITR y autorización expresa de promoción.
