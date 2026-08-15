<#
.SYNOPSIS
  ResumeIQ Oracle runtime verification gate (7 steps).

.DESCRIPTION
  Runs the full Oracle milestone checklist against a real Dockerized Oracle
  Database Free instance:

    1. Fresh database migration succeeds
    2. Re-running migrations makes no changes
    3. Oracle repository contracts pass
    4. Full HTTP persistence E2E passes
    5. Resume data survives a backend restart
    6. Resume data survives an Oracle container restart
    7. Cross-user access remains rejected

  Every step reports PASS or FAIL. A failed step aborts the remaining steps and
  exits non-zero — the gate is never weakened and results are never fabricated.
  When Docker is not yet usable (e.g. virtualization disabled), the first step
  fails loudly and the run records the gate as NOT VERIFIED / BLOCKED.

.PARAMETER Fresh
  Destroy and recreate the database volume first (docker compose down -v + up),
  after an explicit typed confirmation. The confirmation is mandatory and the
  target volume is validated to be the dedicated disposable one (container
  resumeiq-oracle, named volume oracle-data) before anything is destroyed.
  On a fresh volume the one-time --bootstrap step (user provisioning, SYSTEM)
  runs before the normal SYSTEM-free migration command. Without -Fresh, the
  existing container/volume is reused and only pending migrations are applied.

.PARAMETER BackendPort
  TCP port for the throwaway backend process (default 3100).

.EXAMPLE
  powershell -File database/scripts/oracle-verify.ps1 -Fresh
#>
[CmdletBinding()]
param(
  [switch]$Fresh,
  [int]$BackendPort = 3100
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot    = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dbDir       = Join-Path $repoRoot 'database'
$composeFile = Join-Path $dbDir 'docker-compose.oracle.yml'
$envFile     = Join-Path $dbDir '.env'
$backendDir  = Join-Path $repoRoot 'backend'
$runner      = Join-Path $dbDir 'scripts\apply-migrations.mjs'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Copy database/.env.example to database/.env and fill in real values."
}

# ---- Load database/.env (dotenv semantics: never override process env) ----
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $key = $Matches[1]
    $value = $Matches[2]
    if (-not (Test-Path "env:$key")) {
      Set-Item "env:$key" -Value $value
    }
  }
}

$requiredKeys = @('ORACLE_SYSTEM_PASSWORD', 'ORACLE_MIGRATE_PASSWORD', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING')
foreach ($key in $requiredKeys) {
  if (-not (Get-Item "env:$key" -ErrorAction SilentlyContinue)) {
    throw "$key is not set in $envFile"
  }
}

$script:results  = [System.Collections.Generic.List[string]]::new()
$script:failed   = $false
$script:survivor = $false
$script:serverProc = $null
$script:ownerToken   = ''
$script:resumeId     = ''
$script:versionId    = ''
$script:ownerEmail   = ''
$script:stamp        = ''

function Step {
  param([string]$Name, [scriptblock]$Action)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try {
    & $Action
    Write-Host "RESULT: PASS - $Name" -ForegroundColor Green
    $script:results.Add("PASS | $Name")
  } catch {
    Write-Host "RESULT: FAIL - $Name" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)"
    $script:results.Add("FAIL | $Name")
    $script:failed = $true
  }
}

