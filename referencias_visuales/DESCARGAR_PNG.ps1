$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$files = @(
  @{ Name = '01_PORTADA_FINAL_OSCURA.png'; Url = 'https://cdn.creativeclaw.co/u/0410d6f9/images/449ecc6a-6aca-47bb-9f80-f00f4001e16f.png' },
  @{ Name = '02_PORTAL_INTERNO_CLARO.png'; Url = 'https://cdn.creativeclaw.co/u/0410d6f9/images/311ff84c-dc8e-4379-96fc-b17962c767da.png' },
  @{ Name = '03_MENU_MOVIL_PLANTILLAS.png'; Url = 'https://cdn.creativeclaw.co/u/0410d6f9/images/cf8b40cb-ced8-464c-b51a-925d6f650a5e.png' },
  @{ Name = '04_PRESENTACION_GENERAL.png'; Url = 'https://cdn.creativeclaw.co/u/0410d6f9/images/b180b496-ed37-482e-a602-534f6660673a.png' }
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($file in $files) {
  $destination = Join-Path $root $file.Name
  Invoke-WebRequest -UseBasicParsing -Uri $file.Url -OutFile $destination
  if ((Get-Item $destination).Length -lt 100000) { throw "Referencia incompleta: $($file.Name)" }
  Write-Host "Descargada: $($file.Name)"
}
Write-Host 'Las cuatro referencias PNG están preparadas.'
