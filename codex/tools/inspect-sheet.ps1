param([string]$InspectSource,[switch]$DefinitionsOnly)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class SheetBlobs {
 public class Blob { public int L,T,R,B,N; public List<int> Pixels=new List<int>(); }
 public static List<Blob> Find(Bitmap b) {
  int w=b.Width,h=b.Height; var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
  byte[] bytes=new byte[d.Stride*h]; Marshal.Copy(d.Scan0,bytes,0,bytes.Length); int stride=d.Stride; b.UnlockBits(d);
  bool[] seen=new bool[w*h]; int[] q=new int[w*h]; var result=new List<Blob>();
  for(int i=0;i<w*h;i++) {if(seen[i] || bytes[(i/w)*stride+(i%w)*4+3]<16)continue;
   Blob z=new Blob{L=w,T=h,R=0,B=0}; int head=0,tail=1;q[0]=i;seen[i]=true;
   while(head<tail){int p=q[head++],x=p%w,y=p/w;z.Pixels.Add(p);z.N++;z.L=Math.Min(z.L,x);z.R=Math.Max(z.R,x);z.T=Math.Min(z.T,y);z.B=Math.Max(z.B,y);
    for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;int n=ny*w+nx;if(!seen[n]&&bytes[ny*stride+nx*4+3]>=16){seen[n]=true;q[tail++]=n;}}
   }
   if(z.N>10)result.Add(z);
  } return result;
 }
}
'@ -ReferencedAssemblies System.Drawing
if ($DefinitionsOnly) { return }
$b=[System.Drawing.Bitmap]::FromFile($InspectSource)
[SheetBlobs]::Find($b) | ForEach-Object { '{0},{1} .. {2},{3} area={4}' -f $_.L,$_.T,$_.R,$_.B,$_.N }
$b.Dispose()

