import Phaser from 'phaser'
import { Player } from '../src/game/entities'
import { Level } from '../src/game/level'
import { loadStageArt } from '../src/game/art'
import { STEP, VIEW_W, VIEW_H } from '../src/game/constants'
import type { Game } from '../src/game/game'
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
  player!: Player
  level!: Level
  body!: Phaser.Physics.Arcade.Body
  runtime!: Game
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
  create() {
    this.ready=false; this.accumulator=0; this.ticks=0
    this.held=neutral(); this.previous=neutral(); this.pending=neutral()
    this.hud=this.add.text(18, 12, 'Loading movement…', {fontSize:'16px',color:'#ffe7a4'})
    this.keys=this.input.keyboard!.addKeys({left:'LEFT',right:'RIGHT',up:'UP',down:'DOWN',attack:'SPACE',restart:'ENTER'}) as typeof this.keys
    const reset=()=>{this.held=neutral();this.previous=neutral();this.pending=neutral();this.accumulator=0;this.input.keyboard?.resetKeys()}
    this.game.events.on(Phaser.Core.Events.BLUR,reset)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.ready=false; this.game.events.off(Phaser.Core.Events.BLUR,reset)
      this.input.keyboard?.removeAllKeys(true)
      if(this.textures.exists('movement-view'))this.textures.remove('movement-view'); if(this.level){this.level.canvas.width=1;this.level.canvas.height=1}
    })
    void this.prepare().catch(error=>this.hud.setText(String(error)))
  }
  private async prepare() {
    const stage=Math.max(1,Math.min(15,Number(new URLSearchParams(location.search).get('stage'))||1))
    const url=maps[`./maps/${String(stage).padStart(2,'0')}.tmj`]!
    const response=await fetch(url); if(!response.ok)throw new Error(`Map load: ${response.status}`)
    const data:MapData=await response.json()
    await loadStageArt(stage)
    if(!this.scene.isActive())return
    const def=JSON.parse(data.properties[0]!.value) as StageDef
    this.level=new Level(def)
    const terrain=data.layers.find(l=>l.name==='Terrain')!
    if(!('data' in terrain))throw new Error('Missing Terrain')
    this.level.tiles=Uint8Array.from(terrain.data)
    this.level.ladders.fill(0)
    const ladders=data.layers.find(l=>l.name==='Ladders')!
    if('objects' in ladders)for(const o of ladders.objects)this.level.ladders[o.y/16*data.width+o.x/16]=JSON.parse(o.properties[0]!.value)
    this.player=new Player(0,'우가','#ffe7a4')
    const noop=()=>{}
    // No enemies, items, progression or combat targets are introduced in this stage.
    this.runtime={level:this.level,players:[this.player],enemies:[],projectiles:[],boss:null,mode:'play',camX:0,camY:0,
      sfx:{jump:noop,hurt:noop,throw:noop,charge:noop,big:noop},splash:noop,burst:noop,fx:noop,shake:noop,popup:noop} as unknown as Game
    this.player.spawnAt(this.runtime)
    this.surface=this.textures.createCanvas('movement-view',VIEW_W,VIEW_H)!
    this.add.image(0,0,'movement-view').setOrigin(0).setDisplaySize(960,540).setDepth(-1)
    this.marker=this.add.rectangle(0,0,this.player.w,this.player.h).setVisible(false)
    this.physics.add.existing(this.marker)
    this.body=this.marker.body as Phaser.Physics.Arcade.Body
    this.body.setAllowGravity(false); this.body.moves=false
    this.ready=true; this.draw()
    Object.assign(window,{__movement:this})
  }
  /** Called once per display frame; edge inputs survive frames with no physics tick. */
  update(_time:number,delta:number) {
    if(!this.ready)return
    if(this.player.out && Phaser.Input.Keyboard.JustDown(this.keys.restart!)) {
      this.player=new Player(0,'우가','#ffe7a4')
      this.runtime.players=[this.player]
      this.player.spawnAt(this.runtime)
      this.held=neutral();this.previous=neutral();this.pending=neutral();this.accumulator=0
      this.input.keyboard?.resetKeys()
    }
    const input=neutral()
    for(const action of ['left','right','up','down','attack'] as const)input[action]=this.keys[action]!.isDown
    input.jump=input.up
    input.jumpPressed=input.jump&&!this.previous.jump
    input.downPressed=input.down&&!this.previous.down
    input.attackPressed=input.attack&&!this.previous.attack
    input.attackReleased=!input.attack&&this.previous.attack
    for(const edge of ['jumpPressed','downPressed','attackPressed','attackReleased'] as const)this.pending[edge] ||= input[edge]
    this.previous={...input}; this.held=input
    this.advance(delta/1000)
    this.draw()
  }
  advance(seconds:number,input?:PlayerInput) {
    if(input){this.held={...input};this.pending={...input}}
    // Pause catch-up after suspension; normal 30/60/120/144Hz all consume identical STEP.
    this.accumulator+=Math.min(seconds,.25)
    while(this.accumulator+1e-9>=STEP){
      const state={...this.held}
      for(const edge of ['jumpPressed','downPressed','attackPressed','attackReleased'] as const){state[edge]=this.pending[edge];this.pending[edge]=false}
      this.player.update(this.runtime,STEP,state,STEP)
      this.accumulator=Math.max(0,this.accumulator-STEP);this.ticks++
    }
    this.body.reset(this.player.cx,this.player.y+this.player.h/2)
    this.body.velocity.set(this.player.vx,this.player.vy)
    this.body.blocked.down=this.player.onGround
  }
  draw() {
    const p=this.player,lv=this.level
    const cx=Math.max(0,Math.min(lv.width-VIEW_W,p.cx-VIEW_W*.4))
    const cy=Math.max(0,Math.min(lv.height-VIEW_H,p.y-VIEW_H*.5))
    this.runtime.camX=cx;this.runtime.camY=cy
    const ctx=this.surface.context
    ctx.fillStyle='#244b50';ctx.fillRect(0,0,VIEW_W,VIEW_H)
    ctx.drawImage(lv.canvas,cx*lv.scale,cy*lv.scale,VIEW_W*lv.scale,VIEW_H*lv.scale,0,0,VIEW_W,VIEW_H)
    p.draw(ctx,cx,cy);this.surface.refresh()
    this.hud.setText(`STAGE ${lv.def.id}  ← → move · ↑ jump / ladder · ↓ descend · Space swing\n${p.out?'OUT - Enter: retry stage':p.dead?'RESPAWNING':p.climbing?'LADDER':p.swimming?'WATER':p.onGround?'GROUNDED':'AIR'}  O₂ ${p.oxygen.toFixed(1)}/20  HP ${p.hp}  LIFE ${p.lives}`)
  }
}

