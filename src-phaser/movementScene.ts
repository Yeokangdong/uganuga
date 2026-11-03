import { EnvironmentEvent, TREE, drawStory } from './environment'
import { KingKong, drawCaptive } from './kingKong'
import Phaser from 'phaser'
import { sfx } from '../src/game/audio'
import { drawArt, frameAt, art } from '../src/game/art'
import { paintedLabel } from './journeyScene'
import { loadPatternArt, updateStagePattern, drawStagePattern, patternState, bounds } from './patterns'
import { loadSuukuret, SuukuretPopulation } from './suukuret'
import { LudoHero } from './ludoHero'
import { Player, Item } from '../src/game/entities'
import { Level } from '../src/game/level'
import { loadStageArt } from '../src/game/art'
import { STEP, VIEW_W, VIEW_H } from '../src/game/constants'
import { Game, TIME_UNIT } from '../src/game/game'
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
  environment!: EnvironmentEvent
  player!: Player
  level!: Level
  body!: Phaser.Physics.Arcade.Body
  runtime!: Game
  paused = false
  private stageNumber = 1
  private carry?: {score:number;lives:number}
  private fullAt = -10
  private notice = {text:"", until:0}
  private clearT = 0
  private feedback:{x:number;y:number;text:string;t:number}[]=[]
  private impacts:{x:number;y:number;t:number}[]=[]
  private reducedMotion=localStorage.getItem("uganuga.reduceMotion")==="true"
  private shakeUntil=0
  private shakePower=0
  private hitStop=0
  private visualTime=0
  private clearSeconds=0
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
    this.paused=false;this.clearT=0;this.intro=1.6
    this.feedback=[];this.impacts=[];this.hitStop=0;this.visualTime=0
    this.ready=false; this.accumulator=0; this.ticks=0
    this.held=neutral(); this.previous=neutral(); this.pending=neutral()
    this.hud=this.add.text(18, 12, 'Loading movement…', {fontSize:'16px',color:'#ffe7a4'})
    this.keys=this.input.keyboard!.addKeys({left:'LEFT',right:'RIGHT',up:'UP',down:'DOWN',attack:'SPACE',restart:'ENTER',pause:'ESC',effects:'R'}) as typeof this.keys
    const reset=()=>{this.held=neutral();this.previous=neutral();this.pending=neutral();this.accumulator=0;this.input.keyboard?.resetKeys()}
    this.game.events.on(Phaser.Core.Events.BLUR,reset)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.environment?.cancel(); sfx.stopMusic(); this.ready=false; this.game.events.off(Phaser.Core.Events.BLUR,reset)
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
      food:0,foodMax:60,timeLeft:60*TIME_UNIT,time:0,
      stageIdx:stage-1,saved:null,doors:[],ambushes:[],particles:[],popups:[],effects:[],introT:0,lastBeep:0,bannerT:0,bg:this.background,
      sfx,splash:noop,burst:noop,fx:noop,shake:noop,popup:noop,showBanner:noop}) as Game
    this.runtime.popup=(x:number,y:number,text:string)=>{if(!text.startsWith('TIME BONUS'))this.feedback.push({x,y,text,t:.7})}
    this.runtime.burst=(x:number,y:number)=>{this.impacts.push({x,y,t:.18});if(this.player.weapon!=='fire'){this.hitStop=.045}}
    this.runtime.shake=(seconds:number,power:number)=>{this.shakeUntil=this.runtime.time+Math.min(seconds,.3);this.shakePower=power}
    this.fullAt=-10
    this.runtime.showBanner=(text:string,duration=2)=>{this.notice={text,until:this.runtime.time+duration}}
    this.player.spawnAt(this.runtime)
    if(stage===1){
      placeJungleFood(this.runtime)
      const first=this.level.spawns.find(s=>s.kind==='E')
      const site=this.level.findCombatPlacement(304,this.player.y+this.player.h,24,32,256,352)
      if(first&&site){first.col=site.x/16;first.row=site.floor/16-1;first.cfg={...def.roles.E!,behavior:'hopper',speed:18}}
    }
    this.environment=new EnvironmentEvent(this.level)
    const treeSite=this.environment.site
    if(treeSite&&stage===1)for(let i=0;i<4;i++)this.runtime.items.push(new RouteFood('fruit',treeSite.x+100+i*18,treeSite.floor-24,false,def.theme.n))
    if(treeSite&&stage===7)for(let i=0;i<4;i++)this.runtime.items.push(new RouteFood('fruit',treeSite.x+330+i*18,treeSite.floor-24,false,def.theme.n))
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
      if(this.paused)sfx.stopMusic();else sfx.playMusic(this.runtime.mode==='boss'||this.environment.phase==='ACTIVE'?'boss':'stage',this.level.def.theme.n)
    }
    if(this.paused&&Phaser.Input.Keyboard.JustDown(this.keys.effects!)){this.reducedMotion=!this.reducedMotion;localStorage.setItem('uganuga.reduceMotion',String(this.reducedMotion))}
    if(this.player.out){this.scene.start('Journey',{kind:'result',score:this.player.score,stage:this.stageNumber,clear:false});return}
    if(this.paused){this.draw();return}
    const dt=Math.min(delta/1000,.1);this.visualTime+=dt
    for(const f of this.feedback)f.t-=dt
    for(const f of this.impacts)f.t-=dt
    this.feedback=this.feedback.filter(f=>f.t>0);this.impacts=this.impacts.filter(f=>f.t>0)
    if(this.hitStop>0){this.hitStop-=dt;this.accumulator=0;this.draw();return}
    const input=neutral()
    for(const action of ['left','right','up','down','attack'] as const)input[action]=this.keys[action]!.isDown
    input.jump=input.up
    input.jumpPressed=input.jump&&!this.previous.jump
    input.downPressed=input.down&&!this.previous.down
    input.attackPressed=input.attack&&!this.previous.attack
    input.attackReleased=!input.attack&&this.previous.attack
    for(const edge of ['jumpPressed','downPressed','attackPressed','attackReleased'] as const)this.pending[edge] ||= input[edge]
    this.previous={...input}; this.held=input
    if(this.intro>0){this.intro=input.attackPressed||input.jumpPressed||Phaser.Input.Keyboard.JustDown(this.keys.restart!)?0:Math.max(0,this.intro-delta/1000);this.draw();return}
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
        if(this.clearT<=0&&this.stageNumber===15){this.ready=false;this.scene.start('Journey',{kind:'rescue',stage:15,score:this.player.score,lives:this.player.lives});return}
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
      for(const enemy of this.runtime.enemies)enemy.score=100
      const previousPosition={x:this.player.x,y:this.player.y}
      this.player.update(this.runtime,STEP,state,STEP)
      const existingPattern=patternState(this.runtime)
      if(this.environment.phase!=='IDLE'||!['warn','active'].includes(existingPattern.phase))this.environment.update(this.runtime,STEP,previousPosition)
      for(const enemy of this.runtime.enemies){enemy.advanceStatus(STEP);enemy.update(this.runtime,STEP)}
      for(const projectile of this.runtime.projectiles)projectile.update(this.runtime,STEP)
      for(const item of this.runtime.items)item.update(this.runtime,STEP)
      this.runtime.boss?.update(this.runtime,STEP)
      this.runtime.boss?.afterUpdate(this.runtime)
      const expired=this.runtime.timeLeft<=STEP
      r.updateTimer(STEP)
      if(expired)this.runtime.timeLeft=20*TIME_UNIT
      r.updateCamera(STEP)
      if(!r.saved&&this.runtime.mode==='play'&&this.runtime.food>=60&&this.player.alive&&this.player.onGround&&this.player.cx>=this.level.arenaX+20){r.startBoss();if(this.stageNumber===15&&this.runtime.boss){this.runtime.boss=new KingKong(this.runtime);this.runtime.showBanner('최종 보스 · 킹콩',1.2)}sfx.playMusic('boss')}
      if(this.runtime.boss?.dead&&this.runtime.mode==='boss'){this.player.score+=5000;this.runtime.popup(this.runtime.boss.cx,this.runtime.boss.y,'+5000','#ffe4a1');this.clearSeconds=Math.ceil(this.runtime.timeLeft/TIME_UNIT);r.completeStage();this.clearT=2.5}
      // Reuse the original pickup, contact immunity and projectile hit-set rules.
      const foodBefore=this.runtime.food
      const pickups=this.runtime.items.filter(i=>!i.dead)
      const feedbackBefore=this.feedback.length
      ;(this.runtime as unknown as {collide():void}).collide()
      for(const item of pickups.filter(i=>i.dead)){
        const reward=({fruit:[5,50,500],meat:[20,200,100],bigmeat:[40,400,500]} as Record<string,number[]>)[item.kind]
        if(reward){this.player.score+=reward[1]!-reward[2]!;this.feedback=this.feedback.filter((f,i)=>i<feedbackBefore||Math.abs(f.x-item.x-6)>1||Math.abs(f.y-item.y+4)>1);this.runtime.popup(item.x+6,item.y-4,`FOOD +${reward[0]}  +${reward[1]}`,'#ffe4a1')}
      }
      if(foodBefore<60&&this.runtime.food===60){this.fullAt=this.runtime.time;this.runtime.showBanner('FOOD FULL!',2)}
      this.runtime.enemies=this.runtime.enemies.filter(e=>!e.dead)
      this.runtime.items=this.runtime.items.filter(i=>!i.dead)
      this.runtime.projectiles=this.runtime.projectiles.filter(p=>!p.dead)
      if(this.environment.busy){const pattern=patternState(this.runtime);pattern.phase='idle';pattern.site=null;pattern.rect=null;pattern.age=0;pattern.wait=Math.max(pattern.wait,TREE.monkeyGap)}
      updateStagePattern(this.runtime,STEP)
      this.ludo.advance(this.player,STEP)
      this.suukuret.advance(this.runtime,STEP)
      this.runtime.time+=STEP
      this.accumulator=Math.max(0,this.accumulator-STEP);this.ticks++
      if(this.hitStop>0){this.accumulator=0;break}
    }
    this.body.reset(this.player.cx,this.player.y+this.player.h/2)
    this.body.velocity.set(this.player.vx,this.player.vy)
    this.body.blocked.down=this.player.onGround
  }
  private drawRescue(ctx:CanvasRenderingContext2D,x:number,y:number,size:number){
    const face=art.sprites['nuga.wave'],pose=face?.frames[0]
    ctx.save();ctx.beginPath();ctx.arc(x,y-5,size/2,0,Math.PI*2);ctx.clip()
    if(face&&pose)ctx.drawImage(face.img,pose[0]!,pose[1]!,pose[2]!,pose[3]!*.5,x-size/2,y-size/2-5,size,size)
    else {ctx.fillStyle='#efc18d';ctx.fillRect(x-size/2,y-size/2-5,size,size)}
    ctx.restore();paintedLabel(ctx,'♥',x+size*.6,y+3,8)
  }
  private drawAmbient(ctx:CanvasRenderingContext2D,cx:number){
    const t=this.visualTime,theme=this.runtime.stage.theme.n
    ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle='#718b65';ctx.fillStyle=theme==='2'?'#c39871':theme==='3'?'#d8edf2':'#91b66c'
    for(let i=0;i<9;i++){const x=((i*53+t*(theme==='3'?5:3)-cx*.12)%410+410)%410-12,y=45+(i*31+t*5)%155;ctx.beginPath();ctx.ellipse(x+Math.sin(t+i)*4,y,theme==='3'?1:3,1.2,t*.3+i,0,Math.PI*2);ctx.fill()}
    if(!theme){for(let i=0;i<3;i++){const x=i*150+30-cx*.08;ctx.beginPath();ctx.moveTo(x,39);ctx.quadraticCurveTo(x+Math.sin(t*.7+i)*5,56,x+2,76);ctx.stroke()}
      const x=(t*7+90)%420-18,y=71+Math.sin(t*.6)*9;ctx.beginPath();ctx.ellipse(x-2,y,3,1+Math.abs(Math.sin(t*4))*2,0,0,7);ctx.ellipse(x+2,y,3,1+Math.abs(Math.sin(t*4))*2,0,0,7);ctx.fill()
      ctx.beginPath();const b=(t*2+240)%440-28;ctx.moveTo(b-7,51);ctx.lineTo(b,54+Math.sin(t)*2);ctx.lineTo(b+8,51);ctx.stroke()}
    ctx.restore()
  }
  draw() {
    const p=this.player,lv=this.level
    const cx=round(this.runtime).saved?0:this.runtime.mode==='boss'?this.level.arenaX:Math.max(0,Math.min(lv.width-VIEW_W,p.cx-VIEW_W*.4))
    let cy=Math.max(0,Math.min(lv.height-VIEW_H,p.y-VIEW_H*.62))
    if(!round(this.runtime).saved&&this.runtime.mode==='play'){
      const state=patternState(this.runtime),site=state.site??state.sites.find(a=>Math.abs(a.x-p.cx)<160&&Math.abs(a.floor-p.y-p.h)<60)
      if(site){const b=bounds(site,lv.def.id);if(b.h<=VIEW_H-8)cy=Math.max(0,Math.min(lv.height-VIEW_H,Math.max(b.y+b.h-VIEW_H+4,Math.min(cy,b.y-4))))}
    }
    // Reserve the upper 44 pixels for the HUD, including nearby upper ledges.
    cy=Math.max(0,Math.min(cy,p.y-48))
    if(this.stageNumber===15&&this.runtime.boss)cy=Math.max(0,Math.min(lv.height-VIEW_H,(this.runtime.boss as KingKong).floor-194))
    this.runtime.camX=cx;this.runtime.camY=cy
    const ctx=this.surface.context
    this.background.draw(ctx,cx,this.runtime.time,cy,lv.height-VIEW_H)
    this.drawAmbient(ctx,cx)
    ctx.save()
    if(!this.reducedMotion&&(this.impacts.length||this.runtime.time<this.shakeUntil))ctx.translate(Math.sin(this.visualTime*110)*(this.shakePower||1.2),Math.cos(this.visualTime*95)*.7)
    ctx.drawImage(lv.canvas,cx*lv.scale,cy*lv.scale,VIEW_W*lv.scale,VIEW_H*lv.scale,0,0,VIEW_W,VIEW_H)
    drawStory(this.runtime,ctx,cx,cy,this.environment)
    this.environment.draw(this.runtime,ctx,cx,cy)
    for(const item of this.runtime.items)item.draw(ctx,cx,cy)
    for(const enemy of this.runtime.enemies){enemy.draw(ctx,cx,cy);enemy.drawStars(ctx,cx,cy)}
    for(const projectile of this.runtime.projectiles)projectile.draw(ctx,cx,cy)
    round(this.runtime).drawDoors(ctx,cx,cy)
    if(!round(this.runtime).saved){
      const x=lv.arenaX+16-cx
      const open=this.runtime.food>=60, elapsed=this.runtime.time-this.fullAt
      const floor=lv.floorBelow(lv.arenaX+16,0)-cy
      ctx.fillStyle=open?'#64ed99':'#ff6859'
      ctx.fillRect(x,floor-48,4,open?Math.max(0,1-elapsed/.7)*48:48)
      if(open&&elapsed<2){ctx.strokeStyle='#fff1a5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+2,floor-24,8+elapsed*28,0,Math.PI*2);ctx.stroke()}
    }
    const boss=this.runtime.boss
    if(this.stageNumber===15&&boss)drawCaptive(this.runtime,ctx,cx,cy)
    if(boss){
      boss.draw(ctx,cx,cy)
    }
    drawStagePattern(this.runtime,ctx,cx,cy)
    this.suukuret.draw(this.runtime,ctx,cx,cy)
    this.ludo.draw(ctx,p,cx,cy);
    for(const f of this.impacts){for(let i=0;i<5;i++){const a=i*Math.PI*2/5+f.t*4,r=5+( .18-f.t)*45;paintedLabel(ctx,'★',f.x-cx+Math.cos(a)*r,f.y-cy+Math.sin(a)*r,5)}}
    for(const f of this.feedback){ctx.save();ctx.globalAlpha=Math.min(1,f.t/.18);paintedLabel(ctx,f.text,Math.max(65,Math.min(319,f.x-cx)),Math.max(54,f.y-cy-(.7-f.t)*25),9);ctx.restore()}
    ctx.restore()
    if(this.intro>0){drawArt(ctx,'p1.respawn',frameAt('p1.respawn',2.1-this.intro,false),p.cx-cx,p.y+p.h-cy,false);this.drawRescue(ctx,192,90,30);paintedLabel(ctx,'누가를 찾아서 →',192,116,13);paintedLabel(ctx,'Space / ↑ / Enter · 건너뛰기',192,135,8)}
    if(this.stageNumber===1&&!round(this.runtime).saved)drawCaveTracks(this.runtime,ctx,cx,cy)
    ctx.fillStyle='rgba(41,29,19,.91)';ctx.fillRect(4,3,376,36)
    ctx.strokeStyle='#b38a50';ctx.strokeRect(4.5,3.5,375,35)
    paintedLabel(ctx,`HP ${p.hp}   LIFE ${p.lives}`,66,16,9)
    paintedLabel(ctx,`FOOD ${this.runtime.food}/60`,66,29,9)
    ctx.fillStyle='#251c16';ctx.fillRect(12,32,108,4)
    ctx.fillStyle=!this.reducedMotion&&this.runtime.time-this.fullAt<2&&Math.sin(this.runtime.time*24)>0?'#fff9c2':'#eac65f'
    ctx.fillRect(13,33,106*this.runtime.food/60,2)
    paintedLabel(ctx,`STAGE ${String(this.stageNumber).padStart(2,'0')}`,219,16,9);this.drawRescue(ctx,148,24,18)
    paintedLabel(ctx,`SCORE ${String(p.score).padStart(6,'0')}`,204,32,10)
    paintedLabel(ctx,`TIME ${Math.ceil(this.runtime.timeLeft/TIME_UNIT)}`,333,24,13)
    if(this.notice.until>this.runtime.time)paintedLabel(ctx,this.notice.text,192,61,17)
    if(this.runtime.mode==='clear'){ctx.fillStyle='rgba(30,20,10,.85)';ctx.fillRect(72,67,240,85);paintedLabel(ctx,'STAGE CLEAR',192,89,20);paintedLabel(ctx,`남은 시간 ${this.clearSeconds} × 10 = ${this.clearSeconds*10}`,192,111,12);this.drawRescue(ctx,145,139,20);paintedLabel(ctx,'누가의 흔적 →',221,138,12)}
    this.surface.refresh()
    this.hud.setVisible(this.paused || p.out);this.hud.setText(`${this.paused?`설정 / Esc 계속\nR / 화면 흔들림·번쩍임 줄이기: ${this.reducedMotion?'ON':'OFF'}`:this.runtime.mode==='clear'?(this.stageNumber===15?'ALL CLEAR':'STAGE CLEAR'):round(this.runtime).saved?'CAVE ? Down at entrance to return':'Esc pause'}\nSTAGE ${this.stageNumber}  ← → move · ↑ jump / ladder · ↓ descend · Space swing\n${p.out?'OUT - Enter: retry stage':p.dead?'RESPAWNING':p.climbing?'LADDER':p.swimming?'WATER':p.onGround?'GROUNDED':'AIR'}  O₂ ${p.oxygen.toFixed(1)}/20  HP ${p.hp}  LIFE ${p.lives}\nFOOD ${this.runtime.food}/60  SCORE ${p.score}  WEAPON ${p.weapon}  CLOCK ${Math.ceil(this.runtime.timeLeft/3.6)}`)
  }
}


