[CmdletBinding()]
param(
    [string]$DestinationPath = (Join-Path $env:LOCALAPPDATA "Orqena\backup-fallback\restic-recovery.dpapi")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$plaintext = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($plaintext) -or $plaintext.Length -lt 32) {
    throw "A high-entropy recovery key is required on standard input."
}

try {
    $secure = ConvertTo-SecureString $plaintext -AsPlainText -Force
    $ciphertext = ConvertFrom-SecureString $secure
    $parent = Split-Path -Parent $DestinationPath
    $null = New-Item -ItemType Directory -Path $parent -Force
    [IO.File]::WriteAllText($DestinationPath, $ciphertext, [Text.UTF8Encoding]::new($false))
    Write-Output "Recovery key stored with current-user DPAPI protection."
}
finally {
    $plaintext = $null
}
