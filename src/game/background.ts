import {VIEW_H,VIEW_W} from './constants'
import {image} from './art'

/** Every stage uses its own finished painting from stage-backgrounds-v1. */
export class Background {
  private stage=1
  private boss=false

  setStage(stage:number):void {this.stage=stage}
  setBoss(on:boolean):void {this.boss=on}

  draw(g:CanvasRenderingContext2D,camX:number,time:number,camY=0,groundCamY=0):void {
    const im=this.stage===17?(image('underwater.background')??image('stage.bg17')):this.stage===18?(image('sky.background')??image('stage.bg18')):image('stage.bg'+this.stage)
    g.save()
    g.imageSmoothingEnabled=true
    g.fillStyle='#84c9dd'
    g.fillRect(0,0,VIEW_W,VIEW_H)
    const jungle=this.stage===1?[1,2,3].map(n=>image('jungle.close.'+n)):[]
    if(jungle.length&&jungle.every(Boolean)){
      const section=Math.max(0,camX)/900,index=Math.floor(section),local=section-index
      const q=Math.max(0,Math.min(1,(local-.64)/.36)),blend=q*q*(3-2*q)
      const paint=(n:number,alpha:number,position=local)=>{
        const close=jungle[n%3]!,h=Math.max(VIEW_H*1.45,(VIEW_W+24)*close.height/close.width)*1.2,w=h*close.width/close.height
        const y=-(h-VIEW_H)*.5+Math.max(-6,Math.min(6,(groundCamY-camY)*.035))
        g.globalAlpha=alpha
        g.drawImage(close,(VIEW_W-w)/2-(position-.5)*12,y,w,h)
      }
      paint(index,1);if(blend>0)paint(index+1,blend,local-1)
      g.globalAlpha=1
      g.fillStyle='rgba(28,53,34,.14)';g.fillRect(0,0,VIEW_W,VIEW_H)
    }else if(im){
      const h=VIEW_H*1.18,w=Math.max(VIEW_W,h*im.width/im.height)
      const offset=Math.sin(camX/1800)*(w-VIEW_W)*.45
      // Bounded vertical parallax keeps painted skies and landmarks in view.
      const overscan=h-VIEW_H
      const y=Math.max(-overscan,Math.min(0,-overscan*.5+(groundCamY-camY)*.22))
      g.drawImage(im,(VIEW_W-w)/2-offset,y,w,h)
    }
    // Sparse decorative silhouettes stay behind all gameplay and warnings.
    g.globalAlpha=.22
    const cold=[5,6,10,14].includes(this.stage), dry=[3,7,8,11,12,15].includes(this.stage)
    g.fillStyle=cold?'#e2f4ed':dry?'#e5bd87':'#b4d77b'
    for(let i=0;i<6;i++){
      const x=((i*79+this.stage*23+time*(dry?2:4)-camX*.08)% (VIEW_W+20)+VIEW_W+20)%(VIEW_W+20)-10
      const y=48+(i*29+this.stage*7)%100+Math.sin(time*.7+i)*5
      g.beginPath();g.ellipse(x,y,cold?1:3,cold?1:1.2,Math.sin(time+i)*.5,0,Math.PI*2);g.fill()
    }
    if(!cold&&!dry){
      for(let i=0;i<2;i++){
        const x=80+i*210+Math.sin(time*.25+i)*14,y=64+i*36+Math.cos(time*.6+i)*5
        const wing=1+Math.abs(Math.sin(time*3+i))*2
        g.beginPath();g.ellipse(x-2,y,wing,1.5,-.5,0,Math.PI*2);g.ellipse(x+2,y,wing,1.5,.5,0,Math.PI*2);g.fill()
      }
    }
    g.globalAlpha=1
    if(this.boss){g.fillStyle='rgba(19,12,18,.15)';g.fillRect(0,0,VIEW_W,VIEW_H)}
    g.restore()
  }
}
