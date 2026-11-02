param([string]$Source,[string]$Name,[int]$Width,[int]$Height,[int]$Columns=0,[int]$Rows=0,[string]$Counts,[switch]$PerRow,[switch]$PerObject,[switch]$TileX,[switch]$TileY)
$ErrorActionPreference='Stop'
$dest=Join-Path 'D:\99.Work\ugauga\art-src\stage2' $Name
if(Test-Path -LiteralPath $dest){Write-Output "SKIP $Name";return}
[void][System.IO.Directory]::CreateDirectory((Split-Path $dest))
if($Columns -gt 0){
 & "$PSScriptRoot\save-sheet.ps1" -Source $Source -Destination $dest -Columns $Columns -Rows $Rows -Counts $Counts -PerRow:$PerRow -PerObject:$PerObject
}else{
 & "$PSScriptRoot\save-generated.ps1" -Source $Source -Destination $dest -Width $Width -Height $Height -TileX:$TileX -TileY:$TileY
}
if(!(Test-Path -LiteralPath $dest)){throw 'Save failed'}
Add-Content -Encoding UTF8 -LiteralPath 'D:\99.Work\ugauga\codex\progress.txt' -Value "stage2\$Name"
