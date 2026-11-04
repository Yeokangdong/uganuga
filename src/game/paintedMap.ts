import { art, image } from './art'
import { terrainTheme } from './terrainThemes'
import { SCALE } from './constants'
import { STAGES } from './stages'

/** Opt-in source-edge audit. Production builds never install the hook. */
export const terrainDrawAudit = {
  stage: 0,
  cameraX: 0,
  cameraY: 0,
  records: [] as {image:string; side:string; stage:number; x:number; y:number}[],
  enable(): () => void {
    if (!import.meta.env.DEV) return () => {}
    const prototype=CanvasRenderingContext2D.prototype, original=prototype.drawImage
    const cache=new WeakMap<object,ImageData>()
    const audit=this
    prototype.drawImage=function(this:CanvasRenderingContext2D,...args:unknown[]) {
      const im=args[0] as HTMLImageElement
      if(args.length===9 && im instanceof HTMLImageElement){
        const [sx,sy,sw,sh,dx,dy]=args.slice(1) as number[]
        const width=im.naturalWidth,height=im.naturalHeight
        if(sx!==0||sy!==0||sw!==width||sh!==height){
          let pixels=cache.get(im)
          if(!pixels){
            const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
            const g=canvas.getContext('2d')!;(original as (...args:unknown[])=>void).call(g,im,0,0)
            pixels=g.getImageData(0,0,width,height);cache.set(im,pixels)
          }
          const opaque=(x:number,y:number)=>x>=0&&x<width&&y>=0&&y<height&&pixels!.data[(y*width+x)*4+3]!>0
          const l=Math.max(0,Math.floor(sx)),r=Math.min(width-1,Math.ceil(sx+sw)-1)
          const t=Math.max(0,Math.floor(sy)),b=Math.min(height-1,Math.ceil(sy+sh)-1)
          const sides:string[]=[]
          for(const [side,col] of [['left',l],['right',r]] as const){
            if(side==='left'?sx<=0:sx+sw>=width)continue
            for(let y=t;y<=b;y++)if(opaque(col,y)){sides.push(side);break}
          }
          for(const [side,row] of [['top',t],['bottom',b]] as const){
            if(side==='top'?sy<=0:sy+sh>=height)continue
            for(let x=l;x<=r;x++)if(opaque(x,row)){sides.push(side);break}
          }
          const name=Object.keys(art.images).find(key=>art.images[key]===im)
            ??Object.keys(art.sprites).find(key=>art.sprites[key]?.img===im)??im.src
          const matrix=this.getTransform(),point=matrix.transformPoint({x:dx,y:dy})
          for(const side of sides)audit.records.push({image:name,side,stage:audit.stage,x:point.x/SCALE+audit.cameraX,y:point.y/SCALE+audit.cameraY})
        }
      }
      return (original as (...args:unknown[])=>void).apply(this,args)
    } as typeof original
    return ()=>{prototype.drawImage=original}
  },
}

const part=(stage:number,name:string)=>{
  const local=image(`terrain.${stage}.${name}`)
  if(local)return local
  const n=[2,16].includes(stage)?1:[3,15].includes(stage)?2:0
  const legacy:Record<string,string>={fill:'rock',surface:'surface',ladder:'ladder'}
  if(legacy[name])return image(`world.${legacy[name]}${n}`)
  if(name==='support'&&terrainTheme(stage).organic)return image('world.rootedTree')
  return undefined
}

export type ElevatedObject='local'|'vine'|'stone'|'basalt'|'ice'|'ruin'|'mushroom'|'bone'|'coral'|'crystal'
const upperObjects:ElevatedObject[][]=[
  ['local','local','local'],['basalt','bone','local'],['ice','local','bone'],
  ['stone','bone','local'],['local','vine','local'],['local','vine','ruin'],
  ['stone','bone','local'],['crystal','ruin','local'],['stone','vine','coral'],
  ['local','local','local'],['ruin','stone','local'],['stone','ruin','crystal'],
  ['stone','vine','local'],['local','vine','local'],['local','local','local'],
  ['basalt','bone','local'],['coral','ruin','local'],['local','crystal','ruin'],
  ['stone','ruin','bone'],['vine','local','ruin'],
]
export function elevatedObject(stage:number,col:number):ElevatedObject {
  // Main-route biomes use their own scenery and matching ledge material.
  if(stage>=1&&stage<=15)return 'local'
  const choices=upperObjects[stage-1]??upperObjects[0]!
  return choices[Math.floor(col/48)%choices.length]!
}

