import assert from 'node:assert/strict'
import {build} from 'esbuild'
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)})
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const bundle=await build({stdin:{contents:"export {Player} from './src/game/entities.ts'; export {Level,T} from './src/game/level.ts'; export {STAGES} from './src/game/stages.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {Player,Level,T,STAGES}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})}
function level(def){
  const rows=def.map.length,cols=def.map[0].length
  const lv=Object.assign(Object.create(Level.prototype),{def,rows,cols,arenaCol:def.arenaCol,tiles:new Uint8Array(rows*cols),ladders:new Uint8Array(rows*cols),cave:new Uint8Array(rows*cols)})
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)lv.tiles[r*cols+c]=({'#':T.Solid,R:T.Rock,'=':T.Platform,w:T.Water})[def.map[r][c]]??0
  return lv
}
const lv=level(STAGES[16]),p=new Player(0)
const g={level:lv,mode:'play',camX:0,camY:0,enemies:[],projectiles:[],items:[],players:[p],boss:null,sfx:new Proxy({},{get:()=>()=>{}}),burst:()=>{},popup:()=>{},fx:()=>{},splash:()=>{}}
const idle={left:false,right:false,up:false,down:false,attack:false,jump:false,attackPressed:false,attackReleased:false,jumpPressed:false,downPressed:false,throwPressed:false}
function place(x=26*16,y=360){Object.assign(p,{x,y,vx:0,vy:0,hp:10,dead:false,out:false,swimming:false,submerged:false,oxygen:20,invuln:0,spawnFireT:0,knockbackT:0,onGround:false})}
function step(seconds,keys={}){for(let i=0;i<Math.round(seconds*60);i++)p.update(g,.75/60,{...idle,...keys},1/60)}
assert.equal(lv.def.aquatic.airPockets.length,5)
place();step(1,{down:true});assert(p.swimming&&p.submerged&&!p.dead);assert(p.y>390);assert(Math.abs(p.oxygen-19)<.01)
place();step(1,{up:true});assert(p.y<330)
place();step(1,{right:true});assert(p.x>450)
place();step(20.1);assert.equal(p.oxygen,0);assert.equal(p.hp,10);step(2);assert.equal(p.hp,8);assert(!p.dead)
place(26*16,144-6);p.oxygen=5;step(.5);assert(p.oxygen>8&&!p.submerged,'Surface must restore breath')
const air=lv.def.aquatic.airPockets[0]
place((air.col+4)*16,(air.row+air.h)*16-p.h*.7);p.oxygen=5;step(.5);step(8);assert(p.oxygen>15,'Air pocket must restore breath while resting')
place((air.col+4)*16,(air.row+air.h)*16+60);p.oxygen=5;step(2,{up:true});step(8);assert.equal(p.oxygen,20,'Entering an air pocket from below must allow a full refill')
place();p.oxygen=0;p.hp=2;step(2.1);assert(p.dead&&p.lives===2,'Exhausted breath must cause gradual damage and a normal death')
p.spawnAt(g);assert.equal(p.oxygen,20);assert(!p.dead&&!lv.waterAt(p.cx,p.y+p.h-1),'Respawn must use dry ground')
place(18*16+4,144-6);p.swimming=true;step(1.5,{up:true,left:true});assert(p.x<18*16&&p.y+p.h<=145&&!p.dead,'Swimmer must be able to climb onto shore')
const lava=level(STAGES[1]);lava.tiles.fill(T.Water);assert(!lava.swimmableAt(80,80),'Lava must remain dangerous')
const fresh=level(STAGES[0]);fresh.tiles.fill(T.Water);assert(fresh.swimmableAt(80,80),'Fresh water should allow swimming')
console.log('Underwater passed: four-way swimming, real-time 20-second breath, surface/air recovery, gradual drowning, dry respawn, shore exit, and lava safety.')