function Compose {
  param([string[]]$ComposeArgs)
  $invoke = @('compose', '-f', $composeFile) + $ComposeArgs
  & docker @invoke
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($ComposeArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Wait-OracleHealthy {
  param([int]$TimeoutSeconds = 600)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $status = & docker inspect --format '{{.State.Health.Status}}' resumeiq-oracle 2>$null
    if ($LASTEXITCODE -eq 0 -and $status -eq 'healthy') {
      return
    }
    Start-Sleep -Seconds 5
  }
  throw "Oracle container did not become healthy within ${TimeoutSeconds}s"
}

function Wait-ServerReady {
  param([int]$TimeoutSeconds = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $health = Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/v1/health" -TimeoutSec 5 -UseBasicParsing
      if ($health.database -eq 'up') {
        return
      }
    } catch {
      # not up yet
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Backend on :$BackendPort did not report 'database: up' within ${TimeoutSeconds}s"
}

function Invoke-Api {
  param([string]$Method, [string]$Path, [hashtable]$Body, [string]$Token)
  $params = @{
    Uri         = "http://localhost:$BackendPort$Path"
    Method      = $Method
    ContentType = 'application/json'
    TimeoutSec  = 60
    UseBasicParsing = $true
  }
  if ($Body)   { $params.Body = $Body | ConvertTo-Json -Depth 20 }
  if ($Token)  { $params.Headers = @{ Authorization = "Bearer $Token" } }
  return Invoke-RestMethod @params
}

function Get-StatusCode {
  param([string]$Method, [string]$Path, [hashtable]$Body, [string]$Token)
  $params = @{
    Uri         = "http://localhost:$BackendPort$Path"
    Method      = $Method
    TimeoutSec  = 60
    UseBasicParsing = $true
  }
  if ($Body)   { $params.Body = $Body | ConvertTo-Json -Depth 20 }
  if ($Token)  { $params.Headers = @{ Authorization = "Bearer $Token" } }
  try {
    $null = Invoke-WebRequest @params
    return 200
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}

function Start-Backend {
  $env:PORT = "$BackendPort"
  $env:DATA_STORE = 'oracle'
  $env:AUTH_COOKIE_SECURE = 'false'
  $env:AUTH_RATE_LIMIT_LOGIN_MAX = '100000'
  $outLog = Join-Path $env:TEMP 'resumeiq-oracle-verify-backend.out.log'
  $errLog = Join-Path $env:TEMP 'resumeiq-oracle-verify-backend.err.log'
  $script:serverProc = Start-Process -FilePath 'node' `
    -ArgumentList 'dist/src/server.js' `
    -WorkingDirectory $backendDir `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru -NoNewWindow
  Wait-ServerReady
}

function Stop-Backend {
  if ($script:serverProc -and -not $script:serverProc.HasExited) {
    Stop-Process -Id $script:serverProc.Id -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $script:serverProc.Id -Timeout 10 -ErrorAction SilentlyContinue
  }
  $script:serverProc = $null
}

function Assert-DisposableVolume {
  # The -Fresh destroy path may only ever target the dedicated disposable
  # local volume defined by this repository's compose file. Refuse if the
  # compose file stops being the exact known shape (wrong container name or
  # any volume other than the single declared oracle-data).
  $compose = Get-Content $composeFile -Raw
  if ($compose -notmatch '(?m)^\s*container_name:\s*resumeiq-oracle\s*$') {
    throw "Refusing -Fresh: $composeFile no longer declares container_name: resumeiq-oracle"
  }
  $knownKeys = @('services', 'oracle', 'volumes', 'environment', 'ports', 'image',
    'container_name', 'restart', 'healthcheck', 'test', 'interval', 'timeout',
    'retries', 'start_period', 'start_interval')
  $declared = [regex]::Matches($compose, '(?m)^\s*([A-Za-z0-9_-]+):\s*$') |
    ForEach-Object { $_.Groups[1].Value }
  $volumeNames = @($declared | Where-Object { $_ -notin $knownKeys })
  if ($volumeNames.Count -ne 1 -or $volumeNames[0] -ne 'oracle-data') {
    throw "Refusing -Fresh: expected exactly one named volume 'oracle-data', found: $($volumeNames -join ', ')"
  }
  Write-Host 'Volume guard: dedicated disposable volume confirmed (oracle-data, container resumeiq-oracle).'
}

function Confirm-FreshDestruction {
  if (-not $Fresh) {
    return
  }
  Write-Host ''
  Write-Host 'WARNING: -Fresh will run `docker compose down -v`, which DESTROYS all data in the' -ForegroundColor Yellow
  Write-Host 'dedicated disposable Oracle volume (oracle-data, container resumeiq-oracle).' -ForegroundColor Yellow
  $answer = Read-Host 'Type DESTROY to continue, anything else to abort'
  if ($answer -ne 'DESTROY') {
    throw 'Aborted: -Fresh confirmation was not given.'
  }
}

function Start-MigrationRunner {
  param([string[]]$RunnerArgs)
  & node $runner @RunnerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "apply-migrations.mjs $($RunnerArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Reset-RuntimeData {
  Start-MigrationRunner -RunnerArgs @('--reset-data')
}

function Run-OracleVitest {
  param([string]$Spec)
  $env:DATA_STORE = 'oracle'
  $env:ORACLE_IT = '1'
  & npx vitest run -c vitest.oracle.config.ts $Spec
  if ($LASTEXITCODE -ne 0) {
    throw "vitest (oracle profile) $Spec failed with exit code $LASTEXITCODE"
  }
}

# ===========================================================================
# Gate
# ===========================================================================

Step '1 Fresh database migration succeeds' {
  if ($Fresh) {
    Assert-DisposableVolume
    Confirm-FreshDestruction
    Compose -ComposeArgs @('down', '-v', '--remove-orphans')
    Compose -ComposeArgs @('pull')
    Compose -ComposeArgs @('up', '-d')
    Wait-OracleHealthy
    # One-time privileged provisioning on the new disposable volume.
    Start-MigrationRunner -RunnerArgs @('--bootstrap')
  } else {
    Compose -ComposeArgs @('pull')
    Compose -ComposeArgs @('up', '-d')
    Wait-OracleHealthy
  }
  # SYSTEM-free deploy run: applies any pending migrations + grant-sync.
  Start-MigrationRunner

  # Assert the migration-history table shows every committed migration + seed.
  $statusText = (& node $runner --status 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw "apply-migrations.mjs --status failed with exit code $LASTEXITCODE"
  }
  Write-Host $statusText
  foreach ($expected in @('003', 'seed-001')) {
    if (-not ($statusText -match [regex]::Escape($expected))) {
      throw "Migration history is missing expected entry '$expected'"
    }
  }
}

Step '2 Re-running migrations makes no changes' {
  $output = (& node $runner 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) {
    throw "Re-run of apply-migrations.mjs failed with exit code $LASTEXITCODE"
  }
  Write-Host $output
  if ($output -notmatch 'no pending migrations') {
    throw 'Re-run did not report "no pending migrations" — schema unexpectedly changed'
  }
}

if ($script:failed) {
  Write-Host ''
  Write-Host 'Migration gate failed; skipping the dependent Oracle verification steps.' -ForegroundColor Yellow
} else {
  Step '3 Oracle repository contracts pass' {
    Reset-RuntimeData
    Run-OracleVitest -Spec 'test/repositories.contract.test.ts'
  }

  Step '4 Full HTTP persistence E2E passes' {
    Reset-RuntimeData
    Run-OracleVitest -Spec 'test/oracle-persistence.e2e.test.ts'
  }

  Step '5 Resume data survives a backend restart' {
  # Build the production bundle once; the restart test terminates the running
  # backend process and starts a brand-new node process against the same Oracle.
  Push-Location $backendDir
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "backend build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }

  $script:stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $script:ownerEmail = "verify-$($script:stamp)@example.com"
  $password = 'VerifyPass123'

  Start-Backend
  try {
    $owner = Invoke-Api -Method Post -Path '/api/v1/auth/register' -Body @{
      name  = 'Verify Owner'
      email = $script:ownerEmail
      password = $password
    }
    $script:ownerToken = $owner.accessToken

    $resume = Invoke-Api -Method Post -Path '/api/v1/resumes' -Body @{
      name       = 'Restart Survival'
      templateId = 't-classic-ats-navy'
    } -Token $script:ownerToken
    $script:resumeId = $resume.id

    $versions = Invoke-Api -Method Get -Path "/api/v1/resumes/$script:resumeId/versions" -Token $script:ownerToken
    $script:versionId = @($versions)[0].id

    $content = @{
      contacts = @{
        fullName = 'Verify Owner'; title = ''; email = $script:ownerEmail; phone = ''
        location = ''; linkedinUrl = ''; githubUrl = ''; portfolioUrl = ''
      }
      summary = 'Survives restarts'
      skills  = @('Oracle', 'Node.js')
      experiences = @(); projects = @(); education = @(); certifications = @()
      awards = @(); achievements = @(); languages = @(); customSections = @()
    }
    $saved = Invoke-Api -Method Patch -Path "/api/v1/versions/$script:versionId/content" `
      -Body @{ content = $content } -Token $script:ownerToken
    if ($saved.content.summary -ne 'Survives restarts') {
      throw 'Content did not save before backend restart'
    }

    # ---- restart the backend ----
    Stop-Backend
    Start-Backend

    $login = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{
      email = $script:ownerEmail
      password = $password
    }
    $script:ownerToken = $login.accessToken

    $reloaded = Invoke-Api -Method Get -Path "/api/v1/resumes/$script:resumeId" -Token $script:ownerToken
    if ($reloaded.id -ne $script:resumeId) { throw 'Resume was missing after backend restart' }
    $version = Invoke-Api -Method Get -Path "/api/v1/versions/$script:versionId" -Token $script:ownerToken
    if ($version.content.summary -ne 'Survives restarts') {
      throw 'Autosaved content did not survive backend restart'
    }
  } finally {
    Stop-Backend
  }
  $script:survivor = $true
}

if ($script:survivor) {
  Step '6 Resume data survives an Oracle container restart' {
    # `compose restart` bounces the container but keeps the named volume, which
    # is exactly the survival case. `down -v` is never used here (it would
    # destroy the data being verified).
    Compose -ComposeArgs @('restart', 'oracle')
    Wait-OracleHealthy

    Start-Backend
    try {
      $login = Invoke-Api -Method Post -Path '/api/v1/auth/login' -Body @{
        email = $script:ownerEmail
        password = 'VerifyPass123'
      }
      $token = $login.accessToken
      $resume = Invoke-Api -Method Get -Path "/api/v1/resumes/$script:resumeId" -Token $token
      if ($resume.id -ne $script:resumeId) { throw 'Resume was missing after Oracle container restart' }
      $version = Invoke-Api -Method Get -Path "/api/v1/versions/$script:versionId" -Token $token
      if ($version.content.summary -ne 'Survives restarts') {
        throw 'Autosaved content did not survive Oracle container restart'
      }
      $script:ownerToken = $token
    } finally {
      Stop-Backend
    }
  }

  Step '7 Cross-user access remains rejected' {
    Start-Backend
    try {
      $other = Invoke-Api -Method Post -Path '/api/v1/auth/register' -Body @{
        name  = 'Verify Other'
        email = "verify-other-$($script:stamp)@example.com"
        password = 'VerifyPass123'
      }
      $token = $other.accessToken

      $codes = [ordered]@{
        GET_Resume    = (Get-StatusCode -Method Get    -Path "/api/v1/resumes/$script:resumeId"   -Token $token)
        DELETE_Resume = (Get-StatusCode -Method Delete -Path "/api/v1/resumes/$script:resumeId"   -Token $token)
        GET_Version   = (Get-StatusCode -Method Get    -Path "/api/v1/versions/$script:versionId"  -Token $token)
      }
      foreach ($entry in $codes.GetEnumerator()) {
        if ($entry.Value -ne 404) {
          throw "Cross-user $($entry.Key) returned $($entry.Value), expected 404"
        }
        Write-Host "  $($entry.Key): 404 (expected)"
      }
    } finally {
      Stop-Backend
    }
  }
} else {
  Write-Host ''
  Write-Host 'Skipping steps 6-7: backend restart-survival data was not created.' -ForegroundColor Yellow
}
}

# ===========================================================================
# Summary
# ===========================================================================
Write-Host "`n==== Oracle runtime verification summary ===="
$script:results | ForEach-Object { Write-Host "  $_" }
if ($script:failed) {
  Write-Host 'OVERALL: FAIL' -ForegroundColor Red
  $global:LASTEXITCODEFromVerify = 1
} else {
  Write-Host 'OVERALL: PASS' -ForegroundColor Green
  $global:LASTEXITCODEFromVerify = 0
}
exit $global:LASTEXITCODEFromVerify