/** Preserve the crown and roots; repeat the trunk to reach tall ledges. */
export function terrainSupport(g:CanvasRenderingContext2D,x:number,top:number,bottom:number,stage:number,left:number,right:number,object:ElevatedObject='local'):void {
  if(stage===10||object!=='local'&&image('world.elevated.'+object))return
  const im=part(stage,'support'),theme=terrainTheme(stage)
  if(!im||bottom<=top||right<=left||theme.floating)return
  const available=bottom-top+6
  if(stage===1){
    // Tall routes use slender climb vines and the spaced whole jungle trees.
    // Short supports keep ONE complete tree, never a stack of cropped crowns.
    if(available>96)return
    const height=available,width=height*im.width/im.height
    g.drawImage(im,x-width/2,top,width,height)
    return
  }
  const limit=theme.organic?132:theme.structure==='snow'||theme.structure==='ice'?right-left:48
  const scale=Math.min(available/im.height,Math.min(limit,right-left)/im.width)
  const w=im.width*scale,h=im.height*scale
  const center=Math.max(left+w/2,Math.min(right-w/2,x))
  const drawX=center-w/2
  // Snow and ice keep their complete authored proportions (DECISIONS).
  if(h>=available||theme.structure==='snow'||theme.structure==='ice'){
    g.drawImage(im,drawX,bottom+6-h,w,h)
    return
  }
  const crownSource=im.height*.45,rootSource=im.height*.35
  const trunkSource=im.height-crownSource-rootSource
  const crown=crownSource*scale,root=rootSource*scale,trunk=trunkSource*scale
  g.drawImage(im,0,0,im.width,crownSource,drawX,top,w,crown)
  const rootTop=bottom+6-root
  for(let y=top+crown;y<rootTop;y+=trunk){
    const height=Math.min(trunk,rootTop-y)
    g.drawImage(im,0,crownSource,im.width,height/scale,drawX,y,w,height)
  }
  g.drawImage(im,0,im.height-rootSource,im.width,rootSource,drawX,rootTop,w,root)
}

/** An existing whole tree makes the short root obstacle read as jungle, not masonry. */
export function firstJungleTrunk(g:CanvasRenderingContext2D):void {
  const im=part(1,'support');if(!im)return
  const map=STAGES[0]!.map
  // Whole trees at spaced branch junctions; never stamp every climb route.
  for(const [x,width] of [[408,160],[1240,148],[2168,172],[3096,150],[4024,164],[4952,152],[5880,166]]){
    const col=Math.floor(x!/16);let row=map.length-1
    if(map[row]?.[col]!=='#')continue
    while(row>0&&map[row-1]?.[col]==='#')row--
    const height=im.height*width!/im.width
    g.drawImage(im,x!-width!/2,row*16-height,width!,height)
  }
}

const platformTopCache = new WeakMap<HTMLImageElement, number>()
/** Ignore sparse leaves above the continuous walking rim, not just empty rows. */
function platformTop(im:HTMLImageElement):number {
  const cached=platformTopCache.get(im);if(cached!==undefined)return cached
  const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height
  const g=cv.getContext('2d',{willReadFrequently:true})!
  g.drawImage(im,0,0)
  const pixels=g.getImageData(0,0,im.width,im.height).data,tops:number[]=[]
  for(let x=Math.floor(im.width/8);x<im.width*7/8;x++){
    for(let y=0;y<im.height;y++)if(pixels[(y*im.width+x)*4+3]!>128){tops.push(y);break}
  }
  tops.sort((a,b)=>a-b)
  const top=tops[Math.floor(tops.length/2)]??0
  platformTopCache.set(im,top);return top
}

