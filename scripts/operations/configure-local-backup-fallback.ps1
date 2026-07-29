#requires -Version 7.0

[CmdletBinding()]
param(
    [string]$DestinationDirectory = (Join-Path $env:LOCALAPPDATA "Orqena\backup-fallback"),
    [string]$RailwayProject = "merry-quietude",
    [string]$RailwayEnvironment = "production",
    [string]$WebService = "capataz",
    [string]$PostgresService = "Postgres",
    [string]$CredentialService = "capataz-proactive-evaluator",
    [string]$ResticPath = (Join-Path $env:LOCALAPPDATA "Orqena\tools\restic\0.19.1\restic_0.19.1_windows_amd64.exe"),
    [string]$PostgresBinPath = (Join-Path $env:LOCALAPPDATA "Orqena\tools\postgresql\18.4\binaries\pgsql\bin"),
    [string]$PowerShellPath = "pwsh.exe",
    [string]$NodePath = "node.exe",
    [string]$RailwayPath = "railway.exe"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-RailwayVariables {
    param([Parameter(Mandatory)][string]$Service)

    $raw = & railway variable list `
        --project $RailwayProject `
        --environment $RailwayEnvironment `
        --service $Service `
        --json 2>$null | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
        throw "Railway variable retrieval failed for the configured service."
    }
    return $raw | ConvertFrom-Json -AsHashtable
}

function Protect-Value {
    param([Parameter(Mandatory)][string]$Value)

    return ConvertFrom-SecureString (ConvertTo-SecureString $Value -AsPlainText -Force)
}

$postgres = Get-RailwayVariables -Service $PostgresService
$web = Get-RailwayVariables -Service $WebService
$credentials = Get-RailwayVariables -Service $CredentialService
$resolvedRailwayPath = (Get-Command $RailwayPath -ErrorAction Stop).Source
$deploymentJson = & $resolvedRailwayPath deployment list `
    --project $RailwayProject `
    --environment $RailwayEnvironment `
    --service $WebService `
    --json 2>$null | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($deploymentJson)) {
    throw "Unable to record the current Production application SHA."
}
$currentDeployment = @($deploymentJson | ConvertFrom-Json) |
    Where-Object { $_.status -eq "SUCCESS" } |
    Select-Object -First 1
if ($null -eq $currentDeployment) {
    throw "Production has no successful deployment to record."
}
$lastKnownApplicationSha = [string]$currentDeployment.meta.commitHash
if ($lastKnownApplicationSha -notmatch "^[0-9a-f]{40}$") {
    throw "The current Production deployment does not expose a canonical application SHA."
}

$required = @{
    BACKUP_DATABASE_URL = $postgres["DATABASE_PUBLIC_URL"]
    DOCUMENTS_SOURCE_R2_ACCESS_KEY_ID = $web["R2_ACCESS_KEY_ID"]
    DOCUMENTS_SOURCE_R2_SECRET_ACCESS_KEY = $web["R2_SECRET_ACCESS_KEY"]
    DOCUMENTS_SOURCE_R2_ENDPOINT = $web["R2_ENDPOINT"]
    DOCUMENTS_SOURCE_R2_BUCKET = $web["R2_BUCKET"]
    BACKUP_R2_ACCESS_KEY_ID = $credentials["BACKUP_LOCAL_R2_ACCESS_KEY_ID"]
    BACKUP_R2_SECRET_ACCESS_KEY = $credentials["BACKUP_LOCAL_R2_SECRET_ACCESS_KEY"]
    BACKUP_R2_ENDPOINT = $credentials["BACKUP_LOCAL_R2_ENDPOINT"]
    BACKUP_R2_BUCKET = $credentials["BACKUP_LOCAL_R2_BUCKET"]
    RESTIC_PASSWORD = $credentials["BACKUP_LOCAL_RESTIC_PASSWORD"]
    LAST_KNOWN_APPLICATION_SHA = $lastKnownApplicationSha
}

foreach ($entry in $required.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace([string]$entry.Value)) {
        throw "Missing fallback configuration key: $($entry.Key)"
    }
}

$null = New-Item -ItemType Directory -Path $DestinationDirectory -Force
$sourceScript = Join-Path $PSScriptRoot "local-backup-fallback.ps1"
$installedScript = Join-Path $DestinationDirectory "local-backup-fallback.ps1"
Copy-Item -LiteralPath $sourceScript -Destination $installedScript -Force
$sourceMetadataScript = Join-Path $PSScriptRoot "extract-prisma-migration-metadata.mjs"
$installedMetadataScript = Join-Path $DestinationDirectory "extract-prisma-migration-metadata.mjs"
Copy-Item -LiteralPath $sourceMetadataScript -Destination $installedMetadataScript -Force

$pgDumpPath = Join-Path $PostgresBinPath "pg_dump.exe"
$pgRestorePath = Join-Path $PostgresBinPath "pg_restore.exe"
$pwshPath = (Get-Command $PowerShellPath -ErrorAction Stop).Source
$resolvedNodePath = (Get-Command $NodePath -ErrorAction Stop).Source
foreach ($toolPath in @($ResticPath, $pgDumpPath, $pgRestorePath, $pwshPath, $resolvedNodePath, $resolvedRailwayPath, $installedMetadataScript)) {
    if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
        throw "Required local fallback tool is missing: $toolPath"
    }
}

$protected = [ordered]@{}
foreach ($entry in $required.GetEnumerator()) {
    $protected[$entry.Key] = Protect-Value -Value ([string]$entry.Value)
}
$credentialPath = Join-Path $DestinationDirectory "credentials.dpapi.json"
$protected | ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8NoBOM

$taskName = "Orqena backup fallback"
$action = New-ScheduledTaskAction `
    -Execute $pwshPath `
    -Argument "-NoLogo -NoProfile -NonInteractive -File `"$installedScript`" -CredentialPath `"$credentialPath`" -ResticPath `"$ResticPath`" -PgDumpPath `"$pgDumpPath`" -PgRestorePath `"$pgRestorePath`" -NodePath `"$resolvedNodePath`" -MigrationMetadataScript `"$installedMetadataScript`" -RailwayPath `"$resolvedRailwayPath`" -RailwayProject `"$RailwayProject`" -RailwayEnvironment `"$RailwayEnvironment`" -WebService `"$WebService`""
$trigger = New-ScheduledTaskTrigger -Daily -At "04:53"
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Checks the encrypted remote snapshot age and creates a fallback only when stale." `
    -Force | Out-Null

Write-Output "Local DPAPI credential store and current-user scheduled fallback installed."
