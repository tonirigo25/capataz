# Gobierno de privacidad y dato — F5

Estado: controles técnicos listos para validación aislada. La revisión jurídica, identidad definitiva, contratos/DPA y activación de proveedores siguen siendo entradas externas. Este documento no afirma conformidad legal por sí solo.

## Registro de Actividades de Tratamiento

`ProcessingActivity` mantiene por empresa la finalidad, base jurídica, categorías de datos e interesados, destinatarios, transferencias, retención y responsable. `exportProcessingActivities` genera un RAT ordenado y con SHA-256. El catálogo base está versionado en `contracts/privacy/v1/catalog.json`; una integración sensible no se activa si no aparece con finalidad, base y datos enviados.

## Documentos, aceptaciones y subencargados

Los borradores DPA, términos, privacidad y cookies tienen versión y ruta en `contracts/legal/v1/manifest.json`. `LegalDocumentVersion` persiste SHA-256 y `LegalAcceptance` referencia exactamente la versión aceptada. Todos los textos están marcados para revisión jurídica externa.

El inventario de subencargados registra finalidad, categorías, ubicaciones, salvaguardas, fecha efectiva, fecha de revisión y hash de versión. Cada cambio crea `SubprocessorChange`; si exige aviso, debe incluir fecha límite, contenido versionado y evidencia de notificación. Un proveedor marcado `DISABLED` no se presenta como activo.

## Derechos de las personas

El centro protegido `/configuracion/privacidad` admite acceso, rectificación, supresión, oposición, limitación y portabilidad. Cada solicitud nace con vencimiento de un mes natural, identidad pendiente y timeline. Una prórroga admite sólo uno o dos meses, exige motivo y referencia de comunicación. Hay alertas siete días antes del vencimiento y cada cierre exige evidencia de comunicación.

Fuente operativa del plazo: AEPD, “¿Cuál es el plazo para responder cuando se ejercitan estos derechos?”: https://www.aepd.es/preguntas-frecuentes/1-tus-derechos/2-tus-derechos-de-proteccion-de-datos/FAQ-0106-cual-es-el-plazo-para-responder-cuando-se-ejercitan-estos-derechos

Las exportaciones de interesado usan allowlist; las de empresa recorren modelos con `companyId`, eliminan credenciales, hashes de token, cifrados y claves externas, y generan manifest por modelo, conteos y hashes. El verificador detecta manipulación. La expiración prevista del paquete es de siete días.

## Retención, legal hold y supresión

Las políticas nacen desactivadas. Primero se ejecuta `DRY_RUN`; la salida conserva candidatos, bloqueos y hash. `LegalHold` bloquea cualquier supresión coincidente. La aplicación exige la frase exacta derivada del dry-run, vuelve a consultar el hold, elimina mediante el proveedor, conserva un tombstone y registra el hash de evidencia.

La supresión de un interesado preserva documentación contable/fiscal y registra sus conteos. Si la identidad pertenece a varias empresas, no se anonimiza globalmente: se revoca sólo la membresía del tenant. Si pertenece a una sola empresa y no hay hold, se sustituye la identidad por un pseudónimo irreversible. La ejecución siempre requiere plan y confirmación humana.

## Riesgo y EIPD

`PrivacyRiskAssessment` conserva versión, alcance, riesgos, salvaguardas, riesgo residual, responsable, aprobación y siguiente revisión. Una EIPD se prepara antes de tratamientos que puedan suponer alto riesgo; si el riesgo residual no puede mitigarse, la activación queda bloqueada a consulta/decisión externa. Referencias oficiales: EDPB, https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en y plantilla 2026, https://www.edpb.europa.eu/system/files/2026-04/edpb_dpia_template_explainer_2026_v1_en.pdf

## Clasificación, demos y telemetría

Clasificación mínima: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`. Credenciales, tokens, identificadores fiscales, IBAN y certificados son `RESTRICTED`; identidad/contacto/contenido es `CONFIDENTIAL`. Storage, export, soporte y el futuro gateway IA deben aplicar la misma clasificación.

La telemetría sólo admite IDs de correlación, operación/ruta, estado, duración, job/proveedor, código de error, release/entorno y hashes no reversibles. Se prohíben payloads, emails, teléfonos, direcciones, tokens y texto libre. El scanner de fixtures permite únicamente dominios `.invalid` y rechaza patrones españoles plausibles.

## Brechas

Toda brecha se documenta, incluso si se decide no notificar. El registro abre incidente, responsables y timeline, inicia el reloj de decisión de 72 horas y exige motivo trazable. Riesgo implica notificación a autoridad; alto riesgo añade comunicación a afectados. Fuente operativa: AEPD, https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/brechas-de-datos-personales-notificacion

La decisión jurídica y el envío real nunca son automáticos: requieren responsable autorizado y referencia externa verificable.
