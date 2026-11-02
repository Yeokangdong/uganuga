import assert from 'node:assert/strict'
import {build} from 'esbuild'
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)})
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const b=await build({stdin:{contents:"export {Level} from './src/game/level.ts';export {STAGES} from './src/game/stages.ts';export {art} from './src/game/art.ts';export * from './src/game/paintedMap.ts'",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {Level,STAGES,art,ladder,terrainSupport,terrainDeck}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
const calls=[],rects=[]
const ctx=new Proxy({drawImage:(...a)=>calls.push(a),rect:(...a)=>rects.push(a),createPattern:()=>({setTransform(){}})}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({getContext:()=>ctx,width:0,height:0})}
globalThis.DOMMatrix=class{scale(){return this}}
for(let id=1;id<=20;id++)for(const kind of ['platform','support','ladder','fill','surface'])art.images[`terrain.${id}.${kind}`]={width:kind==='ladder'?100:400,height:kind==='ladder'?400:kind==='support'?700:100}
for(const kind of ['vine','stone','basalt','ice','ruin','mushroom','bone','coral','crystal'])art.images['world.elevated.'+kind]={width:300,height:440}
art.images['sky.cloudFloor']={width:400,height:100}
let runs=0
for(const def of STAGES){
 calls.length=0
 const lv=new Level(def)
 for(let r=0;r<lv.rows;r++)for(let c=0;c<lv.cols;){
  if(lv.tile(c,r)!==2){c++;continue}
  const start=c;while(c<lv.cols&&lv.tile(c,r)===2)c++
  assert(calls.some(a=>a.length===9&&Math.abs(a[5]-start*16)<.001&&Math.abs(a[6]-r*16)<.001),`Stage ${def.id}: invisible platform at ${start},${r}`)
  runs++
 }
}
// Explicit unsupported/water case, independent of generated map layouts.
const source=STAGES[0],map=Array.from({length:12},(_,r)=>r===4?'....====........':r===10?'wwwwwwwwwwwwwwww':'................')
calls.length=0
new Level({...source,map,encounters:[],aquatic:undefined,aerial:undefined,arenaCol:14})
assert(calls.some(a=>a.length===9&&a[5]===64&&a[6]===64),'Unsupported platform not painted')
// A wide arch must reach the lower of two banks, not float at the ladder's bank.
for(const pit of [false,true]){
 const stepped=Array.from({length:14},(_,r)=>Array.from({length:16},(_,c)=>
   r===3&&c>=4&&c<=9?'=':c>=4&&c<=6&&r>=8?'#':c>=7&&c<=9&&r>=10&&!(pit&&c===9)?'#':'.').join(''))
 calls.length=0
 new Level({...STAGES[1],map:stepped,encounters:[],aquatic:undefined,aerial:undefined,arenaCol:14})
 const feet=calls.filter(a=>a[0]===art.images['world.elevated.basalt']&&a[2]>0&&a[5]===64)
 assert.equal(feet.length,1,'Wide structure painted twice or missing')
 const baseline=pit?15*16:10*16
 assert.equal(feet[0][6]+feet[0][8],baseline+6,'Feet float above lower bank/pit')
}
for(let stage=1;stage<=20;stage++)for(const height of [16,48,160,300]){
 calls.length=0;ladder(ctx,stage,20,10,10+height)
 assert(calls.every(a=>a.length===9&&a.slice(1).every(Number.isFinite)&&a[3]>0&&a[4]>0&&a[7]>0&&a[8]>0))
 const body=calls.slice(1,-1)
 assert(body.every(a=>Math.abs(a[4]/a[8]-100/12)<1e-6),'Ladder rungs stretched')
 assert(Math.abs(calls.at(-1)[6]+calls.at(-1)[8]-(10+height))<1e-6,'Ladder exceeds its climbable span')
}
rects.length=0;calls.length=0;terrainSupport(ctx,90,40,180,1,0,200)
assert(rects.some(a=>a[1]===54),'Local scenery rises above platform')
const localBase=calls.find(a=>a.length===9)
assert(localBase,'Jungle trunk was not painted')
assert.equal(localBase[6]+localBase[8],186,'Local support must be buried in terrain')
assert(localBase[7]<=34,'Jungle trunk is oversized')
for(const object of ['vine','stone','basalt','ice','ruin','mushroom','bone','coral','crystal']){
 calls.length=0;terrainDeck(ctx,20,40,1,96,object,190)
 if(object==='ice'){
  const body=calls[0];assert.equal(body.length,5)
  assert(Math.abs(body[0].width/body[0].height-body[3]/body[4])<1e-6,'Ice structure stretched')
  assert(calls.slice(1).every(a=>a[0]!==art.images['world.elevated.ice']),'Ice silhouette split into distorted pieces')
  continue
 }
 assert.equal(calls.length,2)
 const cap=calls[0];assert(Math.abs(cap[3]/cap[4]-cap[7]/cap[8])<1e-6,'Crown squashed')
 assert.equal(calls[1][2],cap[4],'Duplicate full support instead of lower segment')
}
for(const width of [16,48,96,240,480])for(const depth of [32,96,192,304]){
 calls.length=0;terrainDeck(ctx,20,40,3,width,'ice',40+depth)
 const body=calls[0]
 assert.equal(body.length,5)
 assert(Math.abs(body[0].width/body[0].height-body[3]/body[4])<1e-6,'Ice aspect changes with ledge dimensions')
 assert.equal(body[2],40);assert.equal(body[4],depth+6,'Ice support lost its ground contact')
 assert(calls.slice(1).some(a=>a[5]===20&&a[6]===40),'Ice ledge top missing')
}
for(const stage of [3,15])for(const depth of [48,128,256]){
 calls.length=0;terrainSupport(ctx,120,20,20+depth,stage,0,300)
 const body=calls.find(a=>a.length===5)
 assert(body&&Math.abs(body[0].width/body[0].height-body[3]/body[4])<1e-6,'Ice pillar stretched')
}
console.log(`Terrain passed: all ${runs} platform runs in ${STAGES.length} maps are visible; unsupported bridges, 80 ladder spans, support ceilings, stepped-bank/pit foundations and 9 undistorted crowns.`)
