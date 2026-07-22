# Provisionamiento de demos

El catálogo versionado incluye construcción, servicios profesionales, instalaciones, taller, hostelería, inmobiliaria y general. `provisionDemo` usa el servicio central, marca la empresa como demo y prohíbe correos y cobros reales.

El reset exige `isDemo`, confirmación literal, actor interno y entorno no productivo. Solo limpia contexto regenerable del tenant seleccionado; nunca trunca tablas, borra usuarios compartidos o toca empresas reales.
