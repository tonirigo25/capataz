# Seguridad comercial

- La empresa activa se deriva de una preferencia persistente validada.
- Toda mutación administrativa usa guards de servidor.
- Denegación prevalece sobre concesión.
- Tokens de invitación se almacenan como hash y caducan.
- Uso incorpora clave de idempotencia única por empresa y métrica.
- Transferencia de propiedad y cambios comerciales son transaccionales.
- Plataforma interna no implica acceso tenant.
- El soporte caduca, es visible y se audita.
- No se registran secretos, tokens ni contenido documental en auditoría.

Antes de desplegar deben añadirse rate limiting distribuido, proveedor real de correo, política CSRF validada con la topología final y revisión independiente de seguridad.
