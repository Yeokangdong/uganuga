import assert from 'node:assert/strict'
import {build} from 'esbuild'
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)})
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const bundle=await build({stdin:{contents:"export {Player} from './src/game/entities.ts'; export {Level,T} from './src/game/level.ts'; export {STAGES,makeCaveRoom} from './src/game/stages.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {Player,Level,T,STAGES,makeCaveRoom}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})}
function level(def){
  const rows=def.map.length,cols=def.map[0].length
  const lv=Object.assign(Object.create(Level.prototype),{def,rows,cols,arenaCol:def.arenaCol,tiles:new Uint8Array(rows*cols),ladders:new Uint8Array(rows*cols),cave:new Uint8Array(rows*cols)})
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)lv.tiles[r*cols+c]=({'#':T.Solid,R:T.Rock,'=':T.Platform,w:T.Water})[def.map[r][c]]??0
  return lv
}
const stage=STAGES[17],lv=level(stage),p=new Player(0)
const g={level:lv,mode:'play',camX:0,camY:0,enemies:[],projectiles:[],items:[],players:[p],boss:null,sfx:new Proxy({},{get:()=>()=>{}}),burst:()=>{},popup:()=>{},fx:()=>{},splash:()=>{}}
const idle={left:false,right:false,up:false,down:false,attack:false,jump:false,attackPressed:false,attackReleased:false,jumpPressed:false,downPressed:false,throwPressed:false}
function step(keys={}){p.update(g,.75/60,{...idle,...keys},1/60)}
function place(x,y){Object.assign(p,{x,y,vx:0,vy:0,dead:false,out:false,hp:10,onGround:true,knockbackT:0,swimming:false,invuln:0})}
assert.equal(stage.aerial.updrafts.length,9)
assert(!stage.icy&&!stage.aquatic)
assert(!makeCaveRoom(stage,1).aerial,'Cave must not inherit sky physics')
assert(lv.def.map[31].slice(0,190).includes('.'),'There must be open sky below islands')
// Traverse each real gap and altitude change using actual player movement/collisions.
const visited=[]
place(40,23*16-p.h)
for(const wind of stage.aerial.updrafts){
  const target=(wind.col+wind.w+2)*16
  let ticks=0,lifted=false
  while(p.x<target&&ticks++<900){step({right:true,up:true,jump:true});lifted ||= p.inUpdraft;assert(!p.dead,'Died crossing gap '+visited.length)}
  assert(p.x>=target,'Blocked at gap '+visited.length)
  assert(lifted,'Did not use wind at gap '+visited.length)
  for(let i=0;i<240&&!p.onGround;i++)step()
  assert(p.onGround,'No landing after gap '+visited.length)
  visited.push([Math.round(p.x),Math.round(p.y)])
}
while(p.x<lv.arenaX+32)step({right:true})
assert(!p.dead&&p.onGround,'Boss clearing must be reachable')
// Held jump slows descent; releasing it restores normal gravity.
place(50,150);p.onGround=false;p.vy=100
for(let i=0;i<30;i++)step({up:true,jump:true})
const glidedY=p.y;assert(p.gliding&&p.vy<=64)
place(50,150);p.onGround=false;p.vy=100
for(let i=0;i<30;i++)step()
assert(p.y>glidedY+40,'Gliding did not meaningfully slow falling')
// A landing checkpoint is retained after falling out of the sky.
place(60,23*16-p.h);step();const checkpoint=[p.x,p.y]
p.y=lv.height+30;step();assert(p.dead);p.spawnAt(g)
assert(Math.abs(p.x-checkpoint[0])<=16&&Math.abs(p.y-checkpoint[1])<1,'Fall lost the last island checkpoint')
console.log('Sky passed: all 9 wind crossings, 10 island landings, boss access, glide/release, fall checkpoint, and dry cave physics.',JSON.stringify(visited))
