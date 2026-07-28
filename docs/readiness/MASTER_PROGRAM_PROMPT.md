# PROMPT MAESTRO — DESARROLLO CONTINUO ORQENA / CAPATAZ

**Fecha base:** 25 de julio de 2026
**Repositorio:** `tonirigo25/capataz`
**Rama base técnica:** `main`
**SHA de main analizado:** `64cf8bbbca8ed99aabce4fbc50ebfb163fc05367`
**Trabajo Marketing V2 separado:** PR #24, rama `feat/capataz-marketing-v2`, SHA `ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4`.

## Mandato

Actúa como ingeniero principal de SaaS, desarrollador web senior, responsable de seguridad y release manager de Orqena/Capataz. Implanta **íntegramente** el Plan Maestro de Implantación. No excluyas, pospongas silenciosamente ni reduzcas ningún requisito. Trabaja de forma continua hasta completar todo lo técnicamente ejecutable en la sesión y deja únicamente como `READY_FOR_EXTERNAL_INPUT` aquello que depende de:

1. dominio definitivo;
2. dirección de soporte/remitente y credenciales de correo;
3. credenciales sandbox/live de proveedores que no estén disponibles;
4. firma o dictamen jurídico, fiscal, de marca, de tiendas o de ciberseguridad independiente.

Esos inputs externos **no bloquean la arquitectura**: crea interfaces, configuración, providers fake/local, pruebas, flags y runbooks para que introducir los datos finales no requiera reescribir código.

## Reglas absolutas de seguridad

- No modificar producción durante el desarrollo. No ejecutar migraciones, seeds, backfills, deploys o cambios de variables en producción sin autorización expresa posterior.
- Antes de cualquier comando con riesgo, ejecutar auditoría de solo lectura, identificar proyecto/environment/service/database, confirmar que no apunta a producción y crear la evidencia/backup exigidos.
- Nunca mostrar tokens, secretos, certificados, cookies, claves, valores de `DATABASE_URL` ni contenido de datos personales.
- Los scripts de base de datos deben incluir clasificación de entorno, guard contra production, `--dry-run`, idempotencia y reconciliación.
- Mantener migraciones aditivas y compatibles. No eliminar columnas/tablas ni convertir Float→Decimal en el mismo release de introducción.
- No habilitar envío real, cobro real, transmisión fiscal, indexación pública o registro público hasta superar su gate y activar un flag explícito.
- Toda mutación externa y sensible debe ser idempotente, auditable y, cuando afecte a clientes finales, confirmada por el profesional.
- No afirmar “cumple RRSIF/VERI*FACTU”, “cumple RGPD”, “publicado en tiendas” o “producción lista” sin evidencia del gate externo correspondiente.
- No inventar IDs de Railway, deployments, volúmenes, dominios, resultados, métricas ni precios.
- No detener el trabajo por el tamaño del programa. Divide por fases y continúa. Ante una dependencia externa, completa el adapter/fake/tests/runbook y marca exactamente la dependencia.

## Estado inicial obligatorio

- **Autor de PR #23:** `tonirigo25`; cuenta GitHub de tipo humano/User. — `Verificado`
- **Permiso en repositorio:** Administrador del repositorio `tonirigo25/capataz`. — `Verificado`
- **PR #23:** Cerrada sin merge; rama remota y SHA conservados. — `Verificado`
- **Nueva PR:** #24, abierta como borrador, base `main`. — `Verificado`
- **Rama:** `feat/capataz-marketing-v2`. — `Verificado`
- **SHA:** `ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4`. — `Verificado`
- **Comentarios/checks/workflows:** Sin comentario de Railway, sin status checks y sin GitHub Actions asociados. — `Verificado`
- **Merge/código/commits:** No hubo merge, cambios de código ni commits nuevos. — `Verificado`
- **Bot PR Environments:** No es necesario activarlo para esta PR, porque el autor es humano. — `Determinación`
- **Membresía Railway:** No puede comprobarse mediante el conector disponible. — `Pendiente de control-plane`
- **Repositorio vinculado en Railway:** No puede comprobarse mediante el conector disponible. — `Pendiente de control-plane`
- **Entorno, servicios, volumen y DATABASE_URL:** No puede verificarse sin acceso a Railway. — `Pendiente de control-plane`
- **Staging y producción:** No se ejecutó ninguna acción contra Railway; los deployment IDs deben verificarse en el cierre manual. — `No modificados desde esta sesión`

La parte GitHub de Sprint F ya está hecha. No cierres la PR #24, no la marques ready, no hagas merge ni cambies su SHA. Falta el control-plane Railway.

## F0 — cierre exacto de Sprint F

1. Comprueba que PR #24 sigue open + draft, con rama y SHA exactos.
2. En Railway, confirma el repositorio `tonirigo25/capataz`, la identidad humana del autor y su membresía autorizada.
3. Conserva staging en su rama persistente actual. No la cambies a Marketing V2.
4. Intenta PR Environment automático. Bot PR Environments no es necesario para autor humano.
5. Si no aparece, crea `capataz-review-pr-24` duplicando **staging**, con cambios preparados primero.
6. Antes de deploy, demuestra environment ID, web service ID, Postgres service/instance ID y volume ID distintos; `DATABASE_URL` como reference interna al Postgres nuevo; cero referencia a production `merry-quietude`.
7. Cambia la rama únicamente en el servicio web del entorno duplicado a `feat/capataz-marketing-v2` y confirma SHA exacto.
8. Ajusta solo `APP_BASE_URL`, `NEXT_PUBLIC_WEB_BASE_URL` y `CAPATAZ_MOBILE_SERVER_URL` al dominio temporal. No cambies secretos.
9. Despliega Postgres y luego web. `npm run db:deploy` solo contra el Postgres efímero.
10. Valida `/marketing-v2`, `/demo-v2`, `/`, `/demo`, `/login`, `/hoy`, `/api/status`, assets, consola/red, no llamadas API desde v2, noindex y exclusión de sitemap; 390×844 y 1440×900.
11. Confirma que staging deployment `dc3ce593-3bc8-4abb-9167-9b9d2f774549` y production deployment `2e266e66-be53-4008-a1b9-cbfaca21c750` no cambiaron.
12. Registra coste/recursos y teardown; no elimines el preview hasta capturar evidencia. No hagas merge.

## Preflight general en PowerShell

```powershell
Set-Location "C:\Users\Toniet\Documents\Capataz"

git status --short --branch
git rev-parse HEAD
git remote -v
git fetch --all --prune

gh auth status
gh pr view 24 `
  --repo tonirigo25/capataz `
  --json number,state,isDraft,author,headRefName,headRefOid,baseRefName,url
```

Después de cerrar F0, crea una rama de programa desde `origin/main`, nunca desde la PR #24:

```powershell
Set-Location "C:\Users\Toniet\Documents\Capataz"

git fetch origin
if (Test-Path ".worktrees\orqena-readiness") {
  throw "El worktree .worktrees\\orqena-readiness ya existe. Audítalo antes de continuar."
}

git worktree add ".worktrees\orqena-readiness" -b "program/orqena-production-readiness" "origin/main"
Set-Location ".worktrees\orqena-readiness"

git status --short --branch
git rev-parse HEAD
```

## Estrategia de ejecución

- Rama de integración: `program/orqena-production-readiness`.
- Ramas apiladas: `feat/readiness-f1-contract`, `feat/readiness-f2-platform-core`, etc.
- Una PR por fase hacia la rama de programa. No abrir PR gigante directa a `main`.
- Antes de cada fase: actualizar execution log, confirmar árbol limpio y ejecutar gate de la fase anterior.
- Después de cada lote: typecheck, tests focales, build, `git diff --check`, revisión de migración y de secretos.
- Los commits deben ser semánticos, pequeños y reversibles; nunca mezclar migración, backfill y retirada destructiva.
- Cuando PR #24 sea aceptada, intégrala una sola vez en F9; concentra conflictos en rutas/manifiestos y vuelve a ejecutar toda la regresión pública.

