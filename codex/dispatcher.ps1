# 우가우가 Codex 작업 배차기 (v2: 토큰 절약)
# codex\queue\*.txt 에 작업 지시가 들어오면 RULES.md 를 앞에 붙여 Codex를 창 없이 실행한다.
#   queue\ 대기  running\ 실행 중  done\ 끝남  logs\ 작업별 로그
$ErrorActionPreference = 'SilentlyContinue'
$cx   = $PSScriptRoot
$root = Split-Path $cx -Parent

# 예전 배차기가 돌고 있으면 끄고 새 버전으로 교체
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dispatcher.ps1*' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
$mutex = New-Object System.Threading.Mutex($false, 'Global\ugauga-codex-dispatcher')
if (-not $mutex.WaitOne(5000)) { exit }

$dirs = @{ queue = "$cx\queue"; running = "$cx\running"; done = "$cx\done"; logs = "$cx\logs" }
foreach ($d in $dirs.Values) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }

$MAX = 2          # 동시에 2명까지
$EFFORT = 'low'   # 추론 노력 낮게 (토큰 절약)
while ($true) {
  Set-Content -Path "$cx\dispatcher-alive.txt" -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -Encoding UTF8
  $running = @(Get-ChildItem $dirs.running -Filter *.txt).Count
  foreach ($j in (Get-ChildItem $dirs.queue -Filter *.txt | Sort-Object Name)) {
    if ($running -ge $MAX) { break }
    $name = $j.BaseName
    $file = Join-Path $dirs.running $j.Name
    $rules = if (Test-Path "$cx\RULES.md") { Get-Content -Raw -Encoding UTF8 "$cx\RULES.md" } else { '' }
    $task  = Get-Content -Raw -Encoding UTF8 $j.FullName
    [IO.File]::WriteAllText($file, "$rules`r`n`r`n$task", (New-Object Text.UTF8Encoding($false)))
    Remove-Item -Force $j.FullName
    $log = Join-Path $dirs.logs "$name.log"
    $cmd = "codex exec -c model_reasoning_effort=$EFFORT -s danger-full-access --skip-git-repo-check -C ""$root"" - < ""$file"" > ""$log"" 2>&1 & move /y ""$file"" ""$($dirs.done)\"" >nul"
    Start-Process -FilePath cmd.exe -ArgumentList "/s /c ""$cmd""" -WindowStyle Hidden -WorkingDirectory $root
    Add-Content -Path "$cx\dispatcher-log.txt" -Value "$(Get-Date -Format 'HH:mm:ss') 시작: $name" -Encoding UTF8
    $running++
  }
  Start-Sleep -Seconds 10
}
