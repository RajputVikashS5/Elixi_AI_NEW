param(
    [string]$ReportPath = "PHASE5_DEEP_SWEEP_REPORT.md",
    [string]$JsonReportPath = "PHASE5_DEEP_SWEEP_REPORT.json"
)

$ErrorActionPreference = "Stop"

function Get-EnvKey([string]$Key) {
    $item = Get-Item -Path ("Env:" + $Key) -ErrorAction SilentlyContinue
    if ($item) {
        return $item.Value
    }
    return $null
}

function Get-AuthValue([string]$Key) {
    $value = Get-EnvKey $Key
    if ($value) {
        return $value
    }

    foreach ($relativePath in @("ai-engine/.env.local", "ai-engine/.env")) {
        if (-not (Test-Path $relativePath)) {
            continue
        }

        $match = Select-String -Path $relativePath -Pattern ("^" + [regex]::Escape($Key) + "=") | Select-Object -First 1
        if (-not $match) {
            continue
        }

        $parts = $match.Line.Split('=', 2)
        if ($parts.Count -lt 2) {
            continue
        }

        $parsed = $parts[1].Trim()
        if ($parsed) {
            return $parsed
        }
    }

    return $null
}

function Add-Result {
    param(
        [System.Collections.Generic.List[object]]$Bucket,
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $Bucket.Add([PSCustomObject]@{
        Name = $Name
        Status = if ($Passed) { "PASS" } else { "FAIL" }
        Detail = $Detail
    })
}

function Run-Step {
    param(
        [System.Collections.Generic.List[object]]$Bucket,
        [string]$Name,
        [scriptblock]$Action
    )

    try {
        $detail = & $Action
        Add-Result -Bucket $Bucket -Name $Name -Passed $true -Detail ([string]$detail)
    }
    catch {
        $message = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $message = $_.ErrorDetails.Message
        }
        Add-Result -Bucket $Bucket -Name $Name -Passed $false -Detail $message
    }
}

Set-Location "e:\Projects\Elixi AI Electron"

$results = New-Object System.Collections.Generic.List[object]
$baseAi = "http://127.0.0.1:8000"
$baseBackend = "http://127.0.0.1:3001"
$baseVoice = "http://127.0.0.1:8001"

Run-Step -Bucket $results -Name "Port 8000 AI" -Action {
    $ok = Test-NetConnection -ComputerName "127.0.0.1" -Port 8000 -InformationLevel Quiet
    if (-not $ok) { throw "Port 8000 is offline" }
    "online"
}

Run-Step -Bucket $results -Name "Port 3001 Backend" -Action {
    $ok = Test-NetConnection -ComputerName "127.0.0.1" -Port 3001 -InformationLevel Quiet
    if (-not $ok) { throw "Port 3001 is offline" }
    "online"
}

Run-Step -Bucket $results -Name "Port 8001 Voice" -Action {
    $ok = Test-NetConnection -ComputerName "127.0.0.1" -Port 8001 -InformationLevel Quiet
    if (-not $ok) { throw "Port 8001 is offline" }
    "online"
}

Run-Step -Bucket $results -Name "Port 5173 UI" -Action {
    $ok = Test-NetConnection -ComputerName "127.0.0.1" -Port 5173 -InformationLevel Quiet
    if (-not $ok) { throw "Port 5173 is offline" }
    "online"
}

$authUsername = (Get-AuthValue "AI_ENGINE_AUTH_USERNAME")
if (-not $authUsername) { $authUsername = (Get-AuthValue "AUTH_USERNAME") }
if (-not $authUsername) { $authUsername = "elixi_admin" }

$authPassword = (Get-AuthValue "AI_ENGINE_AUTH_PASSWORD")
if (-not $authPassword) { $authPassword = (Get-AuthValue "AUTH_PASSWORD") }
if (-not $authPassword) { $authPassword = "change_me_to_a_strong_password" }

$authBody = "grant_type=password&username=$([uri]::EscapeDataString($authUsername))&password=$([uri]::EscapeDataString($authPassword))"
$token = ""

Run-Step -Bucket $results -Name "AI Auth Token" -Action {
    $script:token = (Invoke-RestMethod -Uri "$baseAi/auth/token" -Method POST -Body $authBody -ContentType "application/x-www-form-urlencoded" -TimeoutSec 8).access_token
    if (-not $script:token) {
        throw "Token missing from auth response"
    }
    "token received"
}

$headers = @{ Authorization = "Bearer $token" }

Run-Step -Bucket $results -Name "AI Intent" -Action {
    $response = Invoke-RestMethod -Uri "$baseAi/ai/intent" -Method POST -Headers $headers -Body '{"message":"what is the weather today"}' -ContentType "application/json" -TimeoutSec 8
    "intent=$($response.intent)"
}

