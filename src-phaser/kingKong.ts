import { Boss } from '../src/game/boss'
import { art, drawArt, frameAt } from '../src/game/art'
import type { Game } from '../src/game/game'
import type { Player } from '../src/game/entities'
import { VIEW_W, overlap } from '../src/game/constants'

const files=import.meta.glob('./assets/kingkong_*',{query:'?url',import:'default',eager:true}) as Record<string,string>
const actions=['pound','charge','dizzy','slam','defeat'] as const
let loading:Promise<void>|undefined
export function loadKingKong(){
  return loading??=Promise.all(actions.map(async action=>{
    const base=`./assets/kingkong_${action}`
    const data=await (await fetch(files[base+'.json']!)).json()
    const img=new Image();img.src=files[base+'.png']!;await img.decode()
    // Body landmarks exclude dust, shock waves and overhead status effects.
    const entries=Object.values(data.frames) as {frame:{x:number;y:number;w:number;h:number};body:{w:number;h:number;footX:number;footY:number}}[]
    const baseScale=Math.min(54/entries[0]!.body.w,68/entries[0]!.body.h)
    art.sprites[`kingkong.${action}`]={img,frames:entries.map(({frame:f,body})=>[
      f.x,f.y,f.w,f.h,body.footX/f.w,body.footY/f.h,
      Math.min(54/body.w,68/body.h)/baseScale,
    ]),h:entries[0]!.frame.h*baseScale,fps:18,ax:.5,ay:1,facingLeft:true}
  })).then(()=>{}).catch(error=>{loading=undefined;throw error})
}
export function replaceOpeningKingKong(){
  for(const [key,action] of [['walk','charge'],['carry','charge'],['grab','pound'],['jump','slam']])art.sprites[`kingkong.${key}`]=art.sprites[`kingkong.${action}`]!
}

