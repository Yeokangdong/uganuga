import Phaser from 'phaser'
import { sfx } from '../src/game/audio'
import { drawArt, frameAt } from '../src/game/art'
import { paintedLabel } from './journeyScene'
import { loadPatternArt, updateStagePattern, drawStagePattern, patternState, bounds } from './patterns'
import { loadSuukuret, SuukuretPopulation } from './suukuret'
import { LudoHero } from './ludoHero'
import { Player } from '../src/game/entities'
import { Level } from '../src/game/level'
import { loadStageArt } from '../src/game/art'
import { STEP, VIEW_W, VIEW_H } from '../src/game/constants'
import { Game, TIME_LIMIT } from '../src/game/game'
import { Background } from '../src/game/background'
import { spawnCombat } from './combat'
import { round, spawnRound } from './round'
import type { PlayerInput } from '../src/game/input'
import type { StageDef } from '../src/game/stages'
import type { MapData } from './tiled'

const maps = import.meta.glob('./maps/*.tmj', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const neutral = (): PlayerInput => ({ left:false,right:false,up:false,down:false,jump:false,attack:false,jumpPressed:false,downPressed:false,attackPressed:false,attackReleased:false })

/** Compatibility boundary: preserve the original movement solver as the single authority.
 * Arcade automatic integration is disabled to avoid applying gravity/collision twice.
 * Tiled supplies collision geometry; Phaser owns input, lifecycle and presentation.
 */
export class MovementScene extends Phaser.Scene {
  private ludo = new LudoHero()
  private suukuret = new SuukuretPopulation()
  private background = new Background()
  player!: Player
  level!: Level
  body!: Phaser.Physics.Arcade.Body
  runtime!: Game
  paused = false
  private stageNumber = 1
  private carry?: {score:number;lives:number}
  private clearT = 0
  private intro = 2.1
  ready = false
  accumulator = 0
  ticks = 0
  private held = neutral()
  private previous = neutral()
  private pending = neutral()
  private surface!: Phaser.Textures.CanvasTexture
  private hud!: Phaser.GameObjects.Text
  private marker!: Phaser.GameObjects.Rectangle
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  constructor() { super('Play') }
  create(data?:{stage?:number;score?:number;lives?:number}) {
    this.stageNumber=data?.stage ?? (Number(new URLSearchParams(location.search).get('stage'))||1)
    this.carry=data?.score===undefined?undefined:{score:data.score,lives:data.lives!}
    this.paused=false;this.clearT=0;this.intro=2.1
    this.ready=false; this.accumulator=0; this.ticks=0
    this.held=neutral(); this.previous=neutral(); this.pending=neutral()
    this.hud=this.add.text(18, 12, 'Loading movement…', {fontSize:'16px',color:'#ffe7a4'})
    this.keys=this.input.keyboard!.addKeys({left:'LEFT',right:'RIGHT',up:'UP',down:'DOWN',attack:'SPACE',restart:'ENTER',pause:'ESC'}) as typeof this.keys
    const reset=()=>{this.held=neutral();this.previous=neutral();this.pending=neutral();this.accumulator=0;this.input.keyboard?.resetKeys()}
    this.game.events.on(Phaser.Core.Events.BLUR,reset)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      sfx.stopMusic(); this.ready=false; this.game.events.off(Phaser.Core.Events.BLUR,reset)
      this.input.keyboard?.removeAllKeys(true)
      if(this.textures.exists('movement-view'))this.textures.remove('movement-view'); if(this.level){this.level.canvas.width=1;this.level.canvas.height=1}
    })
    void this.prepare().catch(error=>this.hud.setText(String(error)))
  }
  private async prepare() {
    const stage=Math.max(1,Math.min(15,this.stageNumber))
    const url=maps[`./maps/${String(stage).padStart(2,'0')}.tmj`]!
    const response=await fetch(url); if(!response.ok)throw new Error(`Map load: ${response.status}`)
    const data:MapData=await response.json()
    await Promise.all([loadStageArt(stage), loadPatternArt(stage), this.ludo.load(this), loadSuukuret()])
    if(!this.scene.isActive())return
    const def=JSON.parse(data.properties[0]!.value) as StageDef
    this.level=new Level(def)
    const terrain=data.layers.find(l=>l.name==='Terrain')!
    if(!('data' in terrain))throw new Error('Missing Terrain')
    this.level.tiles=Uint8Array.from(terrain.data)
    this.level.ladders.fill(0)
    const ladders=data.layers.find(l=>l.name==='Ladders')!
    if('objects' in ladders)for(const o of ladders.objects)this.level.ladders[o.y/16*data.width+o.x/16]=JSON.parse(o.properties[0]!.value)
    for(const [name,key] of [['Anchors','patternAnchors'],['Cliffs','patternCliffs']] as const){
      const layer=data.layers.find(l=>l.name===name)
      if(layer&&'objects' in layer)this.level[key]=layer.objects.map(o=>JSON.parse(o.properties[0]!.value))
    }
    this.player=new Player(0,'우가','#ffe7a4')
    const noop=()=>{}
    this.background.setStage(def.theme.background)
    this.runtime=Object.assign(Object.create(Game.prototype),{level:this.level,stage:def,players:[this.player],enemies:[],items:[],projectiles:[],boss:null,mode:'play',camX:0,camY:0,
      food:0,foodMax:60,timeLeft:TIME_LIMIT,time:0,
      stageIdx:stage-1,saved:null,doors:[],ambushes:[],particles:[],popups:[],effects:[],introT:0,lastBeep:0,bannerT:0,bg:this.background,
      sfx,splash:noop,burst:noop,fx:noop,shake:noop,popup:noop,showBanner:noop}) as Game
    this.player.spawnAt(this.runtime)
    this.suukuret.place(this.level)
    if(this.carry){this.player.score=this.carry.score;this.player.lives=this.carry.lives}
    this.surface=this.textures.createCanvas('movement-view',VIEW_W,VIEW_H)!
    // Same 384x216 world viewport and Player.draw dimensions as the original game.
    this.add.image(0,0,'movement-view').setOrigin(0).setDisplaySize(960,540).setDepth(-1)
    this.marker=this.add.rectangle(0,0,this.player.w,this.player.h).setVisible(false)
    this.physics.add.existing(this.marker)
    this.body=this.marker.body as Phaser.Physics.Arcade.Body
    this.body.setAllowGravity(false); this.body.moves=false
    this.ready=true; sfx.playMusic('stage',def.theme.n); this.draw()
    Object.assign(window,{__movement:this,__patternState:()=>patternState(this.runtime)})
  }
  /** Called once per display frame; edge inputs survive frames with no physics tick. */
  update(_time:number,delta:number) {
    if(!this.ready)return
    if(Phaser.Input.Keyboard.JustDown(this.keys.pause!)) {
      this.paused=!this.paused;this.accumulator=0;this.pending=neutral();this.previous=neutral()
      this.input.keyboard?.resetKeys()
      if(this.paused)sfx.stopMusic();else sfx.playMusic(this.runtime.mode==='boss'?'boss':'stage',this.level.def.theme.n)
    }
    if(this.player.out){this.scene.start('Journey',{kind:'result',score:this.player.score,stage:this.stageNumber,clear:false});return}
    if(this.paused){this.draw();return}
    const input=neutral()
    for(const action of ['left','right','up','down','attack'] as const)input[action]=this.keys[action]!.isDown
    input.jump=input.up
    input.jumpPressed=input.jump&&!this.previous.jump
    input.downPressed=input.down&&!this.previous.down
    input.attackPressed=input.attack&&!this.previous.attack
    input.attackReleased=!input.attack&&this.previous.attack
    for(const edge of ['jumpPressed','downPressed','attackPressed','attackReleased'] as const)this.pending[edge] ||= input[edge]
    this.previous={...input}; this.held=input
    if(this.intro>0){this.intro=Math.max(0,this.intro-delta/1000);this.draw();return}
    this.advance(delta/1000)
    this.draw()
  }
  advance(seconds:number,input?:PlayerInput) {
    if(this.paused||!this.ready)return
    if(input){this.held={...input};this.pending={...input}}
    // Pause catch-up after suspension; normal 30/60/120/144Hz all consume identical STEP.
    this.accumulator+=Math.min(seconds,.25)
    while(this.accumulator+1e-9>=STEP){
      const state={...this.held}
      for(const edge of ['jumpPressed','downPressed','attackPressed','attackReleased'] as const){state[edge]=this.pending[edge];this.pending[edge]=false}
      const r=round(this.runtime)
      if(this.runtime.mode==='rescue'){this.ready=false;this.scene.start('Journey',{kind:'rescue',stage:15,score:this.player.score,lives:this.player.lives});return}
      if(this.runtime.mode==='clear') {
        this.clearT-=STEP;this.accumulator=Math.max(0,this.accumulator-STEP)
        if(this.clearT<=0&&this.stageNumber<15){this.ready=false;this.scene.start('Journey',{kind:'travel',stage:this.stageNumber,score:this.player.score,lives:this.player.lives});return}
        continue
      }
      if(this.player.out){this.accumulator=0;break}
      if(state.downPressed&&this.player.alive&&this.player.onGround) {
        if(r.saved&&Math.abs(this.player.cx-64)<18)r.exitCave()
        else if(!r.saved){const door=r.doors.find(d=>Math.abs(d.x-this.player.cx)<18&&Math.abs(d.floor-this.player.y-this.player.h)<6);if(door)r.enterCave(door)}
      }
      this.level=this.runtime.level
      if(!r.saved)spawnCombat(this.runtime)
      spawnRound(this.runtime)
      this.player.update(this.runtime,STEP,state,STEP)
      for(const enemy of this.runtime.enemies){enemy.advanceStatus(STEP);enemy.update(this.runtime,STEP)}
      for(const projectile of this.runtime.projectiles)projectile.update(this.runtime,STEP)
      for(const item of this.runtime.items)item.update(this.runtime,STEP)
      this.runtime.boss?.update(this.runtime,STEP)
      this.runtime.boss?.afterUpdate(this.runtime)
      r.updateTimer(STEP)
      r.updateCamera(STEP)
      if(!r.saved&&this.runtime.mode==='play'&&this.runtime.food>=60&&this.player.alive&&this.player.onGround&&this.player.cx>=this.level.arenaX+20){r.startBoss();sfx.playMusic('boss')}
      if(this.runtime.boss?.dead&&this.runtime.mode==='boss'){if(this.stageNumber===15){this.player.score+=10000;this.runtime.mode='rescue'}else{r.completeStage();this.clearT=2.5}}
      // Reuse the original pickup, contact immunity and projectile hit-set rules.
      ;(this.runtime as unknown as {collide():void}).collide()
      this.runtime.enemies=this.runtime.enemies.filter(e=>!e.dead)
      this.runtime.items=this.runtime.items.filter(i=>!i.dead)
      this.runtime.projectiles=this.runtime.projectiles.filter(p=>!p.dead)
      updateStagePattern(this.runtime,STEP)
      this.ludo.advance(this.player,STEP)
      this.suukuret.advance(this.runtime,STEP)
      this.runtime.time+=STEP
      this.accumulator=Math.max(0,this.accumulator-STEP);this.ticks++
    }
    this.body.reset(this.player.cx,this.player.y+this.player.h/2)
    this.body.velocity.set(this.player.vx,this.player.vy)
    this.body.blocked.down=this.player.onGround
  }
  draw() {
    const p=this.player,lv=this.level
    const cx=round(this.runtime).saved?0:this.runtime.mode==='boss'?this.level.arenaX:Math.max(0,Math.min(lv.width-VIEW_W,p.cx-VIEW_W*.4))
    let cy=Math.max(0,Math.min(lv.height-VIEW_H,p.y-VIEW_H*.5))
    if(!round(this.runtime).saved&&this.runtime.mode==='play'){
      const state=patternState(this.runtime),site=state.site??state.sites.find(a=>Math.abs(a.x-p.cx)<160&&Math.abs(a.floor-p.y-p.h)<60)
      if(site){const b=bounds(site,lv.def.id);if(b.h<=VIEW_H-8)cy=Math.max(0,Math.min(lv.height-VIEW_H,Math.max(b.y+b.h-VIEW_H+4,Math.min(cy,b.y-4))))}
    }
    this.runtime.camX=cx;this.runtime.camY=cy
    const ctx=this.surface.context
    this.background.draw(ctx,cx,this.runtime.time,cy,lv.height-VIEW_H)
    ctx.drawImage(lv.canvas,cx*lv.scale,cy*lv.scale,VIEW_W*lv.scale,VIEW_H*lv.scale,0,0,VIEW_W,VIEW_H)
    for(const item of this.runtime.items)item.draw(ctx,cx,cy)
    for(const enemy of this.runtime.enemies){enemy.draw(ctx,cx,cy);enemy.drawStars(ctx,cx,cy)}
    for(const projectile of this.runtime.projectiles)projectile.draw(ctx,cx,cy)
    round(this.runtime).drawDoors(ctx,cx,cy)
    if(!round(this.runtime).saved){
      const x=lv.arenaX+16-cx
      ctx.fillStyle=this.runtime.food>=60?'#64ed99':'#ff6859';ctx.fillRect(x,lv.floorBelow(lv.arenaX+16,0)-cy-48,4,48)
    }
    const boss=this.runtime.boss
    if(boss){
      boss.draw(ctx,cx,cy)
      ctx.fillStyle='#261c22';ctx.fillRect(boss.cx-cx-24,boss.y-cy-9,48,5)
      ctx.fillStyle='#ff615b';ctx.fillRect(boss.cx-cx-24,boss.y-cy-9,48*boss.hp/boss.maxHp,5)
    }
    drawStagePattern(this.runtime,ctx,cx,cy)
    this.suukuret.draw(this.runtime,ctx,cx,cy)
    this.ludo.draw(ctx,p,cx,cy);
    if(this.intro>0){drawArt(ctx,'p1.respawn',frameAt('p1.respawn',2.1-this.intro,false),p.cx-cx,p.y+p.h-cy,false);paintedLabel(ctx,'READY!',192,64,25)}
    paintedLabel(ctx,'??',30,14,10);paintedLabel(ctx,'??',285,14,10);paintedLabel(ctx,'??',348,14,10);
    ctx.fillStyle='#fff0c5';ctx.font='9px monospace';ctx.fillText(String(p.score),48,14);ctx.fillText(String(Math.ceil(this.runtime.timeLeft/3.6)),301,14);ctx.fillText(String(p.lives),363,14);
    ctx.fillStyle='#301f16';ctx.fillRect(8,21,62,5);ctx.fillStyle='#f2c55d';ctx.fillRect(9,22,60*this.runtime.food/60,3);
    ctx.fillStyle='#fff0c5';ctx.font='8px monospace';ctx.fillText(`FOOD ${this.runtime.food}/60   HP ${p.hp}   O2 ${p.oxygen.toFixed(0)}   ${p.weapon}`,9,37);
    this.surface.refresh()
    this.hud.setVisible(this.paused || p.out);this.hud.setText(`${this.paused?'PAUSED ? Esc resume':this.runtime.mode==='clear'?(this.stageNumber===15?'ALL CLEAR':'STAGE CLEAR'):round(this.runtime).saved?'CAVE ? Down at entrance to return':'Esc pause'}\nSTAGE ${this.stageNumber}  ← → move · ↑ jump / ladder · ↓ descend · Space swing\n${p.out?'OUT - Enter: retry stage':p.dead?'RESPAWNING':p.climbing?'LADDER':p.swimming?'WATER':p.onGround?'GROUNDED':'AIR'}  O₂ ${p.oxygen.toFixed(1)}/20  HP ${p.hp}  LIFE ${p.lives}\nFOOD ${this.runtime.food}/60  SCORE ${p.score}  WEAPON ${p.weapon}  CLOCK ${Math.ceil(this.runtime.timeLeft/3.6)}`)
  }
}