## Fases y resultados obligatorios

### F0 — Cerrar preview de Marketing V2

**Resultado obligatorio:** PR #24 validada en entorno Railway aislado y eliminable; cero impacto en staging/producción.

**Prioridad:** Bloqueante

### F1 — Congelar contrato técnico

**Resultado obligatorio:** Dependencias, configuración, feature flags, esquema objetivo y migraciones aditivas creadas de una vez.

**Prioridad:** Bloqueante

### F2 — Núcleo transversal

**Resultado obligatorio:** Idempotencia, outbox, cifrado, logging, health, rate limit, replay protection y auditoría reutilizables.

**Prioridad:** Bloqueante

### F3 — Motor fiscal y factura B2B

**Resultado obligatorio:** Emisión inmutable, huellas, QR, rectificativas, artefactos electrónicos y adaptadores de transmisión.

**Prioridad:** Crítica

### F4 — Plumbing comercial

**Resultado obligatorio:** Stripe, suscripciones, customer portal, consumo, email real, storage privado y workers.

**Prioridad:** Crítica

### F5 — Privacidad y seguridad operacional

**Resultado obligatorio:** RAT, retención, derechos, brechas, CSP, MFA, incidentes, backups/PITR y restore drill.

**Prioridad:** Crítica

### F6 — Gobierno de IA

**Resultado obligatorio:** Gateway minimizado, store:false, presupuestos, coste, evaluación, transparencia y fallback.

**Prioridad:** Alta

### F7 — Integración de producto

**Resultado obligatorio:** Acciones finas, configuración, plan/uso, privacidad, soporte y documentos usando los servicios nuevos.

**Prioridad:** Alta

### F8 — Métricas y pilotos

**Resultado obligatorio:** Activación, WAU, retención, valor, soporte y paneles de pilotaje; feedback estructurado.

**Prioridad:** Alta

### F9 — Marca y web pública

**Resultado obligatorio:** Posicionamiento vertical, PR #24 integrada tras aceptación, textos legales y dominio/correo parametrizados.

**Prioridad:** Media

### F10 — Móvil y distribución

**Resultado obligatorio:** Builds repetibles, deep links, privacidad de tiendas, firma y crash reporting preparados.

**Prioridad:** Media

### F11 — Diligencia y lanzamiento

**Resultado obligatorio:** CI completa, SBOM, licencias, pentest tenant, runbooks, data room y release candidate.

**Prioridad:** Crítica


## Orden de archivos para minimizar pasadas

1. **Contrato:** `package.json`, lock, `.env*.example`, `prisma/schema.prisma`, `lib/config/**`, `lib/feature-flags.ts`.
2. **Núcleo:** `middleware.ts`, `next.config.ts`, `instrumentation*.ts`, `lib/auth/**`, `lib/platform/**`, `lib/observability/**`, jobs y health.
3. **Motores:** `lib/fiscal/**`, `lib/einvoice/**`, `lib/billing/**`, `lib/email/**`, `lib/storage/**`, `lib/privacy/**`, `lib/ai/**`, `lib/analytics/**`, `lib/support/**`.
4. **Adaptadores:** Server Actions, rutas API, configuración, dinero, plan/uso, documentos, privacidad, soporte, plataforma y chat.
5. **Cierre:** CI, scripts, docs, public web/Marketing V2, móvil, data room y release.

No reabras un archivo compartido por comodidad. Si una nueva necesidad obliga a cambiar el contrato, documenta una ADR y el motivo.

## Migraciones obligatorias

- M01 `platform_contracts`
- M02 `fiscal_ledger`
- M03 `electronic_invoicing`
- M04 `billing_webhooks`
- M05 `email_delivery`
- M06 `privacy_governance`
- M07 `ai_governance`
- M08 `product_analytics_support`
- M09 `storage_integrity`
- M10 `money_decimal_transition` en tres releases

Cada migración requiere: SQL revisado, prueba sobre base vacía, prueba sobre snapshot sintético compatible, rollback lógico, reconciliación y registro de tiempo/bloqueos. Los backfills se ejecutan aparte.

## Gates globales

1. **Gate de datos:** cero filas huérfanas, tenant mismatch o divergencias Decimal/Float; migraciones limpias.
2. **Gate de seguridad:** auth, RBAC/scopes, CSP, CSRF/origin, rate limit, webhooks, uploads, logs y secrets pasan suites.
3. **Gate fiscal:** emisión/snapshot/hash/QR/rectificativas/export y declaración responsable aprobados; transmisión live bloqueada hasta revisión externa.
4. **Gate comercial:** Stripe sandbox, webhooks, reconciliación, dunning, portal y usage cumplen pruebas; live off.
5. **Gate email:** provider local y Resend sandbox, firma, dedupe, bounce/complaint/suppression y templates; live requiere dominio/remitente.
6. **Gate privacidad:** RAT, DSAR, retención, consentimiento, brecha, subencargados y textos parametrizados; revisión externa registrada.
7. **Gate IA:** minimización, provider policy, `store:false`, coste, evals, fallback y confirmación humana.
8. **Gate continuidad:** backups/PITR configurados y restore drill sobre servicio nuevo completado.
9. **Gate UX:** móvil/escritorio, teclado, WCAG, estados vacíos/error/loading, PDFs y navegación por permisos.
10. **Gate release:** CI verde, SBOM/licencias, pentest tenant, runbooks, data room y smoke staging del SHA exacto.

## Requisitos completos — no omitir

### GOV — Gobierno, posicionamiento y transferibilidad

- [ ] **GOV-001 · F9** — Posicionar el producto públicamente para empresas de obra, reformas e instalaciones, no como ERP horizontal genérico.
  **Evidencia:** Copy y navegación pública verificadas contra un único ICP.
- [ ] **GOV-002 · F9** — Conservar la arquitectura multisector como capacidad configurable y no como mensaje principal.
  **Evidencia:** Catálogo sectorial interno configurable; home vertical-first.
- [ ] **GOV-003 · F1** — Centralizar nombre, identidad legal, URLs, soporte, remitentes y aliases en configuración tipada.
  **Evidencia:** No quedan literales comerciales dispersos fuera de tests/compatibilidad.
- [ ] **GOV-004 · F9** — Dejar la aplicación preparada para rebranding/white-label sin fork de código.
  **Evidencia:** Tema, assets, metadata, emails y PDFs resueltos desde configuración.
- [ ] **GOV-005 · F11** — Realizar clearance de marca y documentar control de dominios antes de indexación.
  **Evidencia:** Informe/decisión legal archivada; PUBLIC_INDEXING_ENABLED sigue false hasta cierre.
- [ ] **GOV-006 · F11** — Añadir aviso de software propietario, NOTICE y reglas de contribución.
  **Evidencia:** LICENSE/NOTICE/CONTRIBUTING revisados; repositorio sin licencia ambigua.
- [ ] **GOV-007 · F11** — Inventariar autores, contribuciones asistidas y cesiones de derechos.
  **Evidencia:** Matriz de cadena IP incluida en data room privado.
- [ ] **GOV-008 · F11** — Generar inventario de terceros y obligaciones de sus licencias.
  **Evidencia:** THIRD_PARTY_NOTICES y reporte automatizado sin incompatibilidades críticas.
- [ ] **GOV-009 · F9** — Mantener precios públicos bajo aprobación comercial y mapping externo, nunca hardcodeados en UI.
  **Evidencia:** Feature flag y catálogo de Price IDs validados.
