import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)})
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const bundle=await build({stdin:{contents:"export {Game} from './src/game/game.ts'; export {Player,Item,Projectile,ContactAnimal} from './src/game/entities.ts'; export {STAGES,makeCaveRoom} from './src/game/stages.ts'; export * from './src/game/weapons.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {Game,Player,Item,Projectile,ContactAnimal,STAGES,makeCaveRoom,WEAPON_STAT,rollWeaponDrop,WEAPON_DROP_RATE}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})}
assert.equal(WEAPON_DROP_RATE,.03)
for(const [value,expected] of [[0,'stone'],[.011999,'stone'],[.012,'bone'],[.021,'fire'],[.027,'axe'],[.029999,'axe'],[.03,null],[1,null]])assert.equal(rollWeaponDrop(()=>value),expected)
let drops=0
for(let i=0;i<10000;i++)if(rollWeaponDrop(()=>(i+.5)/10000))drops++
assert.equal(drops,300,'Overall rare drop probability must be 3%')
const p=new Player(0)
const g=Object.assign(Object.create(Game.prototype),{stage:STAGES[0],mode:'play',level:{def:STAGES[0]},players:[p],items:[],enemies:[],projectiles:[],boss:null,food:0,sfx:new Proxy({},{get:()=>()=>{}}),popup:()=>{},fx:()=>{},burst:()=>{}})
for(const kind of ['axe','stone','bone','fire']){
  g.items=[new Item(kind,p.x,p.y)];const before=p.score
  g.collide();assert.equal(g.bannerT,2.4);assert(g.banner.includes('획득!'));assert(g.bannerSub.includes('자동'));assert.equal(p.weapon,kind);assert(g.items[0].dead);assert.equal(p.score,before+200)
  g.collide();assert.equal(p.score,before+200,'Pickup consumed twice')
  const thrown=new Projectile('club',p.cx,p.y,220,-45,p)
  assert.equal(thrown.dmg,WEAPON_STAT[kind].dmg)
  p.weapon='axe';assert.equal(thrown.thrownWeapon,kind,'Thrown weapon changed after a new pickup')
  p.weapon=kind;p.facing=1;p.startSwing(g,'swing');p.swingT=p.swingDur*.5
  const box=p.hitbox();assert(box)
  let damage=0;g.enemies=[{x:box.x,y:box.y,w:5,h:5,dying:false,invulnerable:false,hit:(_g,d)=>damage+=d}]
  p.updateSwing(g,1/60);assert.equal(damage,WEAPON_STAT[kind].dmg,'Melee damage mismatch')
  g.enemies=[]
}
// A random weapon is an additional reward; the original food drop remains.
const random=Math.random
try{
  Math.random=()=>.01;g.items=[]
  const enemy=new ContactAnimal({cls:'melee',key:'dino1_0',hp:3,score:100,speed:20,w:14,h:20},100,100)
  enemy.stunT=3
  for(let i=0;i<3;i++){enemy.flash=0;enemy.hit(g,1,0,p)}
  assert(enemy.dead);assert(g.items.some(i=>i.kind==='meat'));assert(g.items.some(i=>i.kind==='stone'))
}finally{Math.random=random}
// A defeated enemy rolls once; hitting its corpse never grants extra drops.
try{
 Math.random=()=>.9;g.items=[]
 const e=new ContactAnimal({cls:'melee',key:'dino1_0',hp:3,score:100,speed:20,w:14,h:20,reward:'weapon'},100,100)
 e.stunT=3
 for(let i=0;i<4;i++){e.flash=0;e.hit(g,1,0,p)}
 assert.equal(g.items.length,1,'No guaranteed weapon even for legacy reward monsters')
 assert.equal(g.items[0].kind,'meat')
 Math.random=()=>.01;g.items=[]
 const e2=new ContactAnimal({cls:'melee',key:'dino1_0',hp:3,score:100,speed:20,w:14,h:20},100,100)
 e2.stunT=3
 for(let i=0;i<7;i++){e2.flash=0;e2.hit(g,1,0,p)}
 assert.equal(g.items.length,2,'One food and one weapon, without corpse farming')
}finally{Math.random=random}
console.log('Weapons passed: 3% rare drops, no guaranteed special-monster reward, food preserved, four auto-equipped weapons, pickup banner, melee/throw damage and no duplicate loot.')

assert(!readFileSync(new URL('../src/game/level.ts',import.meta.url),'utf8').includes('weaponPlacements'))
