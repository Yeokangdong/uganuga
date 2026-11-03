import type { Game } from '../src/game/game'
import type { Level } from '../src/game/level'
import { VIEW_W, VIEW_H } from '../src/game/constants'

export type EventPhase = 'IDLE'|'TELEGRAPH'|'ACTIVE'|'RESOLVED'|'CANCELLED'
export const TREE = { leafSeconds:1.2, telegraphSeconds:2.4, fallSeconds:.8, length:72, height:12, trigger:108, monkeyGap:10 } as const
/** Scene-owned simulation clock: no delayed callbacks, terrain edits, or camera effects survive cancellation. */
export class EnvironmentEvent {
  phase:EventPhase='IDLE'
  age=0
  passed=false
  site:{x:number;floor:number}|null=null
  private tilted=false
  private completed=false
  constructor(readonly level:Level) {
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
  cancel(){this.completed ||= this.phase==='RESOLVED';this.phase='CANCELLED';this.age=0;this.tilted=false}
  update(g:Game,dt:number,previous:{x:number;y:number}){
    if(!this.site)return
    const p=g.players[0]!,s=this.site
    if(!p.alive||g.level!==this.level||g.mode!=='play'){if(this.busy)g.sfx.playMusic('stage',g.stage.theme.n);this.cancel();return}
    if(this.phase==='CANCELLED'){this.phase=this.completed?'RESOLVED':'IDLE';return}
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
  draw(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
    if(!this.site||g.level!==this.level)return
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
}
