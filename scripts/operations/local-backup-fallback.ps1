#requires -Version 7.0

[CmdletBinding()]
param(
    [switch]$Force,
    [int]$MaximumSnapshotAgeHours = 7,
    [string]$CredentialPath = (Join-Path $env:LOCALAPPDATA "Orqena\backup-fallback\credentials.dpapi.json"),
    [string]$ResticPath = "restic.exe",
    [string]$PgDumpPath = "pg_dump.exe",
    [string]$PgRestorePath = "pg_restore.exe",
    [string]$NodePath = "node.exe",
    [string]$MigrationMetadataScript = (Join-Path $PSScriptRoot "extract-prisma-migration-metadata.mjs"),
    [string]$RailwayPath = "railway.exe",
    [string]$RailwayProject = "merry-quietude",
    [string]$RailwayEnvironment = "production",
    [string]$WebService = "capataz"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Unprotect-Value {
    param([Parameter(Mandatory)][string]$CipherText)

    $secure = ConvertTo-SecureString $CipherText
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Resolve-Tool {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction Stop
    return $command.Source
}

if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) {
    throw "Protected fallback credentials are not installed."
}

$protected = Get-Content -LiteralPath $CredentialPath -Raw | ConvertFrom-Json -AsHashtable
$secretNames = @(
    "BACKUP_DATABASE_URL",
    "DOCUMENTS_SOURCE_R2_ACCESS_KEY_ID",
    "DOCUMENTS_SOURCE_R2_SECRET_ACCESS_KEY",
    "DOCUMENTS_SOURCE_R2_ENDPOINT",
    "DOCUMENTS_SOURCE_R2_BUCKET",
    "BACKUP_R2_ACCESS_KEY_ID",
    "BACKUP_R2_SECRET_ACCESS_KEY",
    "BACKUP_R2_ENDPOINT",
    "BACKUP_R2_BUCKET",
    "RESTIC_PASSWORD",
    "LAST_KNOWN_APPLICATION_SHA"
)

$secrets = @{}
foreach ($name in $secretNames) {
    if (-not $protected.ContainsKey($name)) {
        throw "Protected fallback configuration is incomplete."
    }
    $secrets[$name] = Unprotect-Value -CipherText ([string]$protected[$name])
}

$restic = Resolve-Tool -Name $ResticPath
$pgDump = Resolve-Tool -Name $PgDumpPath
$pgRestore = Resolve-Tool -Name $PgRestorePath
$node = Resolve-Tool -Name $NodePath
$railway = Resolve-Tool -Name $RailwayPath
if (-not (Test-Path -LiteralPath $MigrationMetadataScript -PathType Leaf)) {
    throw "Migration metadata extractor is not installed."
}
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("orqena-backup-" + [guid]::NewGuid().ToString("N"))
$null = New-Item -ItemType Directory -Path $temporaryDirectory

try {
    $env:AWS_ACCESS_KEY_ID = $secrets["BACKUP_R2_ACCESS_KEY_ID"]
    $env:AWS_SECRET_ACCESS_KEY = $secrets["BACKUP_R2_SECRET_ACCESS_KEY"]
    $env:AWS_DEFAULT_REGION = "auto"
    $env:RESTIC_PASSWORD = $secrets["RESTIC_PASSWORD"]
    $env:RESTIC_REPOSITORY = "s3:$($secrets["BACKUP_R2_ENDPOINT"].TrimEnd('/'))/$($secrets["BACKUP_R2_BUCKET"])/postgresql"
    $env:PGCONNECT_TIMEOUT = "20"
    $env:PGDATABASE = $secrets["BACKUP_DATABASE_URL"]

    $snapshotJson = & $restic snapshots --latest 1 --tag postgresql --json 2>$null | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the latest encrypted snapshot."
    }
    $snapshots = $snapshotJson | ConvertFrom-Json
    $latest = @($snapshots) | Sort-Object { [datetime]$_.time } -Descending | Select-Object -First 1
    if (-not $Force -and $null -ne $latest) {
        $age = (Get-Date).ToUniversalTime() - ([datetime]$latest.time).ToUniversalTime()
        if ($age.TotalHours -le $MaximumSnapshotAgeHours) {
            Write-Output "Remote snapshot is recent; fallback backup was not needed."
            exit 0
        }
    }

    $dumpPath = Join-Path $temporaryDirectory "database.dump"
    $dumpDiagnostics = Join-Path $temporaryDirectory "pg-dump.stderr"
    $process = Start-Process `
        -FilePath $pgDump `
        -ArgumentList @("--format=custom", "--no-owner", "--no-acl", "--file=$dumpPath") `
        -RedirectStandardError $dumpDiagnostics `
        -NoNewWindow `
        -PassThru `
        -Wait
    if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $dumpDiagnostics).Length -gt 0) {
        throw "pg_dump failed or emitted diagnostics; fallback snapshot rejected."
    }

    $archiveList = & $pgRestore --list $dumpPath | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore validation failed."
    }
    $serverVersionMatch = [regex]::Match($archiveList, "(?m)^; Dumped from database version: (.+)\r?$")
    if (-not $serverVersionMatch.Success) {
        throw "Unable to derive the PostgreSQL server version from the dump archive."
    }

    $migrationSqlPath = Join-Path $temporaryDirectory "prisma-migrations.sql"
    $migrationDiagnostics = Join-Path $temporaryDirectory "prisma-migrations.stderr"
    & $pgRestore --data-only --table=_prisma_migrations --file=$migrationSqlPath $dumpPath 2> $migrationDiagnostics
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $migrationSqlPath -PathType Leaf)) {
        throw "Unable to extract migration metadata from the fallback dump."
    }
    $metadataJson = & $node $MigrationMetadataScript $migrationSqlPath 2> $migrationDiagnostics | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($metadataJson)) {
        throw "Unable to validate migration metadata from the fallback dump."
    }
    $migrationMetadata = $metadataJson | ConvertFrom-Json -AsHashtable
    $applicationSha = $secrets["LAST_KNOWN_APPLICATION_SHA"]
    $applicationShaSource = "RAILWAY_LAST_KNOWN_AT_INSTALL"
    try {
        $deploymentJson = & $railway deployment list `
            --project $RailwayProject `
            --environment $RailwayEnvironment `
            --service $WebService `
            --json 2>$null | Out-String
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($deploymentJson)) {
            $currentDeployment = @($deploymentJson | ConvertFrom-Json) |
                Where-Object { $_.status -eq "SUCCESS" } |
                Select-Object -First 1
            if ($null -ne $currentDeployment -and [string]$currentDeployment.meta.commitHash -match "^[0-9a-f]{40}$") {
                $applicationSha = [string]$currentDeployment.meta.commitHash
                $applicationShaSource = "RAILWAY_CURRENT_SUCCESS"
            }
        }
    }
    catch {
        # The encrypted last-known SHA remains an honest fallback with its source recorded.
    }

    $manifest = [ordered]@{
        schemaVersion = 1
        timestampUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        postgresVersion = $serverVersionMatch.Groups[1].Value.Trim()
        migrationCount = [int]$migrationMetadata["migrationCount"]
        migrationHead = [string]$migrationMetadata["migrationHead"]
        metadataSource = "PG_DUMP_ARCHIVE"
        dumpBytes = (Get-Item -LiteralPath $dumpPath).Length
        sha256 = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
        applicationSha = $applicationSha
        applicationShaSource = $applicationShaSource
        pgRestoreListValidation = "PASS"
        source = "WINDOWS_CURRENT_USER_FALLBACK"
        recoveryModel = "SNAPSHOT_WITHOUT_PITR"
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $temporaryDirectory "manifest.json") -Encoding utf8NoBOM

    & $restic backup $temporaryDirectory --tag postgresql --tag windows-fallback
    if ($LASTEXITCODE -ne 0) {
        throw "Encrypted fallback snapshot failed."
    }
    & $restic check
    if ($LASTEXITCODE -ne 0) {
        throw "Encrypted repository integrity check failed."
    }
    Write-Output "Encrypted Windows fallback snapshot completed."
}
finally {
    foreach ($name in @(
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_DEFAULT_REGION",
        "RESTIC_PASSWORD",
        "RESTIC_REPOSITORY",
        "PGCONNECT_TIMEOUT",
        "PGDATABASE"
    )) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
    foreach ($key in @($secrets.Keys)) {
        $secrets[$key] = $null
    }
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
