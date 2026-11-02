param([string]$Source,[string]$Destination,[int]$Columns,[int]$Rows,[string]$Counts,[switch]$Hero,[switch]$PerRow,[switch]$PerObject)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/inspect-sheet.ps1" -DefinitionsOnly
$src=[System.Drawing.Bitmap]::FromFile($Source)
$all=@([SheetBlobs]::Find($src))
$large=@($all | Where-Object {$_.N -gt 1000})
# Keep detached small accents (stars, embers, vine ends) with their nearest sprite.
foreach($small in @($all | Where-Object {$_.N -le 1000})) {
 $nearest=$null; $best=[double]::MaxValue
 foreach($b in $large) {
  $dx=[Math]::Max(0,[Math]::Max($b.L-$small.R,$small.L-$b.R))
  $dy=[Math]::Max(0,[Math]::Max($b.T-$small.B,$small.T-$b.B))
  $dist=$dx*$dx+$dy*$dy
  if($dist -lt $best){$best=$dist;$nearest=$b}
 }
 if($best -lt 3600){$nearest.Pixels.AddRange($small.Pixels);$nearest.L=[Math]::Min($nearest.L,$small.L);$nearest.T=[Math]::Min($nearest.T,$small.T);$nearest.R=[Math]::Max($nearest.R,$small.R);$nearest.B=[Math]::Max($nearest.B,$small.B)}
}
$cw=1536.0/$Columns; $ch=1024.0/$Rows
if($PerObject){
 $byCell=@{}
 foreach($b in $large){
  $key='{0},{1}' -f [Math]::Min($Rows-1,[int][Math]::Floor(($b.T+$b.B)/2.0/$ch)),[Math]::Min($Columns-1,[int][Math]::Floor(($b.L+$b.R)/2.0/$cw))
  if(!$byCell.ContainsKey($key)){$byCell[$key]=$b}else{
   $base=$byCell[$key];$base.Pixels.AddRange($b.Pixels);$base.L=[Math]::Min($base.L,$b.L);$base.T=[Math]::Min($base.T,$b.T);$base.R=[Math]::Max($base.R,$b.R);$base.B=[Math]::Max($base.B,$b.B)
  }
 }
 $large=@($byCell.Values)
}
$expected=@($Counts.Split(',') | ForEach-Object {[int]$_})
$groups=@{}
for($row=0;$row -lt $Rows;$row++) {
 $groups[$row]=@($large | Where-Object {[Math]::Min($Rows-1,[int][Math]::Floor(($_.T+$_.B)/2.0/$ch)) -eq $row} | Sort-Object L)
 if($groups[$row].Count -ne $expected[$row]){throw "Row $row expected $($expected[$row]) sprites, found $($groups[$row].Count)"}
}
$globalScale=10.0
foreach($row in 0..($Rows-1)){for($col=0;$col -lt $groups[$row].Count;$col++){
 if($Hero -and $row -eq 2 -and $col -eq 3){continue}
 $b=$groups[$row][$col];$s=[Math]::Min(($cw*0.88)/($b.R-$b.L+1),($ch*0.84)/($b.B-$b.T+1));$globalScale=[Math]::Min($globalScale,$s)
}}
$dst=New-Object System.Drawing.Bitmap(1536,1024,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g=[System.Drawing.Graphics]::FromImage($dst);$g.Clear([System.Drawing.Color]::Transparent);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for($row=0;$row -lt $Rows;$row++) {
 $rowScale=10.0
 foreach($b in $groups[$row]){$rowScale=[Math]::Min($rowScale,[Math]::Min(($cw*0.88)/($b.R-$b.L+1),($ch*0.84)/($b.B-$b.T+1)))}
 for($col=0;$col -lt $groups[$row].Count;$col++) {
  $b=$groups[$row][$col];$sw=$b.R-$b.L+1;$sh=$b.B-$b.T+1
  $scale=$globalScale;if($PerRow){$scale=$rowScale};if($PerObject -or ($Hero -and $row -eq 2 -and $col -eq 3)){$scale=[Math]::Min(($cw*0.88)/$sw,($ch*0.84)/$sh)}
  $part=New-Object System.Drawing.Bitmap($sw,$sh,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  foreach($p in $b.Pixels){$x=$p%$src.Width;$y=[int][Math]::Floor($p/$src.Width);$part.SetPixel($x-$b.L,$y-$b.T,$src.GetPixel($x,$y))}
  $dw=[int]($sw*$scale);$dh=[int]($sh*$scale);$x=[int]($col*$cw+($cw-$dw)/2);$y=[int](($row+0.92)*$ch-$dh)
  $g.DrawImage($part,$x,$y,$dw,$dh);$part.Dispose()
 }
}
$g.Dispose();$src.Dispose();$dst.Save($Destination,[System.Drawing.Imaging.ImageFormat]::Png);$dst.Dispose()
Write-Output "Saved aligned whole sheet $Destination ($Columns x $Rows)"
