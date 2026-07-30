#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
curl -fL --retry 4 'https://cdn.creativeclaw.co/u/0410d6f9/images/449ecc6a-6aca-47bb-9f80-f00f4001e16f.png' -o 01_PORTADA_FINAL_OSCURA.png
curl -fL --retry 4 'https://cdn.creativeclaw.co/u/0410d6f9/images/311ff84c-dc8e-4379-96fc-b17962c767da.png' -o 02_PORTAL_INTERNO_CLARO.png
curl -fL --retry 4 'https://cdn.creativeclaw.co/u/0410d6f9/images/cf8b40cb-ced8-464c-b51a-925d6f650a5e.png' -o 03_MENU_MOVIL_PLANTILLAS.png
curl -fL --retry 4 'https://cdn.creativeclaw.co/u/0410d6f9/images/b180b496-ed37-482e-a602-534f6660673a.png' -o 04_PRESENTACION_GENERAL.png
for f in *.png; do test "$(wc -c < "$f")" -gt 100000 || { echo "Referencia incompleta: $f" >&2; exit 1; }; done
echo 'Las cuatro referencias PNG están preparadas.'
