import { drawPaintedText } from './art'
import type {Game} from './game'
import type {Player} from './entities'
import type {PlayerInput} from './input'
import type {Level} from './level'
import type {StageDef} from './stages'
import {TILE,VIEW_W,clamp} from './constants'
import {terrainDeck} from './paintedMap'
import {image} from './art'

export type CrossingKind='vine'|'lift'|'raft'|'sink'|'spring'|'shuttle'|'crumble'|'orbit'
export interface Crossing {
  kind:CrossingKind;x:number;y:number;w:number;homeX:number;homeY:number
  left:number;right:number;bankY:number;pivotX:number;pivotY:number;length:number
  angle:number;omega:number;age:number;load:number;broken:number;dx:number;dy:number;phase:number
}
const kinds:CrossingKind[]=['vine','lift','raft','sink','raft','spring','shuttle','lift','raft','spring','lift','shuttle','raft','vine','crumble','crumble','raft','shuttle','orbit','vine']
const worlds=new WeakMap<Level,Crossing[]>()
const rides=new WeakMap<Player,{node:Crossing;age:number}>()
const lock=new WeakMap<Player,number>()
const solid=(c:string|undefined)=>c==='#'||c==='R'

/** Put crossings between real ledges, with both takeoff and landing banks. */
export function makeCrossings(def:StageDef):Crossing[]{
  if(def.cave||def.aquatic||def.aerial)return [] // These already have swimming/updraft routes.
  const spans:{a:number;b:number;r:number}[]=[]
  for(let r=5;r<def.map.length-2;r++){
    const row=def.map[r]!
    for(let c=12;c<def.arenaCol-8;){
      const exposed=(x:number)=>['#','R','='].includes(row[x]??'')&&[1,2].every(d=>!solid(def.map[r-d]?.[x]))
      if(!exposed(c)){c++;continue}
      const a=c;while(c<def.arenaCol-8&&exposed(c))c++
      if(c-a>=3)spans.push({a,b:c,r})
    }
  }
  const nodes:Crossing[]=[]
  for(const a of spans.sort((a,b)=>a.b-b.b)){
    const b=spans.filter(b=>b.a-a.b>=2&&b.a-a.b<=10&&Math.abs(a.r-b.r)<=2).sort((u,v)=>u.a-v.a||Math.abs(u.r-a.r)-Math.abs(v.r-a.r))[0]
    if(!b)continue
    const left=(a.b-.6)*TILE,right=(b.a+.6)*TILE,x=(left+right)/2,y=Math.min(a.r,b.r)*TILE
    const spacing=Math.max(150,def.arenaCol*TILE/11)
    if(nodes.some(n=>Math.abs(n.homeX-x)<spacing)||nodes.length>=10)continue
    const length=Math.max(70,(right-left)/(2*Math.sin(.9)))
    const pivotY=y-22-Math.cos(.9)*length
    // Never place a rope or moving platform through a solid ceiling or wall.
    const clear=(px:number,py:number)=>!solid(def.map[Math.floor(py/TILE)]?.[Math.floor(px/TILE)])
    if(!Array.from({length:13},(_,i)=>{
      const angle=-.9+i*.15
      return clear(x+Math.sin(angle)*length,pivotY+Math.cos(angle)*length-4)
    }).every(Boolean))continue
    const w=Math.max(44,Math.min(80,(right-left)*.4))
    nodes.push({kind:kinds[def.id-1]!,x:x-w/2,y,w,homeX:x-w/2,homeY:y,left,right,bankY:a.r*TILE,
      pivotX:x,pivotY,length,angle:-.9,omega:0,age:0,load:0,broken:0,dx:0,dy:0,phase:nodes.length*1.7})
  }
  return nodes
}
export function crossings(lv:Level):Crossing[]{
  let nodes=worlds.get(lv);if(!nodes){nodes=makeCrossings(lv.def);worlds.set(lv,nodes)}return nodes
}
export function vineEnd(n:Crossing){return{x:n.pivotX+Math.sin(n.angle)*n.length,y:n.pivotY+Math.cos(n.angle)*n.length}}
export function releaseCrossing(p:Player):void {rides.delete(p);lock.set(p,.35);p.ropeAngle=null}

