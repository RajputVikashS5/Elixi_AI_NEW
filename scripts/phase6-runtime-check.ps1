Set-Location "e:\Projects\Elixi AI Electron"
$ErrorActionPreference = 'Stop'

function Pass([string]$msg) { Write-Host "PASS $msg" }
function Fail([string]$msg) { Write-Host "FAIL $msg" }

try {
  $ins = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/learning/insights?limit=5&min_occurrences=2" -TimeoutSec 20
  if ($ins.summary -and $ins.verbosityAdaptation -and $ins.predictiveSuggestions) {
    Pass "learning insights endpoint returns adaptive payload"
  } else {
    Fail "learning insights endpoint missing required sections"
  }
} catch {
  Fail "learning insights endpoint error: $($_.Exception.Message)"
}

try {
  $sn = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/learning/snapshots?limit=5" -TimeoutSec 20
  if ($sn.snapshots -and $sn.snapshots.Count -ge 1) {
    Pass "learning snapshots endpoint returns records (scheduler/startup capture)"
  } else {
    Fail "learning snapshots endpoint returned no records"
  }
} catch {
  Fail "learning snapshots endpoint error: $($_.Exception.Message)"
}

$createdId = $null
try {
  $wfBody = @{
    name = "Learned: phase6 test workflow"
    description = "Pinned from adaptive learning suggestion (test)."
    steps = @(@{ action = "open_app"; target = "notepad" })
  } | ConvertTo-Json -Depth 8

  $saved = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/automation/workflows" -Method POST -Body $wfBody -ContentType "application/json" -TimeoutSec 20
  $createdId = $saved.workflow.id

  if ($createdId) {
    Pass "pin workflow API create succeeded (id=$createdId)"
  } else {
    Fail "pin workflow API create missing id"
  }
} catch {
  Fail "pin workflow API create error: $($_.Exception.Message)"
}

if ($createdId) {
  try {
    $runBody = @{ workflowId = $createdId } | ConvertTo-Json
    $run = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/automation/execute" -Method POST -Body $runBody -ContentType "application/json" -TimeoutSec 25
    if ($run.success -eq $true) {
      Pass "run pinned workflow succeeded"
    } else {
      Fail "run pinned workflow returned non-success"
    }
  } catch {
    Fail "run pinned workflow error: $($_.Exception.Message)"
  }

  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/automation/workflows/$createdId" -Method DELETE -TimeoutSec 15 | Out-Null
    Pass "cleanup pinned workflow delete succeeded"
  } catch {
    Fail "cleanup pinned workflow delete error: $($_.Exception.Message)"
  }
}

try {
  function Read-Key([string]$k) {
    foreach ($f in @('ai-engine/.env.local', 'ai-engine/.env')) {
      if (Test-Path $f) {
        $m = Select-String -Path $f -Pattern ("^" + [regex]::Escape($k) + "=") | Select-Object -First 1
        if ($m) {
          return ($m.Line.Split('=', 2)[1]).Trim()
        }
      }
    }
    return $null
  }

  $u = Read-Key 'AUTH_USERNAME'
  if (-not $u) { $u = 'elixi_admin' }
  $p = Read-Key 'AUTH_PASSWORD'
  if (-not $p) { $p = 'change_me_to_a_strong_password' }

  $authBody = "grant_type=password&username=$([uri]::EscapeDataString($u))&password=$([uri]::EscapeDataString($p))"
  $tok = (Invoke-RestMethod -Uri "http://127.0.0.1:8000/auth/token" -Method POST -Body $authBody -ContentType "application/x-www-form-urlencoded" -TimeoutSec 10).access_token
  $h = @{ Authorization = "Bearer $tok" }

  $chat = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ai/chat" -Method POST -Headers $h -Body '{"sessionId":"phase6-test-verbosity","message":"give me a quick answer for db tests","stream":false,"llmProvider":"online","onlineModel":"meta-llama/llama-3-8b-instruct"}' -ContentType "application/json" -TimeoutSec 60

  if ($chat.response_text) {
    Pass "AI chat responded via verbosity-adapted path"
  } else {
    Fail "AI chat missing response_text"
  }
} catch {
  Fail "AI chat error: $($_.Exception.Message)"
}
