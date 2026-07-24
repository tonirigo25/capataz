# Arquitectura multiempresa de Orqena

La identidad de usuario y la empresa activa son conceptos separados. `User.activeCompanyId` es una preferencia persistente; solo se acepta cuando existe una `CompanyMembership` activa y la empresa está activa. Con una única membresía válida se registra un fallback controlado. Con varias y sin preferencia válida, el usuario debe elegir en `/seleccionar-empresa`.

El cambio se ejecuta en servidor, vuelve a validar la membresía, actualiza la preferencia, invalida confirmaciones de chat incompatibles, registra auditoría y redirige a una ruta segura. Los identificadores de empresa enviados por formularios nunca sustituyen el contexto validado.

Las cuentas internas (`PlatformAccount`) no crean membresías implícitas. El acceso de soporte es otro contexto, temporal y auditado.

## Invitaciones y activación por empresa

Una invitación pertenece a una sola empresa y persiste únicamente el hash del token. La aceptación verifica token, expiración y correo; crea o actualiza una membresía `pending_owner_approval`, que no puede seleccionar la empresa ni leer datos. Solo una aprobación transaccional de `OWNER` materializa paquetes, scopes, equipos, campos y autoridades y cambia la membresía a `active`. Rechazo, revocación y suspensión cierran sesiones y conservan auditoría y registros empresariales. La pertenencia a otras empresas no se altera.
## Doble aislamiento de chat

El aislamiento conversacional es `(companyId, ownerUserId)`. La selección local usa `orqena-chat-conversation-id:<companyId>:<userId>` y el cambio de empresa invalida solicitudes, propuestas y respuestas tardías. Un ID de otra empresa o de otro miembro se trata como conversación no disponible. Las conversaciones legacy sin propietario permanecen físicamente conservadas, pero el runtime no las lista ni las abre.
