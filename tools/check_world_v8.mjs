import fs from 'node:fs'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const root=new URL('../',import.meta.url)
const read=path=>fs.readFileSync(new URL(path,root),'utf8')
const bundled=await build({entryPoints:[new URL('src/game/stages.ts',root).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false})
const {STAGES,makeCaveRoom,HABITATS,BESTIARY}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const source=JSON.parse(read('art-src/world-v8/generation.json'))
const specs=new Map(source.monsters.map(s=>[s.key,s]))
assert.equal(new Set(source.monsters.map(s=>s.name)).size,122,'Species and entrance names must be distinct')
const newSpecies=new Set(JSON.parse(read('art-src/monsters-v9/generation.json')).monsters.map(([key])=>key))
const normals=new Set(),bosses=new Set(),doors=new Set(),companions=new Set()
assert.equal(STAGES.length,20)
for(const stage of STAGES){
  const marks=stage.map.join('')
  for(const mark of ['E','M','U','F']){
    assert(marks.includes(mark),`Stage ${stage.id}: missing spawn ${mark}`)
    const key=stage.roles[mark].key
    assert.equal(specs.get(key)?.kind,'monster',key);normals.add(key)
    assert.equal(stage.roles[mark].name,specs.get(key).name,`Name mismatch: ${key}`)
  }
  assert.equal(specs.get(stage.boss.key)?.kind,'boss');bosses.add(stage.boss.key)
  assert.equal(specs.get(stage.caveEntrance)?.kind,'door');doors.add(stage.caveEntrance)
  const localKeys=new Set(Object.values(stage.roles).map(cfg=>cfg.key))
  const habitat=HABITATS[stage.id-1]
  const visitors=new Set([...habitat.ground,...habitat.canopy,...habitat.air].map(name=>BESTIARY[name].key).filter(key=>newSpecies.has(key)))
  for(const encounter of stage.encounters??[])assert(localKeys.has(encounter.cfg.key)||visitors.has(encounter.cfg.key),`Stage ${stage.id}: species does not belong to habitat ${encounter.cfg.key}`)
  for(const encounter of stage.encounters??[])if(!localKeys.has(encounter.cfg.key))companions.add(encounter.cfg.key)
  assert(stage.arenaCol+24<=stage.map[0].length,`Stage ${stage.id}: no boss clearing`)
  assert(stage.boss.hp>0 && stage.boss.chargeSpeed>0)
  const cave=makeCaveRoom(stage,stage.id*100)
  assert.equal(cave.caveEntrance,stage.caveEntrance)
  assert.equal(cave.cave,true)
  // Match the real entrance support test, including slope/terrace boundaries.
  let supportedDoors=0
  for(let r=0;r<stage.map.length;r++)for(let c=0;c<stage.map[r].length;c++)if(stage.map[r][c]==='D'){
    const center=c*16+8
    const solid=(x,y)=>['#','R'].includes(stage.map[Math.floor(y/16)]?.[Math.floor(x/16)])
    let floor=r*16
    while(floor<stage.map.length*16&&!solid(center,floor))floor+=16
    const supported=Array.from({length:15},(_,i)=>center-56+i*8).every(x=>solid(x,floor+1)&&!solid(x,floor-1))
    if(supported&&!solid(center,floor-24))supportedDoors++
  }
  assert(supportedDoors>0,`Stage ${stage.id}: cave entrance has no flat ground`)
}
assert.equal(normals.size,80);assert.equal(bosses.size,20);assert.equal(doors.size,20)
assert.equal(specs.size,122)
console.log('Structure passed: 80 unique local species + 20 guardians + spider/piranha; 20 unique supported cave entrances and boss arenas.')

if(process.argv.includes('--structure'))process.exit(0)
const pack=JSON.parse(read('public/assets/world-v8/manifest.json'))
const companionPack=JSON.parse(read('public/assets/monsters-v9/manifest.json'))
for(const key of companions)for(const action of ['idle','walk','hit','stun','dead']){
  const entry=companionPack.sprites[key+'.'+action]
  assert(entry,`Missing companion art: ${key}.${action}`)
  for(const frame of entry.frames)assert(fs.existsSync(new URL('public/assets/monsters-v9/'+frame.src,root)),key)
}
let frameCount=0
for(const spec of specs.values()){
  for(const action of spec.kind==='door'?['']:['.idle','.walk','.fly','.hit','.collapse','.stun','.recover','.dead']){
    assert(pack.sprites[spec.key+action],`Missing art: ${spec.key+action}`)
  }
}
for(const [key,sprite]of Object.entries(pack.sprites)){
  assert(sprite.h>0&&sprite.ppu>0&&sprite.fps>0,key)
  assert.equal(sprite.frames.length,sprite.durationsMs.length,key)
  for(const frame of sprite.frames){
    assert(fs.existsSync(new URL('public/assets/world-v8/'+frame.src,root)),key)
    const[x,y,w,h,ax,ay]=frame.rect
    const edge=specs.get(key.split('.')[0])?.kind==='boss'?1024:key.includes('.')?512:256
    assert(x>=0&&y>=0&&x+w<=edge&&y+h<=edge,key)
    assert(ax>=0&&ax<=1&&ay>=0&&ay<=1,key);frameCount++
  }
}
assert.equal(frameCount,pack.total)
const report={stages:20,localSpecies:80,extraSpecies:2,bosses:20,entrances:20,authoredCharacterPoses:1632,actionFrameReferences:frameCount,existingCompanionSpecies:companions.size,runtimeSpecies:102+companions.size}
fs.writeFileSync(new URL('art-src/world-v8/validation.json',root),JSON.stringify(report,null,2)+'\n')
console.log('Art passed:',JSON.stringify(report))
