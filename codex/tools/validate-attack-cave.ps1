$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public static class CaveCheck {public static long[] Check(Bitmap b){int w=b.Width,h=b.Height;var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);byte[] a=new byte[d.Stride*h];Marshal.Copy(d.Scan0,a,0,a.Length);int s=d.Stride;b.UnlockBits(d);long z=0,o=0,xe=0,ye=0;for(int y=0;y<h;y++)for(int x=0;x<w;x++){int v=a[y*s+x*4+3];if(v==0)z++;if(v==255)o++;}for(int y=0;y<h;y++)for(int c=0;c<4;c++)if(a[y*s+c]!=a[y*s+(w-1)*4+c])xe++;for(int x=0;x<w;x++)for(int c=0;c<4;c++)if(a[x*4+c]!=a[(h-1)*s+x*4+c])ye++;return new long[]{z,o,xe,ye};}}
"@ -ReferencedAssemblies System.Drawing
$jobs=@(
@('sheets\uga_attack_sheet.png',1536,1024,1,0,0),
@('sheets\buga_attack_sheet.png',1536,1024,1,0,0),
@('sheets\fx_sheet.png',1536,1024,1,0,0),
@('cave\entrance.png',768,768,1,0,0),
@('cave\exit.png',768,768,1,0,0),
@('cave\bg.png',3072,1024,0,1,0),
@('cave\ground.png',1024,1024,0,1,1),
@('cave\top.png',2048,512,1,1,0),
@('cave\cliff.png',1024,1024,0,1,1),
@('cave\ladder.png',256,1024,1,0,1),
@('cave\treasure.png',512,512,1,0,0),
@('cave\stalactite.png',512,512,1,0,0))
foreach($j in $jobs){
$p=Join-Path 'D:\99.Work\ugauga\art-src' $j[0]
if(!(Test-Path -LiteralPath $p)){throw "Missing $p"}
$b=[System.Drawing.Bitmap]::FromFile($p)
if($b.Width -ne $j[1] -or $b.Height -ne $j[2]){throw "Wrong size $p"}
$v=[CaveCheck]::Check($b)
if($j[3] -and ($v[0] -eq 0 -or $v[0] -eq $b.Width*$b.Height)){throw "Bad alpha $p"}
if(!$j[3] -and $v[1] -ne $b.Width*$b.Height){throw "Must be opaque $p"}
if($j[4] -and $v[2] -ne 0){throw "X edge mismatch $p $($v[2])"}
if($j[5] -and $v[3] -ne 0){throw "Y edge mismatch $p $($v[3])"}
Write-Output "$($j[0]) $($b.Width)x$($b.Height) alpha0=$($v[0]) edges=$($v[2]),$($v[3]) PASS"
$b.Dispose()
}

