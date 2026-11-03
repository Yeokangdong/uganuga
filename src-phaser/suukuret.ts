import { art } from '../src/game/art'
import type { Game } from '../src/game/game'
import type { Level } from '../src/game/level'

const files=import.meta.glob('./assets/suukuret_*',{query:'?url',import:'default',eager:true}) as Record<string,string>
const actions=['idle','flee','lunge','swim','dangle','burn','freeze','slip','hug'] as const
type Action=typeof actions[number]
type Box={x:number;y:number;w:number;h:number}
type Pack={image:HTMLImageElement;frames:Box[];left:number;right:number;bottom:number;height:number}
const packs={} as Record<Action,Pack>
let loading:Promise<void>|undefined
export function loadSuukuret(){
  return loading??=Promise.all(actions.map(async action=>{
    const base=`./assets/suukuret_${action}`
    const data=await (await fetch(files[base+'.json']!)).json()
    const image=new Image();image.src=files[base+'.png']!;await image.decode()
    const frames=Object.values(data.frames as Record<string,{frame:Box}>).map(v=>v.frame)
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0)
    const pixels=ctx.getImageData(0,0,image.width,image.height).data
    let left=Infinity,right=0,top=Infinity,bottom=0
    for(const f of frames)for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[((f.y+y)*image.width+f.x+x)*4+3]!>24){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1)}
    packs[action]={image,frames,left,right,bottom,height:bottom-top}
  })).then(()=>{}).catch(error=>{loading=undefined;throw error})
}

export function drawSuukuret(ctx:CanvasRenderingContext2D,action:Action,age:number,x:number,y:number,dir=1){
  const pack=packs[action];if(!pack)return
  const f=pack.frames[Math.floor(age*12)%pack.frames.length]!,scale=12/packs.idle.height
  ctx.save();ctx.translate(x,y);ctx.scale(dir,1)
  ctx.drawImage(pack.image,f.x,f.y,f.w,f.h,-(pack.left+pack.right)/2*scale,-pack.bottom*scale,f.w*scale,f.h*scale)
  ctx.restore()
}

/** Replace the shared opening painter's animal frames at the Phaser boundary. */
export function replaceOpeningAnimal(){
  const p=packs.flee
  for(const key of Object.keys(art.sprites).filter(key=>key.startsWith('squirrel.'))){
    art.sprites[key]={img:p.image,frames:p.frames.map(f=>[f.x,f.y,f.w,f.h,(p.left+p.right)/2/f.w,p.bottom/f.h]),h:p.frames[0]!.h*12/packs.idle.height,fps:12,ax:.5,ay:1}
  }
}

type Animal={x:number;y:number;home:number;age:number;action:Action;reaction:Action;flee:boolean;gone:boolean;dir:number}
export class SuukuretPopulation {
  animals:Animal[]=[]
  private level!:Level
  place(level:Level){
    this.level=level;this.animals=[]
    const sites:{x:number;y:number;reaction:Action}[]=[]
    const reaction:Action=level.def.theme.music==='volcano'||/용암|화산/.test(level.def.sub)?'burn':level.def.icy||/빙하|얼음|설원/.test(level.def.sub)?'freeze':'idle'
    // Search authored surfaces at map creation, never at camera arrival.
    for(let x=144;x<level.arenaX-96;x+=16){
      const y=level.floorBelow(x,0)
      if(y>=level.height||level.solidAt(x,y-16)||Math.abs(level.floorBelow(x-8,0)-y)>1||Math.abs(level.floorBelow(x+8,0)-y)>1)continue
      sites.push({x,y,reaction:reaction==='idle'&&level.waterAt(x,y+2)?'swim':reaction})
    }
    const first=sites.find(s=>s.x>=176)??sites[0]
    const water=sites.find(s=>s.reaction==='swim'&&(!first||Math.abs(s.x-first.x)>160))
    const second=water??sites.find(s=>s.x>Math.max(480,(first?.x??0)+320))
    for(const site of [first,second])if(site)this.animals.push({x:site.x,y:site.y,home:site.x,age:0,action:site.reaction,reaction:site.reaction,flee:false,gone:false,dir:1})
    // Hanging poses include their own rock, placed only at an authored cliff edge.
    const edge=[7,13].includes(level.def.id)?sites.find(s=>s.x>320&&s.reaction==='idle'&&level.floorBelow(s.x+16,0)>s.y+48):undefined
    const cliff=level.patternCliffs.find(c=>c.x>320&&c.x<level.arenaX-96)??(edge?{x:edge.x+8,y:edge.y}:undefined)
    if(cliff&&this.animals[1]&&reaction==='idle')Object.assign(this.animals[1],{x:cliff.x,y:cliff.y,home:cliff.x,action:'dangle',reaction:'dangle'})
  }
  advance(game:Game,dt:number){
    if(game.level!==this.level)return
    const p=game.players[0]!
    for(const a of this.animals){
      if(a.gone)continue
      a.age+=dt
      const hit=game.projectiles.some(q=>!q.dead&&Math.abs(q.x+q.w/2-a.x)<q.w/2+8&&Math.abs(q.y+q.h/2-(a.y-6))<q.h/2+8)
      if(!a.flee&&(hit||p.alive&&Math.hypot(p.cx-a.x,p.y+p.h-a.y)<(p.swingT>0?80:48))){a.flee=true;a.action='flee';a.age=0;a.dir=p.cx<a.x?1:-1}
      if(a.flee){
        a.x+=a.dir*110*dt
        const floor=this.level.floorBelow(a.x,Math.max(0,a.y-24))
        if(Math.abs(floor-a.y)<=24)a.y=floor
        else a.y=Math.min(floor,a.y+100*dt)
        if(a.x<game.camX-32||a.x>game.camX+416||a.x<0||a.x>this.level.width)a.gone=true
      }else{
        const beat=Math.floor(a.age/3)%6
        a.action=beat===0||beat===3?(a.reaction==='freeze'&&beat===3?'slip':a.reaction):beat===1||beat===4?'hug':beat===2?'idle':'lunge'
        if(a.reaction==='swim'||a.reaction==='dangle')a.action=a.reaction
      }
    }
  }
  draw(game:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
    if(game.level!==this.level)return
    for(const a of this.animals)if(!a.gone)drawSuukuret(ctx,a.action,a.age,a.x-cx,a.y-cy,a.dir)
  }
}
