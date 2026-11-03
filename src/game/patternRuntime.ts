import type {Game} from './game'
import type {Level} from './level'
import {TILE,VIEW_W,VIEW_H,overlap,type Rect} from './constants'

type Frame={x:number;y:number;w:number;h:number;pivot:{x:number;y:number}}
type Animation={fps:number;loop:boolean;frames:Frame[]}
type Pack={animations:Record<string,Animation>;image:HTMLImageElement}
const packs=new Map<number,Pack>()
export async function loadPatternArt(stage:number):Promise<void>{
  if(stage<1||stage>10||packs.has(stage))return
  const base=`${import.meta.env.BASE_URL}assets/patterns-v1/stage${String(stage).padStart(2,'0')}/`
  const response=await fetch(base+'manifest.json');if(!response.ok)throw new Error('Pattern manifest '+stage)
  const manifest=await response.json()
  const image=new Image();image.src=base+manifest.image;await image.decode()
  packs.set(stage,{animations:manifest.animations,image})
}
export interface PatternSite {x:number;y:number;floor:number;dir:number;left:number;right:number}
interface Runtime {sites:PatternSite[];site:PatternSite|null;phase:'idle'|'warn'|'active'|'recover';age:number;wait:number;elapsed:number;rect:Rect|null}
const states=new WeakMap<Level,Runtime>()
/** Select only continuous, generous foreground surfaces; preserve ladder exits and both landing ends. */
function sitesFor(l:Level):PatternSite[]{
  const id=l.def.id,result:PatternSite[]=[]
  if(id>10)return result
  const safe=(x:number,y:number)=>x>240&&x<l.arenaX-240&&!l.spawns.some(s=>s.kind==='D'&&Math.abs(s.col*TILE-x)<128)&&!Array.from({length:7},(_,i)=>Math.floor(x/TILE)-3+i).some(c=>Array.from({length:7},(_,i)=>Math.floor(y/TILE)-3+i).some(r=>l.isLadder(c,r)))
  if([1,6,7,8,9,10].includes(id)){
    for(const anchor of l.patternAnchors){
      const a={...anchor}
      if(!safe(a.x,a.floor)||!safe(a.x,a.y)||a.right-a.left<80||result.some(p=>Math.abs(p.x-a.x)<384))continue
      if(![1,6].includes(id)){
        const target=id===7||id===8?a.y-4:a.floor
        const width=id===7?32:id===9||id===10?40:68,height=id===7?32:id===9||id===10?40:64
        const spot=l.findCombatPlacement(a.x-width/2,target,width,height,Math.max(256,id===9?a.x-192:a.left+4),id===9?a.x+192:a.right-width-4,target)
        if(!spot||spot.floor!==target)continue
        a.x=spot.x+width/2
        if(id===7||id===8)a.y=target
      }
      if(a.floor-a.y>120||a.floor-a.y<24&&id!==9)continue
      const row=Math.round(a.floor/TILE)
      if(id!==9&&!Array.from({length:15},(_,i)=>Math.floor(a.x/TILE)-7+i).every(c=>l.isSolidTile(l.tile(c,row))))continue
      result.push({...a,dir:1})
    }
    return result
  }
  if(id===3){
    for(const cliff of l.patternCliffs){
      const floor=cliff.bottom,x=cliff.x
      if(cliff.top>floor-40||!safe(x,floor)||result.some(p=>Math.abs(p.x-x)<480))continue
      if(!Array.from({length:9},(_,i)=>Math.floor(x/TILE)+i).every(c=>l.isSolidTile(l.tile(c,Math.round(floor/TILE)))))continue
      result.push({x,y:cliff.y,floor,dir:1,left:x,right:x+144})
    }
    return result
  }
  for(let r=3;r<l.rows;r++)for(let c=1;c<l.cols;){
    const eligible=(k:number)=>{const t=l.tile(k,r);return (id===1?t===2:l.isSolidTile(t))&&!l.isSolidTile(l.tile(k,r-1))&&l.tile(k,r-1)!==2&&!l.isSolidTile(l.tile(k,r-2))&&l.tile(k,r-2)!==2}
    if(!eligible(c)){c++;continue}
    const start=c;while(c<l.cols&&eligible(c))c++
    const end=c,left=start*TILE,right=end*TILE,y=r*TILE
    if(right-left<(id===1||id===5?128:224))continue
    let x=(left+right)/2,dir=1,actorY=y
    if(id===5){
      const nearWater=(edge:number)=>Array.from({length:7},(_,i)=>r+i-2).some(row=>l.tile(edge,row)===5)
      if(nearWater(end)){x=right-48;dir=-1}else if(nearWater(start-1)){x=left+48}else continue
    }
    const floor=id===1?(l.groundY(x)??y):y
    if(id===1&&(floor-y<64||floor-y>120||!Array.from({length:9},(_,i)=>Math.floor(x/TILE)-2+i).every(c=>l.isSolidTile(l.tile(c,Math.round(floor/TILE))))))continue
    const bodyWidth=id===5?48:84,bodyHeight=id===5?48:64
    const spot=l.findCombatPlacement(x-bodyWidth/2,y,bodyWidth,bodyHeight,Math.max(256,left+4),right-bodyWidth-4,y)
    if(!spot||spot.floor!==y)continue
    x=spot.x+bodyWidth/2
    if(!safe(x,y)||result.some(s=>Math.abs(s.x-x)<VIEW_W+96))continue
    // A branch is part of the authored jungle platform painting. Other actors sit on their biome's surface/edge.
    result.push({x,y:actorY,floor,dir,left,right})
  }
  return result
}
export function patternState(g:Game):Runtime{
  let state=states.get(g.level)
  if(!state){state={sites:sitesFor(g.level),site:null,phase:'idle',age:0,wait:1,elapsed:0,rect:null};states.set(g.level,state)}
  return state
}
const warnings=[0,2,1.9,1.8,1.7,1.6,1.5,1.4,1.3,1.3,1.2]
const durations=[0,3.6,1.1,.85,.65,1.15,1.5,1.6,.9,1.4,2.2]
function soundCenter(p:PatternSite):{x:number;y:number}{return{x:p.x,y:p.y}}
function bounds(s:PatternSite,id:number):Rect{
  if(id===6){const c=soundCenter(s),radius=107;return{x:c.x-radius,y:c.y-radius,w:radius*2,h:radius*2}}
  if(id>=6)return{x:s.x-132,y:Math.min(s.y-50,s.floor-136),w:264,h:s.floor-Math.min(s.y-50,s.floor-136)+8}
  if(id===1)return{x:s.x-64,y:Math.min(s.y-24,s.floor-100),w:s.right-s.x+64,h:s.floor-Math.min(s.y-24,s.floor-100)+10}
  if(id===2)return{x:s.x-48,y:s.floor-110,w:120,h:120}
  if(id===3)return{x:s.x-50,y:s.floor-100,w:164,h:110}
  if(id===4)return{x:s.x-48,y:s.floor-100,w:96,h:110}
  return{x:s.x-110,y:s.floor-100,w:220,h:110}
}
function visible(g:Game,r:Rect):boolean{return r.x>=g.camX+4&&r.x+r.w<=g.camX+VIEW_W-4&&r.y>=g.camY+4&&r.y+r.h<=g.camY+VIEW_H-4}
export function updateStagePattern(g:Game,dt:number):void{
  const id=g.level.def.id;if(id<1||id>10||g.level.def.cave||g.mode!=='play')return
  const s=patternState(g);s.elapsed+=dt;s.rect=null
  if(s.phase==='idle'){
    s.wait=Math.max(0,s.wait-dt);if(s.wait>0)return
    const site=s.sites.map(p=>id===1?{...p,right:g.camX+VIEW_W-4}:p).find(p=>visible(g,bounds(p,id))&&g.players.some(b=>b.alive&&Math.abs(b.x-p.x)<240&&Math.abs(b.y+b.h-p.floor)<60)&&!g.players.some(b=>b.alive&&b.invuln>0&&Math.abs(b.x-p.x)<150))
    if(!site)return
    s.site={...site};s.phase='warn';s.age=0;return
  }
  const p=s.site!
  // Leaving the screen cancels the entire cycle. Returning always requires a fresh warning.
  if(!visible(g,bounds(p,id))||g.players.some(b=>b.alive&&b.invuln>1&&Math.abs(b.x-p.x)<150)){s.phase='idle';s.wait=id>=6?5:6;s.site=null;return}
  s.age+=dt
  if(s.phase==='warn'&&s.age>=warnings[id]!){s.phase='active';s.age=0}
  if(s.phase==='active'){
    const t=s.age
    if(id===1)s.rect={x:p.x+t*32,y:p.floor-22,w:12,h:12}
    if(id===2&&t>=.85&&t<.95)s.rect={x:p.x+23,y:p.floor-12,w:18,h:12}
    if(id===3){const reach=64*Math.min(1,t/.2,(.85-t)/.25);s.rect={x:p.x,y:p.floor-27,w:Math.max(0,reach),h:14}}
    if(id===4)s.rect={x:p.x-20,y:p.floor-25,w:40,h:25}
    if(id===5){const reach=64*Math.max(0,Math.min(1,t/.25,(1.15-t)/.3));s.rect={x:p.dir===1?p.x+25:p.x-25-reach,y:p.floor-13,w:reach,h:9}}
    if(id===7){const q=t<.65?t/.65:(t-.65)/.95;const x=t<.65?p.x:p.x+80*q;const y=t<.65?p.y+(p.floor-p.y-12)*q:p.floor-12-Math.sin(q*Math.PI)*48;s.rect={x:x-10,y:y-10,w:20,h:20}}
    if(id===9)s.rect={x:p.x+32+t/1.4*64,y:p.floor-18,w:26,h:18}
    if(id===9&&s.rect&&!Array.from({length:3},(_,i)=>Math.floor(s.rect!.x/TILE)+i).every(c=>g.level.isSolidTile(g.level.tile(c,Math.round(p.floor/TILE))))){s.phase='recover';s.age=0;s.rect=null;return}
    if(id>=6)for(const player of g.players)if(player.alive&&patternContact(id,p,t,player))player.hurt(g,1,p.x)
    if(s.rect&&id<6)for(const player of g.players)if(player.alive&&overlap(player,s.rect))player.hurt(g,1,p.x)
    if(t>=(id===1?(p.right-p.x-12)/32:durations[id]!)){s.phase='recover';s.age=0;s.rect=null}
  }else if(s.phase==='recover'&&s.age>=.8){s.phase='idle';s.age=0;s.wait=id>=6?5:6;s.site=null}
}
function sprite(ctx:CanvasRenderingContext2D,pack:Pack,key:string,t:number,x:number,y:number,flip=false,size=128,attach?:'top'|'bottom'|'left'|'center'):void{
  const a=pack.animations[key];if(!a)return
  const i=Math.floor(t*a.fps),f=a.frames[a.loop?i%a.frames.length:Math.min(i,a.frames.length-1)]!
  if(attach){
    let b=tongueBounds.get(f)
    if(!b){
      const cv=document.createElement('canvas');cv.width=f.w;cv.height=f.h
      const scan=cv.getContext('2d',{willReadFrequently:true})!;scan.drawImage(pack.image,f.x,f.y,f.w,f.h,0,0,f.w,f.h)
      const data=scan.getImageData(0,0,f.w,f.h).data
      let left=f.w,top=f.h,right=0,bottom=0
      for(let py=0;py<f.h;py++)for(let px=0;px<f.w;px++)if(data[(py*f.w+px)*4+3]!>24){left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py)}
      b={x:left,y:top,w:right-left+1,h:bottom-top+1};tongueBounds.set(f,b)
    }
    if(attach==='top')y-=(b.y-f.pivot.y)*size/f.h
    if(attach==='bottom')y-=(b.y+b.h-f.pivot.y)*size/f.h
    if(attach==='left')x-=(b.x-f.pivot.x)*size/f.w
    if(attach==='center'){x-=((b.x+b.w/2)-f.pivot.x)*size/f.w;y-=((b.y+b.h/2)-f.pivot.y)*size/f.h}
  }
  ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1)
  ctx.drawImage(pack.image,f.x,f.y,f.w,f.h,-f.pivot.x*size/f.w,-f.pivot.y*size/f.h,size,size);ctx.restore()
}
const tongueBounds=new WeakMap<Frame,Rect>()
function tongue(ctx:CanvasRenderingContext2D,pack:Pack,key:string,t:number,r:Rect,cx:number,cy:number,flip:boolean):void{
  if(r.w<=0)return
  const a=pack.animations[key];if(!a)return
  const f=a.frames[Math.min(Math.floor(t*a.fps),a.frames.length-1)]!
  let b=tongueBounds.get(f)
  if(!b){
    const canvas=document.createElement('canvas');canvas.width=f.w;canvas.height=f.h
    const scan=canvas.getContext('2d',{willReadFrequently:true})!
    scan.drawImage(pack.image,f.x,f.y,f.w,f.h,0,0,f.w,f.h)
    const pixels=scan.getImageData(0,0,f.w,f.h).data
    let left=f.w,top=f.h,right=-1,bottom=-1
    for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[(y*f.w+x)*4+3]!>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
    b={x:left,y:top,w:right-left+1,h:bottom-top+1};tongueBounds.set(f,b)
  }
  if(b.w<=0||b.h<=0)return
  ctx.save();ctx.translate(r.x-cx+(flip?r.w:0),r.y-cy);if(flip)ctx.scale(-1,1)
  ctx.drawImage(pack.image,f.x+b.x,f.y+b.y,b.w,b.h,0,0,r.w,r.h);ctx.restore()
}
export function drawStagePattern(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number):void{
  const id=g.level.def.id,pack=packs.get(id);if(!pack||g.level.def.cave||g.mode!=='play')return
  const state=patternState(g),p=state.site
  const idle=['','hang','idle','idle','buried_trace','idle','cling','idle','idle','idle','idle']
  const warn=['','windup','inflate','crack','sand_ring','mouth_open','wing_shiver','push','charge','draw_water','light_up']
  const active=['','throw','erupt','idle','jaw_rise','mouth_open','sing','return','connect','push_water','release_spores']
  const recover=['','return','recover','retract','bury','idle','rest','return','extinguish','return','extinguish']
  ctx.save()
  // One selected actor only, so adjacent sites cannot produce concurrent attacks.
  const site=p??state.sites.map(s=>id===1?{...s,right:g.camX+VIEW_W-4}:s).find(s=>visible(g,bounds(s,id)))
  if(!site){ctx.restore();return}
  const phase=p?state.phase:'idle',t=state.age,x=site.x-cx,y=site.floor-cy
  let ax=x,ay=y
  if(id===1||[6,7,8].includes(id)){ax=x;ay=site.y-cy}
  if(id===1)ay+=4
  if(id===2)ax=x-32
  if(id===3){ax=x;ay=site.y-cy}
  if(id===5)ax=x
  const key=phase==='warn'?warn[id]:phase==='active'?active[id]:phase==='recover'?recover[id]:idle[id]
  if(!(id===4&&phase==='active'))sprite(ctx,pack,key!,t,ax,ay,id===5&&site.dir<0,id===7?48:id===5||id===9||id===10?64:[2,4,8].includes(id)?96:128,id===1?'top':id===3?'left':id===6?'center':'bottom')
  const color=['','#ffe6a2','#ffb34d','#a6efff','#ffe29b','#a8e3b5','#bcefff','#ffbb88','#e0b8ff','#9ceaff','#e6f3ad'][id]!
  if(id>=6){drawLater(ctx,pack,id,site,phase,t,cx,cy,state.rect);ctx.restore();return}
  if(phase==='warn'){
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.setLineDash([3,3])
    const rx=id===1?x:id===3?x:id===2?x+23:id===5?x+site.dir*25+(site.dir<0?-64:0):x-20
    const width=id===1?site.right-site.x:id===3||id===5?64:id===2?18:40
    const height=id===3?14:id===5?9:id===1?12:6
    ctx.strokeRect(rx,y-(id===1?22:id===3?27:id===5?13:6),width,height);ctx.setLineDash([])
    if(id===5)sprite(ctx,pack,'water_ring',t,x,y)
  }
  if(phase==='active'){
    const r=state.rect
    if(id===1&&r)sprite(ctx,pack,'coconut_spin',t,r.x+6-cx,r.y+6-cy,false,32)
    if(id===2){if(t<.85){const q=t/.85;sprite(ctx,pack,'lava_drop',t,x-32+q*64,y-6-Math.sin(q*Math.PI)*64,false,40)}else sprite(ctx,pack,'extinguish',t-.85,x+32,y,false,48)}
    if(id===3&&r){ctx.save();ctx.beginPath();ctx.rect(r.x-cx,r.y-cy,r.w,r.h);ctx.clip();sprite(ctx,pack,'wall_spear',t,x,y-20);ctx.restore()}
    if(id===4)sprite(ctx,pack,t>.32?'jaw_close':'jaw_rise',t,x,y,false,80,'bottom')
    if(id===5&&r){
      const key=t<.25?'tongue_extend':t>=.85?'tongue_retract':'tongue_hold'
      const local=t<.25?t:t>=.85?t-.85:t-.25
      tongue(ctx,pack,key,local,r,cx,cy,site.dir<0)
    }
  }
  ctx.restore()
}

