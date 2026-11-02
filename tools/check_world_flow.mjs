import assert from 'node:assert/strict'
import { build } from 'esbuild'
process.on('uncaughtException',error=>{console.error(error.message);process.exit(1)})

const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')
const result=await build({
  stdin:{contents:"export {Game} from './src/game/game.ts'; export {STAGES} from './src/game/stages.ts';",resolveDir:root},
  bundle:true,platform:'node',format:'esm',write:false,
  define:{'import.meta.env.BASE_URL':JSON.stringify('/'),'import.meta.env.DEV':'false'},
})
const {Game,STAGES}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
for(const stage of STAGES){
  const arenaX=stage.arenaCol*16
  const player={alive:true,out:false,x:arenaX+40,y:328,w:18,h:24,onGround:true,score:0,lives:3,
                checkpoint:()=>{},get cx(){return this.x+this.w/2}}
  const game=Object.assign(Object.create(Game.prototype),{
    stage,mode:'play',boss:null,saved:null,food:100,foodMax:100,players:[player],
    enemies:[],projectiles:[],items:[],popups:[],timeLeft:300,camX:arenaX,
    level:{arenaX,floorBelow:()=>352,spawns:[]},
    sfx:new Proxy({},{get:()=>()=>{}}),bg:{setBoss:()=>{}},showBanner:()=>{},popup:()=>{},
  })
  // Exercise the actual boss gate; the final garden must not skip its guardian.
  game.checkEnd(1/60)
  assert.equal(game.mode,'boss',`Stage ${stage.id}: skipped boss`)
  assert.equal(game.boss.cfg.key,stage.boss.key,`Stage ${stage.id}: wrong boss`)
  game.boss.dead=true
  game.checkEnd(1/60)
  assert.equal(game.mode,stage.final?'rescue':'clear',`Stage ${stage.id}: wrong completion flow`)
  if(stage.final){
    assert.equal(player.score,10000)
    game.checkEnd(1/60)
    assert.equal(player.score,10000,'Final rescue bonus repeated')
    assert.equal(game.mode,'rescue','Rescue was overwritten after the boss died')
  }
}
console.log('Flow passed: all 20 stages start their own boss; stage 20 rescues only after victory and awards the bonus once.')
