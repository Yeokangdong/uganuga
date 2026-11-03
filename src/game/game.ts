import { Piranha } from './piranha'
import { rollCaveReward, addCaveLife } from './caveRewards'
import { drawOpening, OPENING_DURATION, OPENING_GRAB_START, OPENING_ESCAPE_START, OPENING_PLEA_START, OPENING_DIALOGUE_START, OPENING_HERO_LINE_START } from './opening'
import { MAX_OXYGEN, SCALE, STEP, TILE, VIEW_H, VIEW_W, overlap } from './constants'
import { Input } from './input'
import { Level, T } from './level'
import { Background } from './background'
import { Boss } from './boss'
import {
  ContactAnimal, Enemy, Spider, FireTrap, Fx, Item, Particle, Player, Popup, Projectile, SpikeTrap,
  WEAPON_NAME, moveBody, type Weapon,
} from './entities'
import { STAGES, makeCaveRoom, type EnemyCfg, type StageDef } from './stages'
import { drawArt, frameAt, progressFrame, walkFrame, image, has, loadStageArt, drawPaintedText } from './art'
import { sfx, type Sfx } from './audio'
import { terrainDrawAudit } from './paintedMap'
import { JOURNEYS, JOURNEY_DURATION, drawJourney, drawPursuitExit } from './journey'

/** Compact in place to avoid six temporary arrays per simulation step. */
function removeDead<T extends {dead:boolean}>(items:T[]):void {
  let write=0
  for(let read=0;read<items.length;read++)if(!items[read]!.dead)items[write++]=items[read]!
  items.length=write
}

export interface HudPlayer {
  flight:'wind'|'glide'|null
  oxygen:number
  maxOxygen:number
  swimming:boolean
  submerged:boolean
  name: string
  color: string
  hp: number
  maxHp: number
  lives: number
  score: number
  weapon: string
  weaponKey: Weapon
  dead: boolean
  out: boolean
}

export interface HudState {
  journey:boolean
  trail:string|null
  aerial:boolean
  aquatic:boolean
  food: number
  foodFullFrame: number
  dreaming: boolean
  opening: string | null
  players: HudPlayer[]
  boss: { name: string; hp: number; max: number } | null
  banner: string | null
  bannerSub: string | null
  paused: boolean
  muted: boolean
  progress: number
  /** ?��? ?�간(�? */
  timeLeft: number
  stage: number
}

export type EndKind = 'clear' | 'over'



/** ?�테?��? ?�한 ?�간(�? / ?�간 초과 ???�시 주는 ?�간 / ?�계 ?�이??*/
export const TIME_UNIT = 3.6
export const TIME_LIMIT = 99 * TIME_UNIT
export const TIME_EXTEND = 40 * TIME_UNIT
export const CLOCK_BONUS = 10 * TIME_UNIT

export interface GameCallbacks {
  onHud(h: HudState): void
  onEnd(kind: EndKind, scores: number[], stage: number): void
}

/** ?�굴 보물(?) 결과 */

interface Door {
  x: number
  floor: number
  used: boolean
  id: number
  room?: { level: Level; enemies: Enemy[]; items: Item[]; ambushes: Ambush[] }
}

interface SavedWorld {
  level: Level
  camX: number
  camY: number
  enemies: Enemy[]
  projectiles: Projectile[]
  items: Item[]
  ambushes: Ambush[]
  door: Door
}

interface Ambush {
  x: number
  y: number
  kind: 'monster' | 'trap'
  done: boolean
}

export class Game {
  ctx: CanvasRenderingContext2D
  stageIdx: number
  stage: StageDef
  level: Level
  bg = new Background()
  input: Input
  sfx: Sfx = sfx
  players: Player[] = []
  enemies: Enemy[] = []
  projectiles: Projectile[] = []
  items: Item[] = []
  particles: Particle[] = []
  popups: Popup[] = []
  effects: Fx[] = []
  boss: Boss | null = null
  camX = 0
  camY = 0
  mode: 'play' | 'boss' | 'rescue' | 'clear' | 'over' = 'play'
  paused = false
  time = 0
  food = 0
  readonly foodMax = 60
  timeLeft = TIME_LIMIT
  private ambushes: Ambush[] = []
  private doors: Door[] = []
  /** ?�굴 �??�이�?바깥 ?�계�????�해 ??*/
  private saved: SavedWorld | null = null
  private passage: { t: number; door: Door | null } | null = null
  private rescueT = 0
  private lastBeep = 0
  private shakeT = 0
  private shakeMag = 0
  private endT = 0
  private raf = 0
  private last = 0
  private acc = 0
  private hudT = 0
  private banner: string | null = null
  private bannerSub: string | null = null
  private bannerT = 0
  /** ?�테?��? ?�작 ?�출 �?(조작 불�?) */
  private introT = 0
  private dreamCount = 0
  private openingDuration=0
  private openingCue=false
  private openingScratCue=false
  private scratSeen=false
  private scrat:{x:number;y:number;w:number;h:number;vx:number;vy:number;onGround:boolean;hitWall:number;stepHeight:number;walkDistance:number;age:number;state:'pet'|'startled'|'run';stateT:number;lookLeft:boolean}|null=null
  private introElapsed = 0
  private journeyT:number|null=null
  private journeyPreview=false
  private trailSeen=false
  private trailT=0
  private arrivalT=0

