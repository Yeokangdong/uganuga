import { image, terrainManifest } from './art'
import { terrainTheme } from './terrainThemes'

const part=(stage:number,name:string)=>{
  const local=image(`terrain.${stage}.${name}`)
  if(local)return local
  const n=[2,16].includes(stage)?1:[3,15].includes(stage)?2:0
  const legacy:Record<string,string>={fill:'rock',surface:'surface',ladder:'ladder'}
  if(legacy[name])return image(`world.${legacy[name]}${n}`)
  if(name==='support'&&terrainTheme(stage).organic)return image('world.rootedTree')
  return undefined
}

/** Atlas cells are cropped before assembly; 3px overlap hides filtered edges. */
export function rockWall(g:CanvasRenderingContext2D,stage:number,x:number,y:number,width:number,height:number,top=true):boolean {
  const atlas=image(`terrain11.${stage}`);if(!atlas||!terrainManifest)return false
  const variant=terrainManifest.stageVariants.find((v:any)=>v.stage===stage)
  const theme=variant?.baseTheme??['jungle','volcano','glacier'][(stage-1)%3]
  const tiles=terrainManifest.themes[theme].tiles
  g.save();g.beginPath();g.rect(x,y,width,height);g.clip()
  if(variant)g.filter=`hue-rotate(${variant.hueShiftDegrees}deg) saturate(${variant.saturation}) brightness(${variant.brightness})`
  // A continuous backing prevents transparent edge texels exposing dark seams.
  g.fillStyle=terrainTheme(stage).base;g.fillRect(x,y,width,height)
  // Stable irregular crops retain the authored rock grain without mirrored eye motifs.
  const paint=(key:string,atY:number,depth:number)=>{
    const [sx,sy,sw,sh]=tiles[key].frame
    let seed=(stage*73856093 ^ Math.round(x)*19349663 ^ Math.round(atY)*83492791)>>>0
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    for(let dy=0;dy<depth;){
      const rowH=Math.min(depth-dy,key==='side'?27+random()*21:9)
      for(let dx=0;dx<width;){
        const w=Math.min(width-dx,43+random()*57),cropW=sw*(.35+random()*.3),cropH=sh*(.22+random()*.28)
        const ox=random()*(sw-cropW),oy=random()*(sh-cropH)
        g.drawImage(atlas,sx+ox,sy+oy,cropW,cropH,x+dx,atY+dy,w+1,rowH+1)
        dx+=w
      }
      dy+=rowH
    }
  }
  paint('side',y,height)
  if(top)paint('top-middle',y,Math.min(9,height))
  g.restore();return true
}
export function rockCave(g:CanvasRenderingContext2D,stage:number,x:number,floor:number,worldCol=Math.floor(x/16)):boolean {
  const atlas=image(`terrain11.${stage}`);if(!atlas)return false
  const variant=terrainManifest.stageVariants.find((v:any)=>v.stage===stage)
  g.save()
  if(variant)g.filter=`hue-rotate(${variant.hueShiftDegrees}deg) saturate(${variant.saturation}) brightness(${variant.brightness})`
  const shape=worldCol%3
  g.translate(x,floor);g.scale([.9,1.12,1][shape]!,[1,1.16,.88][shape]!);g.translate(-x,-floor)
  // The cave is embedded in a continuous rock face, with its bottom on the entry floor.
  rockWall(g,stage,x-34,floor-53,68,53)
  g.drawImage(atlas,608,464,320,224,x-32,floor-45,64,45)
  g.fillStyle='#10121b';g.strokeStyle='#d7b883';g.lineWidth=2.5
  g.beginPath();g.moveTo(x-14,floor);g.lineTo(x-14,floor-20)
  g.bezierCurveTo(x-14,floor-43,x+14,floor-43,x+14,floor-20)
  g.lineTo(x+14,floor);g.closePath();g.fill();g.stroke()
  g.restore();return true
}

export type ElevatedObject='local'|'vine'|'stone'|'basalt'|'ice'|'ruin'|'mushroom'|'bone'|'coral'|'crystal'
const upperObjects:ElevatedObject[][]=[
  ['local','local','local'],['basalt','bone','local'],['ice','local','bone'],
  ['stone','bone','local'],['local','vine','local'],['local','vine','ruin'],
  ['stone','bone','local'],['crystal','ruin','local'],['stone','vine','coral'],
  ['mushroom','local','mushroom'],['ruin','stone','local'],['stone','ruin','crystal'],
  ['stone','vine','local'],['local','vine','local'],['ice','crystal','local'],
  ['basalt','bone','local'],['coral','ruin','local'],['local','crystal','ruin'],
  ['stone','ruin','bone'],['vine','local','ruin'],
]
export function elevatedObject(stage:number,col:number):ElevatedObject {
  if(stage<=15)return 'local'
  const choices=upperObjects[stage-1]??upperObjects[0]!
  return choices[Math.floor(col/48)%choices.length]!
}

