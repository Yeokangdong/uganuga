import type { Game } from '../src/game/game'
import type { Level } from '../src/game/level'
import { drawArt } from '../src/game/art'
import { RUN_SPEED, VIEW_W, VIEW_H } from '../src/game/constants'

export type EventPhase = 'IDLE'|'TELEGRAPH'|'ACTIVE'|'RESOLVED'|'CANCELLED'
export const P2:Record<number,{name:string;kind:string;color:string;duration:number}>={
  2:{name:'?? ?? ? ?? ????!',kind:'rise',color:'#fa713a',duration:8},
  3:{name:'??? ?? ? ?? ????!',kind:'platform',color:'#b9eeff',duration:5},
  4:{name:'???? ? ?? ?? ??!',kind:'fog',color:'#d9bd78',duration:6},
  5:{name:'???? ??? ? ??!',kind:'platform',color:'#9d7145',duration:5},
  6:{name:'?? ??? ? ??!',kind:'platform',color:'#91bd65',duration:5},
  8:{name:'???? ?? ? ?? ???!',kind:'fall',color:'#bb9ff5',duration:4},
  9:{name:'?? ?? ? ?? ????!',kind:'wave',color:'#6acbe4',duration:6},
  10:{name:'?? ?? ? ?? ?? ??!',kind:'fog',color:'#b9d88c',duration:6},
  11:{name:'??? ?? ?? ? ?? ???!',kind:'chain',color:'#b6a58a',duration:5},
  12:{name:'?? ?? ?? ? ?? ????!',kind:'platform',color:'#f8e18d',duration:5},
  14:{name:'???? ?? ? ?? ???!',kind:'fall',color:'#ae7d50',duration:4},
  15:{name:'??? ?? ? ?????!',kind:'chase',color:'#e7f3ff',duration:7},
}
export const TREE = { leafSeconds:1.2, telegraphSeconds:2.4, fallSeconds:.8, length:72, height:12, trigger:108, monkeyGap:10 } as const
/** Scene-owned simulation clock: no delayed callbacks, terrain edits, or camera effects survive cancellation. */
export class EnvironmentEvent {
  phase:EventPhase='IDLE'
  age=0
  passed=false
  site:{x:number;floor:number}|null=null
  rockX=0
  waterY=0
  safe:{x:number;y:number}|null=null
  private pulse=0
  private tilted=false
  private completed=false
  constructor(readonly level:Level) {
    if(P2[level.def.id]){
      // A reversible event lane in the middle fifth; never replace authored terrain.
      for(let x=Math.ceil(Math.max(384,level.arenaX*.4)/16)*16;x<Math.min(level.arenaX*.6,level.arenaX-320);x+=16){
        const floor=level.groundY(x)
        if(floor==null)continue
        if(level.spawns.some(a=>['D','P','S'].includes(a.kind)&&Math.abs(a.col*16-x)<240))continue
        let clear=true
        for(let dx=-64;dx<=224;dx+=16){
          const c=(x+dx)/16
          if(!level.isSolidTile(level.tile(c,floor/16)))clear=false
          for(let r=floor/16-7;r<floor/16;r++)if(level.isLadder(c,r)||level.isSolidTile(level.tile(c,r)))clear=false
        }
        if(clear){this.site={x,floor};this.rockX=x-48;break}
      }
      return
    }
    if([7,13].includes(level.def.id)){
      for(let x=480;x<level.arenaX-560;x+=16){
        const floor=level.groundY(x)
        if(floor==null)continue
        let safe=true
        for(let c=(x-64)/16;c<=(x+(level.def.id===13?192:320))/16;c++){
          if(!level.isSolidTile(level.tile(c,floor/16)))safe=false
          for(let r=floor/16-6;r<floor/16;r++)if(level.isLadder(c,r)||level.isSolidTile(level.tile(c,r)))safe=false
        }
        if(level.spawns.some(a=>['D','P','S'].includes(a.kind)&&Math.abs(a.col*16-x)<(level.def.id===13?96:352)))safe=false
        if(!safe)continue
        this.site={x,floor};this.rockX=x-64;this.waterY=floor+16
        if(level.def.id===13){
          for(let dx=96;dx<=224;dx+=16)for(let dy=32;dy<=80;dy+=16){
            if(level.tile((x+dx)/16,(floor-dy)/16)===2){this.safe={x:x+dx,y:floor-dy};break}
            if(this.safe)break
          }
          if(!this.safe){this.site=null;continue}
        }
        break
      }
      return
    }
    if(level.def.id!==1)return
    for(let x=Math.floor(level.arenaX*.45/16)*16;x<level.arenaX-256;x+=16){
      const floor=level.groundY(x)
      if(floor===null||floor===undefined||x<384)continue
      if(level.spawns.some(s=>['D','P','S'].includes(s.kind)&&Math.abs(s.col*16-x)<192))continue
      let safe=true
      for(let c=Math.floor((x-80)/16);c<=Math.ceil((x+176)/16);c++){
        if(!level.isSolidTile(level.tile(c,floor/16)))safe=false
        for(let r=floor/16-7;r<floor/16;r++)if(level.isLadder(c,r)||level.isSolidTile(level.tile(c,r)))safe=false
      }
      if(safe){this.site={x,floor};break}
    }
  }
  get busy(){return this.phase==='TELEGRAPH'||this.phase==='ACTIVE'}
  cancel(){this.completed ||= this.phase==='RESOLVED';this.phase='CANCELLED';this.age=0;this.tilted=false;this.pulse=0}
  update(g:Game,dt:number,previous:{x:number;y:number}){
    if(!this.site)return
    const p=g.players[0]!,s=this.site
    if(!p.alive||g.level!==this.level||g.mode!=='play'){if(this.busy)g.sfx.playMusic('stage',g.stage.theme.n);this.cancel();return}
    if(this.phase==='CANCELLED'){this.phase=this.completed?'RESOLVED':'IDLE';this.rockX=s.x-64;this.waterY=s.floor+16;g.sfx.playMusic('stage',g.stage.theme.n);return}
    if(P2[this.level.def.id]){this.updateP2(g,dt,previous);return}
    if([7,13].includes(this.level.def.id)){this.updateP1(g,dt);return}
    const visible=s.x-24>=g.camX&&s.x+TREE.length+24<=g.camX+VIEW_W&&s.floor-100>=g.camY+44&&s.floor<=g.camY+VIEW_H
    if(this.phase==='IDLE'&&visible&&p.cx>=s.x-TREE.trigger&&p.cx<s.x&&Math.abs(p.y+p.h-s.floor)<24){this.phase='TELEGRAPH';this.age=0;g.showBanner('나무가 흔들린다! → 점프',2)}
    if(this.phase==='TELEGRAPH'){
      if(!visible)return
      this.age+=dt
      if(this.age>=TREE.leafSeconds&&!this.tilted){this.tilted=true;g.sfx.thud()}
      if(this.age>=TREE.telegraphSeconds){this.phase='ACTIVE';this.age=0}
    }else if(this.phase==='ACTIVE'){
      if(!visible)return
      this.age+=dt
      if(this.age>=TREE.fallSeconds){this.phase='RESOLVED';this.age=0;g.sfx.thud()}
    }
    if(this.phase==='RESOLVED'){
      // A low reversible obstacle; original terrain and all pickups remain intact.
      const left=s.x,right=s.x+TREE.length,top=s.floor-TREE.height
      if(p.x+p.w>left&&p.x<right&&p.y+p.h>top&&p.y<s.floor){
        if(previous.y+p.h<=top+1&&p.vy>=0){p.y=top-p.h;p.vy=0;p.onGround=true}
        else if(previous.x+p.w<=left+1)p.x=left-p.w
        else if(previous.x>=right-1)p.x=right
        else {p.y=top-p.h;p.vy=0;p.onGround=true}
      }
      if(!this.passed&&p.cx>right+16){this.passed=true;g.showBanner('통과! 먹이를 모으며 잠시 쉬자',2.5)}
    }
  }
  private updateP2(g:Game,dt:number,previous:{x:number;y:number}){
    const p=g.players[0]!,s=this.site!,spec=P2[this.level.def.id]!
    const visible=s.x-64>=g.camX&&s.x+224<=g.camX+VIEW_W&&s.floor-112>=g.camY+44&&s.floor<=g.camY+VIEW_H
    if(this.phase==='IDLE'&&visible&&p.cx>=s.x-32&&p.cx<s.x+64&&p.onGround&&!p.climbing){
      this.phase='TELEGRAPH';this.age=0;g.showBanner(spec.name,3);g.sfx.thud()
    }
    if(!this.busy)return
    if(!visible||p.climbing)return // Hazard simulation waits with its visible warning and escape lane.
    this.age+=dt
    if(this.phase==='TELEGRAPH'&&this.age>=2.8){this.phase='ACTIVE';this.age=0;g.sfx.playMusic('boss');g.shake(.15,1)}
    if(this.phase!=='ACTIVE')return
    const t=this.age,id=this.level.def.id
    // Temporary stepping stones over the original, intact dry floor.
    if(['rise','wave','platform'].includes(spec.kind))for(let i=0;i<3;i++){
      const x=s.x+i*64,y=s.floor-24-(spec.kind==='platform'?Math.min(24,t*7)*(i===Math.floor(t)%3?1:0):0)
      if(p.x+p.w>x&&p.x<x+40&&previous.y+p.h<=y+3&&p.y+p.h>=y&&p.vy>=0){p.y=y-p.h;p.vy=0;p.onGround=true}
    }
    let hit=false,source=s.x
    if(spec.kind==='rise'||spec.kind==='wave'){
      const height=spec.kind==='rise'?Math.min(18,t*3):12+Math.sin(t*2)*5
      hit=p.cx>s.x&&p.cx<s.x+192&&p.y+p.h>s.floor-height
    }else if(spec.kind==='fall'||spec.kind==='chain'){
      const i=spec.kind==='chain'?Math.min(2,Math.floor(t)):1
      source=s.x+32+i*56
      const y=s.floor-100+Math.min(100,(t%1)*145)
      hit=Math.abs(p.cx-source)<13&&p.y<y+16&&p.y+p.h>y
    }else if(spec.kind==='chase'){
      this.rockX=s.x-48+t*RUN_SPEED*.65;source=this.rockX
      hit=p.cx<source+22&&p.cx>s.x-64&&p.y+p.h>s.floor-42
    }
    this.pulse+=dt
    if(hit&&this.pulse>=1.5){p.hurt(g,1,source);this.pulse=0}
    if(t>=spec.duration||p.cx>s.x+208)this.resolve(g)
    // No falling-through holes, permanent tile edits, item removal, or score hooks.
    void id
  }
  private drawP2(ctx:CanvasRenderingContext2D,cx:number,cy:number){
    const s=this.site!,spec=P2[this.level.def.id]!,active=this.phase==='ACTIVE',t=this.age
    if(this.phase==='CANCELLED'||this.phase==='RESOLVED')return
    ctx.save();ctx.translate(s.x-cx,s.floor-cy);ctx.strokeStyle='#ffe391';ctx.fillStyle=spec.color
    ctx.setLineDash([4,4]);ctx.strokeRect(0,-18,192,18);ctx.setLineDash([])
    ctx.font='10px sans-serif';ctx.fillText('? SAFE',198,-28)
    if(['rise','wave','platform'].includes(spec.kind)){
      for(let i=0;i<3;i++){const sink=active&&spec.kind==='platform'&&i===Math.floor(t)%3?Math.min(24,t*7):0;ctx.fillRect(i*64,-24-sink,40,7)}
      if(active&&spec.kind!=='platform'){ctx.globalAlpha=.5;const h=spec.kind==='rise'?Math.min(18,t*3):12+Math.sin(t*2)*5;ctx.fillRect(0,-h,192,h)}
    }else if(spec.kind==='fog'){
      if(active){ctx.globalAlpha=.18;for(let i=0;i<6;i++)ctx.fillRect(i*34+Math.sin(t+i)*8,-95,25,60)}
      ctx.globalAlpha=1;ctx.strokeRect(0,-18,192,18)
    }else if(spec.kind==='chase'){
      ctx.globalAlpha=active?.7:.2;ctx.fillRect((active?this.rockX-s.x:-48)-30,-42,50,42)
    }else{
      for(let i=0;i<3;i++){
        ctx.strokeRect(20+i*56,-18,24,18)
        const falling=active&&(spec.kind!=='chain'||i<=Math.floor(t))
        ctx.fillRect(20+i*56,-100+(falling?Math.min(100,(t%1)*145):Math.sin(t*18)*2),24,16)
      }
    }
    ctx.restore()
  }
  private updateP1(g:Game,dt:number){
    const p=g.players[0]!,s=this.site!,water=this.level.def.id===13
    const visible=s.x-86>=g.camX&&s.x+228<=g.camX+VIEW_W&&s.floor<=g.camY+VIEW_H&&s.floor-90>=g.camY+44
    if(this.phase==='IDLE'&&visible&&p.cx>=s.x&&p.cx<s.x+64&&p.onGround&&!p.climbing){
      this.phase='TELEGRAPH';this.age=0;g.sfx.thud();g.shake(.18,1)
      g.showBanner(water?'수위 상승! 높은 발판으로 ↑':'잔돌! 바위가 온다 →',2.5)
    }
    if(this.phase==='TELEGRAPH'){
      if(p.climbing||!visible)return
      this.age+=dt
      if(this.age>=2.8){this.phase='ACTIVE';this.age=0;this.rockX=Math.max(g.camX+26,Math.min(s.x-64,p.x-96));g.sfx.playMusic('boss');g.shake(.2,1.4)}
    }else if(this.phase==='ACTIVE'){
      this.age+=dt
      if(water){
        this.waterY=Math.max(this.safe!.y+12,s.floor+16-this.age*9)
        if(p.y+p.h>this.waterY&&p.cx>s.x-64&&p.cx<s.x+256&&this.age>3){
          this.pulse+=dt;if(this.pulse>1.5){p.hurt(g,1,p.cx-16);this.pulse=0}
        }
        if(p.cx>=s.x+256||(p.cx>=this.safe!.x&&p.y+p.h<=this.safe!.y+2)||this.age>=12)this.resolve(g)
      }else{
        this.rockX=Math.min(s.x+256,this.rockX+RUN_SPEED*.78*dt)
        if(!p.climbing&&Math.abs(p.cx-this.rockX)<24&&p.y+p.h>s.floor-44&&p.y<s.floor)p.hurt(g,1,this.rockX)
        if(this.rockX>=s.x+256||p.cx>=s.x+320){this.rockX=s.x+256;this.resolve(g)}
      }
    }
    if(this.phase==='RESOLVED')this.waterY=Math.min(s.floor+16,this.waterY+dt*60)
  }
  private resolve(g:Game){this.phase='RESOLVED';this.age=0;g.sfx.thud();g.shake(.18,1);g.sfx.playMusic('stage',g.stage.theme.n);g.showBanner('통과! FOOD 보충 구간 →',2)}
  draw(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
    if(!this.site||g.level!==this.level)return
    if(P2[this.level.def.id]){this.drawP2(ctx,cx,cy);return}
    if([7,13].includes(this.level.def.id)){this.drawP1(g,ctx,cx,cy);return}
    const s=this.site,fallen=this.phase==='RESOLVED'
    let angle=fallen?Math.PI/2:0
    if(this.phase==='TELEGRAPH')angle=this.age<TREE.leafSeconds?Math.sin(this.age*26)*.035:.12*(this.age-TREE.leafSeconds)/(TREE.telegraphSeconds-TREE.leafSeconds)
    if(this.phase==='ACTIVE')angle=.12+(Math.PI/2-.12)*Math.min(1,this.age/TREE.fallSeconds)**2
    ctx.save();ctx.translate(s.x-cx,s.floor-cy);ctx.rotate(angle)
    ctx.fillStyle='#765039';ctx.fillRect(-6,-TREE.length,12,TREE.length)
    if(!fallen){ctx.fillStyle='#5c9253';ctx.beginPath();ctx.ellipse(0,-72,22,15,0,0,Math.PI*2);ctx.fill()}
    ctx.restore()
    if(this.phase==='TELEGRAPH'||this.phase==='ACTIVE'){ctx.save();ctx.strokeStyle='#ffd87a';ctx.setLineDash([4,4]);ctx.strokeRect(s.x-cx,s.floor-cy-12,TREE.length,12);ctx.restore()}
  }
  private drawP1(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
    const s=this.site!,water=this.level.def.id===13
    ctx.save()
    if(water){
      ctx.fillStyle='rgba(66,176,226,.35)';ctx.fillRect(s.x-64-cx,this.waterY-cy,320,Math.max(0,s.floor+16-this.waterY))
      ctx.strokeStyle='#b3eeff';ctx.beginPath()
      for(let i=0;i<=320;i+=4){const y=this.waterY-cy+Math.sin(i*.15+g.time*5)*2;if(i===0)ctx.moveTo(s.x-64-cx+i,y);else ctx.lineTo(s.x-64-cx+i,y)}ctx.stroke()
      ctx.strokeStyle='#ffe58a';ctx.strokeRect(this.safe!.x-cx-8,this.safe!.y-cy-4,32,5)
      ctx.fillStyle='#ffe58a';ctx.font='10px sans-serif';ctx.fillText('↑ SAFE',this.safe!.x-cx-10,this.safe!.y-cy-12)
    }else{
      // Reversible visual stop against a rock outcrop; never a terrain collider.
      ctx.fillStyle='#786957';ctx.fillRect(s.x+278-cx,s.floor-28-cy,18,28)
      if(this.phase==='ACTIVE'||this.phase==='RESOLVED'){
        ctx.translate(this.rockX-cx,s.floor-23-cy);ctx.rotate(this.rockX/23)
        ctx.fillStyle='#a58b70';ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#53483e';ctx.strokeRect(-12,-13,21,17)
      }else if(this.phase==='TELEGRAPH'){
        ctx.fillStyle='#bca488';for(let i=0;i<5;i++)ctx.fillRect(s.x-70+i*12-cx,s.floor-60+(this.age*35+i*11)%48-cy,3,3)
      }
    }
    ctx.restore()
  }
}