- [ ] **GOV-010 · F11** — Mantener registro de deuda técnica, limitaciones y decisiones arquitectónicas.
  **Evidencia:** KNOWN_ISSUES, debt register y ADRs actualizados.
- [ ] **GOV-011 · F11** — Definir lista exacta de activos transferibles y no transferibles.
  **Evidencia:** Data room contiene manifest de repositorios, ramas, diseños, cuentas y documentación.
- [ ] **GOV-012 · F8** — Medir valor del producto por tareas y resultados, no por número de módulos.
  **Evidencia:** Dashboard incluye horas ahorradas, cobros recuperados y conversión.

### ARCH — Arquitectura y contratos técnicos

- [ ] **ARCH-001 · F1** — Mantener un monolito modular Next.js, evitando microservicios prematuros.
  **Evidencia:** Los límites se expresan por módulos y contratos; un web y workers separados comparten código.
- [ ] **ARCH-002 · F1** — Definir bounded contexts: identidad, tenants, CRM/trabajos, ventas, compras, tesorería, fiscal, privacidad, soporte, IA y plataforma.
  **Evidencia:** Mapa de módulos y dependencias aprobado.
- [ ] **ARCH-003 · F1** — Crear configuración de entorno tipada y validada al arranque.
  **Evidencia:** Build/ready fallan con mensaje seguro ante variables obligatorias ausentes.
- [ ] **ARCH-004 · F1** — Crear feature flags por entorno/empresa para fiscal, billing, email, IA, analítica e indexación.
  **Evidencia:** Todos los nuevos motores nacen desactivados y se activan gradualmente.
- [ ] **ARCH-005 · F1** — Documentar ERD y diccionario de datos del esquema objetivo.
  **Evidencia:** Artefactos generados automáticamente desde Prisma y revisados.
- [ ] **ARCH-006 · F1** — Definir owner técnico y contrato de cada módulo.
  **Evidencia:** CODEOWNERS/mapa de ownership sin zonas huérfanas.
- [ ] **ARCH-007 · F2** — Mover reglas de negocio desde páginas/actions a servicios de dominio transaccionales.
  **Evidencia:** Server Actions solo validan, autorizan, invocan servicio y revalidan UI.
- [ ] **ARCH-008 · F2** — Crear idempotencia reutilizable para mutaciones internas y proveedores.
  **Evidencia:** Misma clave no duplica cobros, documentos, emails ni webhooks.
- [ ] **ARCH-009 · F2** — Adoptar inbox/outbox transaccional en PostgreSQL para jobs externos.
  **Evidencia:** Commit de negocio y evento se guardan en la misma transacción.
- [ ] **ARCH-010 · F1** — Migrar importes críticos a Decimal mediante columnas espejo y reconciliación.
  **Evidencia:** Diferencia total antes/después = 0; no se usa Float en evidencia fiscal.
- [ ] **ARCH-011 · F2** — Definir contratos de proveedor para billing, email, storage, IA, fiscal y observabilidad.
  **Evidencia:** Implementación local/fake y producción pasan la misma suite contractual.
- [ ] **ARCH-012 · F1** — Versionar contratos de eventos, prompts, plantillas y artefactos.
  **Evidencia:** Cada evento persistido identifica versión de esquema.
- [ ] **ARCH-013 · F1** — Diseñar migraciones aditivas, backfills idempotentes y rollback operativo.
  **Evidencia:** Cada migración tiene dry-run, guard y plan de reversión.
- [ ] **ARCH-014 · F11** — Publicar ADRs de decisiones irreversibles.
  **Evidencia:** Al menos arquitectura, fiscal, Decimal, outbox, storage y privacidad documentados.

### SEC — Seguridad, multitenencia y control de acceso

- [ ] **SEC-001 · F2** — Preservar sesiones opacas, hashes de token, cookies HttpOnly/Secure/SameSite y revocación.
  **Evidencia:** Regresión auth completa y sin downgrade.
- [ ] **SEC-002 · F2** — Rotar sesión tras login, cambio de contraseña, elevación de privilegio y selección sensible de empresa.
  **Evidencia:** Pruebas demuestran invalidación del token anterior.
- [ ] **SEC-003 · F5** — Añadir MFA para PLATFORM_OWNER/ADMIN y opción para OWNER.
  **Evidencia:** Operaciones de plataforma bloqueadas sin segundo factor configurado.
- [ ] **SEC-004 · F2** — Aplicar request ID y actor context a toda ruta, action, job y webhook.
  **Evidencia:** Logs/auditoría permiten correlación extremo a extremo.
- [ ] **SEC-005 · F2** — Implantar CSP en modo report-only y después enforce con nonce o hashes compatibles con Next.
  **Evidencia:** Cero violaciones necesarias en E2E antes de activar enforce.
- [ ] **SEC-006 · F2** — Completar headers: HSTS, frame-ancestors, Referrer, Permissions, MIME y política de recursos.
  **Evidencia:** Escaneo automatizado de headers pasa en staging.
- [ ] **SEC-007 · F2** — Validar Origin/Host y protección CSRF en mutaciones de navegador.
  **Evidencia:** Pruebas cross-site fallan con 403 sin modificar datos.
- [ ] **SEC-008 · F2** — Aplicar rate limit persistente a login, registro, demo, soporte, IA y webhooks.
  **Evidencia:** Tests concurrentes respetan ventanas y no mezclan tenants.
- [ ] **SEC-009 · F2** — Verificar firmas y proteger replay en webhooks Stripe/Resend/fiscales.
  **Evidencia:** Payload alterado/repetido no produce efectos.
- [ ] **SEC-010 · F2** — Cifrar tokens/certificados de integraciones por sobre con AES-GCM y versionado de clave.
  **Evidencia:** Secretos tenant no quedan en texto plano ni logs.
- [ ] **SEC-011 · F5** — Ampliar tests de aislamiento tenant a PDFs, exportaciones, búsquedas, chat, jobs, billing y storage.
  **Evidencia:** Suite negativa de dos empresas y dos usuarios completa.
- [ ] **SEC-012 · F5** — Encadenar o proteger registros de auditoría sensibles contra edición silenciosa.
  **Evidencia:** Verificador detecta alteración de una fila histórica.
- [ ] **SEC-013 · F5** — Mantener soporte temporal, mínimo privilegio, caducidad y cierre de sesión.
  **Evidencia:** Grant expirado no permite lectura; acceso queda auditado.
- [ ] **SEC-014 · F5** — Validar MIME real, extensión, tamaño, hash y escaneo de archivos.
  **Evidencia:** Archivos incompatibles/maliciosos quedan en cuarentena.
- [ ] **SEC-015 · F11** — Automatizar secret scanning, dependency audit, CodeQL, SBOM y licencias.
  **Evidencia:** CI bloquea secretos y vulnerabilidades por política.
- [ ] **SEC-016 · F11** — Realizar pentest específico de multitenencia y autorización horizontal.
  **Evidencia:** Hallazgos altos/críticos cerrados antes de launch.
- [ ] **SEC-017 · F5** — Crear plan de respuesta a incidentes y brechas.
  **Evidencia:** Simulacro registra detección, contención, comunicación y postmortem.
- [ ] **SEC-018 · F5** — Separar credenciales y permisos de development, preview, staging y production.
  **Evidencia:** Ningún entorno no productivo puede alcanzar recursos productivos.

### FISC — Fiscalidad española y emisión inmutable

- [ ] **FISC-001 · F3** — Completar gap assessment técnico-jurídico RRSIF/VERI*FACTU antes de afirmar conformidad.
  **Evidencia:** Checklist firmada por especialista y trazada a pruebas.
- [ ] **FISC-002 · F3** — Separar factura operativa editable de documento fiscal inmutable.
  **Evidencia:** La emisión crea snapshot; ediciones posteriores son imposibles.