/** Platforms advance before player physics, so riders receive their exact displacement. */
export function advanceCrossings(g:Game,dt:number):void {
  for(const n of crossings(g.level)){
    const oldX=n.x,oldY=n.y;n.age+=dt
    const occupied=g.players.some(p=>p.alive&&p.onGround&&p.x+p.w>n.x&&p.x<n.x+n.w&&Math.abs(p.y+p.h-n.y)<3)
    n.load=occupied?n.load+dt:Math.max(0,n.load-dt*2)
    const t=n.age+n.phase,range=Math.max(0,Math.min(66,(n.right-n.left-n.w)/2-12))
    if(n.kind==='vine'){
      if(!g.players.some(p=>rides.get(p)?.node===n)){
        n.omega+=(-3.3*Math.sin(n.angle)-.12*n.omega)*dt
        n.angle=clamp(n.angle+n.omega*dt,-1.05,1.05)
        if(Math.abs(n.angle)>=1.05&&n.angle*n.omega>0)n.omega*=-.25
      }
    }else if(n.kind==='lift'){n.y=n.homeY-22-Math.sin(t*1.1)*30}
    else if(n.kind==='raft'){n.x=n.homeX+Math.sin(t*.65)*range;n.y=n.homeY+5+Math.sin(t*1.5)*6+Math.min(9,n.load*8)}
    else if(n.kind==='sink'){n.y=n.homeY+Math.min(44,n.load*28)}
    else if(n.kind==='shuttle'){n.x=n.homeX+Math.sin(t*.9)*range;n.y=n.homeY-4}
    else if(n.kind==='orbit'){n.x=n.homeX+Math.sin(t*.8)*range;n.y=n.homeY-20-Math.cos(t*.8)*22}
    else if(n.kind==='spring'){n.y=n.homeY+Math.min(7,n.load*35)}
    else if(n.kind==='crumble'){
      if(n.broken>0){n.broken=Math.max(0,n.broken-dt);n.load=0}
      else if(n.load>.75){n.broken=3.5;n.load=0}
    }
    n.dx=n.x-oldX;n.dy=n.y-oldY
  }
}
export function carryCrossing(p:Player,lv:Level):void {
  if(!p.onGround)return
  for(const n of crossings(lv)){
    if(n.kind==='vine'||n.broken>0)continue
    if(p.x+p.w>n.x-n.dx&&p.x<n.x-n.dx+n.w&&Math.abs(p.y+p.h-(n.y-n.dy))<2){
      const x=p.x+n.dx,y=p.y+n.dy
      if(![x+.5,x+p.w-.5].some(px=>lv.solidAt(px,y+1)||lv.solidAt(px,y+p.h-1))){p.x=x;p.y=y}
      return
    }
  }
}
export function landCrossing(p:Player,lv:Level,previousFeet:number,down:boolean):void {
  if(p.vy<0||down)return
  for(const n of crossings(lv)){
    if(n.kind==='vine'||n.broken>0||p.x+p.w<=n.x||p.x>=n.x+n.w)continue
    if(previousFeet<=n.y+2&&p.y+p.h>=n.y){
      if([p.x+.5,p.x+p.w-.5].some(x=>lv.solidAt(x,n.y-p.h+1)||lv.solidAt(x,n.y-1)))continue
      p.y=n.y-p.h;p.vy=0;p.onGround=true
      if(n.kind==='spring'){p.vy=-410;p.onGround=false}
      return
    }
  }
}
export function rideVine(p:Player,g:Game,dt:number,inp:PlayerInput):boolean {
  const cooldown=Math.max(0,(lock.get(p)??0)-dt);lock.set(p,cooldown)
  let ride=rides.get(p)
  if(!ride&&inp.up&&!p.climbing&&!p.swimming&&cooldown===0){
    const n=crossings(g.level).find(n=>{
      if(n.kind!=='vine')return false
      const e=vineEnd(n);return Math.hypot(e.x-p.cx,e.y-(p.y+5))<26
    })
    if(n){ride={node:n,age:0};rides.set(p,ride);p.onGround=false;p.swingT=0}
  }
  if(!ride){p.ropeAngle=null;return false}
  const n=ride.node;ride.age+=dt
  const direction=Number(inp.right)-Number(inp.left)
  n.omega+=(-3.3*Math.sin(n.angle)+direction*3.8-.16*n.omega)*dt
  n.omega=clamp(n.omega,-2.3,2.3);n.angle=clamp(n.angle+n.omega*dt,-1.05,1.05)
  if(Math.abs(n.angle)>=1.05&&n.angle*n.omega>0)n.omega*=-.25
  const end=vineEnd(n),x=end.x-p.w/2,y=end.y-5
  if([x+.5,x+p.w-.5].some(px=>g.level.solidAt(px,y+2)||g.level.solidAt(px,y+p.h-1))){
    n.omega*=-.25;releaseCrossing(p);return false
  }
  p.x=x;p.y=y;p.onGround=false;p.ropeAngle=n.angle
  p.vx=Math.cos(n.angle)*n.length*n.omega;p.vy=-Math.sin(n.angle)*n.length*n.omega
  if(direction)p.facing=direction
  if(ride.age>.2&&(inp.jumpPressed||inp.downPressed)){
    const launch=inp.jumpPressed
    releaseCrossing(p);p.vx=clamp(p.vx+direction*45,-170,170);p.vy=launch?Math.min(-250,p.vy-150):p.vy
    if(launch)g.sfx.jump()
    // Finish this frame here: regular ground controls must not erase release momentum.
  }
  return true
}

