import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync,existsSync} from 'node:fs'
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const b=await build({stdin:{contents:"export {STAGES} from './src/game/stages.ts';export {art} from './src/game/art.ts';export {drawStageSign} from './src/game/stageSign.ts';export * from './src/game/traversal.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'}})
const {STAGES,art,drawStageSign,makeCrossings,crossingWater,crossings,advanceCrossings,drawCrossings}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
const images=[],text=[],lines=[],ellipses=[]
const ctx=new Proxy({drawImage:(...a)=>images.push(a),fillText:(...a)=>text.push(a),moveTo:(...a)=>lines.push(a),ellipse:(...a)=>ellipses.push(a)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})}
const manifest=JSON.parse(readFileSync(new URL('../public/assets/stage-signs-v1/manifest.json',import.meta.url),'utf8'))
for(const def of STAGES){
 const key='ui.biome_sign_'+def.id,path=manifest.images[key]
 assert(path&&existsSync(new URL('../public/assets/stage-signs-v1/'+path,import.meta.url)),`Missing sign ${def.id}`)
 art.images[key]={width:400,height:280};images.length=0;text.length=0
 assert(drawStageSign(ctx,def.id,48,320))
 assert.equal(images.length,2,'Sign and engraving must both render')
 assert(text.some(t=>t[0]===`STAGE ${def.id}`),'Blank or wrong stage number')
 assert(images[1][1]>=48&&images[1][1]+images[1][3]<=118,'Engraving outside slab width')
 images.length=0;text.length=0;drawStageSign(ctx,def.id,48,320)
 assert.equal(text.length,0,'Engraving regenerated every draw')
}
// A dry crossing must not acquire a raft. Real water gets a stable waterline.
const fixture=(wet)=>({...STAGES[4],map:Array.from({length:24},(_,r)=>
 Array.from({length:60},(_,c)=>r>=20?(c>=20&&c<26?(wet&&r===20?'w':'.'):'#'):'.').join('')),arenaCol:50,encounters:[]})
assert.equal(crossingWater(fixture(false),20,26,20),null)
assert.equal(makeCrossings(fixture(false)).length,0,'Raft spawned over a dry gap')
const wet=fixture(true),lv={def:wet},g={level:lv,players:[]}
const rafts=crossings(lv);assert(rafts.length>0,'Water crossing lost its raft')
for(let i=0;i<600;i++){
 advanceCrossings(g,1/60)
 for(const n of rafts)assert(Math.abs(n.y-(n.waterY-6))<=1.201,'Raft floats away from surface')
}
ellipses.length=0;drawCrossings(g,ctx,0,0)
for(const e of ellipses)assert.equal(e[1],323,'Water ripple moved into the air')
let total=0,raftCount=0
for(const def of STAGES){
 const nodes=makeCrossings(def);total+=nodes.length
 for(const n of nodes){
  assert.equal(n.rightBankY%16,0)
  if(n.kind==='raft'){
   raftCount++
   assert.equal(n.waterY,crossingWater(def,Math.ceil(n.left/16),Math.floor(n.right/16),Math.min(n.bankY,n.rightBankY)/16))
  }
 }
}
console.log(`Signs/crossings passed: ${STAGES.length} numbered engraved signs, ${total} crossing placements (${raftCount} water-only rafts), stable ripple height and dry-gap rejection.`)
