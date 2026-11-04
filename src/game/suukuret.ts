import { TILE } from './constants'
import { art, drawArt, frameAt } from './art'
import type { Level } from './level'
import type { Game } from './game'

type Action='idle'|'slip'|'hug'|'lunge'|'flee'|'burn'|'freeze'|'swim'|'dangle'
interface Animal { x:number; y:number; home:number; feet:number; age:number; stateT:number; action:Action; reaction:Action; dir:number; gone:boolean; restT:number; gestures:number; seed:number }
const ANIMATION_RATE=.6, MOVEMENT_TIME=.75
// Every sheet begins with the same neutral standing pose. Match that reference
// once per sheet; later crouches, slips, jumps and props keep their own shapes.
const standingPixels:Record<Action,number>={idle:93,slip:75,hug:80,lunge:75,flee:86,burn:87,freeze:80,swim:87,dangle:93}
const poseScale=(action:Action)=>standingPixels.idle/standingPixels[action]
const restDuration=(a:Animal)=>(6+((a.seed+a.gestures*11)%41)/10)*MOVEMENT_TIME
function gestureDuration(action:Action):number {
  const s=art.sprites['suukuret.'+action]
  const seconds=s?.durationsMs?s.durationsMs.reduce((sum,ms)=>sum+ms,0)/1000:(s?.frames.length??12)/(s?.fps??12)
  return Math.max(1.2,seconds/ANIMATION_RATE)
}
/** Decorative population: never enters collision, combat, drops or scoring collections. */
export class SuukuretPopulation {
  animals:Animal[]=[]
  private level!:Level
  place(level:Level):void {
    this.level=level;this.animals=[]
    const sites:{x:number;y:number}[]=[]
    for(let x=176;x<level.arenaX-96;x+=TILE){
      const y=level.floorBelow(x,0)
      // Wide continuous support excludes jump landings, ledges, doors and ladder exits.
      if(!level.combatFloor(x-40,y,80,32))continue
      if((level.def.map.ladders??[]).some(([c])=>Math.abs(c*TILE-x)<64))continue
      if(level.spawns.some(s=>s.kind==='D'&&Math.abs(s.col*TILE-x)<80))continue
      sites.push({x,y})
    }
    const first=sites[0],second=sites.find(s=>s.x>(first?.x??0)+420)
    for(const site of [first,second])if(site){
      const reaction:Action=level.def.theme.music==='volcano'?'burn':level.def.icy?'freeze':'idle'
      const animal:Animal={...site,home:site.x,feet:site.y,age:0,stateT:0,action:'idle',reaction,dir:1,gone:false,restT:0,gestures:0,seed:level.def.id*17+this.animals.length*23}
      animal.restT=restDuration(animal);this.animals.push(animal)
    }
    if([5,9,13].includes(level.def.id)){
      let pool:{x:number;y:number}|undefined
      for(let r=2;r<level.rows-1&&!pool;r++)for(let c=12;c<level.cols-6;c++){
        const x=c*TILE+8,y=r*TILE
        if(x>=level.arenaX-96||!level.waterAt(x,y+2)||level.waterAt(x,y-2))continue
        if((level.def.map.ladders??[]).some(([col])=>Math.abs(col*TILE-x)<64))continue
        pool={x,y};break
      }
      if(pool){
        const animal=this.animals[1]??this.animals[0]
        if(animal)Object.assign(animal,{...pool,home:pool.x,feet:pool.y,reaction:'swim'})
      }
    }
    // A decorative ledge pose is outside the traversable landing area.
    if([7,12].includes(level.def.id)&&this.animals[1]){
      let cliff:{x:number;y:number}|undefined=level.patternCliffs.find(c=>c.x>320&&c.x<level.arenaX-96)
      for(let x=336;!cliff&&x<level.arenaX-96;x+=TILE){
        const y=level.floorBelow(x,0)
        if(y<level.height-32&&level.floorBelow(x+TILE,0)>y+32&&!level.isLadder(Math.floor(x/TILE),Math.floor(y/TILE)-1))cliff={x:x+8,y}
      }
      if(cliff)Object.assign(this.animals[1],{x:cliff.x+8,y:cliff.y+12,home:cliff.x+8,feet:cliff.y+12,reaction:'dangle'})
    }
  }
  update(game:Game,dt:number):void {
    if(game.mode!=='play'||game.level!==this.level)return
    for(const a of this.animals){
      if(a.gone)continue
      a.age+=dt;a.stateT+=dt
      if(a.action==='flee'){
        a.x+=a.dir*105*dt
        const floor=this.level.floorBelow(a.x,Math.max(0,a.y-24))
        a.y=Math.abs(floor-a.y)<20?floor:Math.min(floor,a.y+160*dt)
        if(a.stateT>5.25||a.x<0||a.x>this.level.width)a.gone=true
        continue
      }
      if(a.action==='lunge'){
        if(a.stateT>=.65){a.action='flee';a.stateT=0}
        continue
      }
      const p=game.players.find(p=>p.alive&&!p.out&&Math.hypot(p.cx-a.x,p.y+p.h-a.y)<68)
      if(p){a.action='lunge';a.stateT=0;a.dir=p.cx<a.x?1:-1;continue}
      if(a.action!=='idle'){
        if(a.stateT>=gestureDuration(a.action)){
          a.action='idle';a.stateT=0;a.restT=restDuration(a);a.x=a.home
        }
        continue
      }
      a.restT-=dt
      if(a.restT<=0){
        a.action=a.reaction!=='idle'?a.reaction:a.gestures%2===0?'hug':'slip'
        a.gestures++;a.stateT=0
      }
      a.x=a.home
    }
  }
  draw(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    for(const a of this.animals){
      if(a.gone)continue
      if(a.action==='dangle'){
        // Missing approved animation: temporary shapes only (Ludo request).
        ctx.fillStyle='#b99467';ctx.fillRect(a.x-cx-3,a.y-cy-14,6,13)
        ctx.strokeStyle='#b99467';ctx.beginPath();ctx.moveTo(a.x-cx-6,a.y-cy-20);ctx.lineTo(a.x-cx,a.y-cy-10);ctx.lineTo(a.x-cx+6,a.y-cy-20);ctx.stroke();continue
      }
      const key='suukuret.'+a.action
      const alpha=a.action==='flee'?Math.min(1,Math.max(0,(5.25-a.stateT)/.75)):1
      drawArt(ctx,key,frameAt(key,a.stateT*ANIMATION_RATE),a.x-cx,a.y-cy,a.dir<0,{scale:poseScale(a.action),alpha})
      if(a.action==='slip'||a.action==='hug'){
        ctx.fillStyle='#99b94d'
        ctx.fillRect(a.home-cx+12,a.feet-cy-3,6,3)
      }
    }
  }
}