- [ ] **FISC-003 · F3** — Usar Decimal para bases, cuotas, descuentos, retenciones y total.
  **Evidencia:** Golden tests de redondeo por línea/documento.
- [ ] **FISC-004 · F3** — Reservar numeración en transacción y por empresa/serie/tipo.
  **Evidencia:** Prueba concurrente sin duplicados ni huecos por carrera.
- [ ] **FISC-005 · F3** — Crear registro de alta/anulación append-only y hash de contenido canónico.
  **Evidencia:** Recalcular cadena produce mismo hash; manipulación se detecta.
- [ ] **FISC-006 · F3** — Encadenar registros según modalidad y conservar huella anterior.
  **Evidencia:** Cada alta/anulación referencia correctamente su precedente.
- [ ] **FISC-007 · F3** — Modelar rectificativas por sustitución/diferencias y motivo.
  **Evidencia:** Documento rectificativo enlaza originales y no los sobrescribe.
- [ ] **FISC-008 · F3** — Modelar anulación sin borrar evidencia.
  **Evidencia:** Anulación crea nuevo registro y conserva documento/artefactos.
- [ ] **FISC-009 · F3** — Generar QR y leyenda conforme al modo activo.
  **Evidencia:** Contenido QR validado con fixtures oficiales/especialista.
- [ ] **FISC-010 · F3** — Crear adaptador de certificado/firma y almacenamiento seguro de material criptográfico.
  **Evidencia:** Certificado nunca aparece en repo/log; rotación ensayada.
- [ ] **FISC-011 · F3** — Crear adaptador VERI*FACTU y modo no verificable desacoplado.
  **Evidencia:** Fake/sandbox y proveedor real comparten contrato.
- [ ] **FISC-012 · F3** — Registrar estado, reintentos, acuse y error de cada transmisión.
  **Evidencia:** Reintento idempotente no duplica registro remoto.
- [ ] **FISC-013 · F3** — Implementar libro de eventos exigible para modalidad no verificable.
  **Evidencia:** Eventos críticos son append-only y exportables.
- [ ] **FISC-014 · F3** — Generar declaración responsable por producto y versión desplegada.
  **Evidencia:** Documento incluye versión, hash de release y capacidades reales.
- [ ] **FISC-015 · F3** — Conservar evidencia de versión de software que emitió cada registro.
  **Evidencia:** Consulta fiscal recupera release, configuración y hash.
- [ ] **FISC-016 · F3** — Crear exportación para inspección, conservación y portabilidad.
  **Evidencia:** Paquete verificable incluye registros, hashes, artefactos y manifiesto.
- [ ] **FISC-017 · F3** — Clasificar facturas legacy sin retrocertificarlas.
  **Evidencia:** No se etiqueta como conforme ninguna factura histórica no emitida por el motor.
- [ ] **FISC-018 · F3** — Bloquear emisión cuando falten datos fiscales o configuración legal.
  **Evidencia:** No se consume número ni se crea alta ante validación fallida.

### EINV — Factura electrónica B2B e interoperabilidad

- [ ] **EINV-001 · F3** — Crear modelo semántico canónico independiente del formato.
  **Evidencia:** Mismo documento produce representaciones equivalentes.
- [ ] **EINV-002 · F3** — Generar UBL 2.1/EN16931 cuando sea aplicable.
  **Evidencia:** XML valida contra esquema y reglas de negocio seleccionadas.
- [ ] **EINV-003 · F3** — Generar UN/CEFACT CII.
  **Evidencia:** XML valida contra esquema y fixtures.
- [ ] **EINV-004 · F3** — Generar Facturae y firma cuando proceda.
  **Evidencia:** Esquema/firma pasan validador configurado.
- [ ] **EINV-005 · F3** — Diseñar adaptador EDIFACT para escenarios requeridos.
  **Evidencia:** Contrato y validación documentados; activación por capacidad.
- [ ] **EINV-006 · F3** — Versionar esquemas, codelists y validadores.
  **Evidencia:** Artefacto registra la versión exacta utilizada.
- [ ] **EINV-007 · F3** — Crear adaptadores de entrega: descarga, email seguro, plataforma privada y solución pública futura.
  **Evidencia:** Cada entrega registra destino, acuse y hash sin duplicados.
- [ ] **EINV-008 · F3** — Modelar aceptación, rechazo, pago y fechas de estado.
  **Evidencia:** Timeline de factura B2B completo y auditable.
- [ ] **EINV-009 · F3** — Conservar artefactos y acuses bajo política de retención.
  **Evidencia:** Restore reproduce documento y evidencia.
- [ ] **EINV-010 · F3** — Mantener transmisión pública bloqueada hasta la orden ministerial y validación legal.
  **Evidencia:** Flag off por defecto; readiness explica motivo.
- [ ] **EINV-011 · F3** — No mezclar factura B2B con billing SaaS de Stripe.
  **Evidencia:** Dominios, numeración y datos separados.
- [ ] **EINV-012 · F3** — Añadir pruebas de interoperabilidad con fixtures externos.
  **Evidencia:** Suite golden detecta cambios de XML/hashes.

### PRIV — RGPD, privacidad y gobierno del dato

- [ ] **PRIV-001 · F5** — Crear Registro de Actividades de Tratamiento mantenible y exportable.
  **Evidencia:** RAT incluye finalidades, bases, datos, destinatarios, transferencias y plazos.
- [ ] **PRIV-002 · F5** — Versionar DPA, términos, privacidad y cookies.
  **Evidencia:** Cada aceptación referencia hash y versión.
- [ ] **PRIV-003 · F5** — Mantener inventario de subencargados y cambios.
  **Evidencia:** Listado público/contractual actualizado con fecha.
- [ ] **PRIV-004 · F5** — Definir políticas de retención por categoría y empresa.
  **Evidencia:** Job dry-run muestra candidatos antes de borrar/anonimizar.
- [ ] **PRIV-005 · F5** — Crear centro de privacidad para acceso, rectificación, supresión, oposición, limitación y portabilidad.
  **Evidencia:** Solicitud recibe SLA, estado, evidencias y cierre.
- [ ] **PRIV-006 · F5** — Responder derechos dentro del plazo legal y controlar prórrogas.
  **Evidencia:** Alertas antes de vencimiento; auditoría de comunicación.
- [ ] **PRIV-007 · F5** — Crear exportación portable y minimizada por interesado/empresa.
  **Evidencia:** Paquete no cruza tenants y excluye secretos.
- [ ] **PRIV-008 · F5** — Crear borrado/anominización seguro con legal hold.
  **Evidencia:** Dependencias se resuelven sin romper contabilidad/fiscalidad.
- [ ] **PRIV-009 · F5** — Registrar consentimientos y retiradas cuando sean la base aplicable.
  **Evidencia:** Historial demuestra momento, versión y canal.
- [ ] **PRIV-010 · F9** — Implantar CMP solo para categorías no esenciales realmente usadas.
  **Evidencia:** Sin consentimiento no cargan analítica/marketing.
- [ ] **PRIV-011 · F5** — Mantener registro de brechas, decisiones y notificaciones.
  **Evidencia:** Simulacro produce timeline y responsables.
- [ ] **PRIV-012 · F5** — Realizar análisis de riesgos y EIPD cuando proceda.
  **Evidencia:** Documento de riesgo vincula medidas técnicas y residuales.
- [ ] **PRIV-013 · F5** — Clasificar datos y documentos por sensibilidad.
  **Evidencia:** Gateway IA, logs, soporte y exportaciones aplican la clasificación.
- [ ] **PRIV-014 · F5** — Anonimizar datos demo y evitar datos personales en fixtures.
  **Evidencia:** Scanner de fixtures no encuentra emails/teléfonos reales.
