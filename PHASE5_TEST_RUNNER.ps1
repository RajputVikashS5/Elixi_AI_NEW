# PHASE 5 AUTOMATED TEST RUNNER - Simplified
# Tests core functionality of ELIXI AI Engine and Backend

Write-Host "================================"
Write-Host "ELIXI PHASE 5 TEST RUNNER"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "================================"
Write-Host ""

# Test AI Engine
Write-Host "TEST-1: AI ENGINE AVAILABILITY"
Write-Host "==============================="
$aiEngineReady = $false
try {
    $result = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ PASS: AI Engine running on port 8000"
    $aiEngineReady = $true
}
catch {
    Write-Host "✗ FAIL: AI Engine not responding"
}

Write-Host ""

# Test Intent Classification
if ($aiEngineReady) {
    Write-Host "TEST-2: INTENT CLASSIFICATION"
    Write-Host "=============================="
    try {
        $payload = '{"message": "what is the weather"}'
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ai/intent" -Method POST -Body $payload -ContentType 'application/json' -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✓ PASS: Intent endpoint responds"
        Write-Host "  Intent: $($result.intent)"
    }
    catch {
        Write-Host "✗ FAIL: Intent endpoint error"
    }
}

Write-Host ""

# Test Streaming Chat  
if ($aiEngineReady) {
    Write-Host "TEST-3: STREAM GREETING"
    Write-Host "======================"
    try {
        $sessionId = "test-$(Get-Random)"
        $payload = "{""sessionId"":""$sessionId"",""message"":""hi"",""stream"":true,""llmProvider"":""ollama""}"
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ai/chat" -Method POST -Body $payload -ContentType 'application/json' -TimeoutSec 5 -ErrorAction Stop
        
        Write-Host "✓ PASS: Stream greeting works"
        Write-Host "  Response: $(($result.response_text -replace '.{80}','$&`n' -split '`n')[0])..."
    }
    catch {
        Write-Host "✗ FAIL: Stream chat error"
    }
}

Write-Host ""

# Test Backend
Write-Host "TEST-4: BACKEND AVAILABILITY"
Write-Host "============================="
$backendReady = $false
try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/system/info" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ PASS: Backend running on port 3001"
    $backendReady = $true
}
catch {
    Write-Host "✗ FAIL: Backend not responding"
}

Write-Host ""

# Test System Info
if ($backendReady) {
    Write-Host "TEST-5: SYSTEM INFO ENDPOINT"
    Write-Host "============================="
    try {
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/system/info" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✓ PASS: System info endpoint"
        Write-Host "  CPU: $($result.cpu)% | RAM: $($result.ram.used) / $($result.ram.total)"
    }
    catch {
        Write-Host "✗ FAIL: System info error"
    }
}

Write-Host ""

# Summary
Write-Host "================================"
Write-Host "SUMMARY"
Write-Host "================================"
Write-Host "AI Engine:  $(if ($aiEngineReady) { '[READY]' } else { '[DOWN]' })"
Write-Host "Backend:    $(if ($backendReady) { '[READY]' } else { '[DOWN]' })"
Write-Host ""

if ($aiEngineReady -and $backendReady) {
    Write-Host "✓ Core services ready"
} else {
    Write-Host "✗ Please start required services"
}
