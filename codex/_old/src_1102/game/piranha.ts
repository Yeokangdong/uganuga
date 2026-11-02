import { drawArt, frameAt, progressFrame } from './art'
import { Enemy } from './entities'
import type { Game } from './game'

/** A readable water hazard: ripple, leap, submerge, then rest. */
export class Piranha extends Enemy {
  state:'waiting'|'warning'|'air'|'stunned'='waiting'
  private timer=.7
  private airTime=0
  private readonly center:number
  private readonly drift:number
  constructor(left:number,right:number,public readonly waterY:number){
    super({cls:'melee',key:'piranha',hp:2,score:150,speed:0,w:14,h:12},left,waterY)
    this.w=16;this.h=12;this.center=(left+right)/2
    this.drift=Math.min(6,Math.max(0,(right-left-this.w)/2-1))
    this.hide()
  }
  private hide():void {
    this.state='waiting';this.x=this.center-this.w/2;this.y=this.waterY+2
    this.vx=0;this.vy=0;this.invulnerable=true;this.contactDmg=0
  }
  update(g:Game,dt:number):void {
    if(this.dead)return
    this.anim+=dt;this.flash=Math.max(0,this.flash-dt)
    if(this.stunT>0){
      this.state='stunned';this.contactDmg=0
      this.vy+=270*dt;this.y=Math.min(this.waterY-this.h,this.y+this.vy*dt)
      return
    }
    if(this.state==='stunned'){this.hide();this.timer=1.6;return}
    if(this.state==='waiting'){
      this.timer=Math.max(0,this.timer-dt)
      const target=g.players.find(p=>p.alive&&Math.abs(p.cx-this.center)<90&&Math.abs(p.y+p.h-this.waterY)<80)
      if(this.timer===0&&target){this.facing=target.cx<this.center?-1:1;this.state='warning';this.timer=.45}
      return
    }
    if(this.state==='warning'){
      this.timer-=dt
      if(this.timer<=0){
        this.state='air';this.airTime=0;this.vy=-170;this.invulnerable=false;this.contactDmg=1
        g.splash(this.center,this.waterY)
      }
      return
    }
    this.airTime+=dt;this.vy+=270*dt;this.y+=this.vy*dt
    this.x=this.center-this.w/2+this.facing*Math.sin(Math.min(1,this.airTime/1.26)*Math.PI)*this.drift
    if(this.airTime>.2&&this.y>=this.waterY+2){
      g.splash(this.center,this.waterY);this.hide();this.timer=1.7
    }
  }
  draw(g:CanvasRenderingContext2D,cx:number,cy:number):void {
    if(this.dead||this.state==='waiting')return
    if(this.state==='warning'){
      const phase=1-Math.max(0,this.timer)/.45
      g.save();g.strokeStyle='#e2f8ef';g.globalAlpha=.4+phase*.5;g.lineWidth=.7
      for(let i=0;i<2;i++){g.beginPath();g.ellipse(this.center-cx,this.waterY-cy+1,3+phase*7+i*3,1+phase,0,0,Math.PI*2);g.stroke()}
      g.restore();return
    }
    const key=this.state==='stunned'?'piranha.stun':this.vy<0?'piranha.jump':'piranha.fall'
    const frame=this.state==='stunned'?frameAt(key,this.anim):progressFrame(key,this.vy<0?1+this.vy/170:Math.min(1,this.vy/170))
    g.save();g.beginPath();g.rect(this.center-40-cx,-10000,80,this.waterY-cy+10002);g.clip()
    drawArt(g,key,frame,this.cx-cx,this.y+this.h-cy,this.facing<0,{white:this.flash>0})
    g.restore()
  }
}
