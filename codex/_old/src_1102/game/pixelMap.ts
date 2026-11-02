/** Native-resolution map art. Integer pixel clusters, shared by every stage. */
function canvas(w:number,h:number):HTMLCanvasElement {
  const c=document.createElement('canvas');c.width=w;c.height=h;return c
}
const palettes=[
  ['#44362c','#604632','#79563a','#946b46','#b28a58'],
  ['#211f30','#353044','#484052','#625064','#806276'],
  ['#344d68','#486d89','#6493ac','#8dbacb','#c3e1e8'],
  ['#211c28','#352b36','#4c3a42','#614b50','#80605b'],
]
export function pixelRockTexture(theme:number,cave=false):HTMLCanvasElement {
  const c=canvas(128,128),g=c.getContext('2d')!,p=palettes[cave?3:theme]!
  let seed=193+theme*71
  const rnd=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
  g.fillStyle=p[0]!;g.fillRect(0,0,128,128)
  for(let y=-12;y<128;){
    const h=9+rnd(8);let x=-24+rnd(20)
    while(x<128){
      const w=12+rnd(16),color=p[1+rnd(3)]!
      g.fillStyle=color;g.fillRect(x+2,y+1,w-4,h-1);g.fillRect(x+1,y+3,w-2,h-5)
      g.fillStyle=p[4]!;g.fillRect(x+3,y+1,w-7,1)
      g.fillStyle=p[0]!;g.fillRect(x+3,y+h-2,w-6,1)
      if(rnd(3)===0){g.fillStyle=p[2]!;g.fillRect(x+w-5,y+4,2,2)}
      x+=w
    }
    y+=h
  }
  return c
}

export function pixelSurface(g:CanvasRenderingContext2D,theme:number,x:number,y:number,col:number):void {
  const colors=theme===0?['#304e24','#4c7a30','#79a63c','#b2c65a']:theme===1?['#4e2937','#824238','#c56835','#efa450']:['#659cb7','#a6d0dd','#e1f0ec','#fff7db']
  const fill=(color:string,dx:number,dy:number,w:number,h:number)=>{g.fillStyle=color;g.fillRect(x+dx,y+dy,w,h)}
  fill(colors[0]!,0,0,16,5);fill(colors[1]!,0,0,16,3);fill(colors[2]!,0,0,16,1)
  for(let i=0;i<4;i++){
    const dx=(col*11+i*5)%16,drop=2+(col*3+i*7)%3
    fill(colors[1]!,dx,2,Math.min(2,16-dx),drop)
    if(theme===0)fill(colors[3]!,dx,0,1,1)
    if(theme===2)fill(colors[2]!,dx,2,Math.min(3,16-dx),drop-1)
  }
}

export function pixelProp(name:string):HTMLCanvasElement {
  const sizes:Record<string,[number,number]>={log:[24,8],spikes:[32,17],door:[64,40],flag:[24,42]}
  const [w,h]=sizes[name]!,c=canvas(w,h),g=c.getContext('2d')!
  const r=(color:string,x:number,y:number,w:number,h:number)=>{g.fillStyle=color;g.fillRect(x,y,w,h)}
  if(name==='log'){
    r('#39291f',0,1,24,7);r('#8e5b37',1,1,22,5);r('#c28a4a',2,1,20,1);r('#583b29',3,4,14,1);r('#d6a15c',0,2,2,4);r('#67422e',21,2,2,4)
  }else if(name==='spikes'){
    r('#403b45',0,14,32,3)
    for(let x=0;x<32;x+=8)for(let y=0;y<14;y++){
      const half=Math.floor(y/4);r('#3f4b59',x+3-half,y,2+half*2,1);r('#c6d8d2',x+3-half,y,1+half,1)
    }
  }else if(name==='flag'){
    r('#392c25',4,0,3,42);r('#b08a54',4,1,1,39);r('#edbd62',3,0,5,3)
    r('#713b32',7,4,16,17);r('#d57345',7,4,14,14);r('#efac58',8,5,11,2);r('#d57345',7,18,11,4)
    r('#f6dda2',12,8,4,5);r('#f6dda2',11,9,6,3)
  }else{
    // A natural outcrop rooted in the floor, rather than a free-standing doorway.
    g.save();g.beginPath()
    const edge=[[0,40],[0,33],[4,33],[4,25],[8,25],[8,16],[14,16],[14,9],[22,9],[22,4],[29,4],[29,1],[37,1],[37,5],[44,5],[44,11],[51,11],[51,19],[57,19],[57,28],[61,28],[61,35],[64,35],[64,40]]
    edge.forEach(([x,y],i)=>i?g.lineTo(x!,y!):g.moveTo(x!,y!));g.closePath();g.clip()
    g.fillStyle=g.createPattern(pixelRockTexture(0),'repeat')!;g.fillRect(0,0,64,40)
    for(let x=0;x<64;x++){
      const y=x<4?33:x<8?25:x<14?16:x<22?9:x<29?4:x<37?1:x<44?5:x<51?11:x<57?19:x<61?28:35
      r('#4c7a30',x,y,1,2);if(x%3!==0)r('#79a63c',x,y,1,1)
    }
    r('#30291f',19,18,26,22);r('#30291f',23,13,18,8)
    r('#111719',23,20,18,20);r('#111719',26,16,12,6)
    r('#1d2422',24,22,3,18);r('#171d1c',27,19,2,21)
    r('#302d22',19,39,26,1);r('#4c7a30',6,38,11,2);r('#4c7a30',47,38,12,2)
    g.restore()
  }
  return c
}

