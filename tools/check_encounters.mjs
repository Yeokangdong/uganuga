import {build} from 'esbuild'
import assert from 'node:assert/strict'
import fs from 'node:fs'

async function bundle(path){
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,
    define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const {STAGES,BESTIARY,HABITATS,makeCaveRoom}=await bundle('src/game/stages.ts')
const {ContactAnimal}=await bundle('src/game/entities.ts')
const {Game}=await bundle('src/game/game.ts')
const packs=['monsters-v7','monsters-v9','world-v8'].map(folder=>JSON.parse(fs.readFileSync(`public/assets/${folder}/manifest.json`)))
const sprites=Object.assign({},...packs.map(p=>p.sprites))
const seen=new Set(),roster=[]
for(const stage of STAGES){
  const encounters=[...stage.encounters]
  for(let row=0;row<stage.map.length;row++)for(let col=0;col<stage.map[row].length;col++){
    const mark=stage.map[row][col]
    if('EMUF'.includes(mark))encounters.push({col,row,cfg:stage.roles[mark],group:mark==='F'?'상단 경로 공중 경비':'주 경로 수문장'})
  }
  assert(encounters.length>=7&&encounters.length<=8,`Stage ${stage.id}: encounter budget exceeded`)
  const species=new Set(encounters.map(e=>e.cfg.key))
  assert(species.size>=4,`Stage ${stage.id}: insufficient variety`)
  assert(encounters.some(e=>e.cfg.cls==='flyer'))
  assert(encounters.some(e=>e.cfg.cls!=='flyer'))
  assert(encounters.filter(e=>e.cfg.cls!=='flyer'&&e.cfg.reward!=='treasure').length>=5,'Insufficient main-route food')
  assert.equal(encounters.filter(e=>e.cfg.reward==='treasure'&&e.cfg.hp>=4).length,1,'Stage '+stage.id+': optional guard must reward big meat')
  assert.equal(makeCaveRoom(stage,0).encounters.length,0,'Overworld enemies leaked into cave')
  for(const e of encounters){
    seen.add(e.cfg.key)
    assert(e.col>=25&&e.col<stage.arenaCol-12)
    for(let r=0;r<stage.map.length;r++)for(let c=0;c<stage.map[r].length;c++)if(stage.map[r][c]==='D')assert(Math.abs(e.col-c)>=7,'Enemy crowds a cave entrance')
    assert('.EMUF'.includes(stage.map[e.row][e.col]))
    if(e.cfg.cls!=='flyer'){
      for(let c=e.col-1;c<=e.col+2;c++)assert(['#','=','R'].includes(stage.map[e.row+1][c]),`Unsupported ${stage.id} ${e.cfg.key}`)
      assert(!(stage.map.ladders??[]).some(([x,top,bottom])=>Math.abs(e.col-x)<3&&e.row>=top-2&&e.row<=bottom))
    }
    const key=sprites[e.cfg.key+'.walk']?e.cfg.key:e.cfg.fallbackKey
    for(const action of ['walk','idle','hit','windup','attack','collapse','stun','recover'])assert(sprites[key+'.'+action],key+'.'+action)
  }
  roster.push({stage:stage.id,name:stage.sub,formation:HABITATS[stage.id-1].formation,
    localSpecies:Object.values(stage.roles).map(cfg=>({key:cfg.key,fallback:cfg.fallbackKey,behavior:cfg.behavior})),
    addedSpecies:[...species],addedCount:encounters.length,
    encounters:encounters.map(e=>({col:e.col,row:e.row,name:e.cfg.name,species:e.cfg.key,behavior:e.cfg.behavior,group:e.group}))})
}

// Simulate real movement/status code on a flat bank with a nearby player.
function game(){
  const level={height:384,width:1600,tile:(c,r)=>c<0||c>=100||r>=21?1:0,
    isSolidTile:t=>t===1,isLadderTop:()=>false,solidAt:(x,y)=>x<0||x>=1600||y>=336,waterAt:()=>false}
  return {level,nearestPlayer:()=>({cx:360,y:310,h:26,alive:true}),projectiles:[],sfx:{throw(){}},splash(){}}
}
for(const [species,behavior] of [['scarab','charge'],['scorpion','ambush'],['frog','hopper'],['ember','sentry'],['owl','swoop'],['ray','hover']]){
  const cfg=BESTIARY[species],g=game(),enemy=new ContactAnimal(cfg,310,cfg.cls==='flyer'?240:336-cfg.h)
  enemy.onGround=cfg.cls!=='flyer'
  const states=new Set(),poses=new Set();let airborne=false
  for(let frame=0;frame<600;frame++){
    enemy.update(g,1/60);states.add(enemy.phase);poses.add(enemy.action)
    if(enemy.vy<0)airborne=true
    assert(Number.isFinite(enemy.x)&&Number.isFinite(enemy.y)&&!enemy.dead,`${behavior} invalid movement`)
  }
  if(behavior!=='hover'){assert(states.has('warn'),`${behavior}: missing telegraph`);assert(states.has('act'),`${behavior}: never attacks`);assert(states.has('rest'),`${behavior}: no recovery window`)}
  if(behavior==='hopper'||behavior==='ambush')assert(airborne,behavior+' never jumps')
  if(behavior==='sentry')assert(g.projectiles.length>0,'Sentry never fires')
  // Stun suppresses behavior and projectile creation.
  enemy.stunT=3;enemy.flash=0
  const count=g.projectiles.length
  for(let frame=0;frame<60;frame++)enemy.update(g,1/60)
  assert.equal(g.projectiles.length,count)
}
// A patrol at a cliff edge must turn before entering water or empty space.
const g=game();g.level.tile=(c,r)=>r>=21&&c<22?1:0;g.level.solidAt=(x,y)=>x<352&&y>=336
const patrol=new ContactAnimal(BESTIARY.scarab,320,336-BESTIARY.scarab.h)
patrol.onGround=true;patrol.facing=1
patrol.update(g,1/60);assert.equal(patrol.facing,-1);assert(patrol.x+patrol.w<352)
const spawnGame=Object.assign(Object.create(Game.prototype),{camX:300,stage:STAGES[0],players:[{alive:true,cx:310}],enemies:[],items:[],level:{spawns:[26,35,40].map(col=>({col,row:20,kind:'A',cfg:BESTIARY.scarab})),floorBelow:()=>336}})
spawnGame.spawn();assert.equal(spawnGame.enemies.length,2,'Visible combat cap failed');assert(!spawnGame.level.spawns[2].done,'Deferred guard was lost')
spawnGame.enemies[0].dead=true;spawnGame.spawn();assert.equal(spawnGame.enemies.filter(e=>!e.dead).length,2);assert(spawnGame.level.spawns[2].done)
const guardCfg=STAGES[0].encounters.find(e=>e.cfg.reward==='treasure').cfg
const rewardGame={stage:STAGES[0],mode:'play',level:{def:STAGES[0]},items:[],sfx:new Proxy({},{get:()=>()=>{}}),popup(){},fx(){},burst(){}}
const guard=new ContactAnimal(guardCfg,100,100),collector={score:0};guard.stunT=3
for(let i=0;i<3;i++){guard.flash=0;guard.hit(rewardGame,1,0,collector)}
assert(guard.dead&&rewardGame.items.some(i=>i.kind==='bigmeat'),'Optional fight must pay a larger food reward');assert.equal(collector.score,guardCfg.score)
fs.writeFileSync('art-src/encounter-balance-v1/encounters.json',JSON.stringify(roster,null,2)+'\n')
const before=JSON.parse(fs.readFileSync('art-src/encounter-balance-v1/before.json','utf8'))
const summary=roster.map(s=>({stage:s.stage,before:before[s.stage-1].markers+before[s.stage-1].extra,after:s.addedCount}))
fs.writeFileSync('art-src/encounter-balance-v1/summary.json',JSON.stringify(summary,null,2)+'\n')
console.log(`PASS: 20 sparse plans (${summary.map(s=>s.before+'→'+s.after).join(', ')}); food supply, meaningful reward guard, assets, behavior, warnings, recovery and cliff safety`)
