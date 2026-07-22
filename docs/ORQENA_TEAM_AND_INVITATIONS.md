# Equipo e invitaciones

Las membresías conservan estado, rol, invitador, fechas, revocación, origen, actividad y marca demo. Los equipos pertenecen estrictamente a una empresa y solo admiten membresías activas de esa empresa.

Las invitaciones almacenan hash de un token de alta entropía, caducan, son de un uso y se validan contra el correo autenticado. La aceptación es transaccional e idempotente mediante la unicidad usuario-empresa. No se envía correo real sin proveedor configurado.

La transferencia de propiedad es transaccional, exige OWNER y confirmación, mantiene siempre un OWNER, invalida sesiones implicadas y audita el cambio.
