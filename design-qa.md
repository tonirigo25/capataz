# Design QA — Portal interno Orqena

## Resultado

`passed`

No quedan hallazgos visuales P0, P1 o P2 abiertos dentro del alcance del portal interno autorizado para PR #63.

## Fuente visual canónica

- Paquete: `ORQENA_CODEX_PAQUETE_LIGERO_COMPLETO.zip`.
- Contrato global, logo oficial y prompt maestro leídos antes de modificar código.
- Las 18 carpetas `REFERENCIAS/NN` se trataron como pares inseparables de imagen y ficha técnica.
- No se mezclaron referencias entre módulos.

## Implementación validada

- Rama: `design/orqena-field-os-v2`.
- Railway Review: `orqena-review-continuous` / `orqena-review-web`.
- URL: `https://orqena-review-web-review.up.railway.app`.
- El SHA y el deployment exactos se registran en la entrega final después del último gate remoto.
- PR #63 permanece abierta y Draft.
- Staging y Production no se modificaron.

## Evidencia comparada

- 18 capturas de implementación a 1440 px: `artifacts/design-v2/portal-interno/implementation/1440/`.
- 18 tableros fuente-vs-Review en una misma imagen: `artifacts/design-v2/portal-interno/comparisons/1440/`.
- Matriz autenticada de perfiles a 390 px y 1440 px: `artifacts/design-v2/portal-interno/runtime-auth/` y `runtime-auth-remaining/`.

Las comparaciones fueron inspeccionadas para jerarquía, densidad, navegación, composición, tipografía, responsive, estados, controles y fidelidad funcional. Las diferencias frente a las referencias son adaptaciones deliberadas a datos sintéticos veraces, permisos reales y límites de producto; no se inventaron saldos, progreso ni previsiones.

## Cobertura funcional y visual

- Login con el logo oficial y shell autenticado compartido.
- Hoy y Dashboard como pantallas distintas.
- Cliente 360 subordinado a Clientes.
- Trabajo, Presupuestos, Dinero, Documentos, Agenda, Equipo y Configuración.
- Orqena IA persistente en la navegación y ayuda contextual por módulo.
- Confirmación humana, posponer y descartar en las propuestas de IA.
- Navegación móvil, panel contextual móvil y layouts de escritorio.
- Perfiles owner, dirección general, administración, ventas, finanzas, compras, proyecto, supervisión, campo, externo y viewer.
- Aislamiento tenant, permisos, acceso de sólo lectura y límites de plan conservados.

## Iteraciones cerradas

| Hallazgo | Severidad | Corrección |
| --- | --- | --- |
| Etiquetas y enlaces heredados no coincidían con el nuevo mapa | P1 | Normalización de navegación y deep links. |
| Ayuda de IA genérica o no contextual | P1 | Rail contextual gobernado por módulo, rol y acción. |
| Datos económicos podían sugerir magnitudes no confirmadas | P1 | Presentación limitada a información autorizada y fixtures explícitos. |
| Logo oficial fallaba a través del optimizador dinámico | P1 | Recurso oficial servido directamente, sin alterar el activo. |
| Secreto TOTP configurado en entorno no coincidía con el factor activo preservado | P1 operacional | Validación autenticada con el factor activo recuperado de forma efímera y sin mutar la base. |
| El panel móvil y el rail de escritorio compartían el mismo identificador de título al abrirse | P1 | Identificadores independientes y relación `aria-labelledby` inequívoca para el diálogo móvil. |

## Gates

- Typecheck: PASS.
- Build: PASS (93/93 rutas).
- Tests focales de portal, permisos, tenant e IA: PASS.
- CI de aplicación, infraestructura, base crítica, supply chain, CodeQL y contrato de backup: PASS.
- Browser: PASS, incluidos 513 E2E y Lighthouse.
- `/api/health/live`: 200.
- `/api/health/ready`: 200.
- Cero migraciones, semillas o cambios de datos ejecutados en esta entrega.

## Resultado final

`passed`