- [ ] **PRIV-015 · F5** — Aplicar privacidad por defecto al producto y a la telemetría.
  **Evidencia:** Eventos/logs pasan revisión de campos permitidos.
- [ ] **PRIV-016 · F9** — Sustituir textos legales genéricos por contenido parametrizado y revisable.
  **Evidencia:** No quedan afirmaciones falsas sobre envíos, facturación o proveedores.
- [ ] **PRIV-017 · F5** — Registrar base jurídica y finalidad en cada integración sensible.
  **Evidencia:** Catálogo de tratamientos enlaza proveedor y datos enviados.
- [ ] **PRIV-018 · F5** — Definir proceso de cambio de subencargado y aviso.
  **Evidencia:** Runbook y plantilla de comunicación disponibles.

### AI — Gobierno, privacidad, calidad y coste de IA

- [ ] **AI-001 · F6** — Interponer un gateway único entre producto y proveedores de IA.
  **Evidencia:** Ningún módulo llama directamente a api.openai.com.
- [ ] **AI-002 · F6** — Aplicar minimización y redacción antes de construir el payload.
  **Evidencia:** Tests eliminan NIF, IBAN, teléfono, email, direcciones y secretos salvo necesidad autorizada.
- [ ] **AI-003 · F6** — Forzar store:false en llamadas compatibles y documentar excepciones.
  **Evidencia:** Payload auditado y prueba contractual.
- [ ] **AI-004 · F6** — Permitir endpoint/región y controles ZDR/MAM por configuración.
  **Evidencia:** Readiness identifica región y política sin exponer claves.
- [ ] **AI-005 · F6** — Registrar proveedor, modelo, snapshot, prompt/schema version y finalidad.
  **Evidencia:** Cada resultado es reproducible a nivel de contrato.
- [ ] **AI-006 · F6** — Medir tokens, coste estimado, latencia, errores y escalados por empresa/usuario.
  **Evidencia:** Panel de uso reconcilia con proveedor.
- [ ] **AI-007 · F6** — Aplicar presupuestos y límites mensuales por empresa y usuario.
  **Evidencia:** Límite alcanzado degrada con mensaje y no genera sobrecoste silencioso.
- [ ] **AI-008 · F6** — Mantener dos carriles fast/reasoning con política explícita de escalado.
  **Evidencia:** Tests de decisión y coste.
- [ ] **AI-009 · F6** — Crear fallback determinista y modo degradado.
  **Evidencia:** Funciones críticas siguen permitiendo entrada manual sin IA.
- [ ] **AI-010 · F6** — Versionar prompts/esquemas y usar evals de regresión.
  **Evidencia:** Cambio de prompt requiere suite con umbrales.
- [ ] **AI-011 · F6** — Crear corpus sintético de ambigüedades sectoriales.
  **Evidencia:** 17H/importe, IVA, contacto/empresa, pago y rectificativa cubiertos.
- [ ] **AI-012 · F6** — Mostrar transparencia de uso de IA y revisión humana.
  **Evidencia:** UI distingue extracción, sugerencia y acción ejecutada.
- [ ] **AI-013 · F6** — Mantener confirmación para acciones sensibles y canales externos.
  **Evidencia:** Ningún envío/emisión/pago se ejecuta solo por respuesta del modelo.
- [ ] **AI-014 · F6** — Restringir IA según rol, scope, campos y clasificación.
  **Evidencia:** Portal limitado no puede inferir datos económicos ocultos.
- [ ] **AI-015 · F6** — Definir retención y borrado de prompts/resultados.
  **Evidencia:** Job y política documentados; logs sin contenido crudo.
- [ ] **AI-016 · F6** — Incluir proveedor IA en DPA/subencargados y evaluación de transferencia.
  **Evidencia:** Documentación legal y técnica coherente.
- [ ] **AI-017 · F6** — Crear kill switch global y por empresa.
  **Evidencia:** Desactivación no rompe flujos manuales.
- [ ] **AI-018 · F6** — Detectar y medir acciones rechazadas/corregidas.
  **Evidencia:** Métrica de calidad y riesgo visible.

### COMM — Billing, planes, suscripciones y uso

- [ ] **COMM-001 · F4** — Conservar BillingProvider y añadir adaptador Stripe; proveedor local permanece para tests.
  **Evidencia:** Suite contractual ejecutada contra ambos.
- [ ] **COMM-002 · F4** — Separar Plan interno de Product/Price externo mediante mapping.
  **Evidencia:** Ningún Price ID aparece hardcodeado en UI.
- [ ] **COMM-003 · F4** — Crear Checkout Session autenticada e idempotente.
  **Evidencia:** Reintento no crea dos customers/subscriptions.
- [ ] **COMM-004 · F4** — Integrar Customer Portal para método de pago, facturas y cancelación.
  **Evidencia:** Portal solo se crea para la empresa/OWNER autorizados.
- [ ] **COMM-005 · F4** — Verificar firma y deduplicar webhooks Stripe.
  **Evidencia:** Mismo event ID se procesa una vez.
- [ ] **COMM-006 · F4** — Sincronizar estados TRIALING/ACTIVE/PAST_DUE/PAUSED/CANCELED/EXPIRED.
  **Evidencia:** Matriz de eventos y pruebas de transición.
- [ ] **COMM-007 · F4** — Definir política de gracia y acceso read-only ante impago.
  **Evidencia:** Entitlements y mutaciones responden de forma consistente.
- [ ] **COMM-008 · F4** — Gestionar trial, renovación, downgrade y cancel at period end.
  **Evidencia:** Fechas locales y Stripe reconciliadas.
- [ ] **COMM-009 · F4** — Activar dunning y comunicaciones de pago fallido.
  **Evidencia:** Eventos generan email/tarea sin duplicados.
- [ ] **COMM-010 · F4** — Aplicar entitlements y límites en servidor, no solo UI.
  **Evidencia:** Pruebas negativas excediendo miembros/documentos/IA.
- [ ] **COMM-011 · F4** — Registrar consumo idempotente por periodo.
  **Evidencia:** Uso no se duplica al reintentar una acción.
- [ ] **COMM-012 · F4** — Definir sobreuso como decisión comercial, no cargo oculto.
  **Evidencia:** UI avisa y requiere plan/allowance configurado.
- [ ] **COMM-013 · F4** — Recoger datos fiscales de suscripción separados de clientes finales.
  **Evidencia:** Billing customer no contamina facturación operacional.
- [ ] **COMM-014 · F4** — Proporcionar reconciliación diaria proveedor/base.
  **Evidencia:** Job detecta divergencias y no corrige sin auditoría.
- [ ] **COMM-015 · F4** — Incluir cancelación reason y export en métricas.
  **Evidencia:** Razones visibles por cohorte.

### EMAIL — Correo transaccional y entregabilidad

- [ ] **EMAIL-001 · F4** — Unificar lib/email/index.ts y outbox bajo una fachada de servicio.
  **Evidencia:** Auth, invitaciones, billing, soporte y alertas usan la misma cola.
- [ ] **EMAIL-002 · F4** — Guardar el evento en outbox dentro de la transacción de negocio.
  **Evidencia:** No hay estado confirmado sin email pendiente cuando corresponde.
- [ ] **EMAIL-003 · F4** — Procesar outbox con worker separado y locking SKIP LOCKED.
  **Evidencia:** Dos workers no envían el mismo mensaje.
- [ ] **EMAIL-004 · F4** — Versionar plantillas y variables permitidas.
  **Evidencia:** Render falla antes de envío si falta variable.
- [ ] **EMAIL-005 · F4** — Añadir adaptador Resend y local sink.
  **Evidencia:** Contrato de provider y tests con destinatarios de prueba.