Run-Step -Bucket $results -Name "AI Chat Non-Stream Local" -Action {
    $response = Invoke-RestMethod -Uri "$baseAi/ai/chat" -Method POST -Headers $headers -Body '{"sessionId":"phase5-local-nonstream","message":"hello","stream":false,"llmProvider":"ollama","ollamaModel":"llama3"}' -ContentType "application/json" -TimeoutSec 50
    "intent=$($response.intent)"
}

Run-Step -Bucket $results -Name "AI Chat Stream Local" -Action {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseAi/ai/chat" -Method POST -Headers $headers -Body '{"sessionId":"phase5-local-stream","message":"tell me about AI","stream":true,"llmProvider":"ollama","ollamaModel":"llama3"}' -ContentType "application/json" -TimeoutSec 60
    $hasSse = $response.Content -match "data:"
    if (-not $hasSse) {
        throw "Missing SSE data payload"
    }
    "sse=true"
}

Run-Step -Bucket $results -Name "AI Chat Non-Stream Online" -Action {
    $response = Invoke-RestMethod -Uri "$baseAi/ai/chat" -Method POST -Headers $headers -Body '{"sessionId":"phase5-online-nonstream","message":"hello","stream":false,"llmProvider":"online","onlineModel":"meta-llama/llama-3-8b-instruct"}' -ContentType "application/json" -TimeoutSec 60
    "intent=$($response.intent)"
}

Run-Step -Bucket $results -Name "AI Chat Stream Online" -Action {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseAi/ai/chat" -Method POST -Headers $headers -Body '{"sessionId":"phase5-online-stream","message":"tell me about AI","stream":true,"llmProvider":"online","onlineModel":"meta-llama/llama-3-8b-instruct"}' -ContentType "application/json" -TimeoutSec 60
    $hasSse = $response.Content -match "data:"
    if (-not $hasSse) {
        throw "Missing SSE data payload"
    }
    "sse=true"
}

Run-Step -Bucket $results -Name "Backend System Info" -Action {
    $response = Invoke-RestMethod -Uri "$baseBackend/api/system/info" -TimeoutSec 12
    "cpu=$([math]::Round($response.cpu, 2))"
}

Run-Step -Bucket $results -Name "Backend Providers Status" -Action {
    $response = Invoke-RestMethod -Uri "$baseBackend/ai/providers/status" -TimeoutSec 15
    "openrouter=$($response.openrouter.connected) gemini=$($response.gemini.connected)"
}

Run-Step -Bucket $results -Name "Backend Voice Capabilities" -Action {
    $response = Invoke-RestMethod -Uri "$baseBackend/api/voice/capabilities" -TimeoutSec 15
    "status=$($response.data.status)"
}

$testSession = [guid]::NewGuid().ToString()

Run-Step -Bucket $results -Name "Backend Chat Message Local" -Action {
    $payload = @{ sessionId = $testSession; message = "My favorite color is blue"; llmProvider = "ollama"; ollamaModel = "llama3" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$baseBackend/api/chat/message" -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 60
    "success=$($response.success)"
}

Run-Step -Bucket $results -Name "Backend Chat History" -Action {
    $response = Invoke-RestMethod -Uri "$baseBackend/api/chat/history?sessionId=$testSession" -TimeoutSec 12
    "count=$($response.messages.Count)"
}

$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $results.Count
$successRate = if ($total -eq 0) { 0 } else { [math]::Round(($passed / $total) * 100, 1) }
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$timestampIso = (Get-Date).ToString("o")

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Phase 5 Deep Sweep Report")
$reportLines.Add("")
$reportLines.Add("Generated: $timestamp")
$reportLines.Add("")
$reportLines.Add("## Summary")
$reportLines.Add("")
$reportLines.Add("- Total checks: $total")
$reportLines.Add("- Passed: $passed")
$reportLines.Add("- Failed: $failed")
$reportLines.Add("- Success rate: $successRate%")
$reportLines.Add("")
$reportLines.Add("## Results")
$reportLines.Add("")
$reportLines.Add("| Check | Status | Detail |")
$reportLines.Add("|---|---|---|")
foreach ($result in $results) {
    $safeDetail = ([string]$result.Detail).Replace("|", "/")
    $reportLines.Add("| $($result.Name) | $($result.Status) | $safeDetail |")
}

Set-Content -Path $ReportPath -Value $reportLines -Encoding UTF8

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
            detail = [string]$_.Detail
        }
    })
}

$jsonReport | ConvertTo-Json -Depth 6 | Set-Content -Path $JsonReportPath -Encoding UTF8

Write-Host "Phase 5 deep sweep completed."
Write-Host "Passed: $passed / $total (Failed: $failed, Success: $successRate%)"
Write-Host "Report: $ReportPath"
Write-Host "JSON Report: $JsonReportPath"

if ($failed -gt 0) {
    Write-Error "Phase 5 deep sweep detected $failed failed check(s)."
    exit 1
}

exit 0