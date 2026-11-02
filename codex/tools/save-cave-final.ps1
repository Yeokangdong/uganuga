param([string]$Source,[string]$Name,[int]$Width,[int]$Height,[switch]$Alpha,[switch]$TileX,[switch]$TileY,[switch]$Grounded)
$ErrorActionPreference='Stop'
$dest=Join-Path 'D:\99.Work\ugauga\art-src' $Name
if(Test-Path -LiteralPath $dest){Write-Output "SKIP $Name";exit}
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($dest))
& "$PSScriptRoot\save-generated.ps1" -Source $Source -Destination $dest -Width $Width -Height $Height -TileX:$TileX -TileY:$TileY -Grounded:$Grounded
$bitmap=[Drawing.Bitmap]::FromFile($dest)
$zero=0;$visible=0
for($y=0;$y -lt $Height;$y+=4){for($x=0;$x -lt $Width;$x+=4){$a=$bitmap.GetPixel($x,$y).A;if($a -eq 0){$zero++};if($a -gt 128){$visible++}}}
$bitmap.Dispose()
if($Alpha -and ($zero -eq 0 -or $visible -eq 0)){throw "Invalid alpha: $Name"}
Add-Content -Encoding UTF8 -LiteralPath 'D:\99.Work\ugauga\codex\progress.txt' -Value "art-src\$Name"
Write-Output "COMPLETE $Name alpha0=$zero visible=$visible"
