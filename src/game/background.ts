import {VIEW_H,VIEW_W} from './constants'
import {image} from './art'

/** Every stage uses its own finished painting from stage-backgrounds-v1. */
export class Background {
  private stage=1
  private boss=false

  setStage(stage:number):void {this.stage=stage}
  setBoss(on:boolean):void {this.boss=on}

  draw(g:CanvasRenderingContext2D,camX:number,_time:number,camY=0,groundCamY=0):void {
    const im=this.stage===17?(image('underwater.background')??image('stage.bg17')):this.stage===18?(image('sky.background')??image('stage.bg18')):image('stage.bg'+this.stage)
    g.save()
    g.imageSmoothingEnabled=true
    g.fillStyle='#84c9dd'
    g.fillRect(0,0,VIEW_W,VIEW_H)
    if(im){
      const h=VIEW_H*1.18,w=Math.max(VIEW_W,h*im.width/im.height)
      const offset=Math.sin(camX/1800)*(w-VIEW_W)*.45
      // Bounded vertical parallax keeps painted skies and landmarks in view.
      const overscan=h-VIEW_H
      const y=Math.max(-overscan,Math.min(0,-overscan*.5+(groundCamY-camY)*.22))
      g.drawImage(im,(VIEW_W-w)/2-offset,y,w,h)
    }
    if(this.boss){g.fillStyle='rgba(19,12,18,.15)';g.fillRect(0,0,VIEW_W,VIEW_H)}
    g.restore()
  }
}