// Shared geometry drives both the visible warning and exact active contact.
function patternContact(id:number,p:PatternSite,t:number,b:Rect):boolean{
  if(id===6){const c=soundCenter(p),radius=12+92*t/1.5,near=Math.hypot(Math.max(b.x-c.x,0,c.x-b.x-b.w),Math.max(b.y-c.y,0,c.y-b.y-b.h)),far=Math.max(...[b.x,b.x+b.w].flatMap(x=>[b.y,b.y+b.h].map(y=>Math.hypot(x-c.x,y-c.y))));return near<=radius+3&&far>=radius-3}
  if(id===7){const q=t<.65?t/.65:(t-.65)/.95,x=t<.65?p.x:p.x+80*q,y=t<.65?p.y+(p.floor-p.y-12)*q:p.floor-12-Math.sin(q*Math.PI)*48;return overlap(b,{x:x-10,y:y-10,w:20,h:20})}
  if(id===8){for(let i=0;i<=40;i++)if(overlap(b,{x:p.x-64+i*3.2-3,y:p.floor-24-i*1.6-3,w:6,h:6}))return true;return false}
  if(id===9)return overlap(b,{x:p.x+32+t/1.4*64,y:p.floor-18,w:26,h:18})
  const top=p.floor-126+t*10,gap=p.floor-65+t*10;return overlap(b,{x:p.x+40,y:top,w:24,h:gap-top-22})||overlap(b,{x:p.x+40,y:gap+22,w:24,h:Math.max(0,p.floor-gap-22)})
}
function drawLater(c:CanvasRenderingContext2D,pack:Pack,id:number,p:PatternSite,phase:string,t:number,cx:number,cy:number,r:Rect|null):void{
  if(phase==='recover'){if(id===7)sprite(c,pack,'terminal_fragments',t,p.x+80-cx,p.floor-cy,false,56);if(id===9)sprite(c,pack,'foam_dissipate',t,p.x+80-cx,p.floor-cy,false,48);return}
  if(phase!=='warn'&&phase!=='active')return
  const x=p.x-cx,y=p.floor-cy,active=phase==='active'
  c.strokeStyle=active?'#fff2bc':'#ffd876';c.fillStyle='rgba(242,213,143,.22)';c.lineWidth=active?5:2;c.setLineDash(active?[]:[4,3])
  if(id===6){const center=soundCenter(p),sx=center.x-cx,sy=center.y-cy,radius=active?12+92*t/1.5:104;c.beginPath();c.arc(sx,sy,radius,0,Math.PI*2);c.stroke();if(active)sprite(c,pack,'sound_ring_expand',t,sx,sy,false,radius*2)}
  if(id===7){for(const dx of [0,80])c.strokeRect(x+dx-12,y-5,24,5);if(active&&r){sprite(c,pack,'stone_rotate',t,r.x+10-cx,r.y+10-cy,false,40);if(t>.65&&t<.9)sprite(c,pack,'first_impact_dust',t-.65,x,y,false,56)}}
  if(id===8){c.beginPath();c.moveTo(x-64,y-24);c.lineTo(x+64,y-88);c.stroke();if(active)for(const [dx,dy] of [[-64,-24],[64,-88]])sprite(c,pack,'endpoint_refraction',t,x+dx!,y+dy!,false,40)}
  if(id===9){if(active&&r)tongue(c,pack,'low_wave',t,r,cx,cy,false);else c.strokeRect(x+32,y-18,90,18)}
  if(id===10){const fall=active?t*10:0,top=y-126+fall,gap=y-65+fall;for(const a of [{x:p.x+40,y:top+cy,w:24,h:39},{x:p.x+40,y:gap+22+cy,w:24,h:Math.max(0,y-gap-22)}]){if(active)tongue(c,pack,'spore_curtain',t,a,cx,cy,false);else c.strokeRect(a.x-cx,a.y-cy,a.w,a.h)}c.strokeStyle='#98ffcd';c.strokeRect(x+36,gap-22,32,44)}
}
