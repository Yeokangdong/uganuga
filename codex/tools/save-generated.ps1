param([string]$Source,[string]$Destination,[int]$Width,[int]$Height,[switch]$Grounded,[switch]$TileX,[switch]$TileY,[switch]$Contain)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile($Source)
$dst = New-Object System.Drawing.Bitmap($Width,$Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
if ($Grounded) {
  $left=$src.Width; $top=$src.Height; $right=0; $bottom=0
  for($y=0;$y -lt $src.Height;$y++){for($x=0;$x -lt $src.Width;$x++){if($src.GetPixel($x,$y).A -gt 8){$left=[Math]::Min($left,$x);$right=[Math]::Max($right,$x);$top=[Math]::Min($top,$y);$bottom=[Math]::Max($bottom,$y)}}}
  $sw=$right-$left+1; $sh=$bottom-$top+1
  $scale=[Math]::Min(($Width*0.84)/$sw,($Height*0.84)/$sh)
  $dw=[int]($sw*$scale); $dh=[int]($sh*$scale)
  $rect=New-Object System.Drawing.Rectangle([int](($Width-$dw)/2),[int]($Height*0.92-$dh),$dw,$dh)
  $g.DrawImage($src,$rect,$left,$top,$sw,$sh,[System.Drawing.GraphicsUnit]::Pixel)
} elseif($Contain) {
  $scale=[Math]::Min(($Width*0.84)/$src.Width,($Height*0.84)/$src.Height)
  $dw=[int]($src.Width*$scale);$dh=[int]($src.Height*$scale)
  $g.DrawImage($src,[int](($Width-$dw)/2),[int](($Height-$dh)/2),$dw,$dh)
} else {$g.DrawImage($src,0,0,$Width,$Height)}
$g.Dispose()
function Blend-EdgePixel($a,$b,$weight) {
  $mixA=($a.A+$b.A)/2.0
  $outA=$a.A*(1-$weight)+$mixA*$weight
  if($outA -lt 0.5){return [System.Drawing.Color]::Transparent}
  $channels=@()
  foreach($channel in @('R','G','B')) {
    $premult=$a.$channel*$a.A*(1-$weight)+($a.$channel*$a.A+$b.$channel*$b.A)/2.0*$weight
    $channels += [int][Math]::Min(255,[Math]::Max(0,[Math]::Round($premult/$outA)))
  }
  return [System.Drawing.Color]::FromArgb([int][Math]::Round($outA),$channels[0],$channels[1],$channels[2])
}
# Preserve the painted center while matching opposite edges for repeatable tiles.
if($TileX){
  $band=[int][Math]::Min(96,$Width/8)
  for($x=0;$x -lt $band;$x++){
    $weight=(1+[Math]::Cos([Math]::PI*$x/$band))/2
    for($y=0;$y -lt $Height;$y++){
      $a=$dst.GetPixel($x,$y);$b=$dst.GetPixel($Width-1-$x,$y)
      $dst.SetPixel($x,$y,(Blend-EdgePixel $a $b $weight));$dst.SetPixel($Width-1-$x,$y,(Blend-EdgePixel $b $a $weight))
    }
  }
}
if($TileY){
  $band=[int][Math]::Min(96,$Height/8)
  for($y=0;$y -lt $band;$y++){
    $weight=(1+[Math]::Cos([Math]::PI*$y/$band))/2
    for($x=0;$x -lt $Width;$x++){
      $a=$dst.GetPixel($x,$y);$b=$dst.GetPixel($x,$Height-1-$y)
      $dst.SetPixel($x,$y,(Blend-EdgePixel $a $b $weight));$dst.SetPixel($x,$Height-1-$y,(Blend-EdgePixel $b $a $weight))
    }
  }
}
$dst.Save($Destination,[System.Drawing.Imaging.ImageFormat]::Png)
$alpha0=0
for($y=0;$y -lt $Height;$y+=8){for($x=0;$x -lt $Width;$x+=8){if($dst.GetPixel($x,$y).A -eq 0){$alpha0++}}}
$dst.Dispose();$src.Dispose()
Write-Output "$Destination ${Width}x${Height} transparent_samples=$alpha0"
