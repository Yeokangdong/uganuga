import type {Game} from './game'
import type {Player} from './entities'
import {overlap,VIEW_W,VIEW_H} from './constants'
import {localZone,patternHazard,patternZones} from './stagePatterns'

/** Hazards always telegraph for one full cycle second before becoming harmful. */
export function updateStagePattern(g:Game,dt:number,rest:Map<Player,number>):void {
  if(g.mode!=='play'||g.level.def.cave)return
  const def=g.level.def
  for(const p of g.players){
    if(!p.alive){rest.delete(p);continue}
    for(const z of patternZones(def)){
      const hazard=patternHazard(def,g.time,z)
      if(hazard.phase==='active'&&overlap(p,hazard.rect))p.hurt(g,1,z.x+z.w/2)
    }
    if(def.id===20&&p.onGround&&Math.abs(p.vx)<8&&p.hp<p.maxHp&&localZone(def,p)){
      const t=(rest.get(p)??0)+dt
      if(t>=3){p.heal(1);rest.set(p,0);g.popup(p.cx,p.y-5,'+1','#b6f6bb');g.burst(p.cx,p.y+p.h,'#f6c8ed',5)}
      else rest.set(p,t)
    }else rest.delete(p)
  }
}

export function drawStagePattern(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
  const def=g.level.def;if(def.cave||g.mode!=='play')return
  const id=def.id,time=g.time
  ctx.save()
  for(const z of patternZones(def)){
    const x=z.x-cx,y=z.y-cy,w=z.w
    if(x+w<0||x>VIEW_W)continue
    const hazard=patternHazard(def,time,z)
    const hazardStage=[2,9,11,12,16,19].includes(id)
    if(!hazardStage&&id!==13)continue
    const color=hazardStage?hazard.color:'#80dfff'
    if(id===13){ctx.globalAlpha=.2;ctx.fillStyle=color;ctx.fillRect(x,y-144,w,144);ctx.globalAlpha=.65;ctx.strokeStyle='#d2fbff';for(let i=0;i<4;i++){const py=y-((time*65+i*35)%144);ctx.beginPath();ctx.moveTo(x+12+i*12,py);ctx.lineTo(x+12+i*12,py+14);ctx.stroke()}}
    if(hazard.phase==='active'){
      const r=hazard.rect,px=r.x-cx,py=r.y-cy
      ctx.globalAlpha=.72;ctx.fillStyle=color
      if(id===11){ctx.fillStyle='#a59b7a';ctx.fillRect(px,py,r.w,r.h);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(px,py,r.w,r.h)}
      else if(id===16||id===19){ctx.beginPath();ctx.arc(px+9,py+10,9,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.3;ctx.fillRect(px+4,py-28,10,30)}
      else if(id===12){ctx.lineWidth=3;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x+w*.5,y-110);ctx.lineTo(x+w*.3,y-66);ctx.lineTo(x+w*.64,y-69);ctx.lineTo(x+w*.45,y);ctx.stroke();ctx.globalAlpha=.12;ctx.fillRect(px,py,r.w,r.h)}
      else {ctx.fillRect(px,py,r.w,r.h);ctx.strokeStyle='#fff1c4';ctx.beginPath();for(let i=0;i<=w;i+=8){ctx.moveTo(px+i,y);ctx.lineTo(px+i+Math.sin(time*13+i)*3,py+Math.sin(i+time*10)*4)}ctx.stroke()}
    }
    ctx.globalAlpha=1
  }
  if([4,7,14].includes(id)&&(id!==4||time%9>3)){
    ctx.globalAlpha=.45;ctx.strokeStyle=id===4?'#edc98b':id===14?'#e9b75e':'#d9efff';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=.7
    for(let i=0;i<24;i++){
      const x=((i*41+time*(id===7?Math.sin(time*.9)*-30:-45))%VIEW_W+VIEW_W)%VIEW_W,y=(i*29+time*13)%VIEW_H
      if(id===14){ctx.beginPath();ctx.ellipse(x,y,2.5,1,Math.sin(time+i),0,Math.PI*2);ctx.fill()}
      else{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y-2);ctx.stroke()}
    }
  }
  if(id===15&&time%10<4){const glow=ctx.createLinearGradient(0,0,0,VIEW_H*.65);glow.addColorStop(0,'rgba(125,255,215,.24)');glow.addColorStop(1,'rgba(143,144,255,0)');ctx.globalAlpha=1;ctx.fillStyle=glow;ctx.fillRect(0,0,VIEW_W,VIEW_H)}
  ctx.restore()
}
