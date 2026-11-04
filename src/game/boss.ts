import type { Game } from './game'
import { CHARACTER_SCALE, GRAVITY, MAX_FALL, VIEW_W, approach, type Rect } from './constants'
import { moveBody, type Body, type Player } from './entities'
import { art, drawArt, frameAt, walkFrame, type FrameSet } from './art'
import type { BossCfg } from './stages'

const headRows=new WeakMap<FrameSet,Map<number,number>>()
function headHeight(sprite:FrameSet,index:number):number {
  let rows=headRows.get(sprite);if(!rows){rows=new Map();headRows.set(sprite,rows)}
  const cached=rows.get(index);if(cached!==undefined)return cached
  const f=sprite.frames[index]!,[x,y,w,h]=f
  const cv=document.createElement('canvas');cv.width=w!;cv.height=h!
  const ctx=cv.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(sprite.img,x!,y!,w!,h!,0,0,w!,h!)
  const data=ctx.getImageData(0,0,w!,h!).data;let top=0,found=false
  for(let row=0;row<h!&&!found;row++)for(let col=0;col<w!;col++)if(data[(row*w!+col)*4+3]!>32){top=row;found=true;break}
  const height=((f[5]??sprite.ay)-top/h!)*(sprite.ppu?h!*sprite.ppu:sprite.h)
  rows.set(index,height);return height
}

