import {build} from 'esbuild'
import assert from 'node:assert/strict'
import fs from 'node:fs'
async function load(path){
  const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}})
  return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
const {STAGES,makeCaveRoom}=await load('src/game/stages.ts')
const {CAVE_REWARDS,rollCaveReward,caveRewardCount,addCaveLife}=await load('src/game/caveRewards.ts')
const {Game,CLOCK_BONUS}=await load('src/game/game.ts')
const {Item}=await load('src/game/entities.ts')
const report=[]
for(const stage of STAGES){
  const doors=[]
  for(let r=0;r<stage.map.length;r++)for(let c=0;c<stage.map[r].length;c++)if(stage.map[r][c]==='D'){
    assert(c>=32&&c<stage.arenaCol-10,`Stage ${stage.id}: cave in opening or arena`)
    const solid=(x,y)=>['#','R'].includes(stage.map[Math.floor(y/16)]?.[Math.floor(x/16)])
    const center=c*16+8,floor=(r+1)*16
    assert(Array.from({length:15},(_,i)=>center-56+i*8).every(x=>solid(x,floor+1)&&!solid(x,floor-1)),`Unsupported cave ${stage.id}:${c}`)
    assert(!solid(center,floor-24))
    doors.push({col:c,row:r})
  }
  assert(doors.length>=2&&doors.length<=4,`Stage ${stage.id}: ${doors.length} caves`)
  for(const random of [()=>0,()=>.5,()=>.999]){
    const room=makeCaveRoom(stage,stage.id*100,random),text=room.map.join('')
    assert.equal((text.match(/\?/g)??[]).length,caveRewardCount(random))
    assert(!/[XSEMUFDkb]/.test(text),'Unexpected cave trap or fixed reward')
    assert.equal(room.theme.background,stage.theme.background)
    assert.equal(room.caveEntrance,stage.caveEntrance)
    assert.equal(room.encounters.length,0);assert.equal(room.aquatic,undefined);assert.equal(room.aerial,undefined)
  }
  report.push({stage:stage.id,name:stage.sub,doors})
}
assert.deepEqual([0,.25,.5,.75].map(r=>rollCaveReward(()=>r)),CAVE_REWARDS)
assert.equal(addCaveLife(3),4);assert.equal(addCaveLife(9),9)
for(const kind of CAVE_REWARDS){
  const p={alive:true,x:0,y:0,w:12,h:20,lives:3,score:0,heal(n){this.healed=n}}
  const it=new Item(kind,0,0),g={players:[p],enemies:[],projectiles:[],items:[it],boss:null,food:0,foodMax:100,timeLeft:100,sfx:{pickup(){}},popup(){}}
  Game.prototype.collide.call(g)
  assert(it.dead,kind+' not consumed')
  if(kind==='cross')assert.equal(p.lives,4)
  if(kind==='clock')assert.equal(g.timeLeft,100+CLOCK_BONUS)
  if(kind==='meat'){assert.equal(g.food,20);assert.equal(p.healed,3)}
  if(kind==='fruit')assert.equal(g.food,5)
  const score=p.score;Game.prototype.collide.call(g);assert.equal(p.score,score,'Reward collected twice')
}
// Exercise the real entry/exit methods against cached independent cave rooms.
const world={},room={floorBelow:()=>192},reward={dead:true},otherReward={dead:false}
const door={x:800,floor:336,id:0,used:true,room:{level:room,enemies:[],items:[reward],ambushes:[]}}
const second={x:1600,floor:336,id:1,used:false,room:{level:room,enemies:[],items:[otherReward],ambushes:[]}}
const g={stage:STAGES[0],level:world,camX:500,camY:168,players:[],enemies:[],projectiles:[],items:[],ambushes:[],spawn(){},sfx:{thud(){}},showBanner(){}}
const originalRandom=Math.random
Math.random=()=>{throw new Error('Re-entry rerolled a cave')}
try{
  Game.prototype.enterCave.call(g,door);assert.equal(g.items[0],reward)
  Game.prototype.exitCave.call(g);assert.equal(g.level,world)
  Game.prototype.enterCave.call(g,second);assert.equal(g.items[0],otherReward)
  Game.prototype.exitCave.call(g)
  Game.prototype.enterCave.call(g,door);assert(g.items[0].dead)
}finally{Math.random=originalRandom}
fs.mkdirSync('shots/caves',{recursive:true})
fs.writeFileSync('shots/caves/placement-report.json',JSON.stringify(report,null,2)+'\n')
console.log('PASS: 20 maps have 2–4 supported caves away from the opening; 1–3 random rewards, all four pickup effects, themed rooms and persistent independent revisits')
