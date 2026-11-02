# Uganuga Codex 작업 배차기 (v3: 팀장 체제 자동 수행)
# codex\queue\*.txt -> running -> done. 구현 작업이 끝나면 개발팀장 검수를 자동으로 넣고,
# 검수에서 지적이 나오면 구현 수정 작업을 자동으로 넣는다 (최대 3회). 통과/한도 도달 시 codex\reports\AUTO_팀장체제.md 에 기록.
$ErrorActionPreference = 'SilentlyContinue'
$cx   = $PSScriptRoot
$root = Split-Path $cx -Parent

Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dispatcher.ps1*' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
$mutex = New-Object System.Threading.Mutex($false, 'Global\ugauga-codex-dispatcher')
if (-not $mutex.WaitOne(5000)) { exit }

$dirs = @{ queue = "$cx\queue"; running = "$cx\running"; done = "$cx\done"; logs = "$cx\logs"; reports = "$cx\reports" }
foreach ($d in $dirs.Values) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }

$MAX = 2
$EFFORT = 'low'
$ROUNDS = 3
$utf8 = New-Object Text.UTF8Encoding($false)
$autoLog = "$($dirs.reports)\AUTO_팀장체제.md"

function NextNum {
  $m = 0
  foreach ($k in 'queue','running','done') {
    Get-ChildItem $dirs[$k] -Filter *.txt | ForEach-Object {
      if ($_.BaseName -match '^(\d+)_') { $n = [int]$Matches[1]; if ($n -gt $m) { $m = $n } }
    }
  }
  return $m + 1
}
function NewJob($name, $text) {
  [IO.File]::WriteAllText("$($dirs.queue)\$name.txt", $text, $utf8)
  Add-Content -Path "$cx\dispatcher-log.txt" -Value "$(Get-Date -Format 'HH:mm:ss') 자동 생성: $name" -Encoding UTF8
}
function AutoNote($line) { Add-Content -Path $autoLog -Value "- $(Get-Date -Format 'MM-dd HH:mm') $line" -Encoding UTF8 }

$COMMON = '파일 삭제 금지(필요시 _old로 이동). 창 띄우지 말 것. .bat 실행 금지. 다른 작업 큐에 넣지 말 것(자동 체인이 처리).'
$DEPLOY = "끝나면: npm run build 성공 확인 -> robocopy dist _pages /MIR /XD .git (.nojekyll 유지) -> cd _pages; git add -A; git commit -m ""자동 수정""; git push -f origin gh-pages -> 루트에서 git add -A; git commit -m ""팀장 지적 자동 수정""; git push origin main."

$seen = @{}
Get-ChildItem $dirs.done -Filter *.txt | ForEach-Object { $seen[$_.Name] = $true }

while ($true) {
  Set-Content -Path "$cx\dispatcher-alive.txt" -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -Encoding UTF8

  # --- 팀장 체제 자동 체인 ---
  foreach ($f in (Get-ChildItem $dirs.done -Filter *.txt | Sort-Object LastWriteTime)) {
    if ($seen[$f.Name]) { continue }
    $seen[$f.Name] = $true
    if ($f.BaseName -notmatch '^(\d+)_(.+)$') { continue }
    $num = [int]$Matches[1]; $rest = $Matches[2]
    $round = 0; if ($rest -match '_r(\d+)$') { $round = [int]$Matches[1] }

    if ($rest -like '구현*') {
      $n = NextNum
      $name = "${n}_개발팀장_자동검수_${num}_r$round"
      NewJob $name "[개발팀장] $num 구현 작업 자동 검수 ($n) — 코드 수정 금지, 검수만. $COMMON`r`n대상: codex\done\$($f.Name) 지시와 그 결과(codex\reports, git 최근 커밋). codex\DECISIONS.md 대비 어긋남, 새 버그, 빌드 오류, 1~15판 진행 막힘(코드상).`r`n결과: codex\reports\LEAD_$n.md — 문제 없으면 첫 줄에 정확히 ""통과"". 문제 있으면 첫 줄 ""지적"" 후 표(문제/근거 파일:줄/고칠 방법/우선순위) 10줄 이내."
    }
    elseif ($rest -like '개발팀장_자동검수_*') {
      $rep = "$($dirs.reports)\LEAD_$num.md"
      $first = ''
      if (Test-Path $rep) { $first = (Get-Content -Encoding UTF8 $rep -TotalCount 3) -join ' ' }
      if ($first -match '^\s*\W*통과') { AutoNote "$num 검수 통과 ($rest)"; continue }
      if (-not (Test-Path $rep)) { AutoNote "$num 검수 보고서 없음 — 체인 중단 ($rest)"; continue }
      if ($round -ge $ROUNDS) { AutoNote "$num 지적 남음, 자동 수정 $ROUNDS회 한도 — 실장 확인 필요 ($rest)"; continue }
      $n = NextNum; $r = $round + 1
      $name = "${n}_구현_팀장지적수정_r$r"
      NewJob $name "[구현] 개발팀장 지적 자동 수정 ($n, $r회차) — $COMMON`r`ncodex\reports\LEAD_$num.md 의 지적을 우선순위 높은 것부터 수정. 지적 외 변경 금지. codex\DECISIONS.md 결정과 충돌하는 지적은 고치지 말고 보고서에 이유만.`r`n$DEPLOY`r`n결과: codex\reports\구현_$n.md 4줄."
    }
  }

  # --- 배차 ---
  $running = @(Get-ChildItem $dirs.running -Filter *.txt).Count
  foreach ($j in (Get-ChildItem $dirs.queue -Filter *.txt | Sort-Object { if ($_.BaseName -match '^(\d+)') { [int]$Matches[1] } else { 0 } })) {
    if ($running -ge $MAX) { break }
    $name = $j.BaseName
    $file = Join-Path $dirs.running $j.Name
    $rules = if (Test-Path "$cx\RULES.md") { Get-Content -Raw -Encoding UTF8 "$cx\RULES.md" } else { '' }
    $task  = Get-Content -Raw -Encoding UTF8 $j.FullName
    [IO.File]::WriteAllText($file, "$rules`r`n`r`n$task", $utf8)
    Remove-Item -Force $j.FullName
    $log = Join-Path $dirs.logs "$name.log"
    $cmd = "codex exec -c model_reasoning_effort=$EFFORT -s danger-full-access --skip-git-repo-check -C ""$root"" - < ""$file"" > ""$log"" 2>&1 & move /y ""$file"" ""$($dirs.done)\"" >nul"
    Start-Process -FilePath cmd.exe -ArgumentList "/s /c ""$cmd""" -WindowStyle Hidden -WorkingDirectory $root
    Add-Content -Path "$cx\dispatcher-log.txt" -Value "$(Get-Date -Format 'HH:mm:ss') 시작: $name" -Encoding UTF8
    $running++
  }
  Start-Sleep -Seconds 10
}
