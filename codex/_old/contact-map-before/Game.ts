import { SCALE, STEP, TILE, VIEW_H, VIEW_W, overlap } from './constants'
import { Input } from './input'
import { Level } from './level'
import { Background } from './background'
import { Boss } from './boss'
import {
  Charger, Enemy, FireTrap, Flyer, Fx, Item, Melee, Particle, Player, Popup, Projectile, Runner, Spider, SpikeTrap, Thrower,
  WEAPON_NAME, type Weapon,
} from './entities'
import { STAGES, makeCaveRoom, type EnemyCfg, type StageDef } from './stages'
import { drawArt, frameAt, image, drawPaintedText } from './art'
import { sfx, type Sfx } from './audio'

/** Compact in place to avoid six temporary arrays per simulation step. */
function removeDead<T extends {dead:boolean}>(items:T[]):void {
  let write=0
  for(let read=0;read<items.length;read++)if(!items[read]!.dead)items[write++]=items[read]!
  items.length=write
}

export interface HudPlayer {
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
  food: number
  foodFullFrame: number
  dreaming: boolean
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
type Treasure = 'clock' | 'meat' | 'bigmeat' | 'fruit' | 'nothing' | 'monster' | 'weapon' | 'trap'
const TREASURE_TABLE: [Treasure, number][] = [
  ['clock', 20], ['meat', 20], ['bigmeat', 6], ['fruit', 12], ['nothing', 14], ['monster', 18], ['weapon', 6], ['trap', 4],
]
function rollTreasure(): Treasure {
  const total = TREASURE_TABLE.reduce((a, [, w]) => a + w, 0)
  let r = Math.random() * total
  for (const [t, w] of TREASURE_TABLE) {
    r -= w
    if (r <= 0) return t
  }
  return 'nothing'
}

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
  readonly foodMax = 100
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
  private introElapsed = 0

