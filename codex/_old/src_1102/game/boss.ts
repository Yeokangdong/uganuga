import type { Game } from './game'
import { CHARACTER_SCALE, GRAVITY, MAX_FALL, VIEW_W, approach, type Rect } from './constants'
import { moveBody, type Body, type Player } from './entities'
import { art, drawArt, frameAt, walkFrame } from './art'
import type { BossCfg } from './stages'

/** A large contact enemy: patrol, recoil, defeat. No attack AI or projectiles. */
export class Boss implements Body {
  w:number;h:number;hp:number;maxHp:number;name:string
  vx=0;vy=0;onGround=false;hitWall=0;walkDistance=0;facing=-1
  state:'enter'|'walk'|'stun'|'dying'='enter'
  anim=0;flash=0;t=0;dead=false
  private action=''
  private actionStart=0
  constructor(public cfg:BossCfg,public x:number,public y:number){
    this.w=cfg.w*CHARACTER_SCALE;this.h=cfg.h*CHARACTER_SCALE
    this.x+=cfg.w*(1-CHARACTER_SCALE)/2;this.y+=cfg.h*(1-CHARACTER_SCALE)
    this.maxHp=cfg.hp;this.hp=cfg.hp;this.name=cfg.name
  }
  get cx():number{return this.x+this.w/2}
  get phase2():boolean{return this.hp<=this.maxHp/2}
  get dying():boolean{return this.state==='dying'}
  get contactDmg():number{return 1}
  get hitbox():Rect{return{x:this.x+3,y:this.y+2,w:this.w-6,h:this.h-2}}
  hit(g:Game,dmg:number,by:Player|null):void {
    if(this.dying||this.state==='enter'||this.flash>0)return
    this.hp=Math.max(0,this.hp-dmg);this.flash=.24;this.t=.30
    this.state='stun';this.vx=by?(this.cx>=by.cx?1:-1)*45:0
    g.sfx.hit();g.burst(this.cx,this.y+this.h/2,'#fff2be',6)
    if(by)by.score+=10*dmg
    if(this.hp===0){
      this.state='dying';this.t=1.2;this.vx=0
      for(const p of g.players)if(p.alive)p.score+=5000
      g.popup(this.cx,this.y-8,'5000','#ffe14a');g.sfx.roar()
    }
  }
  update(g:Game,dt:number):void {
    if(this.dead)return
    this.anim+=dt;this.flash=Math.max(0,this.flash-dt);this.t=Math.max(0,this.t-dt)
    const left=g.level.arenaX+8,right=g.level.arenaX+VIEW_W-8
    if(this.dying){if(this.t===0){this.dead=true;g.burst(this.cx,this.y+20,'#ffe14a',20)}return}
    if(this.state==='enter'){this.x=right-this.w-12;this.state='walk'}
    if(this.state==='stun'){
      this.vx=approach(this.vx,0,200*dt)
      if(this.t===0)this.state='walk'
    }else{
      if(this.x<=left+1)this.facing=1
      if(this.x+this.w>=right-1)this.facing=-1
      this.vx=this.facing*(this.cfg.chargeSpeed/7)*(this.phase2?1.15:1)
    }
    this.vy=Math.min(MAX_FALL,this.vy+GRAVITY*dt);moveBody(this,g.level,dt)
    if(this.hitWall)this.facing=-this.hitWall
    this.x=Math.max(left,Math.min(right-this.w,this.x))
  }
  afterUpdate(_g:Game):void {}
  draw(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    if(this.dead)return
    const action=this.dying?'dead':this.state==='stun'?'hit':Math.abs(this.vx)>1?'walk':'idle'
    const key=this.cfg.key+'.'+action
    if(this.action!==action){this.action=action;this.actionStart=this.anim}
    const frame=action==='walk'?walkFrame(key,this.walkDistance):frameAt(key,this.anim-this.actionStart,action==='idle')
    drawArt(ctx,key,frame,this.cx-cx,this.y+this.h-cy,this.facing<0,{white:this.flash>.15})
    if(this.dying||this.state==='enter')return
    const sprite=art.sprites[this.cfg.key+'.idle'],w=64
    const x=Math.max(4,Math.min(VIEW_W-w-4,this.cx-cx-w/2))
    const y=Math.max(31,this.y+this.h-cy-(sprite?.h??this.h)-7)
    ctx.fillStyle='#211c28';ctx.fillRect(x-1,y-1,w+2,6)
    ctx.fillStyle='#7a3b36';ctx.fillRect(x,y,w,4)
    ctx.fillStyle='#e28b4c';ctx.fillRect(x,y,Math.ceil(w*this.hp/this.maxHp),4)
  }
}
