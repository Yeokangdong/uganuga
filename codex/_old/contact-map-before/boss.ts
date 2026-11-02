import type { Game } from './game'
import { CHARACTER_SCALE, GRAVITY, MAX_FALL, RUN_SPEED, VIEW_W, VIEW_H, overlap, type Rect } from './constants'
import { Particle, Projectile, moveBody, type Body, type Player } from './entities'
import { art, drawArt, has, frameAt, walkFrame, drawPaintedText } from './art'
import type { BossCfg } from './stages'

type State =
  | 'enter' | 'roar0' | 'walk' | 'idle' | 'telegraph' | 'charge' | 'stun'
  | 'spitPrep' | 'spit' | 'jumpPrep' | 'jump' | 'roar' | 'dying'

/** ?ㅽ뀒?댁? 1 蹂댁뒪: 遺덈퓶????뎔猷?"荑듭푷?? */
export class Boss implements Body {
  w: number
  h: number
  vx = 0
  vy = 0
  onGround = false
  hitWall = 0
  maxHp: number
  hp: number
  walkDistance = 0
  private landingT = 0
  private moved = false
  facing = -1
  state: State = 'enter'
  t = 0
  anim = 0
  flash = 0
  jaw = 0
  shots = 0
  dead = false
  last: State = 'idle'
  name: string

  constructor(public cfg: BossCfg, public x: number, public y: number) {
    this.w = cfg.w * CHARACTER_SCALE
    this.h = cfg.h * CHARACTER_SCALE
    this.x += cfg.w * (1 - CHARACTER_SCALE) / 2
    this.y += cfg.h * (1 - CHARACTER_SCALE)
    this.maxHp = cfg.hp
    this.hp = this.maxHp
    this.name = cfg.name
  }

  get cx(): number {
    return this.x + this.w / 2
  }
  get phase2(): boolean {
    return this.hp <= this.maxHp / 2
  }
  get dying(): boolean {
    return this.state === 'dying'
  }
  get hitbox(): Rect {
    return { x: this.x + 4 * CHARACTER_SCALE, y: this.y + 2 * CHARACTER_SCALE, w: this.w - 8 * CHARACTER_SCALE, h: this.h - 2 * CHARACTER_SCALE }
  }
  get contactDmg(): number {
    return this.cfg.key === 'boss' ? 1 : this.state === 'charge' ? 2 : 1
  }

  private set(s: State, t: number): void {
    this.state = s
    this.t = t
  }

  hit(g: Game, dmg: number, by: Player | null): void {
    if (this.dying || this.state === 'enter') return
    this.hp -= dmg * (this.state === 'stun' ? 2 : 1)
    this.flash = 0.1
    g.sfx.hit()
    if (by) by.score += 10 * dmg
    if (this.hp <= 0) {
      this.hp = 0
      this.set('dying', 3)
      this.vx = 0
      g.sfx.roar()
      g.projectiles.forEach((p) => p.hostile && (p.dead = true))
      for (const pl of g.players) if (pl.alive) pl.score += 5000
      g.popup(this.cx, this.y - 8, '5000', '#ffe14a')
    }
  }

  private mouth(): [number, number] {
    return [this.facing > 0 ? this.x + this.w + 10 * CHARACTER_SCALE : this.x - 10 * CHARACTER_SCALE, this.y + 22 * CHARACTER_SCALE]
  }

  private faceTarget(p: Player | null): void {
    if (p) this.facing = p.cx < this.cx ? -1 : 1
  }

