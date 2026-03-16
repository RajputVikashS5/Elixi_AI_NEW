$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$startedProcesses = @()
$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Details
  )

  $results.Add([PSCustomObject]@{
      Test = $Name
      Passed = $Passed
      Details = $Details
    })
}

function Invoke-Test {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  try {
    $detail = & $Action
    Add-Result -Name $Name -Passed $true -Details ([string]$detail)
  }
  catch {
    Add-Result -Name $Name -Passed $false -Details ($_.Exception.Message)
  }
}

function Wait-Http {
  param(
    [string]$Url,
    [int]$TimeoutSec = 30,
    [int]$SleepMs = 500
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $Url -Method Get | Out-Null
      return $true
    }
    catch {
      Start-Sleep -Milliseconds $SleepMs
    }
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
  $startedProcesses += [PSCustomObject]@{
    Label = $Label
    Process = $proc
  }
}

function Ensure-Ollama {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get | Out-Null
    return 'already running'
  }
  catch {
    $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollamaCmd) {
      throw 'Ollama executable not found in PATH.'
    }

    Start-TrackedProcess -FilePath $ollamaCmd.Source -ArgumentList @('serve') -WorkingDirectory $repoRoot -Label 'ollama'
    if (-not (Wait-Http -Url 'http://127.0.0.1:11434/api/tags' -TimeoutSec 40)) {
      throw 'Ollama service did not become ready in time.'
    }

    return 'started by script'
  }
}

function Ensure-AiEngine {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -Method Get | Out-Null
    return 'already running'
  }
  catch {
    $pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $pythonExe)) {
      throw "Python venv executable not found: $pythonExe"
    }

    Start-TrackedProcess -FilePath $pythonExe -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory (Join-Path $repoRoot 'ai-engine') -Label 'ai-engine'
    if (-not (Wait-Http -Url 'http://127.0.0.1:8000/health' -TimeoutSec 50)) {
      throw 'AI engine did not become ready in time.'
    }

    return 'started by script'
  }
}

function Ensure-Backend {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -Method Get | Out-Null
    return 'already running'
  }
  catch {
    $backendDir = Join-Path $repoRoot 'backend'
    Start-TrackedProcess -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm start') -WorkingDirectory $backendDir -Label 'backend'
    if (-not (Wait-Http -Url 'http://127.0.0.1:3001/health' -TimeoutSec 40)) {
      throw 'Backend did not become ready in time.'
    }

    return 'started by script'
  }
}

