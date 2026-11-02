import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {writeFileSync} from 'node:fs'
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)})
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const bundle=await build({stdin:{contents:"export {Player} from './src/game/entities.ts'; export {Level,T} from './src/game/level.ts'; export {STAGES,makeCaveRoom} from './src/game/stages.ts'; export * from './src/game/stagePatterns.ts'; export {updateStagePattern} from './src/game/patternRuntime.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {Player,Level,T,STAGES,makeCaveRoom,STAGE_PATTERNS,patternZones,patternMovement,patternHazard,updateStagePattern}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})}
function level(def){
  const rows=def.map.length,cols=def.map[0].length
  const lv=Object.assign(Object.create(Level.prototype),{def,rows,cols,arenaCol:def.arenaCol,tiles:new Uint8Array(rows*cols),ladders:new Uint8Array(rows*cols),cave:new Uint8Array(rows*cols)})
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)lv.tiles[r*cols+c]=({'#':T.Solid,R:T.Rock,'=':T.Platform,w:T.Water})[def.map[r][c]]??0
  return lv
}
function scene(id){
  const def=STAGES[id-1],lv=level(def),p=new Player(0),z=patternZones(def)[0]
  Object.assign(p,{x:z?.x+12||40,y:(z?.y??336)-p.h,onGround:true})
  const g={level:lv,mode:'play',time:0,camX:0,camY:0,enemies:[],projectiles:[],items:[],players:[p],boss:null,sfx:new Proxy({},{get:()=>()=>{}}),burst:()=>{},popup:()=>{},fx:()=>{},splash:()=>{}}
  return {def,p,g,z}
}
const idle={left:false,right:false,up:false,down:false,attack:false,jump:false,attackPressed:false,attackReleased:false,jumpPressed:false,downPressed:false}
function tick(g,p,keys={}){p.update(g,.75/60,{...idle,...keys},1/60)}
assert.equal(new Set(STAGE_PATTERNS.map(p=>p[0])).size,20)
for(const def of STAGES){
  if(!def.aquatic&&!def.aerial)assert(patternZones(def).length>0,'No reachable zones in stage '+def.id)
  for(const z of patternZones(def))assert(z.x>16*16&&z.x+z.w<def.arenaCol*16,'Hazard overlaps spawn or boss arena')
  assert.equal(patternZones(makeCaveRoom(def,1)).length,0)
  const neutral=patternMovement(def,5,{x:def.arenaCol*16+20,y:200,w:14,h:22,onGround:true})
  assert.deepEqual(neutral,{speed:1,gravity:1,jump:1,climb:1,wind:0,fallCap:480,slip:false,bounce:0})
}
// The actual player gets different displacement and jump impulse on marked surfaces.
for(const [id,check] of [[5,p=>p.vx<50],[6,p=>p.vy<-430],[8,p=>p.vy<-450]]){
  const {p,g}=scene(id)
  if(id===5)for(let i=0;i<20;i++)tick(g,p,{right:true})
  else tick(g,p,{up:true,jump:true,jumpPressed:true})
  assert(check(p),'Stage '+id+' movement effect missing')
}
{
  const {p,g,z}=scene(10);p.y=z.y-p.h-2;p.onGround=false;p.vy=100;for(let i=0;i<3;i++)tick(g,p)
  assert(!p.onGround&&p.vy<0,'Mushroom must bounce on landing')
}
assert(patternMovement(STAGES[0],0,{x:40,y:100,w:14,h:22,onGround:true}).climb>1)
assert(patternMovement(STAGES[2],0,{x:40,y:100,w:14,h:22,onGround:true}).slip)
assert(patternMovement(STAGES[3],5,{x:40,y:100,w:14,h:22,onGround:true}).wind<0)
assert(patternMovement(STAGES[6],2,{x:40,y:100,w:14,h:22,onGround:false}).wind>0)
assert(patternMovement(STAGES[6],5,{x:40,y:100,w:14,h:22,onGround:false}).wind<0)
{const {p,g}=scene(13);const m=patternMovement(g.level.def,0,p);assert(m.gravity<1&&m.jump>1)}
assert(patternMovement(STAGES[13],0,{x:40,y:100,w:14,h:22,onGround:false}).fallCap<100)
assert(patternMovement(STAGES[14],0,{x:40,y:100,w:14,h:22,onGround:false}).gravity<1)
assert.equal(patternMovement(STAGES[14],5,{x:40,y:100,w:14,h:22,onGround:false}).gravity,1)
assert(patternMovement(STAGES[18],0,{x:40,y:100,w:14,h:22,onGround:false}).gravity<1)
// Every timed hazard warns without damage, then damages only inside its active hitbox.
for(const id of [2,9,11,12,16,19]){
  const {p,g,z,def}=scene(id),period=id===12?6.5:id===9?5:7
  g.time=period-1.5
  assert.equal(patternHazard(def,g.time,z).phase,'warn')
  updateStagePattern(g,1/60,new Map());assert.equal(p.hp,10,'Warning hurt player '+id)
  g.time=period-.15
  const hazard=patternHazard(def,g.time,z);assert.equal(hazard.phase,'active')
  p.x=hazard.rect.x+1;p.y=hazard.rect.y+1
  updateStagePattern(g,1/60,new Map());assert.equal(p.hp,9,'Active hazard failed '+id)
  const hp=p.hp;updateStagePattern(g,1/60,new Map());assert.equal(p.hp,hp,'Invulnerability ignored '+id)
  p.invuln=0;p.x=z.x+z.w+40;updateStagePattern(g,1/60,new Map());assert.equal(p.hp,hp,'Safe path hurt '+id)
  g.mode='boss';p.x=z.x+1;updateStagePattern(g,1/60,new Map());assert.equal(p.hp,hp,'Exploration hazard active during boss '+id)
}
{const {p,g}=scene(20);p.hp=7;const rest=new Map();for(let i=0;i<181;i++)updateStagePattern(g,1/60,rest);assert.equal(p.hp,8,'Flower rest must heal');p.vx=90;updateStagePattern(g,1/60,rest);assert(!rest.has(p),'Moving should reset recovery')}
console.log('Stage patterns passed: 20 distinct rules, supported zones, movement effects, 6 warning/damage cycles, invulnerability, safe boss/cave areas, mushroom bounce and flower recovery.')
writeFileSync(new URL('../art-src/stage-patterns-v1/patterns.json',import.meta.url),JSON.stringify(STAGES.map(s=>({stage:s.id,map:s.sub,name:STAGE_PATTERNS[s.id-1][0],hint:STAGE_PATTERNS[s.id-1][1],zones:patternZones(s)})),null,2)+'\n')