/** Regional bosses retain contact patrol; the final King Kong has telegraphed attacks. */
export class Boss implements Body {
  w:number;h:number;hp:number;maxHp:number;name:string
  vx=0;vy=0;onGround=false;hitWall=0;walkDistance=0;facing=-1
  state:'enter'|'walk'|'stun'|'dying'|'warn'|'pound'|'charge'|'slam'='enter'
  anim=0;flash=0;t=0;dead=false
  pattern:'pound'|'charge'|'slam'='pound'
  private cycle=0
  private targetX=0
  private waves:{x:number,y:number,dir:number,life:number}[]=[]
  get kingkong():boolean{return this.cfg.key==='kingkong'}
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
  get contactDmg():number{return this.kingkong&& !['charge','slam'].includes(this.state)?0:1}
  get hitbox():Rect{
    // The knuckle-running charge stays below the player's jump apex.
    const h=this.kingkong&&this.state==='charge'?30:this.h-2
    return{x:this.x+3,y:this.y+this.h-h,w:this.w-6,h}
  }
  hit(g:Game,dmg:number,by:Player|null):void {
    if(this.dying||this.state==='enter'||this.flash>0||this.kingkong&&this.state!=='stun')return
    this.hp=Math.max(0,this.hp-dmg);this.flash=.24;if(!this.kingkong)this.t=.30
    this.state='stun';if(this.kingkong){this.vx=0}else this.vx=by?(this.cx>=by.cx?1:-1)*45:0
    g.sfx.hit();g.burst(this.cx,this.y+this.h/2,'#fff2be',6)
    if(by)by.score+=10*dmg
    if(this.hp===0){
      this.state='dying';this.t=1.2;this.vx=0;this.waves=[]
      for(const p of g.players)if(p.alive)p.score+=5000
      g.sfx.roar()
    }
  }
  update(g:Game,dt:number):void {
    if(this.dead)return
    this.anim+=dt;this.flash=Math.max(0,this.flash-dt);this.t=Math.max(0,this.t-dt)
    const left=g.level.arenaX+8,right=g.level.arenaX+VIEW_W-8
    if(this.dying){if(this.t===0){this.dead=true;g.burst(this.cx,this.y+20,'#ffe14a',20)}return}
    if(this.kingkong){this.updateKingkong(g,dt,left,right);return}
    if(this.state==='enter')this.state='walk'
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
  private updateKingkong(g:Game,dt:number,left:number,right:number):void {
    const player=g.players.find(p=>p.alive)
    // A warning starts only after both actors are visible and safely grounded.
    if(this.state==='enter'){this.state='stun';this.t=1.8}
    for(const wave of this.waves){
      wave.x+=wave.dir*(this.phase2?125:100)*dt;wave.life-=dt
      for(const p of g.players)if(p.alive&&Math.abs(p.cx-wave.x)<p.w/2+7&&p.y+p.h>wave.y-10&&p.y<wave.y+4)p.hurt(g,1,wave.x)
    }
    this.waves=this.waves.filter(w=>w.life>0&&w.x>left&&w.x<right)
    if(this.state==='stun'){
      this.vx=0
      if(this.t===0&&player&&player.onGround&&!player.climbing&&player.invuln<1&&this.waves.length===0
        &&this.x>=g.camX+4&&this.x+this.w<=g.camX+VIEW_W-4){
        this.pattern=(['pound','charge','slam'] as const)[this.cycle++%3]!
        this.state='warn';this.t=this.phase2?1.1:1.5
        this.facing=player.cx<this.cx?-1:1
        this.targetX=Math.max(left+this.w/2+8,Math.min(right-this.w/2-8,player.cx))
      }
    }else if(this.state==='warn'){
      this.vx=0
      if(this.t===0){
        this.state=this.pattern;this.t=this.pattern==='pound'?.5:2.5
        if(this.pattern==='charge')this.vx=this.facing*this.cfg.chargeSpeed*(this.phase2?1.15:1)
        if(this.pattern==='slam'){this.vy=-300;this.vx=(this.targetX-this.cx)/.5}
        if(this.pattern==='pound'){
          this.waves=[-1,1].map(dir=>({x:this.cx+dir*this.w/2,y:this.y+this.h,dir,life:3.8}))
          g.sfx.roar();g.shake(.16,1)
        }
      }
    }else if(this.state==='pound'&&this.t===0){this.state='stun';this.t=2.2}
    this.vy=Math.min(MAX_FALL,this.vy+GRAVITY*dt);moveBody(this,g.level,dt)
    const wall=this.hitWall||this.x<=left||this.x+this.w>=right
    this.x=Math.max(left,Math.min(right-this.w,this.x))
    if(this.state==='charge'&&(wall||this.t===0)){
      this.state='stun';this.t=this.phase2?2.4:3;this.vx=0;g.shake(.18,1.3)
    }
    if(this.state==='slam'&&this.onGround){
      this.vx=0;this.state='stun';this.t=2.6;g.shake(.2,1.4)
      for(const p of g.players)if(p.alive&&Math.abs(p.cx-this.cx)<this.w/2+24&&p.onGround)p.hurt(g,1,this.cx)
    }
  }
  afterUpdate(_g:Game):void {}
  draw(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    if(this.dead)return
    const action=this.kingkong?(this.dying?'defeat':this.state==='stun'?'dizzy':this.state==='warn'?this.pattern:this.state==='enter'?'dizzy':this.state):this.dying?'dead':this.state==='stun'?'hit':Math.abs(this.vx)>1?'walk':'idle'
    const key=this.cfg.key+'.'+action
    if(this.action!==action){this.action=action;this.actionStart=this.anim}
    const frame=action==='walk'?walkFrame(key,this.walkDistance):frameAt(key,this.anim-this.actionStart,action==='idle')
    drawArt(ctx,key,frame,this.cx-cx,this.y+this.h-cy,this.facing<0,{white:this.flash>.15})
    if(this.dying||this.state==='enter')return
    for(const wave of this.waves){ctx.strokeStyle='#ffd386';ctx.lineWidth=2;ctx.beginPath();ctx.arc(wave.x-cx,wave.y-cy,9,Math.PI,0);ctx.stroke()}
    if(this.kingkong&&this.state==='warn'){
      const x=(this.pattern==='slam'?this.targetX:this.cx)-cx,y=this.y+this.h-cy
      ctx.save();ctx.strokeStyle=this.phase2?'#ff7056':'#ffe087';ctx.lineWidth=2
      ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(x,y-2,this.pattern==='slam'?this.w/2+24:this.w/2+8,5,0,0,Math.PI*2);ctx.stroke()
      if(this.pattern==='charge'){ctx.beginPath();ctx.moveTo(this.cx-cx,y-12);ctx.lineTo((this.facing<0?12:VIEW_W-12),y-12);ctx.stroke()}
      ctx.restore()
    }
    const sprite=art.sprites[this.kingkong?key:this.cfg.key+'.idle'],w=64
    const x=Math.max(4,Math.min(VIEW_W-w-4,this.cx-cx-w/2))
    const y=Math.max(31,this.y+this.h-cy-(sprite?(this.kingkong?headHeight(sprite,frame):sprite.h):this.h)-7)
    ctx.fillStyle='#211c28';ctx.fillRect(x-1,y-1,w+2,6)
    ctx.fillStyle='#7a3b36';ctx.fillRect(x,y,w,4)
    ctx.fillStyle=this.kingkong&&this.phase2?'#ff6652':'#e28b4c';ctx.fillRect(x,y,Math.ceil(w*this.hp/this.maxHp),4)
  }
}