/** The painted walking rim shares the one-way collision top; foliage is decoration. */
export function terrainDeck(g:CanvasRenderingContext2D,x:number,y:number,stage:number,width:number,object:ElevatedObject='local',bottom?:number):void {
  const objectArt=object==='local'?undefined:image('world.elevated.'+object)
  if(objectArt){
    // Fit the entire silhouette; no crown, root or side is clipped to a tile.
    const height=Math.max(1,(bottom??y+80)-y+6)
    const scale=Math.min(width/objectArt.width,height/objectArt.height)
    g.drawImage(objectArt,x+(width-objectArt.width*scale)/2,y,objectArt.width*scale,objectArt.height*scale)
    terrainDeck(g,x,y,stage,width,'local')
    return
  }
  const im=part(stage,'platform')
  if(!im){
    const material=terrainTheme(stage)
    g.save();g.fillStyle=material.base;g.strokeStyle=material.edge;g.lineWidth=1.2
    g.beginPath();g.moveTo(x,y);g.lineTo(x+width,y);g.lineTo(x+width-2,y+6);g.quadraticCurveTo(x+width/2,y+11,x+2,y+6);g.closePath();g.fill()
    g.beginPath();g.moveTo(x+1,y+.6);g.lineTo(x+width-1,y+.6);g.stroke();g.restore();return
  }
  // Preserve the ledge thickness and its two end caps. Repeat only its middle,
  // otherwise a long platform becomes a row of disconnected miniature ledges.
  const unit=stage===15?44:64
  const depth=im.height*unit/im.width,edge=Math.min(8,width/2)
  const drawY=y-platformTop(im)*unit/im.width
  const sourceEdge=im.width/8
  g.drawImage(im,0,0,sourceEdge,im.height,x,drawY,edge,depth)
  for(let offset=edge;offset<width-edge;offset+=48){
    const w=Math.min(48,width-edge-offset)
    g.drawImage(im,sourceEdge,0,im.width-2*sourceEdge,im.height,x+offset,drawY,w,depth)
  }
  g.drawImage(im,im.width-sourceEdge,0,sourceEdge,im.height,x+width-edge,drawY,edge,depth)
}

export function rockPattern(g:CanvasRenderingContext2D,stage:number,size=64):CanvasPattern {
  const jungle=stage===1&&size===64?[1,2,3,4].map(n=>image('jungle.ground.'+n)):[]
  if(jungle.length&&jungle.every(Boolean)){
    const sequence=[0,1,3,2,1,0,2,3],band=size*1.5,fade=size*.18,height=size*2
    const quality=4,cv=document.createElement('canvas');cv.width=band*sequence.length*quality;cv.height=height*quality
    const c=cv.getContext('2d')!;c.scale(quality,quality);c.fillStyle='#79502f';c.fillRect(0,0,cv.width/quality,height)
    for(let i=-1;i<=sequence.length;i++){
      const width=band+fade*2,layer=document.createElement('canvas');layer.width=Math.ceil(width*quality);layer.height=height*quality
      const l=layer.getContext('2d')!,im=jungle[sequence[(i+sequence.length)%sequence.length]!]!
      l.scale(quality,quality);l.drawImage(im,0,0,width,height)
      l.globalCompositeOperation='destination-in'
      const mask=l.createLinearGradient(0,0,width,0)
      mask.addColorStop(0,'transparent');mask.addColorStop(fade*2/width,'#000')
      mask.addColorStop(1-fade*2/width,'#000');mask.addColorStop(1,'transparent')
      l.fillStyle=mask;l.fillRect(0,0,width,height)
      c.drawImage(layer,i*band-fade,0,width,height)
    }
    const mixed=g.createPattern(cv,'repeat')!;mixed.setTransform(new DOMMatrix().scale(1/quality));return mixed
  }
  const im=(stage===0?image('world.rock1'):part(stage,'fill'))??image('world.rock1')
  if(!im)throw new Error('Missing terrain material for stage '+stage)
  const pattern=g.createPattern(im,'repeat')!
  pattern.setTransform(new DOMMatrix().scale(size/im.width,size/im.height))
  return pattern
}

export function surface(g:CanvasRenderingContext2D,stage:number,x:number,y:number,_col:number):void {
  const im=part(stage,'surface')
  if(!im)return
  // Keep the new soil faces under the same visible grass walking line.
  const top=stage===1?platformTop(im)*9/im.height:0
  // Each exposed tile owns a complete silhouette, including isolated ledges.
  g.drawImage(im,x,y-top,16,9)
}

export function ladder(g:CanvasRenderingContext2D,stage:number,x:number,top:number,end:number):void {
  const span=end-top
  if(stage===1){
    const vine=image('traversal.vine');if(!vine||span<=0)return
    // Slender climbing vine, not repeated complete tree crowns and roots.
    const count=Math.max(1,Math.ceil(span/96)),height=span/count,width=height*vine.width/vine.height
    for(let i=0;i<count;i++)g.drawImage(vine,x-width/2,top+i*height,width,height)
    return
  }
  const im=part(stage,'ladder')
  if(!im)return
  const width=12
  if(span<=0)return
  // Fit complete authored sections, including both ends. Uniform scaling keeps
  // their proportions and avoids cutting a rung at the final partial section.
  const count=Math.max(1,Math.ceil(span/(im.height*width/im.width)))
  const height=span/count,sectionWidth=im.width*height/im.height
  for(let i=0;i<count;i++){
    g.drawImage(im,x-sectionWidth/2,top+i*height,sectionWidth,height)
  }
}