/** The support is local scenery behind the collision geometry, clipped to its bank. */
export function terrainSupport(g:CanvasRenderingContext2D,x:number,top:number,bottom:number,stage:number,left:number,right:number,object:ElevatedObject='local'):void {
  if(stage<=15&&image(`terrain11.${stage}`))return
  const objectArt=object==='local'?undefined:image('world.elevated.'+object)
  // Complete alternate structures are drawn once by terrainDeck, including
  // their own lower supports. Never paint a second squeezed full silhouette.
  if(objectArt)return
  const im=part(stage,'support'),theme=terrainTheme(stage)
  if(!im||bottom<=top||theme.floating)return
  if(stage===1){
    // Jungle ledges grow from narrow trunks, rather than stretched whole trees
    // or repeated giant decorative arches competing with the playable path.
    const ceiling=top+14,height=Math.max(1,bottom-ceiling+6),width=Math.min(34,16+height*.14)
    g.save();g.beginPath();g.rect(left,ceiling,right-left,height);g.clip()
    g.drawImage(im,im.width*.23,im.height*.4,im.width*.56,im.height*.6,x-width/2,ceiling,width,height)
    g.restore();return
  }
  const h=Math.max(72,bottom-top+14)
  const w=theme.organic?Math.min(132,h*im.width/im.height):Math.min(48,h*im.width/im.height)
  const center=Math.max(left+w*.25,Math.min(right-w*.25,x))
  g.save()
  // The platform owns the walkable top. Scenery must stay underneath it.
  const ceiling=top+14
  const buried=6
  g.beginPath();g.rect(left,ceiling,right-left,Math.max(0,bottom-ceiling+buried));g.clip()
  g.drawImage(im,center-w/2,bottom-h+buried,w,h)
  g.restore()
}

/** Paint only below the actual one-way platform top: no fake raised landing edge. */
export function terrainDeck(g:CanvasRenderingContext2D,x:number,y:number,stage:number,width:number,object:ElevatedObject='local',bottom?:number):void {
  if(image(`terrain11.${stage}`)&&terrainManifest){
    const atlas=image(`terrain11.${stage}`)!,variant=terrainManifest.stageVariants.find((v:any)=>v.stage===stage)
    const tiles=terrainManifest.themes[variant?.baseTheme??'jungle'].tiles
    g.save();g.beginPath();g.roundRect(x,y,width,24,[0,0,10,10]);g.clip()
    rockWall(g,stage,x,y,width,24)
    const edge=Math.min(12,width/2)
    if(variant)g.filter=`hue-rotate(${variant.hueShiftDegrees}deg) saturate(${variant.saturation}) brightness(${variant.brightness})`
    for(const [key,dx]of [['top-left',x],['top-right',x+width-edge]] as const){
      const [sx,sy,sw,sh]=tiles[key].frame
      g.drawImage(atlas,sx,sy,sw,sh,dx,y,edge,24)
    }
    const [sx,sy,sw,sh]=tiles.side.frame
    g.globalAlpha=.65;g.drawImage(atlas,sx+sw*.15,sy+sh*.65,sw*.7,sh*.25,x+edge,y+17,Math.max(1,width-edge*2),7)
    g.restore();return
  }
  const objectArt=object==='local'?undefined:image('world.elevated.'+object)
  if(objectArt){
    // Keep the authored crown's proportions. Only the lower stem/pillars extend
    // to the ground; drawing a second complete object made overlapping caps.
    const sourceTop=objectArt.height*.28
    const depth=sourceTop*width/objectArt.width
    g.drawImage(objectArt,0,0,objectArt.width,sourceTop,x,y,width,depth)
    if(bottom!==undefined&&bottom>y+depth){
      g.drawImage(objectArt,0,sourceTop,objectArt.width,objectArt.height-sourceTop,
        x,y+depth,width,bottom-y-depth+6)
    }
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
  const unit=64
  const depth=im.height*unit/im.width,edge=Math.min(8,width/2)
  const sourceEdge=im.width/8
  g.drawImage(im,0,0,sourceEdge,im.height,x,y,edge,depth)
  for(let offset=edge;offset<width-edge;offset+=48){
    const w=Math.min(48,width-edge-offset)
    g.drawImage(im,sourceEdge,0,im.width*w/unit,im.height,x+offset,y,w,depth)
  }
  g.drawImage(im,im.width-sourceEdge,0,sourceEdge,im.height,x+width-edge,y,edge,depth)
}

export function rockPattern(g:CanvasRenderingContext2D,stage:number,size=64):CanvasPattern {
  const im=(stage===0?image('world.rock1'):part(stage,'fill'))??image('world.rock1')
  if(!im)throw new Error('Missing terrain material for stage '+stage)
  const pattern=g.createPattern(im,'repeat')!
  pattern.setTransform(new DOMMatrix().scale(size/im.width,size/im.height))
  return pattern
}

export function surface(g:CanvasRenderingContext2D,stage:number,x:number,y:number,col:number):void {
  const im=part(stage,'surface')
  if(!im)return
  const section=im.width/4
  g.drawImage(im,(col%4)*section,0,section,im.height,x,y,16,9)
}

export function ladder(g:CanvasRenderingContext2D,stage:number,x:number,top:number,end:number):void {
  const atlas=image(`terrain11.${stage}`)
  if(atlas){
    const variant=terrainManifest.stageVariants.find((v:any)=>v.stage===stage)
    const tiles=terrainManifest.themes[variant?.baseTheme??'jungle'].tiles
    const [sx,sy,sw,sh]=tiles.ladder.frame,width=14,unit=sh*width/sw
    g.save()
    for(let y=top;y<end;y+=unit){const h=Math.min(unit,end-y);g.drawImage(atlas,sx,sy,sw,sh*h/unit,x-width/2,y,width,h)}
    g.restore();return
  }
  const im=part(stage,'ladder')
  if(!im)return
  const width=12,span=end-top
  if(span<=0)return
  const scale=width/im.width,capSource=im.height*.12
  const cap=Math.min(capSource*scale,span/2)
  g.drawImage(im,0,0,im.width,capSource,x-width/2,top,width,cap)
  // Repeat the shaft at its original aspect ratio so rung spacing stays fixed.
  const sourceBody=im.height-2*capSource,body=sourceBody*scale
  for(let y=top+cap;y<end-cap;y+=body){
    const h=Math.min(body,end-cap-y)
    g.drawImage(im,0,capSource,im.width,h/scale,x-width/2,y,width,h)
  }
  g.drawImage(im,0,im.height-capSource,im.width,capSource,x-width/2,end-cap,width,cap)
}
