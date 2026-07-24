# Sistema de diseño Orqena

El sistema existente se consolida en primitivas y tokens compartidos. La jerarquía usa pocas superficies, una acción primaria, estados semánticos, números tabulares y targets mínimos de 44 px.

`components/compact-filters.tsx` aporta búsqueda, contador, chips, orden y sheet móvil. El sheet restaura foco, responde a Escape, bloquea scroll y respeta safe area. Los filtros se representan en la URL por cada página para conservar recarga y navegación atrás/adelante.

El chat usa un contenedor de mensajes independiente. Solo sigue el último mensaje si el usuario estaba cerca del final y ofrece “Ir al último mensaje” al leer contenido anterior.
