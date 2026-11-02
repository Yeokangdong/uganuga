$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class ArtCheck {
 public static long[] Inspect(Bitmap b){
  int w=b.Width,h=b.Height; var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
  byte[] a=new byte[d.Stride*h];Marshal.Copy(d.Scan0,a,0,a.Length);int s=d.Stride;b.UnlockBits(d);
  long zero=0,soft=0,opaque=0,xedge=0,yedge=0;
  for(int y=0;y<h;y++)for(int x=0;x<w;x++){int z=a[y*s+x*4+3];if(z==0)zero++;else if(z==255)opaque++;else soft++;}
  for(int y=0;y<h;y++)for(int c=0;c<4;c++)if(a[y*s+c]!=a[y*s+(w-1)*4+c])xedge++;
  for(int x=0;x<w;x++)for(int c=0;c<4;c++)if(a[x*4+c]!=a[(h-1)*s+x*4+c])yedge++;
  return new long[]{zero,soft,opaque,xedge,yedge};
 }
 public static int[] CellBounds(Bitmap b,int cols,int rows,int col,int row){
  int l=(int)Math.Round(col*b.Width/(double)cols),r=(int)Math.Round((col+1)*b.Width/(double)cols);
  int t=(int)Math.Round(row*b.Height/(double)rows),bot=(int)Math.Round((row+1)*b.Height/(double)rows);
  int minx=r,miny=bot,maxx=-1,maxy=-1;
  for(int y=t;y<bot;y++)for(int x=l;x<r;x++)if(b.GetPixel(x,y).A>16){minx=Math.Min(minx,x);miny=Math.Min(miny,y);maxx=Math.Max(maxx,x);maxy=Math.Max(maxy,y);}
  return new int[]{minx,miny,maxx,maxy};
 }
}
'@ -ReferencedAssemblies System.Drawing
$manifest=Get-Content -Raw -Encoding utf8 "$PSScriptRoot/generation-prompts.json" | ConvertFrom-Json
$report=@()
foreach($job in $manifest.jobs){
 $path=Join-Path $PSScriptRoot $job.dest
 if(!(Test-Path -LiteralPath $path)){throw "Missing $($job.dest)"}
 $b=[System.Drawing.Bitmap]::FromFile($path)
 $w=$job.w;$h=$job.h;$alpha=$job.alpha
 if($job.id -in @('uga','buga')){$w=1536;$h=1024;$alpha=$true}
 if($b.Width -ne $w -or $b.Height -ne $h){throw "Wrong dimensions $($job.dest)"}
 $v=[ArtCheck]::Inspect($b)
 if($alpha -and ($v[0] -eq 0 -or $v[2] -eq 0)){throw "Invalid alpha $($job.dest)"}
 $tileX=$job.id -in @('far','mid','near','farboss','ground','grass')
 $tileY=$job.id -eq 'ground'
 if($tileX -and $v[3] -ne 0){throw "Horizontal edge mismatch $($job.dest)"}
 if($tileY -and $v[4] -ne 0){throw "Vertical edge mismatch $($job.dest)"}
 $cells=@()
 if($job.dest.StartsWith('sheets/')){
  $cols=5;$rows=3;$counts=@(5,5,4)
  if($job.id -eq 'enemies'){$counts=@(4,5,3)}
  if($job.id -eq 'boss'){$cols=3;$counts=@(3,3,3)}
  if($job.id -eq 'items'){$rows=2;$counts=@(5,4)}
  if($job.id -eq 'props'){$rows=2;$counts=@(5,5)}
  for($row=0;$row -lt $rows;$row++){for($col=0;$col -lt $cols;$col++){
   $bounds=[ArtCheck]::CellBounds($b,$cols,$rows,$col,$row)
   $empty=$bounds[2] -lt 0
   if(($col -lt $counts[$row]) -eq $empty){throw "Incorrect occupied/empty cell $($job.dest) row=$row col=$col"}
   if(!$empty){$expected=[int][Math]::Round(($row+0.92)*1024/$rows);if([Math]::Abs($bounds[3]-$expected) -gt 3){throw "Wrong baseline $($job.dest) row=$row col=$col"}}
   $cells += [ordered]@{row=$row+1;column=$col+1;empty=$empty;bounds=$bounds}
  }}
 }
 $report += [ordered]@{file=$job.dest;width=$b.Width;height=$b.Height;alphaZeroPixels=$v[0];partialAlphaPixels=$v[1];opaquePixels=$v[2];horizontalEdgeMismatches=$v[3];verticalEdgeMismatches=$v[4];cells=$cells}
 $b.Dispose()
}
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 "$PSScriptRoot/validation.json"
Write-Output "PASS: $($report.Count) assets; dimensions, required alpha, sheet cells/baselines, repeating edges."