/** Stationary jump pickups retain the existing +5 fruit collision/reward rules. */
class RouteFood extends Item {
  override update(_g:Game,dt:number){this.t+=dt}
}
function placeJungleFood(g:Game){
  const p=g.players[0]!, floor=p.y+p.h
  // Two arcs, four pickups each: two food groups plus the first enemy/cave.
  for(const start of [p.cx+72,p.cx+230])for(let i=0;i<4;i++){
    const x=start+i*18,y=floor-22-Math.sin(i/3*Math.PI)*28
    if(!g.level.solidAt(x+6,y)&&!g.level.isLadder(Math.floor((x+6)/16),Math.floor(y/16)))
      g.items.push(new RouteFood('fruit',x,y,false,g.stage.theme.n))
  }
}
function drawCaveTracks(g:Game,ctx:CanvasRenderingContext2D,cx:number,cy:number){
  for(const d of round(g).doors){
    if(d.x<cx-32||d.x>cx+416)continue
    ctx.fillStyle='#bca477'
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(d.x-30+i*8-cx,d.floor-2-cy-(i%2)*3,2,1,0,0,Math.PI*2);ctx.fill()}
    ctx.strokeStyle='#bfa77b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(d.x+22-cx,d.floor-3-cy);ctx.lineTo(d.x+31-cx,d.floor-6-cy);ctx.moveTo(d.x+27-cx,d.floor-5-cy);ctx.lineTo(d.x+28-cx,d.floor-9-cy);ctx.stroke()
    ctx.strokeStyle='#ead9ae';ctx.beginPath();ctx.moveTo(d.x-16-cx,d.floor-4-cy);ctx.lineTo(d.x-10-cx,d.floor-6-cy);ctx.stroke()
  }
}