- [ ] **EMAIL-006 · F4** — Verificar webhooks Resend con body crudo y firma.
  **Evidencia:** Webhook inválido/replay se rechaza.
- [ ] **EMAIL-007 · F4** — Persistir delivery, delay, bounce, complaint, failure y suppression.
  **Evidencia:** Estado de outbox se actualiza idempotentemente.
- [ ] **EMAIL-008 · F4** — Mantener lista de supresión y bloquear reenvíos indebidos.
  **Evidencia:** Bounce/complaint posterior no vuelve a enviarse.
- [ ] **EMAIL-009 · F4** — Aplicar reintentos, backoff, dead letter y replay administrativo.
  **Evidencia:** Fallo temporal se recupera; fallo permanente se explica.
- [ ] **EMAIL-010 · F4** — Preparar subdominio de envío, SPF, DKIM, DMARC y reply-to como configuración.
  **Evidencia:** Solo faltan valores de dominio/correo del propietario.
- [ ] **EMAIL-011 · F4** — No persistir tokens de invitación en HTML/payload/auditoría.
  **Evidencia:** Scanner y tests confirman ausencia.
- [ ] **EMAIL-012 · F4** — Medir entrega sin activar tracking no necesario por defecto.
  **Evidencia:** Privacidad y email config son coherentes.

### STOR — Almacenamiento, integridad, backups y restauración

- [ ] **STOR-001 · F4** — Conservar DocumentStorage y seleccionar proveedor por entorno.
  **Evidencia:** Local y S3/Railway Bucket pasan suite contractual.
- [ ] **STOR-002 · F4** — Usar bucket privado y objetos aislados por empresa.
  **Evidencia:** No hay URL pública permanente ni key cruzada.
- [ ] **STOR-003 · F4** — Generar URLs firmadas de corta duración tras autorización.
  **Evidencia:** Enlace expirado/otro tenant falla.
- [ ] **STOR-004 · F4** — Guardar hash, tamaño, MIME, nombre seguro, provider y versión.
  **Evidencia:** Descarga verifica integridad.
- [ ] **STOR-005 · F5** — Añadir cuarentena y adaptador de escaneo antivirus.
  **Evidencia:** Archivo bloqueado no se procesa ni sirve.
- [ ] **STOR-006 · F5** — Aplicar retención, legal hold y borrado verificable.
  **Evidencia:** Job dry-run y evidencia de eliminación.
- [ ] **STOR-007 · F5** — Separar storage de previews, staging y producción.
  **Evidencia:** Bucket/credenciales/namespace distintos.
- [ ] **STOR-008 · F5** — Activar backups de volúmenes y PITR de PostgreSQL.
  **Evidencia:** Políticas visibles y alertas por fallo.
- [ ] **STOR-009 · F5** — Automatizar restore drill a servicio nuevo sin tocar origen.
  **Evidencia:** RPO/RTO medidos y checksum verificado.
- [ ] **STOR-010 · F5** — Crear export completo de empresa con manifest y hashes.
  **Evidencia:** Paquete restaura referencias sin claves externas.
- [ ] **STOR-011 · F4** — Sustituir URLs libres de logo/sello por uploads privados autorizados.
  **Evidencia:** PDFs resuelven assets sin aceptar SSRF.
- [ ] **STOR-012 · F5** — Impedir que previews compartan volumen o referencia DATABASE_URL.
  **Evidencia:** Puerta de infraestructura documentada y automatizada.

### OBS — Observabilidad, jobs, salud e incidentes

- [ ] **OBS-001 · F2** — Crear logger estructurado y PII-safe.
  **Evidencia:** Lista allowlist; scanner de logs evita payloads/secretos.
- [ ] **OBS-002 · F2** — Añadir instrumentación OpenTelemetry desacoplada del proveedor.
  **Evidencia:** Trazas locales/no-op y exportador pasan smoke.
- [ ] **OBS-003 · F2** — Crear instrumentation.ts e instrumentation-client.ts.
  **Evidencia:** Arranque server/client registra release y entorno.
- [ ] **OBS-004 · F2** — Propagar request ID, tenant, actor y job ID con límites de privacidad.
  **Evidencia:** Búsqueda correlaciona una operación completa.
- [ ] **OBS-005 · F2** — Crear /api/health/live, /ready y status interno detallado protegido.
  **Evidencia:** Railway usa ready; público no expone secretos.
- [ ] **OBS-006 · F2** — Registrar release SHA, migration head y deployment metadata.
  **Evidencia:** Diagnóstico identifica versión exacta.
- [ ] **OBS-007 · F5** — Medir errores, latencia, tasa de jobs, colas, DB y proveedores.
  **Evidencia:** Dashboard y alertas con umbrales.
- [ ] **OBS-008 · F5** — Monitorizar cron/worker y dead letters.
  **Evidencia:** Heartbeat vencido genera incidente.
- [ ] **OBS-009 · F5** — Crear synthetic smoke contra rutas públicas/auth y acciones críticas no destructivas.
  **Evidencia:** Ejecución programada con historial.
- [ ] **OBS-010 · F5** — Añadir error tracking configurable sin enviar PII.
  **Evidencia:** Evento de prueba aparece con datos redacted.
- [ ] **OBS-011 · F5** — Definir SLO/SLA internos y severidades.
  **Evidencia:** Runbook vincula alerta, responsable y comunicación.
- [ ] **OBS-012 · F5** — Crear registro de incidentes y postmortems.
  **Evidencia:** Incidente de simulación cerrado con acciones.
- [ ] **OBS-013 · F8** — Medir Core Web Vitals y accesibilidad en páginas clave.
  **Evidencia:** Gates comparan con presupuesto de rendimiento.
- [ ] **OBS-014 · F11** — Generar informe de readiness reproducible.
  **Evidencia:** Un comando produce evidencia versionada.

### CI — CI/CD, previews, pruebas y release

- [ ] **CI-001 · F11** — Añadir GitHub Actions para pull_request y push protegido.
  **Evidencia:** Workflow verde desde clon limpio.
- [ ] **CI-002 · F11** — Usar Node compatible, npm ci y caché controlada.
  **Evidencia:** Lockfile obligatorio y reproducible.
- [ ] **CI-003 · F11** — Levantar PostgreSQL aislado y aplicar todas las migraciones.
  **Evidencia:** Schema desde cero y upgrade fixture pasan.
- [ ] **CI-004 · F11** — Ejecutar prisma validate/generate, typecheck y build.
  **Evidencia:** Cualquier fallo bloquea PR.
- [ ] **CI-005 · F11** — Ejecutar suites críticas de auth, tenant, permisos, numeración, fiscal, billing, email y storage.
  **Evidencia:** Resumen por gate, no solo total global.
- [ ] **CI-006 · F11** — Adoptar Vitest para unidad y Playwright Test para E2E sin eliminar suites existentes.
  **Evidencia:** Tests nuevos reportan JUnit/artefactos.
- [ ] **CI-007 · F11** — Añadir a11y, rutas, noindex/sitemap y CSP checks.
  **Evidencia:** Cero critical/serious y políticas coherentes.
- [ ] **CI-008 · F11** — Añadir npm audit/audit-ci, SBOM CycloneDX y licencias.
  **Evidencia:** Umbral y excepciones documentadas.
- [ ] **CI-009 · F11** — Añadir gitleaks/secret scan y CodeQL.
  **Evidencia:** Hallazgo bloqueante falla workflow.
- [ ] **CI-010 · F11** — Crear golden tests fiscales/XML/PDF y hashes.
  **Evidencia:** Cambio intencional requiere actualización revisada.
- [ ] **CI-011 · F11** — Crear workflow de preview/fallback Railway sin secretos productivos.
  **Evidencia:** PR env se crea y elimina de forma verificable.