export function pixelFire(tall=false):HTMLCanvasElement {
  const h=tall?30:14,w=14,c=canvas(w*4,h),g=c.getContext('2d')!
  for(let frame=0;frame<4;frame++)for(let y=0;y<h;y++){
    const t=y/(h-1),center=7+Math.round(Math.sin(y*.48+frame*1.6)*(1-t)*2)
    const half=Math.max(0,Math.round(t*5+Math.sin(y*.7+frame)*.8))
    const row=(color:string,r:number)=>{g.fillStyle=color;g.fillRect(frame*w+center-r,y,r*2+1,1)}
    row('#e94e25',half)
    if(half>0)row('#ff952f',half-1)
    if(t>.38)row('#ffdb64',Math.max(0,half-2))
    if(t>.75)row('#fff2ba',Math.max(0,half-3))
  }
  return c
}

/** A small carved stone marker; rendered into the level, never attached to a player. */
export function pixelStageSign(stage:number):HTMLCanvasElement {
  const c=canvas(34,30),g=c.getContext('2d')!
  const r=(color:string,x:number,y:number,w:number,h:number)=>{g.fillStyle=color;g.fillRect(x,y,w,h)}
  r('#302f32',3,27,28,3);r('#535254',5,25,24,4)
  r('#302f32',3,5,28,23);r('#302f32',7,1,20,5)
  r('#69686a',5,6,24,20);r('#69686a',8,3,18,5)
  r('#96918a',8,3,18,2);r('#aaa398',6,6,2,16)
  r('#7e7a75',8,6,19,17);r('#49494c',27,7,2,18)
  r('#535254',8,24,19,2);r('#b5ac9c',9,5,14,1)
  // Carved lettering uses native pixels, so it stays clear at the game scale.
  const glyphs:Record<string,string[]>={
    S:['111','100','111','001','111'],T:['111','010','010','010','010'],
    A:['010','101','111','101','101'],G:['111','100','101','101','111'],E:['111','100','110','100','111'],
    '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
    '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
    '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
    '6':['111','100','111','101','111'],'7':['111','001','010','010','010'],
    '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],
  }
  const text=(value:string,x:number,y:number,scale=1)=>{
    for(const ch of value){const rows=glyphs[ch]!;rows.forEach((row,dy)=>[...row].forEach((bit,dx)=>{
      if(bit==='1'){r('#b5ac9c',x+dx*scale,y+dy*scale+1,scale,scale);r('#343337',x+dx*scale,y+dy*scale,scale,scale)}
    }));x+=4*scale}
  }
  text('STAGE',7,7)
  const number=String(stage);text(number,Math.floor((34-(number.length*8-2))/2),14,2)
  r('#49494c',25,5,1,3);r('#49494c',24,8,1,2)
  r('#66635f',4,28,6,1);r('#96918a',26,27,4,1)
  return c
}