  update(g: Game, dt: number): void {
    const grounded=this.onGround
    this.landingT=Math.max(0,this.landingT-dt)
    const startX = this.x, startDistance = this.walkDistance
    const placing = this.cfg.key === 'boss' && (this.state === 'enter' || this.state === 'roar0')
    this.anim += dt
    this.flash -= dt
    this.t -= dt
    const L = g.level.arenaX + 4
    const R = g.level.arenaX + VIEW_W - 4
    const p = g.nearestPlayer(this.cx)
    const fast = this.phase2 ? 1.35 : 1

    if (this.cfg.key === 'boss' && !this.dying) this.updateFirst(dt, p, L, R)
    else switch (this.state) {
      case 'enter':
        // 踰??덈㉧?먯꽌 嫄몄뼱 ?ㅼ뼱?ㅻ?濡?異⑸룎 臾댁떆?섍퀬 吏곸젒 ?대룞
        this.vx = 0
        this.x -= 45 * dt
        this.jaw = 0
        if (this.x + this.w < R - 30) {
          this.vx = 0
          this.set('roar0', 1.4)
          g.sfx.roar()
          g.shake(1.0, 3)
        }
        break
      case 'roar0':
        this.jaw = Math.min(1, this.jaw + dt * 5)
        if (this.t <= 0) this.set('idle', 0.8)
        break
      case 'idle':
        this.vx = 0
        this.jaw = Math.max(0, this.jaw - dt * 4)
        this.faceTarget(p)
        if (this.t <= 0) this.choose()
        break
      case 'telegraph':
        this.vx = 0
        if (this.t <= 0) {
          this.set('charge', 3)
          g.sfx.roar()
        }
        break
      case 'charge':
        this.vx = this.facing * this.cfg.chargeSpeed * fast
        this.jaw = 0.6
        if (Math.random() < 0.5) g.particles.push(new Particle(this.cx - this.facing * 30, this.y + this.h, -this.vx * 0.2, -60, 0.4, '#c9a77a', 3))
        if ((this.facing < 0 && this.x <= L) || (this.facing > 0 && this.x + this.w >= R) || this.t <= 0) {
          this.vx = 0
          g.sfx.thud()
          g.shake(0.5, 4)
          this.dropRocks(g, this.phase2 ? 4 : 3, 0.4)
          this.facing = -this.facing
          this.set('stun', 1)
        }
        break
      case 'stun':
        this.vx = 0
        this.jaw = Math.max(0, this.jaw - dt * 3)
        if (this.t <= 0) this.set('idle', 0.5 / fast)
        break
      case 'spitPrep':
        this.faceTarget(p)
        this.jaw = Math.min(1, this.jaw + dt * 3)
        if (this.t <= 0) {
          this.shots = this.phase2 ? 4 : 3
          this.set('spit', 0)
        }
        break
      case 'spit':
        if (this.t <= 0 && this.shots > 0) {
          const [mx, my] = this.mouth()
          const n = this.phase2 ? 4 : 3
          const i = n - this.shots
          const kind = this.cfg.spit
          if (kind === 'lavablob') {
            // ???⑹븫 ?⑹뼱由щ? ?щЪ?좎쑝濡??쇱삱由?
            const vx = this.facing * (70 + i * 45)
            g.projectiles.push(new Projectile(kind, mx, my - 6, vx, -300 - (i % 2) * 40))
          } else {
            const spread = kind === 'iceball' ? 35 : this.phase2 ? 40 : 55
            const vy = -60 + i * spread
            g.projectiles.push(new Projectile(kind, mx, my, this.facing * (kind === 'iceball' ? 120 : 150), vy))
          }
          g.sfx.throw()
          this.shots--
          this.t = 0.22
        }
        if (this.shots <= 0 && this.t <= 0) this.set('idle', 0.9 / fast)
        break
      case 'jumpPrep':
        this.vx = 0
        this.faceTarget(p)
        if (this.t <= 0) {
          const tx = p ? p.cx : this.cx
          this.vy = -400
          this.vx = Math.max(-180, Math.min(180, (tx - this.cx) / 0.85))
          this.set('jump', 3)
        }
        break
      case 'jump':
        if (this.onGround && this.vy === 0 && this.t < 2.8) {
          this.vx = 0
          g.sfx.thud()
          g.shake(0.45, 4)
          const gy = this.y + this.h - 12
          g.projectiles.push(new Projectile('shock', this.x - 4, gy + 6, -160, 0))
          g.projectiles.push(new Projectile('shock', this.x + this.w + 4, gy + 6, 160, 0))
          for (const pl of g.players) if (pl.alive && pl.onGround) pl.vy = -120
          this.set('stun', 1)
        }
        break
      case 'roar':
        this.vx = 0
        this.jaw = Math.min(1, this.jaw + dt * 5)
        if (this.t <= 0) this.set('idle', 0.6 / fast)
        break
      case 'dying':
        this.vx = 0
        this.jaw = 1
        if (Math.random() < 0.4) {
          const ex = this.x + Math.random() * this.w
          const ey = this.y + Math.random() * this.h
          g.burst(ex, ey, Math.random() < 0.5 ? '#ffb43a' : '#ff5a1a', 6)
          if (Math.random() < 0.2) g.sfx.explode()
        }
        if (this.t <= 0) {
          this.dead = true
          g.burst(this.cx, this.y + 20, '#ffe14a', 40)
          g.shake(0.6, 5)
        }
        break
    }

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)
    moveBody(this, g.level, dt)
    if (this.cfg.key === 'boss' && this.state === 'charge' &&
        (this.hitWall !== 0 || Math.abs(this.x - this.chargeStart) >= VIEW_W / 4 - 0.01 ||
          this.x <= L || this.x + this.w >= R)) {
      this.vx = 0
      this.set('stun', 2)
      g.sfx.thud()
    }
    if (this.state !== 'enter' && !this.dying) {
      for (const pl of g.players) {
        if (!pl.alive || pl.invuln <= 0 || !overlap(pl, this.hitbox)) continue
        const left = this.hitbox.x - pl.w
        const right = this.hitbox.x + this.hitbox.w
        pl.x = left >= g.camX && (pl.cx < this.cx || right > g.camX + VIEW_W - pl.w) ? left : right
        pl.x = Math.max(g.camX, Math.min(g.camX + VIEW_W - pl.w, pl.x))
      }
    }
    if (this.state !== 'enter') {
      if (this.x < L) this.x = L
      if (this.x + this.w > R) this.x = R - this.w
    }
    const distance = placing ? 0 : Math.abs(this.x - startX)
    this.walkDistance = startDistance + distance
    this.moved = distance > 0.001
    if(!grounded&&this.onGround)this.landingT=.22
  }

  private chargeStart = 0

  private updateFirst(dt: number, p: Player | null, L: number, R: number): void {
    this.vx = 0
    this.jaw = Math.max(0, this.jaw - dt * 4)
    // Start inside the arena; every cycle is idle -> walk -> warning -> charge -> stun.
    if (this.state === 'enter' || this.state === 'roar0') {
      this.x = Math.max(L, Math.min(R - this.w - 30, this.x))
      this.faceTarget(p)
      this.set('idle', 2)
    } else if (this.state === 'idle') {
      if (this.t <= 0) this.set('walk', 2)
    } else if (this.state === 'walk') {
      this.faceTarget(p)
      if (p && Math.abs(p.cx - this.cx) > (p.w + this.w) / 2 + 12) {
        this.vx = this.facing * Math.min(RUN_SPEED * 0.5,
          Math.max(0, Math.abs(p.cx - this.cx) - (p.w + this.w) / 2 - 12) / dt)
      }
      if (this.t <= 0) {
        this.vx = 0
        this.faceTarget(p)
        this.set('telegraph', 0.8)
      }
    } else if (this.state === 'telegraph') {
      if (this.t <= 0) {
        this.chargeStart = this.x
        this.set('charge', VIEW_W / 4 / this.cfg.chargeSpeed)
      }
    } else if (this.state === 'charge') {
      const remaining = Math.max(0, VIEW_W / 4 - Math.abs(this.x - this.chargeStart))
      this.vx = this.facing * Math.min(this.cfg.chargeSpeed, remaining / dt,
        Math.max(0, this.facing < 0 ? this.x - L : R - this.w - this.x) / dt)
      if (this.t <= 0 || remaining <= 0.01) {
        this.vx = 0
        this.set('stun', 2)
      }
    } else if (this.state === 'stun' && this.t <= 0) {
      this.set('idle', 2)
    }
  }

  private choose(): void {
    const m = this.cfg.moves
    const opts: [State, number][] = [['telegraph', m.charge], ['spitPrep', m.spit], ['jumpPrep', m.jump], ['roar', m.roar]]
    const pool = opts.filter(([st]) => st !== this.last)
    const total = pool.reduce((a, [, w]) => a + w, 0)
    let roll = Math.random() * total
    let next: State = pool[0][0]
    for (const [st, w] of pool) {
      roll -= w
      if (roll <= 0) {
        next = st
        break
      }
    }
    this.last = next
    const times: Partial<Record<State, number>> = { telegraph: 0.8, spitPrep: 0.55, jumpPrep: 0.4, roar: 1.3 }
    this.set(next, times[next] ?? 0.5)
    if (next === 'roar') this.pendingRoar = true
  }

  pendingRoar = false

  /** 寃뚯엫 猷⑦봽?먯꽌 roar ?곹깭 吏꾩엯 吏곹썑 ?몄텧 */
  afterUpdate(g: Game): void {
    if (this.pendingRoar) {
      this.pendingRoar = false
      g.sfx.roar()
      g.shake(1.0, 2.5)
      this.dropRocks(g, this.phase2 ? 5 : 3, 0.6)
    }
  }

  private dropRocks(g: Game, n: number, baseDelay: number): void {
    const L = g.level.arenaX + 16
    for (let i = 0; i < n; i++) {
      const x = L + Math.random() * (VIEW_W - 32)
      const r = new Projectile(this.cfg.drop, x, -20, 0, 0)
      r.warnY = g.level.floorBelow(x, 0)
      r.delay = baseDelay + i * 0.18 + Math.random() * 0.3
      r.life = 4 + r.delay
      g.projectiles.push(r)
    }
  }

  private paintedHead = { x: 0, y: 0 }
  private frameBounds = new WeakMap<object, Map<number, number[]>>()

  private paintedAction = ''
  private paintedStart = 0
  private drawPainted(ctx: CanvasRenderingContext2D, cx: number, cy: number): boolean {
    const K = has(`${this.cfg.key}.idle`) ? this.cfg.key : has('boss.idle') ? 'boss' : ''
    if (!K) return false
    const map: Partial<Record<State, string>> = {
      enter: 'walk', walk: 'walk', roar0: 'roar', roar: 'roar', telegraph: 'windup', charge: 'charge',
      stun: 'stun', spitPrep: 'windup', spit: 'spit', jumpPrep: 'windup', jump: 'jump', dying: 'dead',
    }
    let key = `${K}.${map[this.state] ?? 'idle'}`
    if (!has(key)) key = `${K}.idle`
    const tint = K !== this.cfg.key
    const walking = this.state === 'enter' || this.state === 'walk'
    if (walking) key = `${K}.${this.moved ? 'walk' : 'idle'}`
    if(this.landingT>0&&this.state!=='dying'&&has(`${K}.land`))key=`${K}.land`
    if (this.flash > 0 && this.state !== 'dying') key = `${K}.hit`
    if (this.paintedAction !== key) { this.paintedAction = key; this.paintedStart = this.anim }
    const frame = this.moved && (key===`${K}.walk`||key===`${K}.charge`) ? walkFrame(key,this.walkDistance) : frameAt(key,this.anim-this.paintedStart,/\.(idle|walk|charge|stun)$/.test(key))
    const shakeX = this.state === 'telegraph' ? Math.sin(this.anim * 60) * 1.5 : 0
    const bob = 0
    if (tint) ctx.filter = this.cfg.key === 'boss2' ? 'hue-rotate(-25deg) brightness(0.75) saturate(1.4)' : 'hue-rotate(170deg) saturate(0.7) brightness(1.2)'
    drawArt(ctx, key, frame, this.cx - cx + shakeX, this.y + this.h - cy + bob, this.facing < 0, {
      white: this.flash > 0, glow: this.phase2 ? '#ff3a1a' : undefined,
    })
    // Use one reference pose per boss; animation bounds must not move the label.
    const sprite = art.sprites[`${K}.idle`]!
    let cache = this.frameBounds.get(sprite)
    if (!cache) { cache = new Map(); this.frameBounds.set(sprite, cache) }
    let bounds = cache.get(0)
    const f = sprite.frames[0]!
    const [fx, fy, fw, fh] = f
    if (!bounds) {
      const canvas = document.createElement('canvas')
      canvas.width = fw; canvas.height = fh
      const g = canvas.getContext('2d')!
      g.drawImage(sprite.img, fx, fy, fw, fh, 0, 0, fw, fh)
      const pixels = g.getImageData(0, 0, fw, fh).data
      let left = fw, right = 0, top = fh
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        if (pixels[(y * fw + x) * 4 + 3]! <= 16) continue
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y)
      }
      bounds = top === fh ? [0, fw, 0] : [left, right, top]
      cache.set(0, bounds)
    }
    const scale = sprite.ppu ?? sprite.h / fh
    const ax = f.length >= 6 ? f[4]! : sprite.ax
    const ay = f.length >= 6 ? f[5]! : sprite.ay
    // The head is on the forward side of the visible body, excluding transparent cell padding.
    const headX = (bounds[0]! + (bounds[1]! - bounds[0]!) * (sprite.facingLeft?.3:.7) - fw * ax) * scale
    this.paintedHead = {
      x: this.cx - cx + (this.facing < 0 !== !!sprite.facingLeft ? -headX : headX),
      y: this.y + this.h - cy + (bounds[2]! - fh * ay) * scale,
    }
    ctx.filter = 'none'
    if (this.state === 'stun') {
      ctx.fillStyle = '#ffe14a'
      for (let i = 0; i < 3; i++) {
        const a = this.anim * 6 + (i * Math.PI * 2) / 3
        const hx = this.cx - cx + this.facing * 26 + Math.cos(a) * 12
        ctx.beginPath()
        ctx.arc(hx, this.y - cy - 6 + Math.sin(a) * 4, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return true
  }

  // ????????????? 洹몃━湲?(?꾪듃 ?먮굦???ш컖??議고빀) ?????????????
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.dying && Math.floor(this.anim * 20) % 3 === 0) return
    if (!this.drawPainted(ctx, cx, cy)) this.drawPixel(ctx, cx, cy)
    this.drawHpBar(ctx, cx, cy)
    if (this.cfg.key === 'boss' && this.state === 'telegraph') {
      drawPaintedText(ctx, '!', this.cx - cx, this.y - cy - 24, 22)
    }
  }

  /** 癒몃━ ??泥대젰 寃뚯씠吏 */
  private drawHpBar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.state === 'enter' || this.dying) return
    const w = 64
    const painted = has(`${this.cfg.key}.idle`) || has('boss.idle')
    const head = painted ? this.paintedHead : { x: this.cx + this.facing * 14 - cx, y: this.y - cy }
    const nameImage = art.images[this.cfg.key === 'boss3' ? 'ui.word_woolly_mammoth' : this.cfg.key === 'boss2' ? 'ui.word_lava_dragon' : 'ui.word_tyrant_king']
    const halfWidth = Math.max((w + 3) / 2, nameImage ? 9 * nameImage.width / nameImage.height / 2 : 0)
    const center = Math.max(halfWidth + 2, Math.min(VIEW_W - halfWidth - 2, head.x))
    const x = center - w / 2
    let y = Math.max(15, Math.min(VIEW_H - 8, head.y - 8))
    // HUD cards are DOM overlays; convert their actual bounds to canvas units.
    const screen = ctx.canvas.getBoundingClientRect()
    if (screen.width > 0 && screen.height > 0) {
      const panels = ctx.canvas.parentElement?.querySelectorAll('.hud .pcard') ?? []
      for (const panel of panels) {
        const rect = panel.getBoundingClientRect()
        const left = (rect.left - screen.left) * VIEW_W / screen.width
        const right = (rect.right - screen.left) * VIEW_W / screen.width
        const top = (rect.top - screen.top) * VIEW_H / screen.height
        const bottom = (rect.bottom - screen.top) * VIEW_H / screen.height
        // Include the name (12px above the bar), outline and screen shake margin.
        if (center + halfWidth + 3 > left && center - halfWidth - 3 < right &&
            y + 8 > top && y - 15 < bottom) {
          y = Math.max(y, bottom + 15)
        }
      }
    }
    const k = Math.max(0, this.hp / this.maxHp)
    ctx.save()
    ctx.fillStyle = 'rgba(28,15,8,0.85)'
    ctx.beginPath()
    ctx.roundRect(x - 1.5, y - 1.5, w + 3, 7, 2)
    ctx.fill()
    ctx.fillStyle = '#3a120c'
    ctx.fillRect(x, y, w, 4)
    const grad = ctx.createLinearGradient(0, y, 0, y + 4)
    grad.addColorStop(0, this.phase2 ? '#ff9a3a' : '#ff6a3a')
    grad.addColorStop(1, '#b8200c')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w * k, 4)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(x, y, w * k, 1)
    ctx.font = 'bold 6px "Black Han Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1c0f08'

    ctx.fillStyle = '#ffcf6b'
    drawPaintedText(ctx, this.name, x + w / 2, y - 3, 9)
    ctx.restore()
  }

  private drawPixel(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const white = this.flash > 0
    const C = {
      line: '#1e0d08',
      body: white ? '#ffffff' : this.phase2 ? '#d8402a' : '#c8452f',
      dark: white ? '#ffffff' : '#7a2418',
      belly: white ? '#ffffff' : '#f0c27a',
      spot: white ? '#ffffff' : '#8c2d1f',
      eye: this.phase2 ? '#ff2a2a' : '#ffe14a',
      tooth: '#fff8e0',
      mouth: '#5a0c0c',
    }
    const shakeX = this.state === 'telegraph' ? Math.round(Math.sin(this.anim * 60) * 1.5) : 0
    const ox = Math.round(this.x - cx) + shakeX
    const oy = Math.round(this.y - cy)
    ctx.save()
    if (this.facing < 0) {
      ctx.translate(ox + this.w, oy)
      ctx.scale(-1, 1)
    } else ctx.translate(ox, oy)

    const walk = Math.abs(this.vx) > 1 ? Math.sin(this.anim * (this.state === 'charge' ? 18 : 9)) : 0
    const crouch = this.state === 'jumpPrep' ? 5 : 0
    const R = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = C.line
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
      ctx.fillStyle = c
      ctx.fillRect(x, y, w, h)
    }

    ctx.translate(0, crouch)
    // 瑗щ━
    ctx.fillStyle = C.line
    ctx.beginPath()
    ctx.moveTo(10, 16)
    ctx.lineTo(-30, 30 + walk * 3)
    ctx.lineTo(-34, 34 + walk * 3)
    ctx.lineTo(10, 42)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = C.body
    ctx.beginPath()
    ctx.moveTo(10, 18)
    ctx.lineTo(-28, 31 + walk * 3)
    ctx.lineTo(-31, 33 + walk * 3)
    ctx.lineTo(10, 40)
    ctx.closePath()
    ctx.fill()

    // ?룸떎由?
    const legA = Math.round(walk * 4)
    R(14 - legA, 40, 12, 18 - crouch, C.dark)
    R(10 - legA, 54 - crouch, 18, 4, C.dark)
    // 紐명넻
    R(4, 12, 46, 32, C.body)
    R(22, 22, 26, 20, C.belly)
    ctx.fillStyle = C.spot
    ctx.fillRect(10, 16, 5, 4)
    ctx.fillRect(18, 14, 4, 3)
    ctx.fillRect(12, 26, 4, 4)
    // ??媛??
    ctx.fillStyle = C.dark
    for (let i = 0; i < 5; i++) ctx.fillRect(8 + i * 8, 8, 4, 4)
    // ?욌떎由?
    R(32 + legA, 40, 12, 18 - crouch, C.body)
    R(30 + legA, 54 - crouch, 18, 4, C.dark)
    ctx.fillStyle = C.tooth
    ctx.fillRect(46 + legA, 56 - crouch, 2, 2)
    // 吏㏃? ??
    R(48, 28, 8, 4, C.body)
    R(54, 30, 3, 4, C.body)

    // 癒몃━ + ??
    const headY = this.state === 'roar' || this.state === 'roar0' ? -4 : 0
    ctx.save()
    ctx.translate(0, headY)
    // ?꾨옒??(?뚯쟾)
    ctx.save()
    ctx.translate(44, 20)
    ctx.rotate(this.jaw * 0.5)
    R(0, 0, 32, 8, C.body)
    ctx.fillStyle = C.mouth
    ctx.fillRect(2, 0, 28, 2)
    ctx.fillStyle = C.tooth
    for (let i = 0; i < 6; i++) ctx.fillRect(6 + i * 4, -2, 2, 2)
    ctx.restore()
    // ?쀫㉧由?
    R(40, -2, 38, 22, C.body)
    R(40, 14, 8, 8, C.body)
    ctx.fillStyle = C.dark
    ctx.fillRect(42, -2, 30, 3)
    // 肄㏐뎄硫?
    ctx.fillStyle = C.line
    ctx.fillRect(73, 3, 2, 2)
    // ??
    ctx.fillStyle = C.line
    ctx.fillRect(56, 2, 8, 7)
    ctx.fillStyle = C.eye
    ctx.fillRect(57, 3, 6, 5)
    ctx.fillStyle = C.line
    ctx.fillRect(60, 4, 2, 3)
    ctx.fillStyle = C.dark
    ctx.fillRect(54, 0, 12, 2)
    // ?쀫땲
    ctx.fillStyle = C.tooth
    for (let i = 0; i < 7; i++) ctx.fillRect(48 + i * 4, 20, 2, 3)
    // ????遺덇퐙 (spit 以鍮?
    if ((this.state === 'spitPrep' || this.state === 'spit') && Math.floor(this.anim * 20) % 2) {
      ctx.fillStyle = '#ffb43a'
      ctx.fillRect(60, 22, 10, 4)
    }
    ctx.restore()
    ctx.restore()

    // 湲곗젅 蹂?
    if (this.state === 'stun') {
      ctx.fillStyle = '#ffe14a'
      for (let i = 0; i < 3; i++) {
        const a = this.anim * 6 + (i * Math.PI * 2) / 3
        const hx = (this.facing > 0 ? ox + this.w - 4 : ox + 4) + Math.cos(a) * 12
        ctx.fillRect(Math.round(hx), Math.round(oy - 8 + Math.sin(a) * 4), 3, 3)
      }
    }
  }
}