try {
  Write-Host '== ELIXI Phase 1-2 Regression ==' -ForegroundColor Cyan

  Invoke-Test -Name 'Build Backend' -Action {
    & npm --prefix backend run build | Out-Null
    'ok'
  }

  Invoke-Test -Name 'Build Desktop' -Action {
    & npm --prefix desktop run build | Out-Null
    'ok'
  }

  Invoke-Test -Name 'Ensure Ollama' -Action { Ensure-Ollama }
  Invoke-Test -Name 'Ensure AI Engine' -Action { Ensure-AiEngine }
  Invoke-Test -Name 'Ensure Backend' -Action { Ensure-Backend }

  Invoke-Test -Name 'Voice Stream Socket Bridge' -Action {
    $voiceCheckScript = Join-Path $repoRoot 'scripts\voice-socket-check.mjs'
    & npm --prefix desktop\react-ui exec node $voiceCheckScript | Out-Null
    'ok'
  }

  $base = 'http://127.0.0.1:3001'

  Invoke-Test -Name 'Health Endpoint' -Action {
    $h = Invoke-RestMethod -Uri "$base/health" -Method Get
    "status=$($h.status)"
  }

  Invoke-Test -Name 'System Info Endpoint' -Action {
    $s = Invoke-RestMethod -Uri "$base/api/system/info" -Method Get
    "cpu=$([math]::Round($s.cpu,2))"
  }

  Invoke-Test -Name 'Memory Store/Get/Delete' -Action {
    $key = 'phase12_regression_' + ([guid]::NewGuid().ToString('N'))
    $payload = @{ category = 'fact'; key = $key; value = 'phase12'; confidence = 0.9 } | ConvertTo-Json
    $stored = Invoke-RestMethod -Uri "$base/api/memory/facts" -Method Post -ContentType 'application/json' -Body $payload
    $facts = Invoke-RestMethod -Uri "$base/api/memory/facts" -Method Get
    Invoke-RestMethod -Uri "$base/api/memory/facts/$($stored.fact.id)" -Method Delete | Out-Null
    "count=$($facts.facts.Count)"
  }

  Invoke-Test -Name 'Permissions API' -Action {
    $permPayload = @{ commandPattern = 'open_app:vscode'; tier = 2 } | ConvertTo-Json
    $req = Invoke-RestMethod -Uri "$base/api/automation/permissions/request" -Method Post -ContentType 'application/json' -Body $permPayload
    $all = Invoke-RestMethod -Uri "$base/api/automation/permissions" -Method Get
    "request=$($req.success) count=$($all.permissions.Count)"
  }

  Invoke-Test -Name 'Workflow CRUD' -Action {
    $createBody = @{ name = 'Regression Temp Workflow'; description = 'temp'; steps = @(@{ action = 'open_app'; target = 'vscode' }) } | ConvertTo-Json -Depth 8
    $created = Invoke-RestMethod -Uri "$base/api/automation/workflows" -Method Post -ContentType 'application/json' -Body $createBody

    $updateBody = @{ name = 'Regression Temp Workflow Updated'; description = 'temp2'; steps = @(@{ action = 'open_app'; target = 'explorer' }) } | ConvertTo-Json -Depth 8
    $updated = Invoke-RestMethod -Uri "$base/api/automation/workflows/$($created.workflow.id)" -Method Put -ContentType 'application/json' -Body $updateBody

    Invoke-RestMethod -Uri "$base/api/automation/workflows/$($created.workflow.id)" -Method Delete | Out-Null

    "updated=$($updated.workflow.name)"
  }

  Invoke-Test -Name 'Automation Execute Command' -Action {
    $cmdPayload = @{ command = 'system_info' } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$base/api/automation/execute" -Method Post -ContentType 'application/json' -Body $cmdPayload
    "success=$($res.success)"
  }

  Invoke-Test -Name 'Automation Execute Workflow' -Action {
    $wfPayload = @{ workflowId = 'coding-workspace' } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$base/api/automation/execute" -Method Post -ContentType 'application/json' -Body $wfPayload
    "success=$($res.success) steps=$($res.result.steps.Count)"
  }

  Invoke-Test -Name 'Audit Logs Endpoint' -Action {
    $logs = Invoke-RestMethod -Uri "$base/api/automation/audit-logs?limit=20" -Method Get
    "count=$($logs.logs.Count)"
  }

  Invoke-Test -Name 'REST Chat E2E' -Action {
    $sessionId = [guid]::NewGuid().ToString()
    $chatBody = @{ sessionId = $sessionId; message = 'Give a concise coding workflow suggestion.'; personalityMode = 'professional'; ollamaModel = 'mistral' } | ConvertTo-Json
    $chat = Invoke-RestMethod -Uri "$base/api/chat/message" -Method Post -ContentType 'application/json' -Body $chatBody -TimeoutSec 180
    $history = Invoke-RestMethod -Uri "$base/api/chat/history?sessionId=$sessionId" -Method Get
    "success=$($chat.success) intent=$($chat.intent) history=$($history.messages.Count)"
  }

  Invoke-Test -Name 'AI Intent Endpoint' -Action {
    $intentBody = @{ message = 'Open VS Code and start coding' } | ConvertTo-Json
    $intent = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/ai/intent' -Method Post -ContentType 'application/json' -Body $intentBody
    "intent=$($intent.intent)"
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
      # Ignore cleanup errors.
    }
  }
}

Write-Host ''
Write-Host '== Summary ==' -ForegroundColor Cyan
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.Passed })
if ($failed.Count -gt 0) {
  Write-Host "FAILED: $($failed.Count) test(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host 'PASSED: all regression checks succeeded.' -ForegroundColor Green
exit 0
