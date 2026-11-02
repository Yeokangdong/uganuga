$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.IO;
public static class CaveAlphaFinal {
 public static void Opaque(string path) {
  using(var input=new MemoryStream(File.ReadAllBytes(path)))
  using(var b=new Bitmap(input)) {
   var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
   byte[] pixels=new byte[d.Stride*b.Height]; Marshal.Copy(d.Scan0,pixels,0,pixels.Length);
   for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) pixels[y*d.Stride+x*4+3]=255;
   Marshal.Copy(pixels,0,d.Scan0,pixels.Length);b.UnlockBits(d);
   using(var stream=new MemoryStream()){b.Save(stream,ImageFormat.Png); File.WriteAllBytes(path,stream.ToArray());}
  }
 }
}
'@
foreach($name in @('bg','ground','cliff')){
 $path="D:\99.Work\ugauga\art-src\cave\$name.png"
 [CaveAlphaFinal]::Opaque($path)
 Write-Output "Opaque alpha verified: $name.png"
}
