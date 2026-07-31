# Inventario de identificadores técnicos legacy

La marca visible es `Orqena Tech` (empresa), `Orqena` (producto) y `Orqena IA` (asistente). Los elementos siguientes se conservan únicamente para no romper compatibilidad; no deben aparecer en UI, metadata, emails, documentos, SEO ni capturas.

| Identificador | Uso técnico actual | Motivo de conservación | Frontera visible |
|---|---|---|---|
| `/capataz` | Alias autenticado y enlaces internos existentes | Bookmarks, permisos y contratos de rutas | En el host público redirige 301 a `/producto`; app permanece `noindex` |
| `app/(app)/capataz` y `app/api/capataz` | Nombres físicos de módulos y endpoint | Evitar romper imports y clientes existentes | Los rótulos se obtienen del contrato canónico |
| `components/capataz-chat.tsx` y módulos `lib/capataz-*` | Nombres de archivos y símbolos | Renombrado fuera de esta revisión visual | No se muestran al usuario |
| `CAPATAZ_*` | Variables, guardas y herramientas históricas | Compatibilidad de despliegue y QA | Nunca se imprimen ni se convierten en copy |
| `capataz` en nombres de base de pruebas | Aislamiento local histórico | Seguridad de runners y migraciones | No sale de logs técnicos controlados |
| Repositorio y servicio históricos | Identidad de infraestructura | Renombrarlos puede romper integraciones | No se usan como marca pública |

Retirar un alias exige una migración separada, inventario de consumidores y plan de rollback. Esta revisión no renombra tablas, migraciones, variables, servicios o módulos internos.