type Move = 'chest'|'charge'|'jump'
type Phase = 'warning'|'attack'|'recover'|'dizzy'
/** Stage 15 boss with the authored Ludo atlas; collision timing stays authoritative. */
export class KingKong extends Boss {
  move:Move='chest'
  phase:Phase='warning'
  remaining=1.2
  elapsed=0
  floor:number
  target=0
  private sequence=1
  private pulses=0
  private waves:{x:number;dir:number;life:number}[]=[]
  constructor(g:Game){
    super({...g.stage.boss,key:'kingkong',name:'킹콩'},0,0)
    this.w=54;this.h=68;this.maxHp=this.hp=36
    this.x=g.level.arenaX+250
    this.floor=g.level.floorBelow(this.cx,0);this.y=this.floor-this.h
    this.state='walk'
  }
  override get contactDmg(){return this.phase==='attack'&&this.move!=='jump'?1:0}
  override hit(g:Game,dmg:number,_by:Player|null){
    if(this.dying||this.flash>0)return
    this.hp=Math.max(0,this.hp-dmg);this.flash=.24
    g.sfx.hit();g.burst(this.cx,this.y+30,'#fff2be',6)
    if(!this.hp){this.state='dying';this.t=2.5;this.elapsed=0;this.y=this.floor-this.h;this.waves=[];this.vx=0;g.sfx.roar()}
    // Damage never cancels a warning or shortens the two-second wall opening.
  }
  private warn(g:Game){
    this.move=(['chest','charge','jump'] as const)[this.sequence++%3]!
    this.phase='warning';this.elapsed=0;this.pulses=0
    this.remaining=(this.move==='chest'?1.2:1)*(this.phase2?.8:1)
    this.target=Math.max(g.level.arenaX+44,Math.min(g.level.arenaX+VIEW_W-44,g.players[0]!.cx))
    this.facing=this.target<this.cx?-1:1;this.state='walk'
  }
  private pulse(){
    for(const dir of [-1,1])this.waves.push({x:this.cx,dir,life:2.5})
  }
  override update(g:Game,dt:number){
    if(this.dead)return
    this.anim+=dt;this.flash=Math.max(0,this.flash-dt)
    if(this.dying){this.elapsed+=dt;this.t=Math.max(0,this.t-dt);if(!this.t)this.dead=true;return}
    this.remaining=Math.max(0,this.remaining-dt);this.elapsed+=dt
    const left=g.level.arenaX+44,right=g.level.arenaX+VIEW_W-44
    if(this.phase==='warning'){
      if(this.move==='jump'){
        // Rise stays fully visible; the landing target locks at the warning start.
        this.x+=(this.target-this.cx)*Math.min(1,dt*8)
        this.y=this.floor-this.h-38*Math.min(1,this.elapsed/.25)
      }
      if(!this.remaining){
        this.phase='attack';this.elapsed=0
        this.remaining=this.move==='charge'?2:this.move==='jump'?.22:this.phase2?.75:.38
        if(this.move==='chest'){this.pulse();this.pulses=1}
      }
    }else if(this.phase==='attack'){
      if(this.move==='charge'){
        this.x+=this.facing*230*dt
        if(this.cx<=left||this.cx>=right){
          this.x=Math.max(left,Math.min(right,this.cx))-this.w/2
          this.phase='dizzy';this.state='stun';this.remaining=2;this.elapsed=0
          g.burst(this.cx,this.floor-12,'#ffe4a1',8)
        }
      }else if(this.move==='jump'){
        this.y=Math.min(this.floor-this.h,this.y+280*dt)
        if(this.y>=this.floor-this.h&&this.pulses===0){
          this.pulses=1
          for(const p of g.players)if(p.alive&&Math.abs(p.cx-this.target)<43&&p.y+p.h>this.floor-12)p.hurt(g,1,this.cx)
          g.burst(this.cx,this.floor-4,'#ffe4a1',8)
        }
      }else if(this.phase2&&this.pulses===1&&this.elapsed>=.36){this.pulse();this.pulses=2}
      if(this.phase==='attack'&&!this.remaining){this.phase='recover';this.elapsed=0;this.remaining=.65;this.y=this.floor-this.h}
    }else if(!this.remaining)this.warn(g)
    for(const wave of this.waves){
      wave.x+=wave.dir*135*dt;wave.life-=dt
      if(wave.x<g.level.arenaX+8||wave.x>g.level.arenaX+VIEW_W-8){wave.life=0;continue}
      for(const p of g.players)if(p.alive&&overlap(p,{x:wave.x-6,y:this.floor-9,w:12,h:9}))p.hurt(g,1,wave.x)
    }
    this.waves=this.waves.filter(w=>w.life>0)
  }
  override afterUpdate(_g:Game){}
  override draw(ctx:CanvasRenderingContext2D,cx:number,cy:number){
    if(this.dead)return
    const x=this.cx-cx,floor=this.floor-cy
    ctx.save()
    if(this.phase==='warning'&&!this.dying){
      ctx.fillStyle=this.move==='jump'?'rgba(20,10,10,.6)':'rgba(255,193,76,.45)'
      ctx.beginPath();ctx.ellipse(this.move==='jump'?this.target-cx:x,floor-3,this.move==='jump'?43:34,5,0,0,7);ctx.fill()
      if(this.move==='charge')for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(x-this.facing*(18+i*4),floor-4-(i%3)*3,3+Math.sin(this.anim*20+i),0,7);ctx.fill()}
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe9a8'
      ctx.fillText(this.move==='chest'?'가슴 두드리기 · 점프!':this.move==='charge'?'돌진 · 피하세요!':'그림자 밖으로!',192,cy===0?74:62)
    }
    let action:string='pound',frame=0
    if(this.dying){action='defeat';frame=Math.min(35,Math.floor(this.elapsed*18))}
    else if(this.phase==='dizzy'){action='dizzy';frame=Math.floor(this.elapsed*18)%36}
    else if(this.move==='charge'){action='charge';frame=Math.floor(this.elapsed*18)%36}
    else if(this.move==='jump'){
      action='slam'
      frame=this.phase==='warning'?Math.min(17,Math.floor(this.elapsed/(this.phase2?.8:1)*18)):this.phase==='attack'?18+Math.min(11,Math.floor(this.elapsed/.14*12)):30+Math.min(5,Math.floor(this.elapsed/.65*6))
    }else frame=this.phase==='warning'?Math.min(23,Math.floor(this.elapsed/(1.2*(this.phase2?.8:1))*24)):this.phase==='attack'?24+Math.min(11,Math.floor(this.elapsed/(this.phase2?.75:.38)*12)):35
    const key=`kingkong.${action}`
    ctx.save()
    if(this.phase2)ctx.filter='sepia(1) saturate(6) hue-rotate(315deg)'
    drawArt(ctx,key,frame,x,this.y+this.h-cy,this.facing<0,{white:this.flash>.15,scale:art.sprites[key]!.frames[frame]![6]})
    ctx.restore()
    for(const wave of this.waves){ctx.strokeStyle='#ffd07b';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(wave.x-cx,floor-4,7,4,0,Math.PI,Math.PI*2);ctx.stroke()}
    if(this.phase==='dizzy'){
      ctx.fillStyle='#ffe481';ctx.font='12px sans-serif';ctx.textAlign='center'
      ctx.fillText('★  ★  ★',x,this.y-cy-12);ctx.font='9px sans-serif';ctx.fillText('어지러움 · 공격!',x,this.y-cy-23)
    }
    // Exactly one health bar, anchored above the actual opening sprite.
    if(!this.dying){const y=this.y-cy-8;ctx.fillStyle='#261c22';ctx.fillRect(x-30,y,60,5);ctx.fillStyle=this.phase2?'#ff3030':'#ff9361';ctx.fillRect(x-30,y,60*this.hp/this.maxHp,5)}
    ctx.restore()
  }
}

export function drawCaptive(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
  const x=g.level.arenaX+VIEW_W-25-cx
  const floor=g.level.floorBelow(g.level.arenaX+VIEW_W-25,0)-cy
  ctx.save();ctx.strokeStyle='#9c794b';ctx.lineWidth=4
  ctx.beginPath();ctx.moveTo(x-16,floor);ctx.lineTo(x-16,floor-97);ctx.stroke()
  ctx.fillStyle='#9c794b';ctx.fillRect(x-25,floor-62,44,5)
  drawArt(ctx,'nuga.wave',frameAt('nuga.wave',g.time),x,floor-62,false)
  ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff0c0';ctx.fillText('누가',x,floor-95)
  ctx.restore()
}


