$ErrorActionPreference = 'Stop'

function Invoke-Smoke {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 8
      $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Url -Headers $Headers -ContentType 'application/json' -Body $json -TimeoutSec 45
    } else {
      $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Url -Headers $Headers -TimeoutSec 45
    }

    $sw.Stop()
    $content = [string]$resp.Content
    $snippet = $content.Substring(0, [Math]::Min(300, $content.Length))

    return [pscustomobject]@{
      name = $Name
      ok = $true
      status = [int]$resp.StatusCode
      ms = [int]$sw.ElapsedMilliseconds
      body = $snippet
    }
  } catch {
    $sw.Stop()

    $status = -1
    $body = $_.Exception.Message

    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
      } catch {}
    }

    $snippet = [string]$body
    $snippet = $snippet.Substring(0, [Math]::Min(300, $snippet.Length))

    return [pscustomobject]@{
      name = $Name
      ok = $false
      status = $status
      ms = [int]$sw.ElapsedMilliseconds
      body = $snippet
    }
  }
}

$results = @()
$results += Invoke-Smoke -Name 'health_backend_3001' -Method 'GET' -Url 'http://127.0.0.1:3001/health' -Body $null -Headers @{}
$results += Invoke-Smoke -Name 'health_ai_8000' -Method 'GET' -Url 'http://127.0.0.1:8000/health' -Body $null -Headers @{}
$results += Invoke-Smoke -Name 'health_voice_8001' -Method 'GET' -Url 'http://127.0.0.1:8001/health' -Body $null -Headers @{}

$sessionId = [guid]::NewGuid().ToString()
$results += Invoke-Smoke -Name 'chat_e2e_backend_api' -Method 'POST' -Url 'http://127.0.0.1:3001/api/chat/message' -Body @{ sessionId = $sessionId; message = 'Runtime smoke test: reply with short ack'; llmProvider = 'ollama'; ollamaModel = 'llama3' } -Headers @{}
$results += Invoke-Smoke -Name 'chat_history_backend_api' -Method 'GET' -Url ("http://127.0.0.1:3001/api/chat/history?sessionId=" + $sessionId) -Body $null -Headers @{}

$results += Invoke-Smoke -Name 'voice_status_backend_api' -Method 'GET' -Url 'http://127.0.0.1:3001/api/voice/status' -Body $null -Headers @{}
$results += Invoke-Smoke -Name 'voice_capabilities_backend_api' -Method 'GET' -Url 'http://127.0.0.1:3001/api/voice/capabilities' -Body $null -Headers @{}
$results += Invoke-Smoke -Name 'voice_tts_backend_api' -Method 'POST' -Url 'http://127.0.0.1:3001/api/voice/tts' -Body @{ text = 'ELIXI runtime smoke test' } -Headers @{}

$results += Invoke-Smoke -Name 'ai_provider_status_backend_api' -Method 'GET' -Url 'http://127.0.0.1:3001/ai/providers/status' -Body $null -Headers @{}

$results | ConvertTo-Json -Depth 8
