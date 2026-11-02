import {image} from './art'

// The slab is placed differently in each complete, painted dolmen.
const slabCenters=[.35,.35,.35,.35,.35,.36,.38,.44,.40,.40,.40,.39,.41,.39,.43,.37,.43,.43,.37,.43]
const engravings=new Map<number,HTMLCanvasElement>()

function engraving(stage:number,stone:HTMLImageElement):HTMLCanvasElement {
  const cached=engravings.get(stage)
  if(cached)return cached
  const layer=()=>{const c=document.createElement('canvas');c.width=512;c.height=96;return c}
  const canvas=layer(),mask=layer(),face=layer(),edge=layer()
  const m=mask.getContext('2d')!
  m.font='bold 78px Georgia, serif';m.textAlign='center';m.textBaseline='middle'
  m.fillStyle='#fff';m.fillText(`STAGE ${stage}`,256,48,478)
  // Carved faces retain the actual slab's grain instead of a solid ink color.
  const f=face.getContext('2d')!,sw=stone.width*.76,sh=sw*96/512
  f.drawImage(stone,(stone.width-sw)/2,stone.height*(slabCenters[stage-1]??.4)-sh/2,sw,sh,0,0,512,96)
  f.globalCompositeOperation='multiply'
  const cut=f.createLinearGradient(0,10,0,86)
  cut.addColorStop(0,'#28231f');cut.addColorStop(.45,'#655c50');cut.addColorStop(1,'#9d8f78')
  f.fillStyle=cut;f.fillRect(0,0,512,96)
  f.globalCompositeOperation='destination-in';f.drawImage(mask,0,0)
  const g=canvas.getContext('2d')!,e=edge.getContext('2d')!
  // Only the lower OUTSIDE lip catches light. A bright full duplicate glyph
  // reads as raised lettering; a narrow rim reads as a cut into the stone.
  e.drawImage(mask,0,2);e.globalCompositeOperation='destination-out';e.drawImage(mask,0,0)
  e.globalCompositeOperation='source-in';e.fillStyle='#f1dec0';e.fillRect(0,0,512,96)
  g.globalAlpha=.7;g.drawImage(edge,0,0);g.globalAlpha=1;g.drawImage(face,0,0)
  // A narrow inner shadow at the top of each groove supplies visible depth.
  e.globalCompositeOperation='source-over';e.clearRect(0,0,512,96);e.drawImage(mask,0,0)
  e.globalCompositeOperation='destination-out';e.drawImage(mask,1,5)
  e.globalCompositeOperation='source-in';e.fillStyle='#211c18';e.fillRect(0,0,512,96)
  g.globalAlpha=.85;g.drawImage(edge,0,0);g.globalAlpha=1
  engravings.set(stage,canvas)
  return canvas
}

/** Base artwork and number are one rendering operation, including every stage. */
export function drawStageSign(g:CanvasRenderingContext2D,stage:number,x:number,floor:number,width=70):boolean {
  const sign=image(`ui.biome_sign_${stage}`)
  if(!sign)return false
  const height=width*sign.height/sign.width,y=floor-height+2
  g.drawImage(sign,x,y,width,height)
  const textWidth=width*.76,textHeight=textWidth*96/512
  g.drawImage(engraving(stage,sign),x+(width-textWidth)/2,y+height*(slabCenters[stage-1]??.4)-textHeight/2,textWidth,textHeight)
  return true
}
