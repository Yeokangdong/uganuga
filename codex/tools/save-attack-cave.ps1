param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Name,[int]$Width,[int]$Height,[switch]$Alpha,[switch]$TileX,[switch]$TileY,[switch]$Grounded)
$ErrorActionPreference='Stop'
$root='D:\99.Work\ugauga'
$dest=Join-Path "$root\art-src" $Name
if(Test-Path -LiteralPath $dest){Write-Output "SKIP $Name";exit 0}
[void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($dest))
& "$PSScriptRoot\save-generated.ps1" -Source $Source -Destination $dest -Width $Width -Height $Height -TileX:$TileX -TileY:$TileY -Grounded:$Grounded
$b=[System.Drawing.Bitmap]::FromFile($dest)
$zeros=0;$solid=0
for($y=0;$y -lt $b.Height;$y+=4){for($x=0;$x -lt $b.Width;$x+=4){$a=$b.GetPixel($x,$y).A;if($a -eq 0){$zeros++};if($a -eq 255){$solid++}}}
$b.Dispose()
if($Alpha -and ($zeros -eq 0 -or $solid -eq 0)){throw "Invalid transparency $Name"}
Add-Content -Encoding UTF8 -LiteralPath "$root\codex\progress.txt" -Value $Name
Write-Output "COMPLETE $Name alpha0=$zeros opaque=$solid"