export function drawCrossings(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
  for(const n of crossings(g.level)){
    if(n.right<cx-100||n.left>cx+VIEW_W+100)continue
    ctx.save();ctx.translate(-cx,-cy)
    if(n.kind==='vine'){
      // Textured bark and a thin flexible strand share the scenery's painted style.
      const support=image('traversal.vineSupport'),vine=image('traversal.vine')
      if(support){
        const width=(n.pivotX-(n.left-12))/.75,height=(n.bankY+5-n.pivotY)/.95
        ctx.drawImage(support,n.pivotX-width*.98,n.pivotY-height*.03,width,height)
      }
      const e=vineEnd(n)
      if(vine){
        ctx.save();ctx.translate(n.pivotX,n.pivotY);ctx.rotate(-n.angle)
        ctx.drawImage(vine,-5,-1,10,n.length+8);ctx.restore()
      }
      const rider=g.players.find(p=>rides.get(p)?.node===n)
      const nearby=g.players.some(p=>p.alive&&Math.hypot(p.cx-e.x,p.y+5-e.y)<60)
      if(rider||nearby){
        ctx.font='bold 6px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=2
        ctx.strokeStyle='#314525';ctx.fillStyle='#fff1c9'
        const text=rider?'← 흔들기 → · ↑ 뛰기':'↑ 덩굴 잡기',y=(rider?.y??e.y)-12
        drawPaintedText(ctx,text,rider?.cx??e.x,y,parseFloat(ctx.font)||8)
      }
    }else{
      if(n.broken>0){ctx.restore();continue}
      if(n.kind==='lift'||n.kind==='shuttle'){
        // Visible suspension attaches the moving ledge to the banks.
        ctx.strokeStyle='#8b7652';ctx.lineWidth=1.2
        ctx.beginPath();ctx.moveTo(n.left,n.bankY);ctx.lineTo(n.x+3,n.y+5);ctx.moveTo(n.right,n.homeY);ctx.lineTo(n.x+n.w-3,n.y+5);ctx.stroke()
      }
      terrainDeck(ctx,n.x,n.y,g.level.def.id,n.w,'local')
      if(n.kind==='crumble'&&n.load>.25){
        ctx.strokeStyle='#2b2730';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(n.x+10,n.y);ctx.lineTo(n.x+17,n.y+4);ctx.lineTo(n.x+14,n.y+9);ctx.moveTo(n.x+30,n.y);ctx.lineTo(n.x+26,n.y+8);ctx.stroke()
      }
      if(n.kind==='raft'){ctx.strokeStyle='rgba(160,220,217,.5)';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(n.x+n.w/2,n.y+12,n.w*.65,2,0,0,Math.PI*2);ctx.stroke()}
    }
    ctx.restore()
  }
}