  skipIntro(): void {
    if (this.introT <= 0) return
    this.introT = 0
    this.players.forEach(p => { p.invuln = 1.5 })
    this.pushHud()
  }
  private stopped = false
  private dark: HTMLCanvasElement
  private darkCtx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement, numPlayers: number, private cb: GameCallbacks, startStage = 0) {
    canvas.width = VIEW_W * SCALE
    canvas.height = VIEW_H * SCALE
    this.ctx = canvas.getContext('2d')!
    this.dark = document.createElement('canvas')
    this.dark.width = VIEW_W * SCALE
    this.dark.height = VIEW_H * SCALE
    this.darkCtx = this.dark.getContext('2d')!
    this.input = new Input(numPlayers)
    this.stageIdx = Math.max(0, Math.min(STAGES.length - 1, startStage))
    this.stage = STAGES[this.stageIdx]
    this.level = new Level(this.stage)
    const defs: [string, string][] = [['우가', '#ff9a3a'], ['부가', '#c48cff']]
    for (let i = 0; i < numPlayers; i++) this.players.push(new Player(i, defs[i][0], defs[i][1]))
    this.dreamCount = numPlayers
    this.beginStage()
  }

  /** ?�테?��? ?�작 (처음 ?�는 ?�음 ?�테?��?�??�어�??? */
  private beginStage(): void {
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
    this.mode = 'play'
    this.food = 0
    this.timeLeft = TIME_LIMIT
    this.lastBeep = 0
    this.bg.setStage(this.stage.theme.n, this.stage.theme.tint)
    this.bg.setBoss(false)
    for (const p of this.players) {
      if (p.out) continue
      p.spawnAt(this, true)
      p.invuln = 0
      p.y = (this.level.groundY(p.x) ?? 11 * TILE) - p.h
    }
    // Food belongs to authored routes, animals and persistent cave rooms.
    // No duplicated "guaranteed" drops, no deletion when the camera moves away.
    this.introElapsed = 0
    this.introT = this.dreamCount * 2.5 + 2.1
    this.banner = null
    this.pushHud()
    this.sfx.playMusic('stage')
    if(this.stage.kind==='boss') this.startBoss()
  }

  private nextStage(): void {
    this.stageIdx++
    this.stage = STAGES[this.stageIdx]
    this.level = new Level(this.stage)
    this.dreamCount = 0
    this.beginStage()
  }

  start(): void {
    this.sfx.playMusic('stage')
    this.last = performance.now()
    const loop = (ts: number) => {
      if (this.stopped) return
      const frame = Math.min(0.1, (ts - this.last) / 1000)
      this.last = ts
      this.acc += frame
      let n = 0
      while (this.acc + 1e-10 >= STEP && n < 6) {
        this.captureRenderState()
        this.update(STEP)
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
    dt *= 0.75 // Fixed simulation steps; movement and animation run 25% slower.
    this.time += dt
    this.updateTimer(realDt)
    if (this.tryDoor()) return
    this.players.forEach((p, i) => {
      p.spawnFireT = Math.max(0, p.spawnFireT - (realDt - dt))
      p.invuln = Math.max(0, p.invuln - (realDt - dt))
      p.update(this, dt, inp.get(i))
    })
    this.updateCamera(dt)
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

  // ?????????????????????????? ?�굴 �???????????????????????????
  /** ?�굴 ?�구 ?�에???????�굴 방으�?*/
  private tryDoor(): boolean {
    if(this.mode!=='play') return false
    for(let i=0;i<this.players.length;i++) {
      const p=this.players[i]!
      if(!p.alive || !p.onGround || p.climbing) continue
      if(this.saved) {
        if(p.x<=18 || (this.input.get(i).downPressed && p.cx<58)) {
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
      p.x=30;p.y=this.level.floorBelow(40,100)-p.h;p.vx=0;p.vy=0;p.climbing=false;p.onGround=true;p.facing=1;p.swingT=0
      p.checkpoint();p.invuln=Math.max(p.invuln,.8)
    }
    this.spawn();this.sfx.thud();this.showBanner('동굴',.9)
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
    if(this.saved){drawArt(ctx,'v2.door',0,24-cx,this.level.floorBelow(40,100)-cy,false);return}
    for(const d of this.doors){
      if(d.x<cx-40||d.x>cx+VIEW_W+40)continue
      drawArt(ctx,'v2.door',0,d.x-cx,d.floor-cy,false,{alpha:d.used?.8:1})
      if(this.players.some(p=>p.alive&&Math.abs(d.x-p.cx)<18&&Math.abs(d.floor-p.y-p.h)<6)){
        ctx.fillStyle='#ffe8a3';ctx.beginPath();ctx.moveTo(d.x-cx-3,d.floor-cy-45);ctx.lineTo(d.x-cx+3,d.floor-cy-45);ctx.lineTo(d.x-cx,d.floor-cy-40);ctx.closePath();ctx.fill()
      }
    }
  }

  private updateCamera(dt: number): void {
    if(this.saved) {this.camX=0;return}
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
    const gate=this.level.arenaX+16
    if(this.food<this.foodMax && p.x+p.w>gate) {
      p.x=gate-p.w;p.vx=0
      if(this.bannerT<=0)this.showBanner('배고프다!',1.5)
    }
  }

  private startBoss(): void {
    this.mode = 'boss'
    const cfg = this.stage.boss
    const floor = this.level.floorBelow(this.level.arenaX + VIEW_W - 40, 0)
    this.boss = new Boss(cfg, this.level.arenaX + VIEW_W + 10, floor - cfg.h)
    this.bg.setBoss(true)
    this.sfx.playMusic('boss')
    this.showBanner('보스 등장!', 2.2, cfg.name)
    this.enemies.forEach((e) => (e.dead = true))
    this.level.spawns.forEach((s) => (s.done = true))
  }

  private makeEnemy(cfg: EnemyCfg, x: number, floorY: number, row: number): Enemy {
    switch (cfg.cls) {
      case 'melee': return new Melee(cfg, x, floorY - cfg.h)
      case 'thrower': return new Thrower(cfg, x, floorY - cfg.h)
      case 'runner': return new Runner(cfg, x, floorY - cfg.h)
      case 'charger': return new Charger(cfg, x, floorY - cfg.h)
      case 'flyer': return new Flyer(cfg, x, row * TILE)
    }
  }

  private spawn(): void {
    const edge = this.camX + VIEW_W + 8
    const lv = this.level
    const n = this.stage.theme.n
    for (const s of lv.spawns) {
      if (s.done || s.col * TILE > edge) continue
      s.done = true
      const x = s.col * TILE
      const cy = s.row * TILE
      const floor = lv.floorBelow(x + 8, cy)
      switch (s.kind) {
        case 'E': case 'M': case 'U': case 'F': {
          const cfg = this.stage.roles[s.kind as 'E' | 'M' | 'U' | 'F']
          if (cfg) this.enemies.push(this.makeEnemy(cfg, x, floor, s.row))
          break
        }
        case 'S':
          this.enemies.push(new Spider(lv, x + 8, cy))
          break
        case '^':
          this.enemies.push(new SpikeTrap(x+8,floor))
          break
        case 'X':
          this.enemies.push(new FireTrap(x + 8, floor))
          break
        case 'm':
          this.items.push(new Item('meat', x + 2, cy, false, n))
          break
        case 'f':
          this.items.push(new Item('fruit', x + 2, cy, false, n))
          break
        case 'k':
          this.items.push(new Item('clock', x + 2, floor - 12, false, n))
          break
        case 'b':
          this.items.push(new Item(this.stage.weapon, x + 2, cy, false, n))
          break
        case '?':
          this.placeTreasure(x + 2, floor)
          break
        case 'D':
          this.doors.push({ x: x + 8, floor, used: false, id: this.doors.length })
          break
      }
    }
  }

  /** ?�굴 보물: ?�계 / 고기 / �?/ 몬스??/ 무기 / ?�석 ?�정??무작??*/
  private placeTreasure(x: number, floor: number): void {
    const t = rollTreasure()
    const n = this.stage.theme.n
    const y = floor - 12
    switch (t) {
      case 'clock': this.items.push(new Item('clock', x, y, false, n)); break
      case 'meat': this.items.push(new Item('meat', x, y, false, n)); break
      case 'bigmeat': this.items.push(new Item('bigmeat', x, y, false, n)); break
      case 'fruit': this.items.push(new Item('fruit', x, y, false, n)); break
      case 'weapon': this.items.push(new Item(this.stage.weapon, x, y, false, n)); break
      case 'nothing': this.items.push(new Item('empty', x, floor - 10, false, n)); break
      case 'monster':
      case 'trap':
        this.ambushes.push({ x, y: floor, kind: t, done: false })
        // 겉보기엔 고기�? ?�여 ?�음 (미끼)
        this.items.push(new Item('meat', x, y, false, n))
        break
    }
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
        if(e.stunT>0) e.collect(this,p)
        else p.hurt(this,e.contactDmg,e.cx)
      }
      const b = this.boss
      if (b && !b.dying && b.state !== 'enter' && overlap(p, b.hitbox)) p.hurt(this, b.contactDmg, b.cx)
      for (const it of this.items) {
        if (it.dead || !overlap(p, it)) continue
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
          case 'clock':
            this.timeLeft += CLOCK_BONUS
            p.score += 300
          this.popup(it.x + 6, it.y - 4, `+${CLOCK_BONUS/TIME_UNIT}`, '#c9c0ae')
            break
          case 'bone':
          case 'fire': {
            const w: Weapon = it.kind
            p.weapon = w
            p.score += 200
          this.popup(it.x + 6, it.y - 4, WEAPON_NAME[w], '#c9c0ae')
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
          this.nextStage()
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
    if(this.stage.kind!=='boss' && !this.saved && this.mode==='play' && this.food>=this.foodMax && this.players.some(p=>p.alive && p.cx>=this.level.arenaX+20 && p.onGround)) {
      if(this.stage.final) {
        this.mode='rescue';this.rescueT=0;this.enemies=[];this.projectiles=[]
        this.players.forEach(p=>{p.score+=10000;p.invuln=0;p.spawnFireT=0;p.swingT=0;p.charge=0;p.chargeReady=false;p.celebrating=true;p.vx=0;p.x=Math.min(p.x,this.level.arenaX-8-p.w/2)})
        this.sfx.stopMusic();this.sfx.fanfare();this.showBanner('누가 공주를 찾았다!',7)
      } else this.completeStage()
    } else if(this.boss?.dead) this.completeStage()
  }

  private completeStage():void {
    if(this.mode==='clear')return
    this.mode='clear';this.endT=2.5;this.sfx.stopMusic();this.sfx.fanfare()
    this.showBanner('STAGE CLEAR!',2.5)
    const bonus=Math.ceil(this.timeLeft/TIME_UNIT)*10
    for(const p of this.players) if(!p.out) {p.score+=bonus;if(this.stage.kind!=='boss')p.lives=Math.min(9,p.lives+1)}
    if(bonus>0)this.popup(this.camX+VIEW_W/2,70,`TIME BONUS ${bonus}`,'#ffe14a')
  }

  private pushHud(): void {
    const b = this.boss
    this.cb.onHud({
      food: this.food / this.foodMax,
      foodFullFrame: 1 + Math.floor(this.time * 8) % 3,
      dreaming: this.introT > 0 && this.introElapsed < this.dreamCount * 2.5,
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
      })),
      boss: b && !b.dead && b.state !== 'enter' ? { name: b.name, hp: b.hp, max: b.maxHp } : null,
      banner: this.banner,
      bannerSub: this.bannerSub,
      paused: this.paused,
      muted: this.sfx.muted,
      progress: this.stage.kind==='boss'?1:Math.min(1, (this.players[0]?.cx ?? 0) / Math.max(1,this.level.arenaX)),
      timeLeft: Math.ceil(this.timeLeft/TIME_UNIT),
      stage: this.stage.id,
    })
  }

  // ?????????????????????????? render ??????????????????????????
  private previousPositions = new Map<{x:number;y:number;walkDistance?:number},[number,number,number?]>()
  private previousCamera = 0
  private previousLevel: Level | null = null
  private captureRenderState():void {
    this.previousPositions.clear()
    for(const e of [...this.players,...this.enemies,...this.items,...this.projectiles,...this.particles,...(this.boss?[this.boss]:[])])
      this.previousPositions.set(e,[e.x,e.y,'walkDistance' in e ? e.walkDistance : undefined])
    this.previousCamera=this.camX;this.previousLevel=this.level
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
    if(Math.abs(camera-this.previousCamera)<32)this.camX=this.previousCamera+(camera-this.previousCamera)*alpha
    this.render()
    this.camX=camera
    for(const[e,[x,y,distance]]of current){e.x=x;e.y=y;if(distance!==undefined)e.walkDistance=distance}
  }

  private render(): void {
    const ctx = this.ctx
    const sx = this.shakeMag > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0
    const sy = this.shakeMag > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0
    const cx = this.camX - sx
    const cy = this.camY - sy

    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    ctx.imageSmoothingEnabled = false
    if (this.saved) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    } else this.bg.draw(ctx, this.camX, this.time)
    const ls = this.level.scale
    ctx.drawImage(this.level.canvas, cx * ls, cy * ls, VIEW_W * ls, VIEW_H * ls, 0, 0, VIEW_W, VIEW_H)
    this.drawWater(ctx, cx, cy)
    this.drawDoors(ctx, cx, cy)
    if(!this.saved && this.stage.kind!=='boss') {
      const x=this.level.arenaX+16,y=this.level.floorBelow(x,100)
      drawArt(ctx,'v2.flag',0,x-cx,y-cy,false,{alpha:this.food>=this.foodMax?1:.6})
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
    if (this.introT <= 0 || this.introElapsed >= this.dreamCount * 2.5 + 1.5) {
      for (const p of this.players) {
        p.draw(ctx, cx, cy)
        if (p.alive && p.spawnFireT > 0) {
          const fire = image(`ui.spawn_fire_${1 + Math.floor(this.time * 12) % 4}`)
          if (fire) ctx.drawImage(fire, p.cx - cx - 26, p.y + p.h - cy - 46, 52, 52)
        }
      }
    }
    for (const p of this.projectiles) p.draw(ctx, cx, cy)
    for (const f of this.effects) f.draw(ctx, cx, cy)
    for (const p of this.particles) p.draw(ctx, cx, cy)
    this.drawDarkness(ctx, cx, cy)
    for (const p of this.popups) p.draw(ctx, cx, cy)

    this.drawIntro(ctx, cx, cy)
    if (this.passage) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.passage.t)})`
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }
  }

  private drawIntro(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.introT <= 0) return
    const dreams = this.dreamCount * 2.5
    if (this.introElapsed < dreams) {
      const t = this.introElapsed % 2.5
      const dream=image('intro.uga')
      if(dream)ctx.drawImage(dream,0,0,VIEW_W,VIEW_H)
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, (t - 2.05) / .45)})`
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      return
    }
    const t = this.introElapsed - dreams
    const ready = image('ui.ready')
    if (ready && t < 1.5) ctx.drawImage(ready, VIEW_W / 2 - 60, 46, 120, 120 * ready.height / ready.width)
    const p = this.players[0]!
    const sign = this.stage.id<=3?image(`ui.stage_sign_${this.stage.id}`):null
    if (sign) {
      const w = 2 * 33, h = w * sign.height / sign.width
      ctx.drawImage(sign, p.cx - cx + 20, p.y + p.h - cy - h, w, h)
    }
    if(!sign) {
      ctx.fillStyle='#514330';ctx.strokeStyle='#c6ab73';ctx.lineWidth=1
      ctx.fillRect(p.cx-cx+20,p.y+p.h-cy-24,48,22);ctx.strokeRect(p.cx-cx+20,p.y+p.h-cy-24,48,22)
      drawPaintedText(ctx,String(this.stage.id),p.cx-cx+44,p.y+p.h-cy-6,14)
    }
    if (t >= 1.5) {
      const fire = image(`ui.spawn_fire_${1 + Math.floor((t - 1.5) * 12) % 4}`)
      if (fire) for (const player of this.players) {
        const h = player.h + 24, w = h * fire.width / fire.height
        ctx.drawImage(fire, player.cx - cx - w / 2, player.y + player.h - cy - h + 5, w, h)
      }
    }
  }

  /** 물·용?�·얼?�물 (�???그림 ?�에 ?�들리는 ?�면) */
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
        ctx.globalAlpha = 0.85
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
      ? (this.saved ? 'rgba(6,3,2,0.72)' : 'rgba(6,3,2,0.86)')
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
      if (e instanceof FireTrap) light(e.cx, e.y + e.h / 2, e.big ? 46 : 30, 0.9)
      else light(e.cx, e.y + e.h / 2, Math.max(e.w, e.h) * 0.8 + 8, 0.75)
    }
    for (const pr of this.projectiles) if (pr.kind === 'fireball' || pr.kind === 'lavarock' || pr.kind === 'lavablob') light(pr.cx, pr.cy, 26, 0.8)
    for (const it of this.items) if (it.kind === 'clock') light(it.x + 6, it.y + 5, 18, 0.5)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.dark, 0, 0)
    ctx.restore()
  }
}

