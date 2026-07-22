# Relaciones contextuales

`lib/entity-context` concentra selección, opciones y validación. Todo ID se resuelve con `companyId` activo. Un trabajo fija su cliente; presupuestos, facturas, documentos y contactos deben pertenecer al cliente y trabajo compatibles.

Al cambiar cliente se descartan relaciones dependientes. Al cambiar trabajo se actualiza cliente y se limpian dependencias. El servidor rechaza entidades de otra empresa o relaciones incompatibles aunque el navegador manipule el formulario.

Las opciones se cargan en consultas agrupadas, con límites, búsqueda y etiquetas persistentes para evitar N+1.
