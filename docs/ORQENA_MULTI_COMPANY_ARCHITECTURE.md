# Arquitectura multiempresa de Orqena

La identidad de usuario y la empresa activa son conceptos separados. `User.activeCompanyId` es una preferencia persistente; solo se acepta cuando existe una `CompanyMembership` activa y la empresa está activa. Con una única membresía válida se registra un fallback controlado. Con varias y sin preferencia válida, el usuario debe elegir en `/seleccionar-empresa`.

El cambio se ejecuta en servidor, vuelve a validar la membresía, actualiza la preferencia, invalida confirmaciones de chat incompatibles, registra auditoría y redirige a una ruta segura. Los identificadores de empresa enviados por formularios nunca sustituyen el contexto validado.

Las cuentas internas (`PlatformAccount`) no crean membresías implícitas. El acceso de soporte es otro contexto, temporal y auditado.
