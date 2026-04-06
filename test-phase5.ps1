# PHASE 5 AUTOMATED TEST RUNNER - Ultra Simple Version

Write-Host ""
Write-Host "======================================"
Write-Host "ELIXI PHASE 5 DIAGNOSTIC TEST RUNNER"
Write-Host "======================================"
Write-Host ""

function Resolve-DiagnosticAuthUsername {
    if ($env:AI_ENGINE_AUTH_USERNAME) { return $env:AI_ENGINE_AUTH_USERNAME }
    if ($env:AUTH_USERNAME) { return $env:AUTH_USERNAME }
    $fromFile = Get-DiagnosticAuthFromEnvFiles -Key "AUTH_USERNAME"
    if ($fromFile) { return $fromFile }
    return "elixi_admin"
}

function Resolve-DiagnosticAuthPassword {
    if ($env:AI_ENGINE_AUTH_PASSWORD) { return $env:AI_ENGINE_AUTH_PASSWORD }
    if ($env:AUTH_PASSWORD) { return $env:AUTH_PASSWORD }
    $fromFile = Get-DiagnosticAuthFromEnvFiles -Key "AUTH_PASSWORD"
    if ($fromFile) { return $fromFile }
    return "change_me_to_a_strong_password"
}

function Get-DiagnosticAuthFromEnvFiles {
    param([string]$Key)

    $candidateFiles = @(
        "ai-engine/.env.local",
        "ai-engine/.env"
    )

    foreach ($relativePath in $candidateFiles) {
        if (-not (Test-Path $relativePath)) { continue }

        $line = Get-Content $relativePath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
        if (-not $line) { continue }

        $parts = $line.Split('=', 2)
        if ($parts.Count -lt 2) { continue }

        $value = $parts[1].Trim()
        if (-not $value) { continue }

        return $value
    }

    return $null
}

function Get-DiagnosticAiToken {
    param([string]$BaseUrl)

    $authBody = "grant_type=password&username=$([uri]::EscapeDataString((Resolve-DiagnosticAuthUsername)))&password=$([uri]::EscapeDataString((Resolve-DiagnosticAuthPassword)))"
    $authResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/token" -Method POST -Body $authBody -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 5
    return $authResponse.access_token
}

function Format-Phase5Error {
    param([object]$ErrorRecord)

    $exception = $ErrorRecord.Exception
    if ($exception -and $exception.Response -and $exception.Response.StatusCode) {
        return "HTTP $([int]$exception.Response.StatusCode) $($exception.Response.StatusDescription)"
    }

    if ($exception) {
        return $exception.Message
    }

    return "Unknown error"
}

# Test AI Engine
Write-Host "[TEST-1] AI ENGINE (port 8000)"
Write-Host "----------------------------------"
$aiReady = Test-NetConnection -ComputerName "127.0.0.1" -Port 8000 -InformationLevel Quiet
if ($aiReady) { 
    Write-Host "STATUS: ONLINE - AI Engine responding"
    Write-Host ""
    
    # Try a quick chat request
    Write-Host "[PROBE] Testing intent classification..."
    $payloadJson = '{"message":"hello"}'
    $baseUri = "http://127.0.0.1:8000"
    $uri = "$baseUri/ai/intent"
    
    try {
        $token = Get-DiagnosticAiToken -BaseUrl $baseUri
        $headers = @{ Authorization = "Bearer $token" }
        $response = Invoke-RestMethod -Uri $uri -Method POST -Body $payloadJson -ContentType 'application/json' -Headers $headers -TimeoutSec 5
        Write-Host "  -> Intent detected: $($response.intent)"
    } catch {
        Write-Host "  -> Error: $(Format-Phase5Error -ErrorRecord $_)"
    }
} else {
    Write-Host "STATUS: OFFLINE - Start with: cd ai-engine; ..\.venv\Scripts\python.exe -m uvicorn main:app --port 8000"
}

Write-Host ""

# Test Backend
Write-Host "[TEST-2] BACKEND (port 3001)"
Write-Host "----------------------------------"
$backendReady = Test-NetConnection -ComputerName "127.0.0.1" -Port 3001 -InformationLevel Quiet
if ($backendReady) {
    Write-Host "STATUS: ONLINE - Backend responding"
} else {
    Write-Host "STATUS: OFFLINE - Start with: npm run dev"
}

Write-Host ""

# Test Voice Engine
Write-Host "[TEST-3] VOICE ENGINE (port 8001)"
Write-Host "----------------------------------"
$voiceReady = Test-NetConnection -ComputerName "127.0.0.1" -Port 8001 -InformationLevel Quiet
if ($voiceReady) {
    Write-Host "STATUS: ONLINE - Voice Engine responding"
} else {
    Write-Host "STATUS: OFFLINE (optional) - Start with: cd voice-engine; ..\.venv\Scripts\python.exe -m uvicorn voice_server:app --port 8001"
}

Write-Host ""

# Test Desktop UI
Write-Host "[TEST-4] DESKTOP UI (port 5173)"
Write-Host "----------------------------------"
$uiReady = Test-NetConnection -ComputerName "127.0.0.1" -Port 5173 -InformationLevel Quiet
if ($uiReady) {
    Write-Host "STATUS: ONLINE - Desktop UI responding"
} else {
    Write-Host "STATUS: OFFLINE - Start with: npm run dev"
}

Write-Host ""

# Summary
Write-Host "======================================"
Write-Host "SUMMARY"
Write-Host "======================================"
Write-Host "AI Engine:  $(if ($aiReady) { 'ONLINE' } else { 'OFFLINE' })"
Write-Host "Backend:    $(if ($backendReady) { 'ONLINE' } else { 'OFFLINE' })"
Write-Host "Voice:      $(if ($voiceReady) { 'ONLINE' } else { 'OFFLINE' })"
Write-Host "Desktop:    $(if ($uiReady) { 'ONLINE' } else { 'OFFLINE' })"
Write-Host ""

if ($aiReady -and $backendReady) {
    Write-Host "VERDICT: Core services READY for testing"
    Write-Host "NEXT: Open http://127.0.0.1:5173 in browser to test UI"
} else {
    Write-Host "VERDICT: Please start core services first"
}

Write-Host ""
Write-Host "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
