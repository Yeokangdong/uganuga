$ErrorActionPreference='Stop'
$definitions=(Get-Content -Raw -Encoding UTF8 "$PSScriptRoot\validate-art.ps1").Split([string[]]@('$manifest='),[System.StringSplitOptions]::None)[0]
Invoke-Expression $definitions
$jobs=@(
 @('enemies_sheet.png',1536,1024,$true,5,3,'4,5,3'),
 @('boss_sheet.png',1536,1024,$true,3,3,'3,3,3'),
 @('items_sheet.png',1536,1024,$true,5,2,'4,0'),
 @('props_sheet.png',1536,1024,$true,5,2,'5,5'),
 @('bg_far.png',3072,1024,$false),
 @('bg_mid.png',3072,1024,$true),
 @('bg_near.png',3072,1024,$true),
 @('bg_far_boss.png',3072,1024,$false),
 @('ground.png',1024,1024,$false),
 @('grass.png',2048,512,$true),
 @('log.png',1536,384,$true)
)
foreach($j in $jobs){
 $path=Join-Path 'D:\99.Work\ugauga\art-src\stage2' $j[0]
 $b=[System.Drawing.Bitmap]::FromFile($path)
 try{
  if($b.Width -ne $j[1] -or $b.Height -ne $j[2]){throw "Dimensions $($j[0])"}
  $a=[ArtCheck]::Inspect($b)
  if($j[3] -and ($a[0] -eq 0 -or $a[2] -eq 0)){throw "Alpha $($j[0])"}
  if(!$j[3] -and $a[0] -ne 0){throw "Opaque $($j[0])"}
  if($j[0] -match '^(bg_|ground|grass)' -and $a[3] -ne 0){throw "Tile X $($j[0])"}
  if($j[0] -eq 'ground.png' -and $a[4] -ne 0){throw 'Tile Y ground'}
  if($j.Count -gt 4){
   $counts=$j[6].Split(',');$cols=$j[4];$rows=$j[5]
   for($row=0;$row -lt $rows;$row++){for($col=0;$col -lt $cols;$col++){
    $bb=[ArtCheck]::CellBounds($b,$cols,$rows,$col,$row)
    $empty=$bb[2] -lt 0
    if(($col -lt [int]$counts[$row]) -eq $empty){throw "Cell $($j[0]) $row,$col"}
    if(!$empty -and [Math]::Abs($bb[3]-[Math]::Round(($row+0.92)*1024/$rows)) -gt 3){throw "Baseline $($j[0]) $row,$col"}
   }}
  }
  Write-Output "PASS $($j[0]) $($b.Width)x$($b.Height) alpha0=$($a[0]) edgeX=$($a[3]) edgeY=$($a[4])"
 }finally{$b.Dispose()}
}
$done='D:\99.Work\ugauga\codex\DONE_S2.txt'
if(!(Test-Path -LiteralPath $done)){[System.IO.File]::WriteAllText($done,"Stage 2 complete: 11 PNG assets. Dimensions, alpha, sheet cells/baselines, repeating edges verified.`r`n",[System.Text.UTF8Encoding]::new($false))}