- [ ] **CI-012 · F11** — Crear workflow de release con gates manuales por entorno.
  **Evidencia:** Production requiere aprobación y SHA inmutable.
- [ ] **CI-013 · F11** — Pinnear acciones por SHA y permisos mínimos.
  **Evidencia:** Workflow no usa write-all.
- [ ] **CI-014 · F11** — Subir artefactos de pruebas, logs sanitizados, SBOM y manifest de release.
  **Evidencia:** Data room puede reproducir una RC.

### UX — Producto, UX, accesibilidad y control humano

- [ ] **UX-001 · F7** — Crear onboarding guiado por objetivo, empresa y oficio.
  **Evidencia:** Usuario llega a primer valor sin depender de soporte.
- [ ] **UX-002 · F7** — Mostrar checklist de activación: empresa, cliente, presupuesto y documento.
  **Evidencia:** Evento de activación medido en siete días.
- [ ] **UX-003 · F7** — Ofrecer importación segura de clientes/documentos con preview y rollback.
  **Evidencia:** Errores por fila y sin duplicados.
- [ ] **UX-004 · F7** — Convertir plan/uso en panel real de consumo, límites, checkout y portal.
  **Evidencia:** No queda botón de simulación en producción.
- [ ] **UX-005 · F7** — Crear centro de privacidad y preferencias IA/email.
  **Evidencia:** Usuario gestiona derechos y opt-ins.
- [ ] **UX-006 · F7** — Crear soporte autenticado con contexto mínimo y adjuntos seguros.
  **Evidencia:** Ticket incluye ruta/release sin secretos.
- [ ] **UX-007 · F7** — Refactorizar acciones de dinero y documentos para usar servicios de dominio.
  **Evidencia:** No quedan writes fiscales directos en UI.
- [ ] **UX-008 · F7** — Mejorar PDFs con assets reales, Unicode, plantillas versionadas y snapshot.
  **Evidencia:** PDF multipágina y branding pasan golden test.
- [ ] **UX-009 · F9** — Integrar Marketing V2 solo después de preview aislada y revisión.
  **Evidencia:** PR #24 validada; route manifest actualizado una vez.
- [ ] **UX-010 · F9** — Reducir mensaje público a flujo lead-visita-presupuesto-trabajo-gasto-factura-cobro.
  **Evidencia:** Demo de 15 minutos cubre historia completa.
- [ ] **UX-011 · F8** — Mantener accesibilidad WCAG en públicos y app.
  **Evidencia:** Axe y revisión teclado/reduced motion.
- [ ] **UX-012 · F7** — Mantener modo manual completo cuando IA/integraciones están desactivadas.
  **Evidencia:** Todas las entidades críticas son editables sin IA.

### MET — Métricas, unit economics y experimentación

- [ ] **MET-001 · F8** — Capturar eventos first-party con allowlist y minimización.
  **Evidencia:** Schema de evento rechaza propiedades no aprobadas.
- [ ] **MET-002 · F8** — Medir activación: empresa, cliente, presupuesto y documento en siete días.
  **Evidencia:** Funnel por cohorte.
- [ ] **MET-003 · F8** — Medir WAU de usuarios y empresas.
  **Evidencia:** Definición estable y documentada.
- [ ] **MET-004 · F8** — Medir retención M1/M2/M3 y motivos de abandono.
  **Evidencia:** Cohortes y cancelación vinculadas.
- [ ] **MET-005 · F8** — Medir MRR, ARPA y expansión/contracción desde billing reconciliado.
  **Evidencia:** No se infiere MRR de estados locales simulados.
- [ ] **MET-006 · F8** — Medir coste de infraestructura, IA, almacenamiento, email y soporte.
  **Evidencia:** Unit economics por plan/empresa.
- [ ] **MET-007 · F8** — Calcular margen bruto y coste de servir.
  **Evidencia:** Panel con metodología y fecha.
- [ ] **MET-008 · F8** — Medir conversión de presupuesto, plazo de cobro y deuda recuperada.
  **Evidencia:** Valor ligado a datos operativos.
- [ ] **MET-009 · F8** — Medir tiempo ahorrado y acciones IA aceptadas/corregidas.
  **Evidencia:** Encuesta/eventos con metodología.
- [ ] **MET-010 · F8** — Crear cohortes de piloto y feedback estructurado.
  **Evidencia:** Cada piloto tiene objetivo, frecuencia y resultado.
- [ ] **MET-011 · F8** — Crear panel PLATFORM_OWNER de salud comercial y técnica.
  **Evidencia:** Datos agregados; sin lectura de contenido tenant.
- [ ] **MET-012 · F8** — Definir experimentos y decisiones de producto.
  **Evidencia:** Cada cambio de onboarding/precio tiene hipótesis y métrica.

### SUP — Pilotos, soporte y éxito de cliente

- [ ] **SUP-001 · F8** — Definir programa de 5-10 pilotos, al menos 5 de pago.
  **Evidencia:** Cohorte, contrato/consentimiento y criterios de éxito.
- [ ] **SUP-002 · F8** — Estandarizar onboarding y sesión inicial.
  **Evidencia:** Checklist y tiempos registrados.
- [ ] **SUP-003 · F8** — Crear ticketing con prioridad, SLA interno y estados.
  **Evidencia:** Incidencias no quedan en email informal.
- [ ] **SUP-004 · F8** — Crear base de conocimiento y troubleshooting.
  **Evidencia:** Top incidencias resueltas sin intervención.
- [ ] **SUP-005 · F8** — Medir horas de soporte por cuenta.
  **Evidencia:** Coste integrado en unit economics.
- [ ] **SUP-006 · F8** — Recoger feedback y NPS/CSAT de forma proporcionada.
  **Evidencia:** Consentimiento y no spam.
- [ ] **SUP-007 · F8** — Registrar razones de cancelación/churn.
  **Evidencia:** Taxonomía y campo libre redacted.
- [ ] **SUP-008 · F8** — Gestionar testimonios/casos con consentimiento.
  **Evidencia:** Permiso, alcance y retirada registrados.
- [ ] **SUP-009 · F5** — Definir incidentes Sev1-Sev4 y comunicación.
  **Evidencia:** Plantillas y responsables listos.
- [ ] **SUP-010 · F8** — Crear handoff comercial-soporte-producto.
  **Evidencia:** No se pierde contexto y se respeta minimización.

### MOB — PWA, app móvil y tiendas

- [ ] **MOB-001 · F10** — Definir oficialmente el wrapper móvil como cliente del backend web.
  **Evidencia:** Documentación/store listing coherentes.
- [ ] **MOB-002 · F10** — Separar configuraciones development/staging/release.
  **Evidencia:** Build no puede apuntar a localhost en release.
- [ ] **MOB-003 · F10** — Configurar universal/app links y retorno de auth.
  **Evidencia:** Deep link validado en Android/iOS.
- [ ] **MOB-004 · F10** — Revisar cookies, sesiones y almacenamiento seguro en WebView.
  **Evidencia:** Login/logout/rotación pasan E2E dispositivo.
- [ ] **MOB-005 · F10** — Gestionar PDFs, descargas, uploads y permisos mínimos.
  **Evidencia:** Flujos funcionan sin permisos innecesarios.
- [ ] **MOB-006 · F10** — Añadir crash reporting y release mapping configurable.
  **Evidencia:** Crash sintético llega sin PII.
- [ ] **MOB-007 · F10** — Completar privacy labels/data safety desde el RAT real.
  **Evidencia:** Metadatos de tienda coinciden con producto.
- [ ] **MOB-008 · F10** — Preparar firma y rotación de keystore/certificados fuera del repo.
  **Evidencia:** Runbook y backup seguro.
