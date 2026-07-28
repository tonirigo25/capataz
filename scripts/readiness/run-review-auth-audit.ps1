param(
  [string]$Sha = "",
  [switch]$PreserveOwnerAccess,
  [switch]$D10,
  [switch]$SkipD10AuthEngines
)

$ErrorActionPreference = "Stop"
$projectId = "c54a5065-df2c-46b9-a82b-cfac3be07315"
$reviewEnvironmentId = "e41b5add-511c-4697-b2b5-48164506f49a"
$databaseServiceId = "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b"
$webServiceId = "345992f1-c168-4221-a60d-b440d5a33e30"
$reviewOrigin = "https://orqena-review-web-review.up.railway.app"

if (-not $Sha) {
  $Sha = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "REVIEW_SHA_UNAVAILABLE"
  }
}

$env:ORQENA_REVIEW_SEED_APPROVED = "true"
$env:ORQENA_REVIEW_DATABASE_SERVICE_ID = $databaseServiceId
$env:NEXT_PUBLIC_APP_ENV = "preview"
$env:CREDENTIAL_SCOPE = "preview"
$env:ORQENA_REVIEW_ROTATE_OWNER_ACCESS = if ($PreserveOwnerAccess) { "false" } else { "true" }
$env:ORQENA_REVIEW_PROVISION_MFA = "true"
if ($D10) {
  $env:ORQENA_REVIEW_FOCUS_D10 = "true"
  $env:ORQENA_REVIEW_VIEWPORT_KEYS = "390,430,768,1024,1280,1440,1920"
}

try {
  $qaPasswordLines = @(
    & railway run `
      --project $projectId `
      --environment $reviewEnvironmentId `
      --service $webServiceId `
      --no-local `
      -- node -e 'process.stdout.write(process.env.ORQENA_REVIEW_QA_PASSWORD || "")'
  )
  if ($LASTEXITCODE -ne 0) {
    throw "REVIEW_QA_PASSWORD_LOOKUP_FAILED:$LASTEXITCODE"
  }
  $qaPassword = ($qaPasswordLines -join "").Trim()
  if ($qaPassword.Length -lt 24) {
    throw "REVIEW_QA_PASSWORD_INVALID"
  }
  $env:ORQENA_REVIEW_QA_PASSWORD = $qaPassword

  $publicDatabaseUrlLines = @(
    & railway run `
      --project $projectId `
      --environment $reviewEnvironmentId `
      --service $databaseServiceId `
      --no-local `
      -- node -e 'process.stdout.write(process.env.DATABASE_PUBLIC_URL || "")'
  )
  if ($LASTEXITCODE -ne 0) {
    throw "REVIEW_PUBLIC_DATABASE_LOOKUP_FAILED:$LASTEXITCODE"
  }
  $publicDatabaseUrl = ($publicDatabaseUrlLines -join "").Trim()
  $publicDatabaseUri = [uri]$publicDatabaseUrl
  if ($publicDatabaseUri.Host -notmatch '\.proxy\.rlwy\.net$') {
    throw "REVIEW_PUBLIC_DATABASE_HOST_INVALID"
  }
  $env:ORQENA_REVIEW_PUBLIC_DATABASE_URL = $publicDatabaseUrl

  $seedCommand = '$env:DATABASE_URL=$env:ORQENA_REVIEW_PUBLIC_DATABASE_URL; npx tsx scripts/readiness/provision-continuous-review.ts'
  $seedLines = @(
    & railway run `
      --project $projectId `
      --environment $reviewEnvironmentId `
      --service $webServiceId `
      --no-local `
      -- pwsh -NoProfile -Command $seedCommand
  )
  if ($LASTEXITCODE -ne 0) {
    throw "REVIEW_PROVISION_FAILED:$LASTEXITCODE"
  }
  $seedLine = $seedLines | Where-Object { $_ -match '^\{"ok":true' } | Select-Object -Last 1
  if (-not $seedLine) {
    throw "REVIEW_PROVISION_JSON_MISSING"
  }
  $seed = $seedLine | ConvertFrom-Json
  if ($seed.ownerAccessRotated) {
    Write-Output "REVIEW_ACCESS_REPLACED=$($seed.resetUrl)"
    Write-Output "REVIEW_ACCESS_EXPIRES=$($seed.resetExpiresAt)"
  } else {
    Write-Output "REVIEW_ACCESS_PRESERVED=true"
  }
  if (-not $seed.ownerMfaProvisioned -or [string]::IsNullOrWhiteSpace([string]$seed.ownerMfaSecret)) {
    throw "REVIEW_MFA_HANDOFF_MISSING"
  }

  $env:ORQENA_REVIEW_BASE_URL = $reviewOrigin
  $env:ORQENA_REVIEW_SHA = $Sha
  $env:ORQENA_REVIEW_OWNER_TOTP_SECRET = [string]$seed.ownerMfaSecret
  $seed.ownerMfaSecret = $null
  & npm run readiness:validate-review-auth
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  if ($D10 -and -not $SkipD10AuthEngines) {
    & npm run test:design-d10-auth-engines
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }
} finally {
  Remove-Item Env:ORQENA_REVIEW_QA_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_SEED_APPROVED -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_ROTATE_OWNER_ACCESS -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_PROVISION_MFA -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_PUBLIC_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_OWNER_TOTP_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_FOCUS_D10 -ErrorAction SilentlyContinue
  Remove-Item Env:ORQENA_REVIEW_VIEWPORT_KEYS -ErrorAction SilentlyContinue
}
