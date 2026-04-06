param(
    [string]$ReportPath = "PHASE7_REGRESSION_REPORT.md",
    [string]$JsonReportPath = "PHASE7_REGRESSION_REPORT.json"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$startedProcesses = @()
$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail,
        [double]$DurationMs
    )

    $results.Add([PSCustomObject]@{
        Name = $Name
        Status = if ($Passed) { 'PASS' } else { 'FAIL' }
        Detail = $Detail
        DurationMs = [math]::Round($DurationMs, 1)
    })
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $detail = & $Action
        $sw.Stop()
        Add-Result -Name $Name -Passed $true -Detail ([string]$detail) -DurationMs $sw.Elapsed.TotalMilliseconds
    }
    catch {
        $sw.Stop()
        $message = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $message = $_.ErrorDetails.Message
        }
        Add-Result -Name $Name -Passed $false -Detail $message -DurationMs $sw.Elapsed.TotalMilliseconds
    }
}

function Wait-Http {
    param(
        [string]$Url,
        [int]$TimeoutSec = 40,
        [int]$SleepMs = 500
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            # keep polling
        }
        Start-Sleep -Milliseconds $SleepMs
    }

    return $false
}

function Start-TrackedProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$Label
    )

    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Hidden
    $script:startedProcesses += [PSCustomObject]@{
        Label = $Label
        Process = $proc
    }
}

function Start-RequiredService {
    param(
        [string]$Name,
        [string]$HealthUrl,
        [scriptblock]$Starter
    )

    if (Wait-Http -Url $HealthUrl -TimeoutSec 3) {
        return 'already running'
    }

    & $Starter

    if (-not (Wait-Http -Url $HealthUrl -TimeoutSec 60)) {
        throw "$Name did not become healthy at $HealthUrl"
    }

    return 'started by regression runner'
}

function Invoke-CommandStep {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory
    )

    Invoke-Step -Name $Name -Action {
        Push-Location $WorkingDirectory
        try {
            $null = & powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
            if ($LASTEXITCODE -ne 0) {
                throw "Command failed with exit code $($LASTEXITCODE): $Command"
            }
        }
        finally {
            Pop-Location
        }

        'ok'
    }
}