  skipIntro(): void {
    if(this.stageLoadFailed){this.beginJourney();return}
    if(this.journeyT!==null){if(this.journeyT>=.6)this.nextStage();return}
    if (this.introT <= 0) return
    this.introT = 0
    this.players.forEach(p => { p.invuln = 1.5 })
    this.pushHud()
  }
  private stopped = false
  private dark: HTMLCanvasElement
  private darkCtx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement, private cb: GameCallbacks, startStage = 0, private directStage = false) {
    canvas.width = VIEW_W * SCALE
    canvas.height = VIEW_H * SCALE
    this.ctx = canvas.getContext('2d')!
    this.dark = document.createElement('canvas')
    this.dark.width = VIEW_W * SCALE
    this.dark.height = VIEW_H * SCALE
    this.darkCtx = this.dark.getContext('2d')!
    this.input = new Input()
    this.stageIdx = Math.max(0, Math.min(STAGES.length - 1, startStage))
    this.stage = STAGES[this.stageIdx]
    this.level = new Level(this.stage)
    this.players.push(new Player(0, '우가', '#ff9a3a'))
    this.dreamCount = this.stageIdx===0&&!this.directStage?1:0
    this.beginStage()
  }

  /** ?�테?��? ?�작 (처음 ?�는 ?�음 ?�테?��?�??�어�??? */
  private beginStage(): void {
    this.journeyT=null
    this.journeyPreview=false
    this.trailSeen=false
    this.trailT=0
    this.camX = 0
    this.camY = this.level.height - VIEW_H
    this.enemies = []
    this.projectiles = []
    this.items = []
    this.particles = []
    this.popups = []
    this.effects = []
    this.ambushes = []
    this.doors = []
    this.saved = null
    this.passage = null
    this.boss = null
    this.scrat=null
    this.mode = 'play'
    this.food = 0
    this.timeLeft = this.stage.id === 1 ? TIME_LIMIT * 2 : TIME_LIMIT
    this.lastBeep = 0
    this.bg.setStage(this.stage.theme.background)
    this.bg.setBoss(false)
    for (const p of this.players) {
      if (p.out) continue
      p.spawnAt(this, true)
      p.invuln = 0
      p.y = (this.level.groundY(p.x) ?? this.level.height-3*TILE) - p.h
      p.onGround = true
      p.spawnFireT = 0 // Stage-one's intro owns its pose; other stages start standing.
    }
    if((this.stage.aquatic||this.stage.aerial)&&this.players[0])this.camY=Math.max(0,Math.min(this.level.height-VIEW_H,this.players[0].y-VIEW_H*.55))
    // Meat is produced only by finishing stunned animals.
    // No duplicated "guaranteed" drops, no deletion when the camera moves away.
    this.introElapsed = 0
    this.openingDuration=this.stageIdx===0&&!this.directStage?OPENING_DURATION:0
    this.openingCue=false
    this.openingScratCue=false
    this.introT = this.directStage&&this.stageIdx>0?0:this.openingDuration+this.dreamCount * 2.5 + 2.1
    this.banner = null
    this.pushHud()
    this.sfx.playMusic('stage',this.stage.theme.music)
  }

  private stageLoading=false
  private stageLoadFailed=false
  private nextStage(): void {
    if(this.stageLoading)return
    this.stageLoading=true
    this.stageLoadFailed=false
    void loadStageArt(this.stageIdx+2).then(()=>{
      if(this.stopped)return
      this.finishNextStage()
    }).catch(()=>{this.stageLoadFailed=true}).finally(()=>{this.stageLoading=false})
  }

  private finishNextStage(): void {
    if(this.stageIdx>=STAGES.length-1)return
    this.stageIdx++
    this.stage = STAGES[this.stageIdx]
    this.level = new Level(this.stage)
    this.dreamCount = 0
    this.beginStage()
    this.arrivalT=4
    this.pushHud()
  }

  /** Review the connecting scene through the existing development controls. */
  previewJourney():void {
    if(!import.meta.env.DEV||this.stageIdx>=STAGES.length-1)return
    this.paused=false;this.sfx.setPaused(false)
    this.introT=0;this.beginJourney(true)
  }

  private beginJourney(preview=false):void {
    if(this.stageLoading||this.stageIdx>=STAGES.length-1)return
    this.stageLoading=true;this.stageLoadFailed=false
    void loadStageArt(this.stageIdx+2).then(()=>{
      if(this.stopped)return
      this.journeyPreview=preview
      this.mode='clear';this.journeyT=preview?2.4:0
      this.banner=null;this.bannerSub=null;this.bannerT=0
      this.sfx.stopMusic();this.pushHud()
    }).catch(()=>{if(!this.stopped)this.stageLoadFailed=true})
      .finally(()=>{this.stageLoading=false})
  }

  start(): void {
    this.sfx.playMusic('stage',this.stage.theme.music)
    this.last = performance.now()
    const loop = (ts: number) => {
      if (this.stopped) return
      const frame = Math.min(0.1, (ts - this.last) / 1000)
      this.last = ts
      this.acc += frame
      let n = 0
      while (this.acc + 1e-10 >= STEP && n < 6) {
        this.captureRenderState()
        if(!this.stageLoading&&!this.stageLoadFailed)this.update(STEP)
        this.acc = Math.max(0, this.acc - STEP)
        n++
      }
      if (n >= 6) this.acc = 0
      this.renderInterpolated(this.acc / STEP)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    this.stopped = true
    cancelAnimationFrame(this.raf)
    this.input.dispose()
    this.sfx.stopMusic()
  }

  // ?????????????????????????? helpers ??????????????????????????
  nearestPlayer(x: number): Player | null {
    let best: Player | null = null
    let bd = Infinity
    for (const p of this.players) {
      if (!p.alive) continue
      const d = Math.abs(p.cx - x)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 40 + Math.random() * 100
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.3 + Math.random() * 0.3, color, 2))
    }
  }

  splash(x: number, y: number): void {
    const c = this.stage.theme.water
    for (let i = 0; i < 12; i++) this.particles.push(new Particle(x + (Math.random() - 0.5) * 10, y, (Math.random() - 0.5) * 80, -100 - Math.random() * 120, 0.6, c, 3))
  }

  popup(x: number, y: number, text: string, color = '#ffffff'): void {
    this.popups.push(new Popup(x, y, text, color))
  }

  /** Codex ?�펙??그림 ?�생 (그림???�으�??�무것도 ???? */
  fx(key: string, x: number, y: number, faceLeft: boolean, life = 0.25, scale = 1): void {
    this.effects.push(new Fx(key, x, y, faceLeft, life, scale))
  }

  shake(t: number, mag: number): void {
    this.shakeT = Math.max(this.shakeT, t)
    this.shakeMag = Math.max(this.shakeMag, mag)
  }

  showBanner(text: string, t: number, sub: string | null = null): void {
    this.banner = text
    this.bannerSub = sub
    this.bannerT = t
  }

  togglePause(): void {
    if (this.mode === 'clear' || this.mode === 'over') return
    this.paused = !this.paused
    this.sfx.setPaused(this.paused)
    this.pushHud()
  }

  // ?????????????????????????? update ??????????????????????????
  private update(dt: number): void {
    const inp = this.input
    inp.update()
    if (inp.consume('Escape') || inp.consume('KeyP')) this.togglePause()
    if (inp.consume('KeyM')) {
      this.sfx.toggleMute()
      this.pushHud()
    }
    if (inp.consume('Enter')) this.skipIntro()
    inp.endFrame()
    if (this.paused) return

    if(this.journeyT!==null){
      if(this.journeyPreview){this.pushHud();return}
      this.journeyT+=dt
      if(this.journeyT>=JOURNEY_DURATION)this.nextStage()
      this.pushHud();return
    }

    if (this.passage) {
      this.passage.t += dt
      for (const p of this.players) {
        if (!p.alive) continue
        p.anim += dt
        p.vx = 14
        p.x += p.facing * 8 * dt
        p.y -= 3 * dt
      }
      if (this.passage.t >= 1) {
        const door = this.passage.door
        this.passage = null
        if (door) this.enterCave(door)
        else this.exitCave()
      }
      return
    }
    if (this.introT > 0) {
      this.introElapsed += dt
      if(this.openingDuration>0&&!this.openingScratCue&&this.introElapsed>=.45){this.openingScratCue=true;this.sfx.scrat()}
      if(this.openingDuration>0&&!this.openingCue&&this.introElapsed>=OPENING_GRAB_START){this.openingCue=true;this.sfx.roar()}
      this.introT = Math.max(0, this.introT - dt)
      if (this.introT === 0) this.players.forEach(p => { p.invuln = 1.5 })
      this.pushHud()
      return
    }
    if(this.mode==='rescue') {
      this.rescueT+=dt;this.time+=dt
      const target=this.level.arenaX+36
      for(const p of this.players) if(p.alive) {
        const dx=target-24-p.cx
        p.vx=dx>1?35:0;p.facing=1;p.x+=p.vx*dt;p.walkDistance+=p.vx*dt;p.anim+=dt
      }
      if(this.rescueT>=7) {this.mode='clear';this.endT=-5;this.cb.onEnd('clear',this.players.map(p=>p.score),this.stage.id)}
      this.pushHud();return
    }
    if(this.mode==='clear' || this.mode==='over') {
      this.time+=dt;for(const p of this.players)p.anim+=dt
      this.checkEnd(dt);this.pushHud();return
    }
    const realDt = dt
    this.trailT=Math.max(0,this.trailT-realDt)
    this.arrivalT=Math.max(0,this.arrivalT-realDt)
    if(!this.saved&&!this.trailSeen&&JOURNEYS[this.stageIdx]&&this.players.some(p=>p.alive&&p.cx>=this.level.arenaX-180)){
      this.trailSeen=true;this.trailT=5
    }
    dt *= 0.75 // Fixed simulation steps; movement and animation run 25% slower.
    this.time += dt
    this.updateTimer(realDt)
    if (this.tryDoor()) return
    this.players.forEach((p, i) => {
      p.spawnFireT = Math.max(0, p.spawnFireT - (realDt - dt))
      p.invuln = Math.max(0, p.invuln - (realDt - dt))
      p.update(this, dt, inp.get(i),realDt)
      p.advanceIdleThought(realDt,inp.get(i))
    })
    this.updateCamera(dt)
    this.updateScrat(dt)
    this.spawn()
    this.checkAmbush()

    for (const e of this.enemies) {
      e.advanceStatus(realDt)
      if(e.x+e.w>this.camX-80 && e.x<this.camX+VIEW_W+80) e.update(this, dt)
    }
    if (this.boss) {
      this.boss.update(this, dt)
      this.boss.afterUpdate(this)
    }
    for (const p of this.projectiles) p.update(this, dt)
    for (const it of this.items) it.update(this, dt)
    for (const p of this.particles) p.update(dt)
    for (const p of this.popups) p.update(dt)
    for (const f of this.effects) f.update(dt)

    this.collide()

    removeDead(this.enemies)
    removeDead(this.projectiles)
    removeDead(this.items)
    removeDead(this.particles)
    removeDead(this.popups)
    removeDead(this.effects)
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500)

    this.shakeT -= dt
    if (this.shakeT <= 0) this.shakeMag = 0
    this.bannerT -= dt
    if (this.bannerT <= 0 && this.banner !== null) {
      this.banner = null
      this.bannerSub = null
      this.pushHud()
    }

    this.checkEnd(dt)

    this.hudT -= dt
    if (this.hudT <= 0) {
      this.hudT = 0.08
      this.pushHud()
    }
  }

  /** One optional encounter midway through stage one, independent of combat. */
  private updateScrat(dt:number):void {
    if(this.saved||this.mode!=='play')return
    if(!this.scratSeen&&this.stageIdx===0){
      const p=this.players.find(p=>p.alive&&p.onGround&&!p.climbing&&p.cx>=this.level.arenaX*.48)
      if(p)for(let ahead=104;ahead<=152;ahead+=16){
        const x=p.cx+ahead,floor=this.level.floorBelow(x,p.y+p.h-12)
        if(floor<this.camY+20||floor>this.camY+VIEW_H-8||Math.abs(floor-(p.y+p.h))>TILE||this.level.waterAt(x,floor+1))continue
        const c=Math.floor(x/TILE),r=Math.floor((floor-10)/TILE)
        if(this.level.isSolidTile(this.level.tile(c,r)))continue
        this.scratSeen=true
        this.scrat={x:x-6,y:floor-14,w:12,h:14,vx:0,vy:0,onGround:true,hitWall:0,stepHeight:TILE,walkDistance:0,age:0,state:'pet',stateT:0,lookLeft:false}
        break
      }
    }
    const s=this.scrat;if(!s)return
    s.age+=dt;s.stateT+=dt
    if(s.state==='pet'){
      const approaching=this.players.find(p=>p.alive&&Math.abs(p.cx-(s.x+s.w/2))<58&&Math.abs(p.y+p.h-s.y-s.h)<40)
      if(s.stateT>=.9&&approaching){
        s.state='startled';s.stateT=0;s.lookLeft=approaching.cx<s.x+s.w/2;this.sfx.scrat()
      }
      return
    }
    if(s.state==='startled'){
      if(s.stateT<.28)return
      s.state='run';s.stateT=0
    }
    s.vx=150*Math.min(1,s.stateT/.15)
    const feet=s.y+s.h,next=s.x+s.w+12
    if(s.onGround&&(s.hitWall||this.level.waterAt(next,feet+4)||this.level.floorBelow(next,feet-4)>feet+TILE))s.vy=-175
    s.vy=Math.min(300,s.vy+500*dt)
    moveBody(s,this.level,dt)
    if(s.stateT>4.7||s.x>this.camX+VIEW_W+40||s.y>this.camY+VIEW_H+24)this.scrat=null
  }

  // ?????????????????????????? ?�굴 �???????????????????????????
  /** ?�굴 ?�구 ?�에???????�굴 방으�?*/
  private tryDoor(): boolean {
    if(this.mode!=='play') return false
    for(let i=0;i<this.players.length;i++) {
      const p=this.players[i]!
      if(!p.alive || !p.onGround || p.climbing) continue
      p.advanceIdleThought(0,this.input.get(i))
      if(this.saved) {
        if(p.x<=18 || (this.input.get(i).downPressed && Math.abs(p.cx-64)<18)) {
          p.facing=-1;this.passage={t:0,door:null};return true
        }
      } else if(this.input.get(i).downPressed) {
        const d=this.doors.find(dd=>Math.abs(dd.x-p.cx)<18 && Math.abs(dd.floor-p.y-p.h)<6)
        if(d) {p.facing=1;this.passage={t:0,door:d};return true}
      }
    }
    return false
  }

  private enterCave(door:Door):void {
    this.saved={level:this.level,camX:this.camX,camY:this.camY,enemies:this.enemies,projectiles:this.projectiles,items:this.items,ambushes:this.ambushes,door}
    const room=door.room
    this.level=room?.level ?? new Level(makeCaveRoom(this.stage,this.stage.id*100+door.id))
    this.camX=0;this.camY=this.level.height-VIEW_H
    this.enemies=room?.enemies ?? [];this.items=room?.items ?? [];this.ambushes=room?.ambushes ?? []
    this.projectiles=[];this.particles=[];this.popups=[];this.effects=[]
    for(const p of this.players) if(!p.out) {
      p.x=64-p.w/2;p.y=this.level.floorBelow(64,100)-p.h;p.vx=0;p.vy=0;p.climbing=false;p.onGround=true;p.facing=1;p.swingT=0
      p.checkpoint();p.invuln=Math.max(p.invuln,.8)
    }
    if(!room){
      const spider=new Spider(this.level,11*TILE,7*TILE)
      if(this.stage.id===1)spider.speed=.65
      this.enemies.push(spider)
    }
    this.spawn();this.sfx.thud();this.showBanner(this.stage.sub+' · 동굴',1.1)
  }

  private exitCave():void {
    const s=this.saved;if(!s)return
    s.door.room={level:this.level,enemies:this.enemies,items:this.items,ambushes:this.ambushes}
    s.door.used=true;this.saved=null;this.level=s.level;this.camX=s.camX;this.camY=s.camY
    this.enemies=s.enemies;this.projectiles=s.projectiles;this.items=s.items;this.ambushes=s.ambushes
    this.particles=[];this.popups=[];this.effects=[]
    for(const p of this.players) if(!p.out) {
      p.x=s.door.x-p.w/2;p.y=s.door.floor-p.h;p.vx=0;p.vy=0;p.climbing=false;p.onGround=true;p.swingT=0;p.invuln=Math.max(p.invuln,1);p.checkpoint()
    }
    this.sfx.thud()
  }

  private drawDoors(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    const entrance=this.stage.caveEntrance
    if(this.saved){drawArt(ctx,entrance,0,64-cx,this.level.floorBelow(64,100)-cy,false);return}
    for(const d of this.doors){
      if(d.x<cx-64||d.x>cx+VIEW_W+64)continue
      drawArt(ctx,entrance,0,d.x-cx,d.floor-cy,false,{alpha:d.used?.8:1})
      if(this.players.some(p=>p.alive&&Math.abs(d.x-p.cx)<18&&Math.abs(d.floor-p.y-p.h)<6)){
        ctx.fillStyle='#ffe8a3';ctx.beginPath();ctx.moveTo(d.x-cx-3,d.floor-cy-61);ctx.lineTo(d.x-cx+3,d.floor-cy-61);ctx.lineTo(d.x-cx,d.floor-cy-56);ctx.closePath();ctx.fill()
      }
    }
  }

  private updateCamera(dt: number): void {
    if(this.saved) {this.camX=0;return}
    if(this.mode==='boss'){
      this.camX+=(this.level.arenaX-this.camX)*(1-Math.exp(-7*dt))
      const bossY=this.stage.aquatic?Math.max(0,Math.min(this.level.height-VIEW_H,this.level.floorBelow(this.level.arenaX+VIEW_W/2,0)-VIEW_H*.82)):this.level.height-VIEW_H
      this.camY+=(bossY-this.camY)*(1-Math.exp(-7*dt))
      return
    }
    if(this.mode!=='play') return
    const p=this.players.find(p=>p.alive);if(!p)return
    // Follow continuously inside a narrow dead zone. Never jump to the opposite
    // edge of the screen when the player crosses a tracking threshold.
    const left=this.camX+VIEW_W*.42,right=this.camX+VIEW_W*.58
    let target=this.camX
    if(p.cx>right) target=p.cx-VIEW_W*.58
    else if(p.cx<left) target=p.cx-VIEW_W*.42
    target=Math.max(0,Math.min(Math.max(0,this.level.width-VIEW_W),target))
    this.camX+=(target-this.camX)*(1-Math.exp(-10*dt))
    this.camX=Math.max(0,Math.min(Math.max(0,this.level.width-VIEW_W),this.camX))
    const upper=this.camY+VIEW_H*.32,lower=this.camY+VIEW_H*.72,feet=p.y+p.h
    let targetY=this.camY
    if(p.y<upper)targetY=p.y-VIEW_H*.32
    else if(feet>lower)targetY=feet-VIEW_H*.72
    targetY=Math.max(0,Math.min(Math.max(0,this.level.height-VIEW_H),targetY))
    this.camY+=(targetY-this.camY)*(1-Math.exp(-8*dt))
    const gate=this.level.arenaX+16
    if(this.food<this.foodMax && p.x+p.w>gate) {
      p.x=gate-p.w;p.vx=0
      if(this.bannerT<=0)this.showBanner('배고프다!',1.5)
    }
  }

  private startBoss(): void {
    if(this.boss||this.mode!=='play'||this.saved)return
    this.mode = 'boss'
    const cfg = this.stage.boss
    const floor = this.level.floorBelow(this.level.arenaX + VIEW_W - 40, 0)
    this.boss = new Boss(cfg, this.level.arenaX + VIEW_W + 10, floor - cfg.h)
    this.bg.setBoss(true)
    this.sfx.playMusic('boss')
    this.showBanner('보스 등장!', 2.2, cfg.name)
    for(const p of this.players)if(p.alive){
      p.x=Math.max(this.level.arenaX+8,Math.min(this.level.arenaX+VIEW_W-p.w-8,p.x))
      p.checkpoint()
    }
    this.enemies.forEach((e) => (e.dead = true))
    this.level.spawns.forEach((s) => (s.done = true))
  }

  private makeEnemy(cfg: EnemyCfg, x: number, floorY: number, row: number): Enemy {
    const resolved=has(cfg.key+'.walk')?cfg:{...cfg,key:cfg.fallbackKey??'dino1_0'}
    return new ContactAnimal(resolved,x,cfg.cls==='flyer'?row*TILE:floorY-cfg.h)
  }

  private spawn(): void {
    const edge = this.camX + VIEW_W + 8
    const lv = this.level
    const n = this.stage.theme.n
    for (const s of lv.spawns) {
      if (s.done || s.col * TILE > edge) continue
      if(['A','E','M','U','F','S','P'].includes(s.kind)){
        const x=s.col*TILE
        if(x<this.camX-48||x>this.camX+VIEW_W-32)continue
        const visible=this.enemies.filter(e=>!e.dead&&!e.dying&&e.cfg.hp<999&&e.x+e.w>this.camX-16&&e.x<this.camX+VIEW_W+16)
        if(visible.length>=2||this.players.some(p=>p.alive&&Math.abs(p.cx-x)<40))continue
      }
      s.done = true
      const x = s.col * TILE
      const cy = s.row * TILE
      const floor = lv.floorBelow(x + 8, cy)
      switch (s.kind) {
        case 'A': {
          if(s.cfg){const enemy=this.makeEnemy(s.cfg,x,floor,s.row);enemy.facing=s.facing??-1;this.enemies.push(enemy)}
          break
        }
        case 'E': case 'M': case 'U': case 'F': {
          const cfg = this.stage.roles[s.kind as 'E' | 'M' | 'U' | 'F']
          if (cfg) this.enemies.push(this.makeEnemy(cfg, x, floor, s.row))
          break
        }
        case 'P':
          if(has('piranha.jump'))this.enemies.push(new Piranha(x,x+(s.width??1)*TILE,cy))
          break
        case 'S':
          this.enemies.push(new ContactAnimal({cls:'melee',key:'spider',hp:2,score:200,speed:22,w:14,h:12},x,floor-12))
          break
        case '^':
          this.enemies.push(new SpikeTrap(x+8,floor))
          break
        case 'X':
          this.enemies.push(new FireTrap(x + 8, floor))
          break
        case 'f':
          // Fruit is a cave reward, never a pre-placed map decoration.
          break
        case 'k':
          this.items.push(new Item('clock', x + 2, floor - 12, false, n))
          break
        case 'b':
          // Old map markers no longer grant guaranteed weapons.
          break
        case '?':
          this.placeTreasure(x + 2, floor)
          break
        case 'D':
          {
            const center=x+8,flat=Array.from({length:15},(_,i)=>center-56+i*8).every(px=>this.level.solidAt(px,floor+1)&&!this.level.solidAt(px,floor-1))
            const ground=this.level.tile(Math.floor(center/TILE),Math.floor(floor/TILE))===T.Solid
            if(flat&&ground&&!this.level.solidAt(center,floor-24))this.doors.push({x:center,floor,used:false,id:this.doors.length})
          }
          break
      }
    }
  }

  /** ?�굴 보물: ?�계 / 고기 / �?/ 몬스??/ 무기 / ?�석 ?�정??무작??*/
  private placeTreasure(x:number,floor:number):void {
    this.items.push(new Item(rollCaveReward(),x,floor-12,false,this.stage.theme.n))
  }

  private checkAmbush(): void {
    for (const a of this.ambushes) {
      if (a.done) continue
      const p = this.players.find((pl) => pl.alive && Math.abs(pl.cx - a.x) < 48 && Math.abs(pl.y + pl.h - a.y) < 40)
      if (!p) continue
      a.done = true
      if (a.kind === 'monster') {
        this.showBanner('함정!', 0.8)
        const cfg = this.stage.roles.E ?? this.stage.roles.U
        if (cfg) {
          for (const dx of [-36, 40]) {
            const ex = a.x + dx
            if (this.level.solidAt(ex + 4, a.y - 8)) continue
            const e = this.makeEnemy(cfg.cls === 'flyer' ? this.stage.roles.U ?? cfg : cfg, ex, a.y, 0)
            e.flash = 0.3
            this.enemies.push(e)
            this.burst(ex + 6, a.y - 10, '#c9a77a', 8)
          }
        }
        this.sfx.roar()
      } else {
        this.showBanner('함정!', 0.8)
        const ceil = this.level.ceilingAbove(a.x, a.y - 4)
        for (let i = 0; i < 3; i++) {
          const pr = new Projectile('stalactite', a.x - 20 + i * 20, ceil + 4, 0, 0)
          pr.delay = 0.35 + i * 0.2
          pr.warnY = a.y
          this.projectiles.push(pr)
        }
        this.shake(0.4, 1.5)
      }
    }
  }

  private collide(): void {
    // ?�레?�어 충격??강�?) ????보스
    for (const pr of this.projectiles) {
      if (pr.hostile || pr.dead || pr.delay > 0) continue
      for (const e of this.enemies) {
        if (e.dying || e.invulnerable || pr.hitSet.has(e)) continue
        if (overlap(pr, e)) {
          e.hit(this, pr.dmg, pr.cx, pr.owner)
          pr.hitSet.add(e)
          if (!pr.pierce) { pr.dead = true; break }
        }
      }
      const b = this.boss
      if (!pr.dead && b && !b.dying && !pr.hitSet.has(b) && overlap(pr, b.hitbox)) {
        b.hit(this, pr.dmg, pr.owner)
        pr.hitSet.add(b)
        if (!pr.pierce) pr.dead = true
      }
    }

    for (const p of this.players) {
      if (!p.alive) continue
      for (const pr of this.projectiles) {
        if (!pr.hostile || pr.dead || pr.delay > 0) continue
        if (overlap(pr, p)) {
          p.hurt(this, pr.dmg, pr.cx)
          if (!pr.pierce) pr.dead = true
        }
      }
      for (const e of this.enemies) {
        if(e.dead || e.dying || !overlap(p,e)) continue
        if(e.contactDmg>0&&e.stunT<=0&&e.flash<=0)p.hurt(this,e.contactDmg,e.cx)
      }
      const b = this.boss
      if (b && !b.dying && b.state !== 'enter' && b.state!=='stun' && overlap(p, b.hitbox)) p.hurt(this, b.contactDmg, b.cx)

      for (const it of this.items) {
        if (it.dead || it.t < it.pickupDelay || !overlap(p, it)) continue
        it.dead = true
        if (it.kind === 'empty') {
          this.popup(it.x + 6, it.y - 4, '꽝', '#c9c0ae')
          continue
        }
        this.sfx.pickup()
        switch (it.kind) {
          case 'meat':
            this.food = Math.min(this.foodMax, this.food + 20)
            p.heal(3)
            p.score += 100
          this.popup(it.x + 6, it.y - 4, '+100', '#c9c0ae')
            break
          case 'bigmeat':
            this.food = Math.min(this.foodMax, this.food + 40)
            p.heal(99)
            p.score += 500
          this.popup(it.x + 6, it.y - 4, '+500', '#c9c0ae')
            break
          case 'fruit':
            this.food = Math.min(this.foodMax, this.food + 5)
            p.score += 500
          this.popup(it.x + 6, it.y - 4, '+500', '#c9c0ae')
            break
          case 'cross':
            p.lives=addCaveLife(p.lives)
            p.score+=1000
            this.popup(it.x+6,it.y-4,'1 UP!','#bbf3a4')
            break
          case 'clock':
            this.timeLeft += CLOCK_BONUS
            p.score += 300
          this.popup(it.x + 6, it.y - 4, `+${CLOCK_BONUS/TIME_UNIT}`, '#c9c0ae')
            break
          case 'axe':
          case 'stone':
          case 'bone':
          case 'fire': {
            const w: Weapon = it.kind
            p.weapon = w
            p.score += 200
            this.popup(it.x + 6, it.y - 4, WEAPON_NAME[w]+' 획득!', '#ffe2a0')
            this.showBanner(WEAPON_NAME[w]+' 획득!',2.4,'무기가 자동으로 장착되었습니다')
            break
          }
        }
      }
    }
  }

  /** ?�한 ?�간: 0???�면 ?�아 ?�는 모두 목숨 ?�나�??�고 ?�간???�시 주어진다 */
  private updateTimer(dt: number): void {
    if ((this.mode !== 'play' && this.mode !== 'boss') || this.introT > 0) return
    this.timeLeft = Math.max(0, this.timeLeft - dt)
    const sec = Math.ceil(this.timeLeft/TIME_UNIT)
    if (sec <= 10 && sec > 0 && sec !== this.lastBeep) {
      this.lastBeep = sec
      this.sfx.tick()
    }
    if (this.timeLeft <= 0) {
      this.showBanner('TIME UP!', 2)
      for (const p of this.players) {
        if (!p.alive) continue
        p.invuln = 0
        p.die(this)
      }
      this.timeLeft = TIME_EXTEND
      this.lastBeep = 0
    }
  }

  private checkEnd(dt: number): void {
    if (this.mode === 'clear' || this.mode === 'over') {
      this.endT -= dt
      if (this.endT <= 0 && this.endT > -1) {
        this.endT = -5
        if (this.mode === 'clear' && this.stageIdx < STAGES.length - 1) {
          this.beginJourney()
          return
        }
        this.cb.onEnd(this.mode === 'clear' ? 'clear' : 'over', this.players.map((p) => p.score), this.stage.id)
      }
      return
    }
    if (this.players.every((p) => p.out)) {
      this.mode = 'over'
      this.endT = 2
      this.sfx.stopMusic()
      this.sfx.sad()
      this.showBanner('GAME OVER', 5)
      return
    }
    if(!this.saved && this.mode==='play' && this.food>=this.foodMax && this.players.some(p=>p.alive && p.cx>=this.level.arenaX+20 && p.onGround)) {
      this.startBoss()
    } else if(this.boss?.dead && this.mode==='boss') {
      if(this.stage.final) {
        this.mode='rescue';this.rescueT=0;this.enemies=[];this.projectiles=[]
        this.players.forEach(p=>{p.score+=10000;p.invuln=0;p.spawnFireT=0;p.swingT=0;p.charge=0;p.chargeReady=false;p.celebrating=true;p.vx=0;p.x=Math.min(p.x,this.level.arenaX-8-p.w/2)})
        this.sfx.stopMusic();this.sfx.fanfare();this.showBanner('누가 공주를 찾았다!',7)
      } else this.completeStage()
    }
  }

  private completeStage():void {
    if(this.mode==='clear')return
    this.mode='clear';this.endT=2.5;this.sfx.stopMusic();this.sfx.fanfare()
    this.showBanner('STAGE CLEAR!',2.5)
    const bonus=Math.ceil(this.timeLeft/TIME_UNIT)*10
    for(const p of this.players) if(!p.out) {p.score+=bonus;p.lives=Math.min(9,p.lives+1)}
    if(bonus>0)this.popup(this.camX+VIEW_W/2,70,`TIME BONUS ${bonus}`,'#ffe14a')
  }

  private pushHud(): void {
    const b = this.boss
    this.cb.onHud({
      journey:this.journeyT!==null,
      trail:this.journeyT!==null?JOURNEYS[this.stageIdx]?.reason??null:this.trailT>0?JOURNEYS[this.stageIdx]?.clue??null:this.arrivalT>0&&this.stageIdx>0?`${STAGES[this.stageIdx-1]!.sub}에서 이어진 길 · 킹콩의 발자국을 따라가자.`:null,
      aquatic:!!this.level.def.aquatic,
      aerial:!!this.level.def.aerial,
      food: this.food / this.foodMax,
      foodFullFrame: 1 + Math.floor(this.time * 8) % 3,
      opening:this.introT>0&&this.introElapsed<this.openingDuration?(this.introElapsed<1.7?'누가 공주가 도토리를 든 다람쥐를 쫓아갑니다':this.introElapsed<OPENING_GRAB_START?'다람쥐를 쫓던 공주 앞에 킹콩이 나타납니다':this.introElapsed<OPENING_PLEA_START?'킹콩이 누가 공주를 납치합니다':this.introElapsed<OPENING_DIALOGUE_START?'누가 공주: 우가! 도와줘! 무서워!':this.introElapsed<OPENING_ESCAPE_START?'킹콩: 누가 예쁘다… 내 색시로 삼을 거다!':this.introElapsed<OPENING_HERO_LINE_START?'킹콩이 공주를 데리고 달아납니다':'우가: 누가! 기다려! 내가 꼭 구해줄게!'):null,
      dreaming: this.introT > 0 && this.introElapsed < this.openingDuration+this.dreamCount * 2.5,
      players: this.players.map((p) => ({
        name: p.name,
        color: p.color,
        hp: p.hp,
        maxHp: p.maxHp,
        lives: p.lives,
        score: p.score,
        weapon: WEAPON_NAME[p.weapon],
        weaponKey: p.weapon,
        dead: p.dead,
        out: p.out,
        oxygen:p.oxygen,maxOxygen:MAX_OXYGEN,swimming:p.swimming,submerged:p.submerged,
        flight:p.inUpdraft?'wind':p.gliding?'glide':null,
      })),
      boss: b && !b.dead && b.state !== 'enter' ? { name: b.name, hp: b.hp, max: b.maxHp } : null,
      banner: this.banner,
      bannerSub: this.bannerSub,
      paused: this.paused,
      muted: this.sfx.muted,
      progress: Math.min(1, (this.players[0]?.cx ?? 0) / Math.max(1,this.level.arenaX)),
      timeLeft: Math.ceil(this.timeLeft/TIME_UNIT),
      stage: this.stage.id,
    })
  }

  // ?????????????????????????? render ??????????????????????????
  private previousPositions = new Map<{x:number;y:number;walkDistance?:number},[number,number,number?]>()
  private previousCamera = 0
  private previousCameraY = 0
  private previousLevel: Level | null = null
  private captureRenderState():void {
    this.previousPositions.clear()
    for(const e of [...this.players,...this.enemies,...this.items,...this.projectiles,...this.particles,...(this.boss?[this.boss]:[]),...(this.scrat?[this.scrat]:[])])
      this.previousPositions.set(e,[e.x,e.y,'walkDistance' in e ? e.walkDistance : undefined])
    this.previousCamera=this.camX;this.previousCameraY=this.camY;this.previousLevel=this.level
  }
  private renderInterpolated(alpha:number):void {
    if(this.paused||this.previousLevel!==this.level){this.render();return}
    const current=new Map<{x:number;y:number;walkDistance?:number},[number,number,number?]>()
    for(const[e,[x,y,distance]]of this.previousPositions){
      if(Math.abs(e.x-x)>32||Math.abs(e.y-y)>32)continue
      current.set(e,[e.x,e.y,e.walkDistance]);e.x=x+(e.x-x)*alpha;e.y=y+(e.y-y)*alpha
      if(distance!==undefined&&e.walkDistance!==undefined)e.walkDistance=distance+(e.walkDistance-distance)*alpha
    }
    const camera=this.camX
    const cameraY=this.camY
    if(Math.abs(camera-this.previousCamera)<32)this.camX=this.previousCamera+(camera-this.previousCamera)*alpha
    if(Math.abs(cameraY-this.previousCameraY)<32)this.camY=this.previousCameraY+(cameraY-this.previousCameraY)*alpha
    this.render()
    this.camX=camera
    this.camY=cameraY
    for(const[e,[x,y,distance]]of current){e.x=x;e.y=y;if(distance!==undefined)e.walkDistance=distance}
  }

  private render(): void {
    const ctx = this.ctx
    const sx = this.shakeMag > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0
    const sy = this.shakeMag > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0
    const cx = this.camX - sx
    const cy = this.camY - sy
    if(import.meta.env.DEV){terrainDrawAudit.stage=this.stage.id;terrainDrawAudit.cameraX=cx;terrainDrawAudit.cameraY=cy}

    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    ctx.imageSmoothingEnabled = true
    if(this.stageLoading||this.stageLoadFailed){
      ctx.fillStyle='#24170f';ctx.fillRect(0,0,VIEW_W,VIEW_H)
      const logo=image('title.logo')
      if(logo)ctx.drawImage(logo,VIEW_W/2-100,VIEW_H/2-55,200,80)
      if(this.stageLoadFailed){
        drawPaintedText(ctx,'그림을 불러오지 못했습니다',VIEW_W/2,VIEW_H/2+55,18)
        drawPaintedText(ctx,'화면을 눌러 다시 불러오기',VIEW_W/2,VIEW_H/2+85,16)
        return
      }
      ctx.fillStyle='#f2bb62';ctx.fillRect(VIEW_W/2-60,VIEW_H/2+40,120,5)
      return
    }
    if(this.journeyT!==null){
      const journey=JOURNEYS[this.stageIdx]
      if(journey)drawJourney(ctx,journey,this.journeyT)
      return
    }
    if (this.saved) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    } else this.bg.draw(ctx, this.camX, this.time,this.camY,this.level.height-VIEW_H)
    const ls = this.level.scale
    ctx.drawImage(this.level.canvas, cx * ls, cy * ls, VIEW_W * ls, VIEW_H * ls, 0, 0, VIEW_W, VIEW_H)
    if(this.level.def.cave){
      for(const x of [3*TILE,19*TILE]){
        const y=7*TILE,px=x-cx,py=y-cy
        ctx.save()
        const glow=ctx.createRadialGradient(px,py-8,2,px,py-8,58)
        glow.addColorStop(0,'rgba(255,182,64,.45)');glow.addColorStop(1,'rgba(255,130,30,0)')
        ctx.fillStyle=glow;ctx.fillRect(px-58,py-66,116,116)
        ctx.strokeStyle='#73503b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px-4,py+10);ctx.lineTo(px,py-2);ctx.stroke()
        drawArt(ctx,'fire.flame',frameAt('fire.flame',this.time+x),px,py,false)
        ctx.restore()
      }
    }
    this.drawWater(ctx, cx, cy)
    this.drawAirPockets(ctx,cx,cy)
    this.drawUpdrafts(ctx,cx,cy)
    this.drawDoors(ctx, cx, cy)
    if(!this.saved)drawPursuitExit(ctx,this.stage.id,this.level.arenaX,x=>this.level.floorBelow(x,0),cx,cy)
    if(this.scrat&&!this.saved&&this.mode==='play'){
      const s=this.scrat,key=s.state==='pet'?'squirrel.pet':s.state==='startled'?'squirrel.startled':'squirrel.run'
      const frame=s.state==='pet'?frameAt(key,s.stateT):s.state==='startled'?progressFrame(key,s.stateT/.28):walkFrame(key,s.walkDistance)
      const hop=s.state==='startled'?Math.sin(Math.min(1,s.stateT/.28)*Math.PI)*4:0
      drawArt(ctx,key,frame,s.x+s.w/2-cx,s.y+s.h-cy-hop,s.state==='startled'&&s.lookLeft,{alpha:Math.min(1,s.age/.1,s.state==='run'?(4.7-s.stateT)/.35:1)})
    }

    if(!this.saved) {
      const x=this.level.arenaX+(this.stage.final?16:VIEW_W-32),y=this.level.floorBelow(x,100)
      drawArt(ctx,'v2.flag',0,x-cx,y-cy,false,{alpha:this.food>=this.foodMax?1:.45})
      if(this.stage.final){const key=this.mode==='rescue'?(this.rescueT<3?'nuga.wave':'nuga.cheer'):'nuga.idle';drawArt(ctx,key,frameAt(key,this.mode==='rescue'?this.rescueT:this.time),this.level.arenaX+36-cx,y-cy,false)}
    }

    for (const it of this.items) it.draw(ctx, cx, cy)
    for (const e of this.enemies) {
      ctx.save()
      if (this.level.def.cave || this.level.caveAt(e.cx, e.y + e.h / 2)) {
        ctx.filter = 'brightness(1.12)'
      }
      e.draw(ctx, cx, cy)
      e.drawStars(ctx, cx, cy)
      ctx.restore()
    }
    this.boss?.draw(ctx, cx, cy)
    if (this.introT <= 0 || this.stageIdx>0 || this.introElapsed >= this.openingDuration+this.dreamCount * 2.5 + 1.5) {
      for (const p of this.players) {
        p.draw(ctx, cx, cy)

      }
    }
    for (const p of this.projectiles) p.draw(ctx, cx, cy)
    for (const f of this.effects) f.draw(ctx, cx, cy)
    for (const p of this.particles) p.draw(ctx, cx, cy)
    for(const p of this.players)if(p.alive&&p.submerged){
      ctx.save();ctx.strokeStyle='#c9faff';ctx.lineWidth=.5
      for(let i=0;i<3;i++){
        const age=(this.time*17+i*9)%30
        ctx.globalAlpha=(1-age/30)*.7
        ctx.beginPath();ctx.arc(p.cx-cx+p.facing*5+Math.sin(age*.2+i)*2,p.y-cy+4-age,1+age*.025,0,Math.PI*2);ctx.stroke()
      }
      ctx.restore()
    }
    this.drawDarkness(ctx, cx, cy)
    for (const p of this.popups) p.draw(ctx, cx, cy)

    this.drawIntro(ctx)
    if (this.passage) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.passage.t)})`
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    if (this.introT <= 0) return
    if(this.introElapsed<this.openingDuration){drawOpening(ctx,this.introElapsed);return}
    const elapsed=this.introElapsed-this.openingDuration
    const dreams = this.dreamCount * 2.5
    if (elapsed < dreams) {
      const t = elapsed % 2.5
      const dream=image('intro.uga')
      if(dream)ctx.drawImage(dream,0,0,VIEW_W,VIEW_H)
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, (t - 2.05) / .45)})`
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      return
    }
    const t = elapsed - dreams
    if(t<1.5){
      if(this.stageIdx===0)for(const p of this.players){
        if(!p.out)drawArt(ctx,'p1.respawn',progressFrame('p1.respawn',Math.max(0,(t-.7)/.8)),p.cx-this.camX,p.y+p.h-this.camY,false)
      }
      ctx.save();ctx.font='bold 24px "Trebuchet MS", sans-serif';ctx.textAlign='center';ctx.lineJoin='round'
      ctx.lineWidth=3;ctx.strokeStyle='#573a25';ctx.fillStyle='#fff0bc';ctx.strokeText('READY!',VIEW_W/2,66);ctx.fillText('READY!',VIEW_W/2,66);ctx.restore()
    }

  }

  /** 물·용?�·얼?�물 (�???그림 ?�에 ?�들리는 ?�면) */
  private drawUpdrafts(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    const sky=this.level.def.aerial;if(!sky)return
    ctx.save()
    for(const p of sky.updrafts){
      const x=p.col*TILE-cx,y=p.row*TILE-cy,w=p.w*TILE,h=p.h*TILE
      if(x+w<0||x>VIEW_W)continue
      const mist=ctx.createLinearGradient(x,0,x+w,0)
      mist.addColorStop(0,'rgba(208,252,255,0)');mist.addColorStop(.5,'rgba(208,252,255,.2)');mist.addColorStop(1,'rgba(208,252,255,0)')
      ctx.fillStyle=mist;ctx.fillRect(x,y,w,h)
      ctx.strokeStyle='#e6ffff';ctx.lineWidth=.8
      for(let i=0;i<10;i++){
        const py=y+h-((this.time*80+i*43+p.col*7)%h)
        const px=x+w*(.22+(i%3)*.28)+Math.sin(this.time*2+i)*3
        ctx.globalAlpha=.35+(i%3)*.15
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+14);ctx.stroke()
      }
      ctx.globalAlpha=1
    }
    ctx.restore()
  }

  private drawAirPockets(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    const sea=this.level.def.aquatic;if(!sea)return
    ctx.save()
    for(const p of sea.airPockets){
      const x=p.col*TILE-cx,y=p.row*TILE-cy,w=p.w*TILE,h=p.h*TILE
      if(x+w<0||x>VIEW_W||y+h<0||y>VIEW_H)continue
      const light=ctx.createLinearGradient(0,y,0,y+h)
      light.addColorStop(0,'rgba(215,243,183,.38)');light.addColorStop(1,'rgba(190,244,226,.08)')
      ctx.fillStyle=light;ctx.fillRect(x,y,w,h)
      ctx.strokeStyle='#b6ece2';ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(x,y+h);ctx.quadraticCurveTo(x+w/2,y+h+Math.sin(this.time*2+p.col)*2,x+w,y+h);ctx.stroke()
    }
    ctx.restore()
  }

  private drawWater(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const lv = this.level
    const c0 = Math.max(0, Math.floor(cx / TILE))
    const c1 = Math.min(lv.cols - 1, Math.ceil((cx + VIEW_W) / TILE))
    const color = this.stage.theme.water
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < lv.rows; r++) {
        if (!lv.waterAt(c * TILE + 1, r * TILE + 1)) continue
        const top = !lv.waterAt(c * TILE + 1, (r - 1) * TILE + 1)
        const wave = top ? Math.round(Math.sin(this.time * 3 + c * 0.9)) : 0
        ctx.globalAlpha = lv.def.aquatic ? .17 : .85
        ctx.fillStyle = color
        ctx.fillRect(c * TILE - cx, r * TILE - cy + (top ? 2 + wave : 0), TILE, TILE + (top ? -2 - wave : 0))
        if (top) {
          ctx.globalAlpha = 0.6
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(c * TILE - cx, r * TILE - cy + 2 + wave, TILE, 1)
        }
      }
    }
    ctx.globalAlpha = 1
  }

  /** ?�굴?? ?�두컴컴: ?�굴 칸을 ?�둡�???�� 캐릭??주�?�?밝게 */
  private drawDarkness(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const lv = this.level
    const visible = lv.caveRects.filter((r) => r.x + r.w > cx && r.x < cx + VIEW_W)
    if (visible.length === 0) return
    const d = this.darkCtx
    d.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    d.globalCompositeOperation = 'source-over'
    d.clearRect(0, 0, VIEW_W, VIEW_H)
    d.fillStyle = lv.def.cave
      ? 'rgba(6,10,18,0.32)'
      : (this.saved ? 'rgba(6,9,16,0.22)' : 'rgba(6,9,16,0.38)')
    d.filter = lv.def.cave ? 'none' : 'blur(5px)'
    for (const r of visible) d.fillRect(r.x - cx - 0.5, r.y - cy - 0.5, r.w + 1, r.h + 1)
    d.filter = 'none'
    // �? ?�레?�어, �??�정, �??�사�? ?�계
    d.globalCompositeOperation = 'destination-out'
    const light = (x: number, y: number, rad: number, k = 1) => {
      const gr = d.createRadialGradient(x - cx, y - cy, 2, x - cx, y - cy, rad)
      gr.addColorStop(0, `rgba(0,0,0,${k})`)
      gr.addColorStop(0.6, `rgba(0,0,0,${k * 0.6})`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      d.fillStyle = gr
      d.beginPath()
      d.arc(x - cx, y - cy, rad, 0, Math.PI * 2)
      d.fill()
    }
    for (const p of this.players) if (!p.out) light(p.cx, p.y + p.h / 2, p.weapon === 'fire' ? 58 : 40)
    for (const e of this.enemies) {
      if (e instanceof FireTrap) light(e.cx, e.y + e.h / 2, 30+16*e.intensity, 0.9)
      else light(e.cx, e.y + e.h / 2, Math.max(e.w, e.h) * 0.8 + 8, 0.75)
    }
    for (const pr of this.projectiles) if (pr.kind === 'fireball' || pr.kind === 'lavarock' || pr.kind === 'lavablob') light(pr.cx, pr.cy, 26, 0.8)
    for (const it of this.items) if (!it.dead) light(it.x + 6, it.y + 5, it.kind==='cross'?24:18, 0.65)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.dark, 0, 0)
    ctx.restore()
  }
}