/** Story scenery has no collision, pickup or scoring hooks. */
export function drawStory(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number,event:EnvironmentEvent){
  if(g.level!==event.level)return
  const lv=g.level,id=lv.def.id
  ctx.save()
  if(id>=5&&id<=10){ctx.globalAlpha=.28;ctx.filter='brightness(0)';drawArt(ctx,'kingkong.walk',0,lv.arenaX*.45-cx*.7,110,false,{scale:.7});ctx.filter='none';ctx.globalAlpha=1}
  for(const d of (g as unknown as {doors:{x:number;floor:number}[]}).doors){
    if(Math.abs(d.x-cx-192)>240)continue
    ctx.fillStyle='#63533e';for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(d.x-36-i*23-cx,d.floor-3-cy,9,3,-.25,0,7);ctx.fill()}
    ctx.fillStyle='#896347';ctx.fillRect(d.x+24-cx,d.floor-11-cy,27,7);ctx.fillRect(d.x+26-cx,d.floor-23-cy,6,17)
    if(id>=11){ctx.strokeStyle='#f2a2ba';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(d.x+31-cx,d.floor-24-cy);ctx.lineTo(d.x+42-cx,d.floor-29-cy);ctx.lineTo(d.x+37-cx,d.floor-20-cy);ctx.stroke()}
  }
  if(event.site&&Math.abs(g.players[0]!.cx-event.site.x)<220&&event.phase!=='RESOLVED'){
    ctx.strokeStyle='#403a35';for(let i=0;i<5;i++){const x=event.site.x-90+i*18-cx+(event.phase==='TELEGRAPH'?event.age*45:0),y=event.site.floor-100-cy-i%2*12;ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x,y+Math.sin(g.time*8+i)*2);ctx.lineTo(x+5,y-2);ctx.stroke()}
  }
  ctx.restore()
}