try {
    Write-Host '== ELIXI Phase 7 Regression Runner ==' -ForegroundColor Cyan

    Invoke-Step -Name 'Ensure AI Engine' -Action {
        Start-RequiredService -Name 'AI Engine' -HealthUrl 'http://127.0.0.1:8000/health' -Starter {
            $pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
            if (-not (Test-Path $pythonExe)) {
                throw "Python executable not found: $pythonExe"
            }
            Start-TrackedProcess -FilePath $pythonExe -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory (Join-Path $repoRoot 'ai-engine') -Label 'ai-engine'
        }
    }

    Invoke-Step -Name 'Ensure Backend' -Action {
        Start-RequiredService -Name 'Backend' -HealthUrl 'http://127.0.0.1:3001/health' -Starter {
            Start-TrackedProcess -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm run dev') -WorkingDirectory (Join-Path $repoRoot 'backend') -Label 'backend'
        }
    }

    Invoke-Step -Name 'Ensure Voice Engine' -Action {
        Start-RequiredService -Name 'Voice Engine' -HealthUrl 'http://127.0.0.1:8001/health' -Starter {
            $pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
            if (-not (Test-Path $pythonExe)) {
                throw "Python executable not found: $pythonExe"
            }
            Start-TrackedProcess -FilePath $pythonExe -ArgumentList @('-m', 'uvicorn', 'voice_server:app', '--host', '127.0.0.1', '--port', '8001') -WorkingDirectory (Join-Path $repoRoot 'voice-engine') -Label 'voice-engine'
        }
    }

    Invoke-Step -Name 'Ensure UI Dev Server' -Action {
        Start-RequiredService -Name 'UI Dev Server' -HealthUrl 'http://127.0.0.1:5173' -Starter {
            Start-TrackedProcess -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm run dev:ui --workspace=desktop') -WorkingDirectory $repoRoot -Label 'ui'
        }
    }

    Invoke-CommandStep -Name 'Backend Integration Tests' -Command 'npm run test:integration' -WorkingDirectory (Join-Path $repoRoot 'backend')
    Invoke-CommandStep -Name 'Backend Build' -Command 'npm run build' -WorkingDirectory (Join-Path $repoRoot 'backend')
    Invoke-CommandStep -Name 'Frontend Build' -Command 'npm run build' -WorkingDirectory (Join-Path $repoRoot 'desktop\react-ui')

    Invoke-Step -Name 'Phase 5 Deep Sweep' -Action {
        $tmpMd = Join-Path $repoRoot 'PHASE5_DEEP_SWEEP_REPORT.tmp.md'
        $tmpJson = Join-Path $repoRoot 'PHASE5_DEEP_SWEEP_REPORT.tmp.json'

        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\phase5-deep-sweep.ps1') -ReportPath $tmpMd -JsonReportPath $tmpJson
        if ($LASTEXITCODE -ne 0) {
            throw "Phase 5 deep sweep failed. See $tmpMd"
        }

        $summary = (Select-String -Path $tmpMd -Pattern 'Success rate:' | Select-Object -First 1).Line
        if (-not $summary) { $summary = 'completed' }
        $summary
    }

    Invoke-Step -Name 'Phase 6 Runtime Check' -Action {
        $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\phase6-runtime-check.ps1') 2>&1
        $lines = @($output | ForEach-Object { [string]$_ })
        $fails = @($lines | Where-Object { $_ -match '^FAIL\s' })
        if ($fails.Count -gt 0) {
            throw ($fails -join '; ')
        }

        $passCount = @($lines | Where-Object { $_ -match '^PASS\s' }).Count
        "passes=$passCount"
    }

    Invoke-Step -Name 'Phase 7 Integrations API Wiring' -Action {
        $available = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/integrations/available' -TimeoutSec 10
        if (-not $available.providers -or $available.providers.Count -lt 5) {
            throw 'Providers list incomplete'
        }

        $browserConnect = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/integrations/connect/browser' -Method POST -TimeoutSec 10
        $browserId = $browserConnect.integration.id
        $browserStatus = Invoke-RestMethod -Uri ("http://127.0.0.1:3001/api/integrations/{0}/status" -f $browserId) -TimeoutSec 10
        if (-not $browserStatus.status.connected) {
            throw 'Browser integration did not connect instantly'
        }

        $vscodeConnect = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/integrations/connect/vscode' -Method POST -TimeoutSec 10
        $vscodeId = $vscodeConnect.integration.id
        $vscodeStatus = Invoke-RestMethod -Uri ("http://127.0.0.1:3001/api/integrations/{0}/status" -f $vscodeId) -TimeoutSec 10
        if (-not $vscodeStatus.status.connected) {
            throw 'VS Code integration did not connect instantly'
        }

        # Route existence check for OAuth browser callback endpoint
        try {
            Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/integrations/oauth/callback?state=invalid' -UseBasicParsing -TimeoutSec 10 | Out-Null
        }
        catch {
            # Even 400 indicates route exists; treat transport-level failures only as errors.
            if (-not $_.Exception.Response) {
                throw 'OAuth callback endpoint not reachable'
            }
        }

        "providers=$($available.providers.Count) browserConnected=$($browserStatus.status.connected) vscodeConnected=$($vscodeStatus.status.connected)"
    }

    Invoke-Step -Name 'Phase 7 UI Route Reachability' -Action {
        $html = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 15
        if ($html.StatusCode -ne 200) {
            throw "UI returned status $($html.StatusCode)"
        }
        'ui reachable'
    }
}
finally {
    foreach ($tracked in $startedProcesses) {
        try {
            if ($tracked.Process -and -not $tracked.Process.HasExited) {
                Stop-Process -Id $tracked.Process.Id -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # ignore cleanup errors
        }
    }
}

$passed = @($results | Where-Object { $_.Status -eq 'PASS' }).Count
$failed = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count
$total = $results.Count
$successRate = if ($total -eq 0) { 0 } else { [math]::Round(($passed / $total) * 100, 1) }
$timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
$timestampIso = (Get-Date).ToString('o')

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add('# Phase 7 Regression Report')
$reportLines.Add('')
$reportLines.Add("Generated: $timestamp")
$reportLines.Add('')
$reportLines.Add('## Summary')
$reportLines.Add('')
$reportLines.Add("- Total checks: $total")
$reportLines.Add("- Passed: $passed")
$reportLines.Add("- Failed: $failed")
$reportLines.Add("- Success rate: $successRate%")
$reportLines.Add('')
$reportLines.Add('## Results')
$reportLines.Add('')
$reportLines.Add('| Check | Status | Duration (ms) | Detail |')
$reportLines.Add('|---|---|---:|---|')
foreach ($result in $results) {
    $safeDetail = ([string]$result.Detail).Replace('|', '/')
    $reportLines.Add("| $($result.Name) | $($result.Status) | $($result.DurationMs) | $safeDetail |")
}

Set-Content -Path (Join-Path $repoRoot $ReportPath) -Value $reportLines -Encoding UTF8

$jsonReport = [PSCustomObject]@{
    generatedAt = $timestampIso
    summary = [PSCustomObject]@{
        totalChecks = $total
        passed = $passed
        failed = $failed
        successRate = $successRate
    }
    checks = @($results | ForEach-Object {
        [PSCustomObject]@{
            name = $_.Name
            status = $_.Status
            durationMs = $_.DurationMs
            detail = [string]$_.Detail
        }
    })
}

$jsonReport | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $repoRoot $JsonReportPath) -Encoding UTF8

Write-Host ''
Write-Host '== Phase 7 Regression Summary ==' -ForegroundColor Cyan
$results | Format-Table Name, Status, DurationMs, Detail -AutoSize
Write-Host ''
Write-Host "Report: $ReportPath"
Write-Host "JSON Report: $JsonReportPath"
Write-Host "Passed: $passed / $total (Failed: $failed, Success: $successRate%)"

if ($failed -gt 0) {
    exit 1
}

exit 0
