import {image} from './art'

// The slab is placed differently in each complete, painted dolmen.
const slabCenters=[.35,.35,.35,.35,.35,.36,.38,.44,.40,.40,.40,.39,.41,.39,.43,.37,.43,.43,.37,.43]
const engravings=new Map<number,HTMLCanvasElement>()

function engraving(stage:number):HTMLCanvasElement {
  const cached=engravings.get(stage)
  if(cached)return cached
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96
  const g=canvas.getContext('2d')!
  g.font='bold 78px Georgia, serif';g.textAlign='center';g.textBaseline='middle'
  const text=`STAGE ${stage}`,dark=[2,10,12,16,19].includes(stage)
  // Lower lip catches light; the upper cut and recessed face remain dark.
  g.fillStyle=dark?'#cab78c':'#f1dcb3';g.fillText(text,256,53,478)
  g.fillStyle=dark?'#151419':'#3b3026';g.fillText(text,256,48,478)
  g.fillStyle=dark?'#a39379':'#65543f';g.fillText(text,256,50,478)
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
  g.drawImage(engraving(stage),x+(width-textWidth)/2,y+height*(slabCenters[stage-1]??.4)-textHeight/2,textWidth,textHeight)
  return true
}