- [ ] **MOB-009 · F10** — Automatizar build AAB/Archive con gates.
  **Evidencia:** Artefactos versionados y reproducibles.
- [ ] **MOB-010 · F10** — No afirmar publicación hasta revisión efectiva de tiendas.
  **Evidencia:** Estado y limitaciones visibles.

### DATA — Diligencia, documentación y data room

- [ ] **DATA-001 · F11** — Crear data room con estructura de producto, tecnología, seguridad, pruebas, IP, legal, comercial y transición.
  **Evidencia:** Índice y manifest con fechas/hashes.
- [ ] **DATA-002 · F11** — Documentar arquitectura, ERD, data dictionary y flujos críticos.
  **Evidencia:** Un nuevo equipo puede orientarse sin fundador.
- [ ] **DATA-003 · F11** — Documentar despliegue, rollback, backups, restore y disaster recovery.
  **Evidencia:** Simulacro y capturas/evidencia.
- [ ] **DATA-004 · F11** — Publicar catálogo de comandos y suites reproducibles.
  **Evidencia:** Clon limpio alcanza resultado documentado.
- [ ] **DATA-005 · F11** — Mantener known issues, deuda técnica y limitaciones honestas.
  **Evidencia:** No quedan promesas contradictorias con código.
- [ ] **DATA-006 · F11** — Documentar matriz de dependencias/licencias/SBOM.
  **Evidencia:** Revisión legal técnica completada.
- [ ] **DATA-007 · F11** — Acreditar titularidad de código, diseños, datos demo y assets.
  **Evidencia:** Cesiones/manifest en carpeta privada.
- [ ] **DATA-008 · F11** — Definir paquete de transición y horas incluidas.
  **Evidencia:** Runbook de handover y criterios de aceptación.
- [ ] **DATA-009 · F11** — Crear ADRs y registro de decisiones.
  **Evidencia:** Historia técnica no depende de memoria.
- [ ] **DATA-010 · F11** — Definir support matrix de versiones y proveedores.
  **Evidencia:** Compatibilidad y EOL conocidas.
- [ ] **DATA-011 · F11** — Mantener manifest de release con SHA, migraciones, artefactos y checksums.
  **Evidencia:** Cada RC es auditable.
- [ ] **DATA-012 · F11** — Separar data room privado de documentación pública del repo.
  **Evidencia:** No se exponen secretos, contratos o datos personales.


## Evidencia y registro continuo

Crea/actualiza:

- `docs/readiness/EXECUTION_LOG.md`
- `docs/readiness/requirements.yaml`
- `docs/readiness/evidence/<phase>/...`
- `docs/adr/...`
- `docs/runbooks/...`
- `docs/compliance/...`
- un manifest de release JSON con SHA, migraciones, suites, artefactos y checksums.

No versionar secretos, dumps reales, capturas con PII, contratos privados ni data room confidencial. La evidencia sensible se referencia por hash/localización segura.

## Entrega final obligatoria

Informa, con valores reales y sin secretos:

1. rama, SHA y PR de cada fase;
2. archivos y migraciones creados/modificados;
3. resultados de typecheck/build/tests/E2E/a11y/security;
4. providers y flags por entorno;
5. restore drill y rollback;
6. resultados fiscal/eInvoice, billing, email, IA, privacidad y storage;
7. métricas/pilotos disponibles y datos aún no demostrados;
8. estado de Marketing V2 y PR #24;
9. estado exacto de staging y producción;
10. costes/recursos temporales y teardown;
11. requisitos PASS, BLOCKED, READY_FOR_EXTERNAL_INPUT y WAIVED;
12. inputs concretos que debe proporcionar el propietario: dominio, remitente/correo y credenciales/aprobaciones externas;
13. confirmación de cero secretos y cero modificaciones no autorizadas de producción.

No finalices con una promesa futura. Entrega todo lo completado, lo bloqueado con causa verificable y los comandos/runbooks para resolver exclusivamente lo externo.

## Fuentes oficiales de referencia

- **S1 — Repositorio Capataz/Orqena - rama main:** https://github.com/tonirigo25/capataz
  Código y documentación técnica inspeccionados el 25-07-2026.
- **S2 — PR #24 - Marketing V2:** https://github.com/tonirigo25/capataz/pull/24
  PR borrador, rama y SHA utilizados para el cierre de Sprint F.
- **S3 — Real Decreto 1007/2023 - requisitos de sistemas de facturación:** https://www.boe.es/eli/es/rd/2023/12/05/1007
  Integridad, conservación, accesibilidad, legibilidad, trazabilidad, inalterabilidad, QR y declaración responsable.
- **S4 — AEAT - ampliación de plazos de adaptación SIF:** https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html
  Fechas 01-01-2027 y 01-07-2027 según obligado.
- **S5 — Real Decreto 238/2026 - factura electrónica B2B:** https://www.boe.es/eli/es/rd/2026/03/25/238
  Marco de factura electrónica entre empresarios y profesionales.
- **S6 — Reglamento (UE) 2024/1689 - AI Act:** https://eur-lex.europa.eu/eli/reg/2024/1689/oj
  Transparencia, gobernanza y calendario de aplicación.
- **S7 — AEPD - exactitud y minimización en sistemas de IA:** https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-analiza-calidad-exactitud-y-minimizacion-de-datos-personales-en-tratamientos-con-ia
  Nota técnica publicada el 21-07-2026.
- **S8 — AEPD - Gestiona RGPD:** https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-lanza-nueva-version-gestiona-rgpd
  RAT, análisis de riesgos, medidas y EIPD.
- **S9 — AEPD - ejercicio de derechos:** https://www.aepd.es/en/rights-and-duties/know-your-rights
  Derechos y plazo general de respuesta de un mes.
- **S10 — OpenAI - controles de datos de la API:** https://developers.openai.com/api/docs/guides/your-data
  Retención por endpoint, store:false, ZDR/MAM y residencia de datos.
- **S11 — Stripe - webhooks de suscripciones:** https://docs.stripe.com/billing/subscriptions/webhooks
  Eventos asíncronos, verificación y reintentos.
- **S12 — Stripe - Customer Portal:** https://docs.stripe.com/customer-management
  Gestión de pago, facturas y suscripciones por el cliente.
- **S13 — Resend - verificación de webhooks:** https://resend.com/docs/webhooks/verify-webhooks-requests
  Firma Svix y uso de body crudo.
- **S14 — Resend - dominios:** https://resend.com/docs/dashboard/domains/introduction
  SPF, DKIM, subdominio y DMARC.
- **S15 — Resend - retries y replays:** https://resend.com/docs/webhooks/retries-and-replays
  Backoff y replay de webhooks.
- **S16 — Railway - Environments:** https://docs.railway.com/environments
  Aislamiento, PR Environments, Bot PR Environments y duplicación.
- **S17 — Railway - variables:** https://docs.railway.com/variables
  Reference variables y limitaciones de sealed variables en duplicados/previews.
- **S18 — Railway - backups:** https://docs.railway.com/volumes/backups
  Backups diarios/semanales/mensuales de volúmenes.
- **S19 — Railway - Point-in-Time Recovery:** https://docs.railway.com/volumes/point-in-time-recovery
  Restore a nuevo servicio sin tocar el origen.
- **S20 — Railway - Config as Code:** https://docs.railway.com/config-as-code/reference
  Overrides de entorno `pr` y prioridad de configuración.
- **S21 — Next.js 15 - Content Security Policy:** https://nextjs.org/docs/15/app/guides/content-security-policy
  CSP, nonces y protección contra inyección.
- **S22 — Next.js - OpenTelemetry:** https://nextjs.org/docs/15/pages/guides/open-telemetry
  Instrumentación OpenTelemetry compatible con Next.
