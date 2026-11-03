# Portable setup for 2x Codex (ChatGPT Plus) agents in Zed.
# Run on each machine:  powershell -ExecutionPolicy Bypass -File setup-zed-dual-codex.ps1
# Then restart Zed, paste the printed agent_servers snippet into Zed settings.json,
# and log each account in once via browser. Credentials (auth.json) are NEVER
# copied by this script -- do not commit auth.json to git.
$ErrorActionPreference = 'Stop'

$acc1 = Join-Path $HOME '.codex-zed-account-1'
$acc2 = Join-Path $HOME '.codex-zed-account-2'
$mainCfg = Join-Path $HOME '.codex\config.toml'
$pin = 'cli_auth_credentials_store = "file"'

foreach ($d in @($acc1, $acc2)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory $d | Out-Null }
  $cfg = Join-Path $d 'config.toml'
  if (-not (Test-Path $cfg)) { Set-Content $cfg "$pin`n" -Encoding utf8 }
  elseif ((Get-Content $cfg -Raw) -notmatch 'cli_auth_credentials_store') {
    Add-Content $cfg "`n$pin`n" -Encoding utf8
  }
}

if (-not (Test-Path $mainCfg)) {
  New-Item -ItemType Directory (Split-Path $mainCfg) -Force | Out-Null
  Set-Content $mainCfg "$pin`n" -Encoding utf8
}
elseif ((Get-Content $mainCfg -Raw) -notmatch 'cli_auth_credentials_store') {
  Add-Content $mainCfg "`n$pin`n" -Encoding utf8
}

$cmd = Join-Path $env:APPDATA 'npm\codex-acp.cmd'
$homeFwd = ($HOME -replace '\\', '/')
$snippet = @"
    "Codex-Acc1": {
      "type": "custom",
      "command": "$($cmd -replace '\\', '\\')",
      "args": [],
      "env": { "CODEX_HOME": "$homeFwd/.codex-zed-account-1", "OPENAI_API_KEY": "", "CODEX_API_KEY": "" }
    },
    "Codex-Acc2": {
      "type": "custom",
      "command": "$($cmd -replace '\\', '\\')",
      "args": [],
      "env": { "CODEX_HOME": "$homeFwd/.codex-zed-account-2", "OPENAI_API_KEY": "", "CODEX_API_KEY": "" }
    },
"@
Write-Output '--- paste inside "agent_servers" in %APPDATA%\Zed\settings.json, then restart Zed ---'
Write-Output $snippet
Write-Output '--- then: new Codex-Acc1 thread > Login with ChatGPT (acc1); new Codex-Acc2 thread > Login with ChatGPT (acc2, incognito) ---'
