import { ugaSwingFrame } from './art'
import type { Game } from './game'
import type { PlayerInput } from './input'
import { T, type ItemKind, type Level } from './level'
import type { EnemyCfg } from './stages'
import { CHARACTER_SCALE, CHARGE_TIME, GRAVITY, JUMP_VEL, MAX_FALL, RUN_SPEED, TILE, VIEW_W, approach, overlap, type Rect } from './constants'
import { drawSprite, drawSpriteRot, sprites, type PlayerSprites, type Sprite } from './sprites'
import { drawArt, frameAt, walkFrame, progressFrame, has, drawPaintedText } from './art'

// Both players use normalized key poses; hurt and ladder retain sheet2.

// ????????????????????????? 臾쇰━ ?????????????????????????
export interface Body extends Rect {
  vx: number
  vy: number
  onGround: boolean
  hitWall: number
}

export function moveBody(b: Body, lv: Level, dt: number, dropThrough = false): void {
  const startX = b.x
  b.hitWall = 0
  b.x += b.vx * dt
  const r0 = Math.floor(b.y / TILE)
  const r1 = Math.floor((b.y + b.h - 1) / TILE)
  if (b.vx > 0) {
    const c = Math.floor((b.x + b.w) / TILE)
    for (let r = r0; r <= r1; r++) {
      if (lv.isSolidTile(lv.tile(c, r))) {
        b.x = c * TILE - b.w - 0.01
        b.vx = 0
        b.hitWall = 1
        break
      }
    }
  } else if (b.vx < 0) {
    const c = Math.floor(b.x / TILE)
    for (let r = r0; r <= r1; r++) {
      if (lv.isSolidTile(lv.tile(c, r))) {
        b.x = (c + 1) * TILE + 0.01
        b.vx = 0
        b.hitWall = -1
        break
      }
    }
  }
  if ('walkDistance' in b) (b as Body & { walkDistance: number }).walkDistance += Math.abs(b.x - startX)
  const prevBottom = b.y + b.h
  b.y += b.vy * dt
  b.onGround = false
  const c0 = Math.floor(b.x / TILE)
  const c1 = Math.floor((b.x + b.w - 1) / TILE)
  if (b.vy >= 0) {
    const r = Math.floor((b.y + b.h) / TILE)
    for (let c = c0; c <= c1; c++) {
      const t = lv.tile(c, r)
      const oneWay = t === T.Platform || lv.isLadderTop(c, r)
      if (lv.isSolidTile(t) || (oneWay && !dropThrough && prevBottom <= r * TILE + 0.5)) {
        b.y = r * TILE - b.h
        b.vy = 0
        b.onGround = true
        break
      }
    }
  } else {
    const r = Math.floor(b.y / TILE)
    for (let c = c0; c <= c1; c++) {
      if (lv.isSolidTile(lv.tile(c, r))) {
        b.y = (r + 1) * TILE
        b.vy = 0
        break
      }
    }
  }
}

function groundAhead(lv: Level, b: Body, dir: number): boolean {
  const px = dir > 0 ? b.x + b.w + 2 : b.x - 2
  const c = Math.floor(px / TILE)
  const r = Math.floor((b.y + b.h + 2) / TILE)
  const t = lv.tile(c, r)
  return lv.isSolidTile(t) || t === T.Platform || lv.isLadderTop(c, r)
}

// ????????????????????????? ?뚰떚??/ ?앹뾽 / ?댄럺???????????????????????????
export class Particle {
  dead = false
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
    public color: string,
    public size = 2,
    public grav = 400,
  ) {}
  update(dt: number): void {
    this.vy += this.grav * dt
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.life -= dt
    if (this.life <= 0) this.dead = true
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.fillStyle = this.color
    ctx.fillRect(this.x - cx, this.y - cy, this.size, this.size)
  }
}

export class Popup {
  dead = false
  life = 0.9
  constructor(public x: number, public y: number, public text: string, public color = '#fff') {}
  update(dt: number): void {
    this.y -= 30 * dt
    this.life -= dt
    if (this.life <= 0) this.dead = true
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.font = 'bold 8px "Black Han Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1c0f08'

    ctx.fillStyle = this.color
    drawPaintedText(ctx, this.text, this.x - cx, this.y - cy, 8)
  }
}

/** ?댄럺??洹몃┝ (Codex fx ?쒗듃) ??踰??ъ깮 */
export class Fx {
  dead = false
  t = 0
  constructor(public key: string, public x: number, public y: number, public faceLeft: boolean, public life = 0.25, public scale = 1) {}
  update(dt: number): void {
    this.t += dt
    if (this.t >= this.life) this.dead = true
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.t / this.life
    drawArt(ctx, this.key, 0, this.x - cx, this.y - cy, this.faceLeft, { alpha: 1 - k * k, scale: this.scale * (0.9 + k * 0.25) })
  }
}

// ????????????????????????? ?뚮젅?댁뼱 ?????????????????????????
export type Weapon = 'axe' | 'bone' | 'fire'
export const WEAPON_NAME: Record<Weapon, string> = { axe: '나무몽둥이', bone: '\uBF08\uBABD\uB465\uC774', fire: '불몽둥이' }
const WEAPON_STAT: Record<Weapon, { reach: number; dmg: number; time: number }> = {
  axe: { reach: 20 * CHARACTER_SCALE, dmg: 1, time: 0.3 },
  bone: { reach: 27 * CHARACTER_SCALE, dmg: 2, time: 0.26 },
  fire: { reach: 22 * CHARACTER_SCALE, dmg: 3, time: 0.3 },
}

type SwingKind = 'swing' | 'up' | 'air' | 'smash' | 'throw'

export class Player implements Body {
  x = 0
  y = 0
  w = 18 * CHARACTER_SCALE
  h = 30 * CHARACTER_SCALE
  vx = 0
  vy = 0
  onGround = false
  hitWall = 0
  jumpAge = 1
  landingT = 0
  walkDistance = 0
  facing = 1
  maxHp = 10
  hp = 10
  lives = 3
  score = 0
  weapon: Weapon = 'axe'
  invuln = 0
  charge = 0
  chargeReady = false
  celebrating = false
  dead = false
  out = false
  respawnT = 0
  spawnFireT = 0
  anim = 0
  dropT = 0
  deathRot = 0
  climbing = false
  swingT = 0
  swingDur = 0
  swingKind: SwingKind = 'swing'
  private swingHit = new Set<object>()
  private jumpBufferT = 0
  private groundGraceT = 0
  private knockbackT = 0
  private smashDone = false
  spr: PlayerSprites

  constructor(public idx: number, public name: string, public color: string) {
    this.spr = idx === 0 ? sprites().p1 : sprites().p2
  }

  get alive(): boolean {
    return !this.dead && !this.out
  }
  get cx(): number {
    return this.x + this.w / 2
  }
  get key(): string {
    return this.idx === 0 ? 'p1' : 'p2'
  }

  private safeX = 40
  private safeY = 146
  checkpoint():void {this.safeX=this.x;this.safeY=this.y;this.jumpBufferT=0;this.groundGraceT=0}
  spawnAt(g: Game, keepWeapon = false): void {
    const lv = g.level
    const desiredX = this.dead ? this.safeX : 40 + this.idx * 24
    const desiredY = this.dead ? this.safeY : lv.height - TILE * 3 - this.h
    let best = Infinity, px = desiredX, py = desiredY
    for (let c = 1; c < lv.cols - 1; c++) for (let r = 3; r < lv.rows; r++) {
      const support = lv.tile(c,r)
      if (!lv.isSolidTile(support) && support !== T.Platform && !lv.isLadderTop(c,r)) continue
      const x = c*TILE + (TILE-this.w)/2, y = r*TILE-this.h
      const body = {x,y,w:this.w,h:this.h}
      if ([x+.5,x+this.w/2,x+this.w-.5].some(sx=>lv.solidAt(sx,y+.5)||lv.solidAt(sx,r*TILE-1))) continue
      if (lv.waterAt(x+this.w/2,r*TILE-1)) continue
      const danger = g.enemies.some(e=>!e.dead && e.invulnerable && overlap(body,{x:e.x-3,y:e.y-3,w:e.w+6,h:e.h+3}))
      if(danger || (g.boss && overlap(body,g.boss.hitbox))) continue
      const score = Math.abs(x-desiredX)+Math.abs(y-desiredY)*2
      if(score<best) { best=score;px=x;py=y }
    }
    this.x=px;this.y=py;this.safeX=px;this.safeY=py
    this.vx=0;this.vy=0;this.onGround=true
    this.knockbackT=0;this.jumpBufferT=0;this.groundGraceT=0
    this.hp=this.maxHp;this.dead=false;this.invuln=1.5;this.spawnFireT=1.5
    if(!keepWeapon) this.weapon='axe'
    this.charge=0;this.chargeReady=false;this.climbing=false;this.swingT=0;this.celebrating=false
  }

  update(g: Game, dt: number, inp: PlayerInput): void {
    this.spawnFireT = Math.max(0, this.spawnFireT - dt)
    this.anim += dt
    this.jumpAge += dt
    this.landingT = Math.max(0, this.landingT - dt)
    if (this.out) return
    if (this.dead) {
      this.vy += GRAVITY * dt
      this.vx=approach(this.vx,0,110*dt)
      moveBody(this,g.level,dt)
      this.deathRot += dt * 10
      this.respawnT -= dt
      if (this.respawnT <= 0) {
        if (this.lives > 0) this.spawnAt(g,g.mode==='boss')
        else this.out = true
      }
      return
    }
    const lv = g.level
    this.invuln -= dt
    this.jumpBufferT = inp.jumpPressed ? 0.10 : Math.max(0, this.jumpBufferT - dt)
    this.groundGraceT = this.onGround ? 0.065 : Math.max(0, this.groundGraceT - dt)

    // ?? ?щ떎由???
    const col = Math.floor(this.cx / TILE)
    const rowMid = Math.floor((this.y + this.h / 2) / TILE)
    const rowLow = Math.floor((this.y + this.h - 2) / TILE)
    const rowFeet = Math.floor((this.y + this.h + 1) / TILE)
    const touchingLadder = lv.isLadder(col, rowMid) || lv.isLadder(col, rowLow)
    const onLadderTop = this.onGround && lv.isLadderTop(col, rowFeet)
    if (!this.climbing && this.swingT <= 0) {
      if ((inp.up && touchingLadder) || (inp.downPressed && onLadderTop)) {
        this.climbing = true
        let left=col,right=col
        const ladderRow=onLadderTop?rowFeet:lv.isLadder(col,rowMid)?rowMid:rowLow
        while(lv.isLadder(left-1,ladderRow)) left--
        while(lv.isLadder(right+1,ladderRow)) right++
        this.x = (left+right+1)*TILE/2-this.w/2
        this.vx = 0
        this.vy = 0
        if (onLadderTop) this.y += 3
      }
    }
    if (this.climbing) {
      this.jumpBufferT = 0
      this.groundGraceT = 0
      this.updateClimb(g, dt, inp, col)
      this.clampToCamera(g)
      return
    }

    // ?? ?대룞 ??
    let target = 0
    if (inp.left) target -= RUN_SPEED
    if (inp.right) target += RUN_SPEED
    if (target !== 0) this.facing = Math.sign(target)
    if (this.swingT > 0 && this.onGround) target *= 0.35
    const icy = lv.def.icy && this.onGround
    const accel = this.onGround ? (icy ? 260 : target === 0 ? 2200 : 1800) : 850
    this.knockbackT = Math.max(0, this.knockbackT - dt)
    if (this.knockbackT <= 0) this.vx = approach(this.vx, target, accel * dt)

    // 諛쒗뙋 ?대젮媛湲?/ ?먰봽
    if (inp.downPressed && this.onGround && this.onPlatform(lv)) {
      this.dropT = 0.22
      this.y += 1
    } else if (this.jumpBufferT > 0 && this.groundGraceT > 0 && this.knockbackT <= 0) {
      this.jumpBufferT = 0
      this.groundGraceT = 0
      this.onGround = false
      this.jumpAge = 0
      this.vy = -JUMP_VEL
      g.sfx.jump()
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)
    this.dropT -= dt
    const wasGrounded = this.onGround
    moveBody(this, lv, dt, this.dropT > 0)
    if (!wasGrounded && this.onGround) this.landingT = .14
    if (this.onGround && !g.enemies.some(e=>e.invulnerable && overlap(this,e))) { this.safeX=this.x; this.safeY=this.y }
    this.clampToCamera(g)

    // ?? 怨듦꺽: ?먯뿉 ???뚮룄?쇰줈 ?뚮━湲???
    if(inp.throwPressed&&this.swingT<=0&&!g.projectiles.some(p=>p.kind==='club'&&p.owner===this&&!p.dead))this.startSwing(g,'throw')
    if (inp.attackPressed && this.swingT <= 0) {
      this.charge = 0
      this.chargeReady = false
      this.startSwing(g, inp.up ? 'up' : !this.onGround && inp.down ? 'air' : 'swing')
    }
    if (inp.attack) {
      this.charge += dt
      if (!this.chargeReady && this.charge > CHARGE_TIME) {
        this.chargeReady = true
        g.sfx.charge()
      }
    }
    if (inp.attackReleased) {
      if (this.chargeReady && this.swingT <= 0.05) this.startSwing(g, 'smash')
      this.charge = 0
      this.chargeReady = false
    }
    this.updateSwing(g, dt)

    if (lv.waterAt(this.cx, this.y + this.h - 3)) {
      g.splash(this.cx, this.y + this.h)
      this.die(g)
    }
    if (this.y > lv.height + 24) this.die(g)
  }

  private updateClimb(g: Game, dt: number, inp: PlayerInput, col: number): void {
    const lv = g.level
    // Step onto an adjacent landing instead of falling through the shaft.
    if ((inp.left || inp.right) && !inp.up && !inp.down) {
      const dir=inp.left?-1:1,row=Math.round((this.y+this.h)/TILE)
      if(Math.abs(row*TILE-this.y-this.h)<7)for(let step=1;step<=3;step++) {
        const c=col+dir*step,t=lv.tile(c,row)
        if(!lv.isSolidTile(t)&&t!==T.Platform)continue
        const nx=dir>0?c*TILE-this.w+2:(c+1)*TILE-2,ny=row*TILE-this.h
        if([nx+.5,nx+this.w-.5].some(x=>lv.solidAt(x,ny+.5)||lv.solidAt(x,row*TILE-1)))break
        this.x=nx;this.y=ny;this.onGround=true;break
      }
      this.climbing=false;this.facing=dir;this.vx=dir*RUN_SPEED*.6;this.vy=0
      return
    }
    this.vx = 0
    this.vy = inp.up ? -86 * CHARACTER_SCALE : inp.down ? 86 * CHARACTER_SCALE : 0
    const prevY = this.y
    moveBody(this, lv, dt, true)
    this.walkDistance += Math.abs(this.y - prevY)
    // ?놁쑝濡??꾨Ⅴ硫??щ떎由ъ뿉???대┝
    if ((inp.left || inp.right) && !inp.up && !inp.down) {
      this.climbing = false
      this.facing = inp.left ? -1 : 1
      return
    }
    const feetRow = Math.floor((this.y + this.h - 1) / TILE)
    const midRow = Math.floor((this.y + this.h / 2) / TILE)
    if (!lv.isLadder(col, feetRow) && !lv.isLadder(col, midRow)) {
      if (this.y < prevY || inp.up) {
        // 瑗??湲??꾩갑: ?щ떎由?瑗??湲??꾩뿉 ?몄?
        let r = feetRow + 1
        while (r < lv.rows && !lv.isLadderTop(col, r)) r++
        this.y = r * TILE - this.h
        this.onGround = true
      }
      this.climbing = false
      return
    }
    if (this.onGround && inp.down) this.climbing = false
  }

  private clampToCamera(g: Game): void {
    const lo=g.mode==='boss'?g.camX:0
    const hi=g.mode==='boss'?g.camX+VIEW_W-this.w:g.level.width-this.w
    if(this.x<lo) {this.x=lo;if(this.vx<0)this.vx=0}
    if(this.x>hi) {this.x=hi;if(this.vx>0)this.vx=0}
  }

  private onPlatform(lv: Level): boolean {
    const r = Math.floor((this.y + this.h + 1) / TILE)
    const c0 = Math.floor(this.x / TILE)
    const c1 = Math.floor((this.x + this.w - 1) / TILE)
    for (let c = c0; c <= c1; c++) {
      if (lv.tile(c, r) !== T.Platform) return false
    }
    return true
  }

  private startSwing(g: Game, kind: SwingKind): void {
    const st = WEAPON_STAT[this.weapon]
    this.swingKind = kind
    this.swingDur = kind === 'smash' ? 0.5 : kind==='throw'?.4:st.time
    this.swingT = this.swingDur
    this.swingHit.clear()
    this.smashDone = false
    if (kind === 'air') this.vy = Math.max(this.vy, 120)
    g.sfx.throw()
  }

  /** 吏湲?怨듦꺽 ?먯젙 ?ш컖??(?놁쑝硫?null) */
  hitbox(): Rect | null {
    if (this.swingT <= 0 || this.swingKind==='throw') return null
    const p = this.swingDur - this.swingT
    const st = WEAPON_STAT[this.weapon]
    if (this.swingKind === 'smash') {
      if (ugaSwingFrame(p, this.swingDur) !== 2) return null
      return { x: this.cx - 34, y: this.y - 6, w: 68, h: this.h + 10 }
    }
    if (ugaSwingFrame(p, this.swingDur) !== 2) return null
    switch (this.swingKind) {
      case 'up':
        return { x: this.cx - 14, y: this.y - 24, w: 28, h: 28 }
      case 'air':
        return { x: this.cx - 13, y: this.y + this.h - 6, w: 26, h: 20 }
      default:
        return this.facing > 0
          ? { x: this.cx + 2, y: this.y - 4, w: st.reach, h: this.h + 6 }
          : { x: this.cx - 2 - st.reach, y: this.y - 4, w: st.reach, h: this.h + 6 }
    }
  }

  private updateSwing(g: Game, dt: number): void {
    if (this.swingT <= 0) return
    const p = this.swingDur - this.swingT
    this.swingT -= dt
    if(this.swingKind==='throw'&&p>=this.swingDur*.5&&!this.smashDone){
      this.smashDone=true;g.projectiles.push(new Projectile('club',this.cx+this.facing*12*CHARACTER_SCALE,this.y+12*CHARACTER_SCALE,this.facing*220,-45,this))
    }
    const hb = this.hitbox()
    if (this.swingKind === 'smash' && p >= 0.2 && !this.smashDone) {
      this.smashDone = true
      const gy = this.y + this.h
      g.shake(0.3, 3)
      g.sfx.big()
      g.projectiles.push(new Projectile('shock', this.cx - 6, gy - 6, -170, 0, this))
      g.projectiles.push(new Projectile('shock', this.cx + 6, gy - 6, 170, 0, this))
      g.fx('fx.shock', this.cx, gy + 2, false, 0.4, 1.2)
      g.burst(this.cx, gy, '#c9a77a', 14)
    }
    if (!hb) return
    if (this.swingHit.size === 0 && p < 0.07 + dt * 1.5 && this.swingKind !== 'smash') {
      const fxKey = this.weapon === 'fire' ? 'fx.slashFire' : this.swingKind === 'up' ? 'fx.slashUp' : 'fx.slash'
      g.fx(fxKey, hb.x + hb.w / 2, hb.y + hb.h, this.facing < 0, 0.18)
    }
    const dmg = this.swingKind === 'smash' ? 3 : WEAPON_STAT[this.weapon].dmg
    for (const e of g.enemies) {
      if (e.dying || e.invulnerable || this.swingHit.has(e)) continue
      if (overlap(hb, e)) {
        this.swingHit.add(e)
        e.hit(g, dmg, this.cx, this)
        g.fx('fx.hit', e.cx, e.y + e.h * 0.7, false, 0.2)
        if (this.weapon === 'fire') g.burst(e.cx, e.y + e.h / 2, '#ff7a1a', 6)
        if (this.swingKind === 'air') this.vy = -220
      }
    }
    const b = g.boss
    if (b && !b.dying && !this.swingHit.has(b) && overlap(hb, b.hitbox)) {
      this.swingHit.add(b)
      b.hit(g, dmg, this)
      g.fx('fx.hit', hb.x + hb.w / 2, hb.y + hb.h / 2, false, 0.2)
      if (this.swingKind === 'air') this.vy = -240
    }
    // ?좎븘?ㅻ뒗 ?묒? ?ъ궗泥대뒗 爾먯꽌 留됱쓬
    for (const pr of g.projectiles) {
      if (!pr.hostile || pr.dead || pr.delay > 0 || pr.big) continue
      if (overlap(hb, pr)) {
        pr.pop(g, '#ffffff')
        g.popup(pr.cx, pr.cy - 6, '??', '#ffffff')
      }
    }
  }

  hurt(g: Game, dmg: number, fromX: number): void {
    if (!this.alive || this.invuln > 0) return
    this.hp -= dmg
    const bossContact = g.boss && fromX === g.boss.cx && overlap(this, g.boss.hitbox)
    this.invuln = 0.8
    this.knockbackT = 0.16
    this.climbing = false
    this.vx = (this.cx < fromX ? -1 : 1) * 70
    if (bossContact && g.boss) {
      const b = g.boss.hitbox
      const left = b.x - this.w - 2
      const right = b.x + b.w + 2
      const goLeft = left >= g.camX && (this.cx < fromX || right > g.camX + VIEW_W - this.w)
      this.x = goLeft ? left : right
      this.clampToCamera(g)
      this.vx = (goLeft ? -1 : 1) * 160
    }
    this.vy = -100
    g.sfx.hurt()
    g.burst(this.cx, this.y + 8, '#ffffff', 6)
    if (this.hp <= 0) this.die(g)
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n)
  }

  die(g: Game): void {
    if (this.dead) return
    this.dead = true
    this.hp = 0
    this.lives--
    this.vy = -110
    this.vx = -this.facing * 24
    this.respawnT = 2.2
    this.deathRot = 0
    this.climbing = false
    this.swingT = 0
    g.sfx.hurt()
  }

  // ?? 洹몃━湲???
  private paintedAction = ''
  private paintedStart = 0
  private poseFrame(key: string, loop = true): number {
    if (this.paintedAction !== key) { this.paintedAction = key; this.paintedStart = this.anim }
    return frameAt(key, this.anim - this.paintedStart, loop)
  }

  private paintedKey(): { key: string; frame: number; o: { sy?: number; sx?: number; tilt?: number } } {
    const k = this.key
    const pick = (...keys: string[]) => keys.find((x) => has(x)) ?? `${k}.idle`
    if(this.celebrating&&this.onGround&&Math.abs(this.vx)<1){const key=pick(`${k}.win`);return {key,frame:this.poseFrame(key),o:{}}}
    if (this.climbing) {
      const key = Math.abs(this.vy)>1?pick(`${k}.climb`):pick(`${k}.climbIdle`,`${k}.climb`)
      return {key,frame:Math.abs(this.vy)>1?walkFrame(key,this.walkDistance):this.poseFrame(key),o:{}}
    }
    if(this.knockbackT>0){const key=pick(`${k}.hurt`);return {key,frame:this.poseFrame(key,false),o:{}}}
    if(this.swingT>0){
      const action=this.swingKind==='throw'?'throw':this.swingKind==='up'?'attackUp':this.swingKind==='air'||this.swingKind==='smash'?'attackDown':'attack'
      const key=pick(`${k}.${action}`,`${k}.attack`)
      return {key,frame:progressFrame(key,(this.swingDur-this.swingT)/this.swingDur),o:{}}
    }
    if(!this.onGround){
      const key=pick(`${k}.${this.vy<0?'jump':'fall'}`,`${k}.jump`)
      return {key,frame:this.vy<0?progressFrame(key,1-Math.max(0,-this.vy)/JUMP_VEL):progressFrame(key,Math.min(1,this.vy/JUMP_VEL)),o:{}}
    }
    if(this.landingT>0){const key=pick(`${k}.land`,`${k}.idle`);return{key,frame:progressFrame(key,1-this.landingT/.14),o:{}}}
    if(Math.abs(this.vx)>10){const key=pick(`${k}.walk`,`${k}.run`);return{key,frame:walkFrame(key,this.walkDistance),o:{}}}
    if(this.spawnFireT>1.05){const key=pick(`${k}.respawn`,`${k}.idle`);return{key,frame:progressFrame(key,(1.5-this.spawnFireT)/.45),o:{}}}
    if(this.charge>.3){const key=pick(`${k}.charge`,`${k}.idle`);return{key,frame:this.poseFrame(key),o:{}}}

    const idleKey = this.weapon === 'bone' && has(`${k}.boneIdle`) ? `${k}.boneIdle` : `${k}.idle`
    return { key: idleKey, frame: this.poseFrame(idleKey), o: {} }
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.out) return
    const left = this.facing < 0
    const bx = this.cx - cx
    // Sprite soles and painted terrain share the same collision surface.
    const by = this.y + this.h - cy
    if (this.onGround && !this.climbing && !this.dead) {
      ctx.save()
      ctx.fillStyle = 'rgba(31,24,13,.24)'
      ctx.beginPath(); ctx.ellipse(bx, by + 1, this.w * .6, 2.1, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    if (has(`${this.key}.idle`)) {
      if (this.dead) {
        const key = has(`${this.key}.dead`) ? `${this.key}.dead` : `${this.key}.hurt`
        drawArt(ctx, key, this.poseFrame(key,false), bx, by, left, { rot: has(`${this.key}.dead`) ? 0 : this.deathRot })
        return
      }
      if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return
      const { key, frame, o } = this.paintedKey()
      const flash = this.chargeReady && Math.floor(this.anim * 16) % 2 === 0
      const sx = (o.sx ?? 1) * (o.sy ? 2 - o.sy : 1)
      drawArt(ctx, key, frame, bx, by, left, { sy: o.sy, tilt: o.tilt, sx, white: flash, glow: this.chargeReady ? '#ffd23a' : undefined })
      this.drawOverlay(ctx, bx, by, 40)
      return
    }
    // ?? ?꾪듃 洹몃┝ (?쇰윭?ㅽ듃 ?놁쓣 ?? ??
    const s = this.spr
    if (this.dead) {
      drawSpriteRot(ctx, s.jump, bx, by - 10, this.deathRot, left)
      return
    }
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return
    let f: Sprite
    if (this.swingT > 0) f = this.swingKind === 'up' ? s.throwUp : s.throw
    else if (!this.onGround || this.climbing) f = s.jump
    else if (Math.abs(this.vx) > 10) f = Math.floor(this.anim * 4) % 2 ? s.run1 : s.run2
    else f = s.idle
    drawSprite(ctx, f, bx, by, left, this.chargeReady && Math.floor(this.anim * 16) % 2 === 0)
    this.drawOverlay(ctx, bx, by, 27)
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, bx: number, by: number, hgt: number): void {
    if (this.dead) return
    const top = by - hgt
    if (this.charge > 0.15 && !this.chargeReady) {
      const k = Math.min(1, this.charge / CHARGE_TIME)
      ctx.fillStyle = '#1c0f08'
      ctx.fillRect(bx - 8, top, 16, 3)
      ctx.fillStyle = '#ffd23a'
      ctx.fillRect(bx - 7, top + 1, 14 * k, 1)
    }
    ctx.fillStyle = this.color
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
  }
}

// ????????????????????????? ?ъ궗泥??????????????????????????
export type ProjKind = 'club' | 'shock' | 'rock' | 'fireball' | 'lavarock' | 'lavablob' | 'spear' | 'iceball' | 'icicle' | 'stalactite'

const PROJ: Record<ProjKind, { size: number; dmg: number; life: number; pierce: boolean; big: boolean; art: string[] }> = {
  club: { size: 9, dmg: 1, life: .85, pierce: false, big: false, art: ['v2.log'] },
  shock: { size: 12, dmg: 2, life: 0.9, pierce: true, big: true, art: ['fx.shock'] },
  rock: { size: 12, dmg: 2, life: 4, pierce: false, big: true, art: ['proj.rock'] },
  fireball: { size: 10, dmg: 2, life: 3, pierce: false, big: true, art: ['proj.fireball'] },
  lavarock: { size: 9, dmg: 1, life: 3, pierce: false, big: false, art: ['proj2.lavarock', 'proj.rock'] },
  lavablob: { size: 14, dmg: 2, life: 4, pierce: false, big: true, art: ['proj2.lava', 'proj.fireball'] },
  spear: { size: 9, dmg: 1, life: 3, pierce: false, big: false, art: ['proj3.spear'] },
  iceball: { size: 11, dmg: 2, life: 3.5, pierce: false, big: true, art: ['proj3.ice', 'proj.fireball'] },
  icicle: { size: 10, dmg: 2, life: 4, pierce: false, big: true, art: ['proj3.icicle', 'proj.rock'] },
  stalactite: { size: 10, dmg: 2, life: 4, pierce: false, big: true, art: ['cave.stalactite', 'proj.rock'] },
}

export class Projectile implements Body {
  x: number
  y: number
  w: number
  h: number
  onGround = false
  hitWall = 0
  dead = false
  rot = 0
  life: number
  dmg: number
  hostile: boolean
  pierce: boolean
  big: boolean
  delay = 0
  /** ?숉븯臾?寃쎄퀬??諛붾떏 y */
  warnY = 0
  hitSet = new Set<object>()
  private startDir: number

  constructor(
    public kind: ProjKind,
    x: number,
    y: number,
    public vx: number,
    public vy: number,
    public owner: Player | null = null,
  ) {
    const c = PROJ[kind]
    this.hostile = owner === null
    this.startDir = Math.sign(vx) || 1
    this.w = c.size
    this.h = c.size
    this.dmg = c.dmg
    this.life = c.life
    this.pierce = c.pierce
    this.big = c.big
    this.x = x - c.size / 2
    this.y = y - c.size / 2
  }

  get cx(): number {
    return this.x + this.w / 2
  }
  get cy(): number {
    return this.y + this.h / 2
  }

  update(g: Game, dt: number): void {
    if (this.delay > 0) {
      this.delay -= dt
      return
    }
    this.life -= dt
    if (this.life <= 0) this.dead = true
    const lv = g.level
    switch (this.kind) {
      case 'shock': {
        this.x += this.vx * dt
        const ahead = this.vx > 0 ? this.x + this.w + 1 : this.x - 1
        if (lv.solidAt(ahead, this.cy) || !lv.solidAt(this.cx, this.y + this.h + 4)) this.dead = true
        if (Math.random() < 0.6) g.particles.push(new Particle(this.cx, this.y + this.h, (Math.random() - 0.5) * 40, -120, 0.35, '#c9a77a', 3))
        break
      }
      case 'rock':
      case 'icicle':
      case 'stalactite':
        this.vy = Math.min(this.vy + 500 * dt, 400)
        this.y += this.vy * dt
        if (this.kind === 'rock') this.rot += dt * 4
        if (lv.solidAt(this.cx, this.y + this.h) || this.y > lv.height) {
          this.pop(g, this.kind === 'icicle' ? '#cfefff' : '#8c8577')
          g.shake(0.08, 1.5)
        }
        break
      case 'fireball':
      case 'iceball':
        this.x += this.vx * dt
        this.y += this.vy * dt
        this.vy += 60 * dt
        if (Math.random() < 0.8) {
          const col = this.kind === 'iceball' ? (Math.random() < 0.5 ? '#e8f8ff' : '#8fd6ff') : Math.random() < 0.5 ? '#ffd23a' : '#ff3a1a'
          g.particles.push(new Particle(this.cx, this.cy, 0, -10, 0.3, col, 3, -40))
        }
        if (lv.solidAt(this.cx, this.cy)) this.pop(g, '#ff7a1a')
        break
      case 'lavarock':
      case 'lavablob':
        this.vy += (this.kind === 'lavablob' ? 420 : 520) * dt
        this.x += this.vx * dt
        this.y += this.vy * dt
        this.rot += dt * 8 * this.startDir
        if (Math.random() < 0.5) g.particles.push(new Particle(this.cx, this.cy, 0, -10, 0.25, '#ff7a1a', 2, -30))
        if (lv.solidAt(this.cx, this.cy)) this.pop(g, '#ff5a1a')
        break
      case 'club':
        this.vy+=180*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;this.rot+=dt*14*this.startDir
        if(lv.solidAt(this.cx,this.cy))this.pop(g,'#a47a49')
        break
      case 'spear':
        this.vy += 260 * dt
        this.x += this.vx * dt
        this.y += this.vy * dt
        this.rot = Math.atan2(this.vy, this.vx)
        if (lv.solidAt(this.cx, this.cy)) this.pop(g, '#e8e0c8')
        break
    }
    if (this.x < g.camX - 40 || this.x > g.camX + VIEW_W + 40) this.dead = true
  }

  pop(g: Game, color: string): void {
    this.dead = true
    g.burst(this.cx, this.cy, color, 6)
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.delay > 0) {
      const k = 1 - Math.min(1, this.delay / 1.2)
      ctx.fillStyle = `rgba(0,0,0,${(0.25 + k * 0.3).toFixed(2)})`
      ctx.beginPath()
      ctx.ellipse(this.cx - cx, this.warnY - cy, 4 + k * 5, 2, 0, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    const key = PROJ[this.kind].art.find((a) => has(a))
    if (key) {
      ctx.save()
      ctx.translate(this.cx - cx, this.cy - cy)
      if (this.kind === 'fireball' || this.kind === 'iceball') ctx.rotate(Math.atan2(this.vy, this.vx) + (this.vx < 0 ? Math.PI : 0))
      else if (this.kind !== 'shock') ctx.rotate(this.rot)
      if (this.kind === 'iceball' && key === 'proj.fireball') ctx.filter = 'hue-rotate(180deg) saturate(0.6) brightness(1.4)'
      drawArt(ctx, key, 0, 0, this.h * 0.6, this.vx < 0 && this.kind !== 'spear')
      ctx.restore()
      return
    }
    ctx.fillStyle = this.hostile ? '#ff6a3a' : '#c9a77a'
    ctx.beginPath()
    ctx.arc(this.cx - cx, this.cy - cy, this.w / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ????????????????????????? ?꾩씠???????????????????????????
export class Item implements Body {
  w = 12
  h = 10
  vx = 0
  vy = -120
  onGround = false
  hitWall = 0
  dead = false
  t = 0
  constructor(public kind: ItemKind | 'empty', public x: number, public y: number, public timed = false, public stageN = '') {
    if (!timed) this.vy = 0
  }
  update(g: Game, dt: number): void {
    this.t += dt
    if (!this.timed) this.y = g.level.floorBelow(this.x + this.w / 2, this.y) - this.h
    if (this.timed) {
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)
      moveBody(this, g.level, dt)
      if (this.t > 9) this.dead = true
    }
    if (this.y > g.level.height + 20) this.dead = true
  }
  artKey(): string | null {
    const n = this.stageN
    const cands: Record<string, string[]> = {
      meat: [`item${n}.meat`, 'item.meat'],
      fruit: [`item${n}.fruit`, 'item.fruit'],
      bigmeat: ['cave.treasure', 'item.bigmeat'],
      bone: ['item.bone'],
      fire: ['item.fire'],
      clock: ['cave.clock'],
      empty: ['cave.empty'],
    }
    return (cands[this.kind] ?? []).find((k) => has(k)) ?? null
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.timed && this.t > 6.5 && Math.floor(this.t * 10) % 2) return
    const bob = 0
    const key = this.artKey()
    const glow = this.kind === 'empty' ? undefined : this.kind === 'clock' ? '#9ff0ff' : '#fff6b0'
    if (key && drawArt(ctx, key, 0, this.x + this.w / 2 - cx, this.y + this.h - cy + bob, false, { glow })) {
      if (this.kind === 'clock') {
        const x = this.x + this.w / 2 - cx
        const y = this.y + this.h - cy + bob - 7
        ctx.save()
        ctx.strokeStyle = '#fff4dc'
        ctx.lineWidth = 1.2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x, y - 3)
        ctx.lineTo(x, y)
        ctx.lineTo(x + 2.5, y + 1)
        ctx.stroke()
        ctx.restore()
      }
      return
    }
    const b = sprites()
    const s: Partial<Record<string, Sprite>> = { meat: b.meat, bigmeat: b.bigmeat, fruit: b.fruit, bone: b.bone, fire: b.torch }
    const sp = s[this.kind]
    if (sp) drawSprite(ctx, sp, this.x + this.w / 2 - cx, this.y + this.h - cy + bob, false)
    else {
      ctx.fillStyle = this.kind === 'clock' ? '#9ff0ff' : '#8c8577'
      ctx.beginPath()
      ctx.arc(this.x + this.w / 2 - cx, this.y + this.h / 2 - cy + bob, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ????????????????????????? ???????????????????????????
export abstract class Enemy implements Body {
  vx = 0
  vy = 0
  onGround = false
  hitWall = 0
  walkDistance = 0
  facing = -1
  flash = 0
  dying = false
  dead = false
  rot = 0
  anim = 0
  w: number
  h: number
  hp: number
  score: number
  contactDmg = 1
  invulnerable = false

  constructor(public cfg: EnemyCfg, public x: number, public y: number) {
    const scale = cfg.key === 'fire' || cfg.key === 'prop.rock' ? 1 : CHARACTER_SCALE
    this.w = cfg.w * 1.5 * scale
    this.h = cfg.h * 1.5 * scale
    this.x += cfg.w * 1.5 * (1 - scale) / 2
    this.cfg = { ...cfg, speed: cfg.speed * scale }
    this.y -= this.h - cfg.h
    this.hp = cfg.hp
    this.score = cfg.score
  }

  get cx(): number {
    return this.x + this.w / 2
  }

  stunT = 0

  advanceStatus(realDt: number): void {
    if (this.stunT <= 0) return
    this.stunT = Math.max(0, this.stunT - realDt)
    if (this.stunT === 0) {
      this.hp = this.cfg.hp
    }
  }

  hit(g: Game, dmg: number, fromX: number, _by: Player | null): void {
    if(this.dead || this.dying || this.invulnerable || this.stunT>0 || this.flash>0) return
    this.flash=.14;this.hp-=dmg
    this.vx=(this.cx>=fromX?1:-1)*34
    g.sfx.hit();g.burst(this.cx,this.y+this.h/2,'#fff2be',4)
    if(this.hp<=0) {this.stunT=5;this.vx=0;this.vy=0}
  }

  collect(g: Game, by: Player): void {
    if(this.dead || this.stunT<=0) return
    this.dead=true;this.dying=true
    by.score+=this.score
    g.food=Math.min(g.foodMax,g.food+(this.cfg.hp>=4?20:10))
    g.popup(this.cx,this.y-4,String(this.score),'#ffe4a1')
    g.sfx.pickup();g.fx('fx.ko',this.cx,this.y+this.h,false,.25)
  }

  drawStars(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.stunT <= 0 || this.dead) return
    ctx.save()
    ctx.fillStyle = '#ffe45c'
    ctx.strokeStyle = '#8b531d'
    ctx.lineWidth = 0.7
    for (let i = 0; i < 3; i++) {
      const angle = this.anim * 5 + i * Math.PI * 2 / 3
      const x = this.cx - cx + Math.cos(angle) * 13
      const y = this.y - cy - 9 + Math.sin(angle) * 4
      ctx.beginPath()
      for (let j = 0; j < 10; j++) {
        const a = j * Math.PI / 5 - Math.PI / 2
        const r = j % 2 ? 1.8 : 4
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r
        if (j === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  protected updateDying(g: Game, dt: number): boolean {
    this.anim += dt
    this.flash -= dt
    if (this.dead) return true
    if (!this.dying && (this.stunT > 0 || this.flash > 0)) {
      this.vx = approach(this.vx, 0, 240 * dt)
      if (this.cfg.cls === 'flyer' || this.cfg.key === 'spider') this.x += this.vx * dt
      else this.fall(g, dt)
      return true
    }
    if (!this.dying) return false
    this.vy += GRAVITY * dt
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.rot += dt * 12 * Math.sign(this.vx || 1)
    if (this.y > g.level.height + 40) this.dead = true
    return true
  }

  protected fall(g: Game, dt: number): void {
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)
    moveBody(this, g.level, dt)
    if (g.level.waterAt(this.cx, this.y + this.h - 2)) {
      g.splash(this.cx, this.y + this.h)
      this.dead = true
    }
    if (this.y > g.level.height + 20) this.dead = true
  }

  /** ?쇰윭?ㅽ듃 洹몃━湲?(?덉쑝硫?true). 二쎈뒗 以묒씠硫??뚯쟾?섎ŉ ?좎븘媛?*/
  private paintedAction = ''
  private paintedStart = 0
  protected paint(ctx: CanvasRenderingContext2D, key: string, frame: number, cx: number, cy: number, faceLeft: boolean, _extra: { sy?: number; tilt?: number } = {}): boolean {
    if (/\.(walk|run)$/.test(key) && Math.abs(this.vx) < 1) key = `${this.cfg.key}.idle`
    if(this.dying)key=`${this.cfg.key}.collapse`
    else if(this.stunT>4.5)key=`${this.cfg.key}.collapse`
    else if(this.stunT>0&&this.stunT<.4)key=`${this.cfg.key}.recover`
    else if(this.stunT>0)key=`${this.cfg.key}.stun`
    else if(this.flash>0)key=`${this.cfg.key}.hit`
    if (this.paintedAction !== key) { this.paintedAction = key; this.paintedStart = this.anim }
    frame = frameAt(key,this.anim-this.paintedStart,/\.(idle|walk|run|fly|stun|hang|charge)$/.test(key))
    if (!has(key)) {
      key = [`${this.cfg.key}.run`, `${this.cfg.key}.fly`, `${this.cfg.key}.walk`].find(has) ?? key
    }
    if (!has(key)) return false
    if (/\.(walk|run)$/.test(key)) { frame = /^dino[123]_2\./.test(key) ? frameAt(key, this.anim) : walkFrame(key, this.walkDistance); if (Math.abs(this.vx) > 1) faceLeft = this.vx < 0 }
    const white = this.flash > 0
    if (this.dying) {
      ctx.save()
      ctx.translate(this.cx - cx, this.y + this.h / 2 - cy)
      ctx.rotate(this.rot)
      drawArt(ctx, key, frame, 0, this.h / 2, faceLeft, { white })
      ctx.restore()
      return true
    }
    return drawArt(ctx, key, frame, this.cx - cx, this.y + this.h - cy, faceLeft, { white })
  }

  protected pixel(ctx: CanvasRenderingContext2D, s: Sprite, cx: number, cy: number, faceLeft: boolean): void {
    const white = this.flash > 0
    if (this.dying) drawSpriteRot(ctx, s, this.cx - cx, this.y + this.h / 2 - cy, this.rot, faceLeft, white)
    else drawSprite(ctx, s, this.cx - cx, this.y + this.h - cy, faceLeft, white)
  }

  protected alert(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.dying || Math.floor(this.anim * 12) % 2 === 0) return
    ctx.fillStyle = '#ff4a3a'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    drawPaintedText(ctx, 'ui.word_ting', this.cx - cx, this.y - cy - 12, 7)
  }

  abstract update(g: Game, dt: number): void
  abstract draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void
}

/** 紐쎈뫁?대줈 ?뚮━??洹쇱젒 ??*/
export class Melee extends Enemy {
  state: 'walk' | 'wind' | 'swing' | 'rest' = 'walk'
  t = 0

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    const p = g.nearestPlayer(this.cx)
    this.t -= dt
    switch (this.state) {
      case 'walk':
        if (p) {
          const dx = p.cx - this.cx
          if (Math.abs(dx) > 4) this.facing = Math.sign(dx)
          if (Math.abs(dx) < 30 && Math.abs(p.y - this.y) < 26) {
            this.state = 'wind'
            this.t = 0.45
          }
        }
        this.vx = approach(this.vx, this.facing * this.cfg.speed, 400 * dt)
        if (this.onGround && !groundAhead(g.level, this, this.facing)) this.vx = 0
        break
      case 'wind':
        this.vx = approach(this.vx, 0, 600 * dt)
        if (this.t <= 0) {
          this.state = 'swing'
          this.t = 0.25
          const hb: Rect = { x: this.facing > 0 ? this.x + this.w - 2 : this.x - 18, y: this.y - 4, w: 20, h: this.h + 4 }
          for (const pl of g.players) if (pl.alive && overlap(pl, hb)) pl.hurt(g, 2, this.cx)
          g.sfx.throw()
        }
        break
      case 'swing':
        this.vx = 0
        if (this.t <= 0) {
          this.state = 'rest'
          this.t = 0.6
        }
        break
      case 'rest':
        if (this.t <= 0) this.state = 'walk'
        break
    }
    this.fall(g, dt)
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.cfg.key
    const walking = this.state === 'walk' && Math.abs(this.vx) > 5
    const left = this.facing < 0
    const key = this.state === 'wind' ? `${k}.windup` : this.state === 'swing' ? `${k}.swing` : `${k}.walk`
    const sy = this.state === 'wind' ? 1.04 : this.state === 'swing' ? 0.95 : 1 + (walking ? Math.abs(Math.sin(this.anim * 9)) * 0.03 : 0)
    if (!this.paint(ctx, has(key) ? key : `${k}.walk`, walking ? Math.floor(this.anim * 6) % 2 : 0, cx, cy, left, { sy })) {
      const b = sprites()
      this.pixel(ctx, walking && Math.floor(this.anim * 6) % 2 ? b.raptor2 : b.raptor1, cx, cy, left)
    }
    if (this.state === 'wind') this.alert(ctx, cx, cy)
  }
}

/** ?뙿룹갹???섏?????*/
export class Thrower extends Enemy {
  state: 'walk' | 'wind' | 'throw' | 'rest' = 'walk'
  t = 1

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    const p = g.nearestPlayer(this.cx)
    this.t -= dt
    switch (this.state) {
      case 'walk': {
        if (p) {
          const dx = p.cx - this.cx
          if (Math.abs(dx) > 4) this.facing = Math.sign(dx)
          const near = Math.abs(dx) < 130 && Math.abs(p.y - this.y) < 50
          if (near && this.t <= 0) {
            this.state = 'wind'
            this.t = 0.55
          }
          const keep = Math.abs(dx) > 70 ? 1 : 0
          this.vx = approach(this.vx, this.facing * this.cfg.speed * keep, 400 * dt)
        } else this.vx = approach(this.vx, 0, 400 * dt)
        if (this.onGround && !groundAhead(g.level, this, this.facing)) this.vx = 0
        break
      }
      case 'wind':
        this.vx = approach(this.vx, 0, 600 * dt)
        if (this.t <= 0) {
          this.state = 'throw'
          this.t = 0.3
          if (p && this.cfg.proj) {
            const dx = p.cx - this.cx
            const spear = this.cfg.proj === 'spear'
            const tFly = spear ? 0.55 : 0.8
            const vx = Math.max(-190, Math.min(190, dx / tFly))
            const vy = (spear ? -70 : -230) + (p.y - this.y) / tFly
            g.projectiles.push(new Projectile(this.cfg.proj, this.cx + this.facing * 8, this.y + 4, vx, vy))
            g.sfx.throw()
          }
        }
        break
      case 'throw':
        if (this.t <= 0) {
          this.state = 'rest'
          this.t = 1.3
        }
        break
      case 'rest':
        this.vx = approach(this.vx, 0, 600 * dt)
        if (this.t <= 0) {
          this.state = 'walk'
          this.t = 0.6
        }
        break
    }
    this.fall(g, dt)
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.cfg.key
    const walking = this.state === 'walk' && Math.abs(this.vx) > 5
    const left = this.facing < 0
    const key = this.state === 'wind' ? `${k}.windup` : this.state === 'throw' ? `${k}.throw` : `${k}.walk`
    if (!this.paint(ctx, has(key) ? key : `${k}.walk`, walking ? Math.floor(this.anim * 6) % 2 : 0, cx, cy, left)) {
      const b = sprites()
      this.pixel(ctx, walking && Math.floor(this.anim * 6) % 2 ? b.raptor2 : b.raptor1, cx, cy, left)
    }
    if (this.state === 'wind') this.alert(ctx, cx, cy)
  }
}

/** 鍮좊Ⅴ寃??щ젮?쒕뒗 ??(?⑺꽣쨌?꾨쭏諭쨌寃移섑샇?묒씠) */
export class Runner extends Enemy {
  jumpCd = 0

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    const p = g.nearestPlayer(this.cx)
    if (p) {
      const dx = p.cx - this.cx
      if (Math.sign(dx) !== this.facing && Math.abs(dx) > 50) this.facing = Math.sign(dx)
    }
    this.vx = approach(this.vx, this.facing * this.cfg.speed, 300 * dt)
    this.jumpCd -= dt
    if (this.onGround && this.jumpCd <= 0) {
      const needJump = this.hitWall !== 0 || !groundAhead(g.level, this, this.facing)
      const playerAbove = p && Math.abs(p.cx - this.cx) < 60 && p.y < this.y - 10
      if (needJump || (playerAbove && Math.random() < 0.05)) {
        this.vy = -110
        this.jumpCd = 0.6
      }
    }
    this.fall(g, dt)
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.cfg.key
    const key = !this.onGround && has(`${k}.jump`) ? `${k}.jump` : `${k}.run`
    if (this.paint(ctx, key, frameAt(`${k}.run`, this.anim * 1.4), cx, cy, this.facing < 0)) return
    const b = sprites()
    this.pixel(ctx, this.onGround && Math.floor(this.anim * 12) % 2 ? b.raptor2 : b.raptor1, cx, cy, this.facing < 0)
  }
}

/** ?좎븘?ㅻ땲??湲됯컯?섑븯????*/
export class Flyer extends Enemy {
  baseY: number
  state: 'fly' | 'dive' | 'rise' = 'fly'
  t = 0

  constructor(cfg: EnemyCfg, x: number, y: number) {
    super(cfg, x, y)
    this.baseY = y
  }

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    this.t += dt
    const p = g.nearestPlayer(this.cx)
    switch (this.state) {
      case 'fly':
        this.vx = this.facing * this.cfg.speed
        this.vy = 0
        this.y = this.baseY + Math.sin(this.t * 3) * 8
        if (p && Math.abs(p.cx - this.cx) < 70 && p.y > this.y + 20 && this.t > 0.8) {
          const dx = p.cx - this.cx
          const dy = p.y - this.y
          const d = Math.hypot(dx, dy) || 1
          this.vx = (dx / d) * 170
          this.vy = (dy / d) * 170
          this.state = 'dive'
        }
        break
      case 'dive':
        if ((p && this.y > p.y + 4) || g.level.solidAt(this.cx, this.y + this.h + 4)) {
          this.state = 'rise'
          this.vy = -110
          this.vx = this.facing * 90
        }
        break
      case 'rise':
        if (this.y <= this.baseY) {
          this.state = 'fly'
          this.t = 0
        }
        break
    }
    this.x += this.vx * dt
    if (this.state !== 'fly') this.y += this.vy * dt
    if(this.x<16 || this.x+this.w>g.level.width-16) this.facing*=-1
    const pX=p?.cx ?? this.cx
    if(Math.abs(this.cx-pX)>VIEW_W*.8) this.facing=this.cx>pX?-1:1
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.cfg.key
    const key = this.state==='dive'?`${k}.dive`:this.state==='rise'&&has(`${k}.recover`)?`${k}.recover`:`${k}.fly`
    if (this.paint(ctx, key, Math.floor(this.anim * 7) % 2, cx, cy, this.vx < 0)) return
    const b = sprites()
    this.pixel(ctx, Math.floor(this.anim * 8) % 2 ? b.ptero2 : b.ptero1, cx, cy, this.vx < 0)
  }
}

/** 泥쒖쿇??嫄룸떎媛 癒몃━ ?숈뿬 ?뚯쭊?섎뒗 ??(?꾧린 留ㅻ㉧?? */
export class Charger extends Enemy {
  state: 'walk' | 'aim' | 'charge' | 'stun' = 'walk'
  t = 0
  contactDmg = 1

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    const p = g.nearestPlayer(this.cx)
    this.t -= dt
    switch (this.state) {
      case 'walk':
        if (p) {
          const dx = p.cx - this.cx
          if (Math.abs(dx) > 6) this.facing = Math.sign(dx)
          if (Math.abs(dx) < 140 && Math.abs(p.y + p.h - (this.y + this.h)) < 18 && this.t <= 0) {
            this.state = 'aim'
            this.t = 0.6
          }
        }
        this.vx = approach(this.vx, this.facing * this.cfg.speed, 300 * dt)
        if (this.onGround && !groundAhead(g.level, this, this.facing)) this.vx = 0
        break
      case 'aim':
        this.vx = 0
        if (this.t <= 0) {
          this.state = 'charge'
          this.t = 1.3
          g.sfx.roar()
        }
        break
      case 'charge':
        this.vx = this.facing * 200
        if (Math.random() < 0.4) g.particles.push(new Particle(this.cx - this.facing * 10, this.y + this.h, -this.vx * 0.2, -50, 0.35, '#e8f4ff', 3))
        if (this.hitWall || !groundAhead(g.level, this, this.facing) || this.t <= 0) {
          if (this.hitWall) g.shake(0.2, 2)
          this.state = 'stun'
          this.t = 0.9
          this.vx = 0
        }
        break
      case 'stun':
        this.vx = 0
        if (this.t <= 0) {
          this.state = 'walk'
          this.t = 1
        }
        break
    }
    this.fall(g, dt)
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const k = this.cfg.key
    const shake = this.state === 'aim' ? Math.sin(this.anim * 60) * 1 : 0
    const key=this.state==='aim'?`${k}.windup`:this.state==='charge'?`${k}.run`:`${k}.walk`
    ctx.save()
    ctx.translate(shake, 0)
    const ok = this.paint(ctx, has(key) ? key : `${k}.walk`, this.state === 'walk' ? Math.floor(this.anim * 5) % 2 : 0, cx, cy, this.facing < 0)
    if (!ok) this.pixel(ctx, sprites().raptor1, cx, cy, this.facing < 0)
    ctx.restore()
    if (this.state === 'aim') this.alert(ctx, cx, cy)
  }
}

const SPIDER_CFG: EnemyCfg = { cls: 'melee', key: 'spider', hp: 2, score: 200, speed: 0, w: 14, h: 12 }

/** ?숆뎬 泥쒖옣 嫄곕?: ?ㅼ뿉 留ㅻ떖???꾩븘?섎줈 ?ㅻⅤ?대┝ */
export class Spider extends Enemy {
  anchorY: number
  range: number
  t = Math.random() * 3
  speed = 1.4 + Math.random() * 0.6

  constructor(lv: Level, x: number, y: number) {
    super(SPIDER_CFG, x - 7, y)
    this.anchorY = lv.ceilingAbove(x, y)
    const floor = lv.floorBelow(x, y)
    this.range = Math.max(8, floor - this.anchorY - this.h - 10)
    this.y = this.anchorY
  }

  update(g: Game, dt: number): void {
    if (this.updateDying(g, dt)) return
    this.t += dt * this.speed
    // ?꾩뿉???좉퉸 ?ъ뿀?ㅺ? ???대젮?ㅺ퀬 泥쒖쿇???щ씪媛?
    const ph = this.t % (Math.PI * 2)
    const k = ph < 0.8 ? 0 : 0.5 - 0.5 * Math.cos(((ph - 0.8) / (Math.PI * 2 - 0.8)) * Math.PI * 2)
    this.y = this.anchorY + k * this.range
    this.vy = 0
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.dying) {
      ctx.strokeStyle = 'rgba(235,235,245,0.7)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(this.cx - cx, this.anchorY - cy)
      ctx.lineTo(this.cx - cx, this.y + 2 - cy)
      ctx.stroke()
    }
    const descending = this.y - this.anchorY > this.range * 0.3
    const ph=this.t%(Math.PI*2)
    const key=this.dying?'spider.dead':this.y-this.anchorY>this.range*.9?(Math.sin(this.anim*2)>0?'spider.attack':'spider.idle'):descending?'spider.drop':ph<.35?'spider.idle':'spider.hang'
    ctx.save()
    ctx.filter = 'drop-shadow(1px 0 0 #e2ccff) drop-shadow(-1px 0 0 #e2ccff) drop-shadow(0 1px 0 #e2ccff) drop-shadow(0 -1px 0 #e2ccff)'
    const painted = this.paint(ctx, key, Math.floor(this.anim * 4) % 2, cx, cy, false)
    ctx.restore()
    if (!painted) {
      ctx.save()
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#674782'
      ctx.strokeStyle = '#e2ccff'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(this.cx - cx, this.y + this.h / 2 - cy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    if (!this.dying) {
      ctx.save()
      ctx.shadowColor = '#aaffee'
      ctx.shadowBlur = 4
      ctx.fillStyle = '#e2fff4'
      for (const dx of [-2, 2]) {
        ctx.beginPath()
        ctx.arc(this.cx - cx + dx, this.y + this.h * 0.55 - cy, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }
}

const FIRE_CFG: EnemyCfg = { cls: 'melee', key: 'fire', hp: 999, score: 0, speed: 0, w: 10, h: 14 }

/** 諛붾떏 遺??⑥젙: ?묎쾶 ??ㅺ? 二쇨린?곸쑝濡??ш쾶 ?잛쓬. ?먰봽濡??쇳븿 */
export class FireTrap extends Enemy {
  t = Math.random() * 3
  big = false
  baseH = 14

  constructor(x: number, floorY: number) {
    super(FIRE_CFG, x - 5, floorY - 14)
    this.invulnerable = true
  }

  update(g: Game, dt: number): void {
    this.anim += dt
    this.t += dt
    const cyc = this.t % 3.2
    const big = cyc > 2.2
    if (big !== this.big) {
      this.big = big
      const bottom = this.y + this.h
      this.h = big ? 30 : this.baseH
      this.y = bottom - this.h
      if (big && this.x > g.camX && this.x < g.camX + VIEW_W) g.sfx.thud()
    }
    if (Math.random() < (this.big ? 0.9 : 0.4)) {
      g.particles.push(new Particle(this.cx + (Math.random() - 0.5) * 6, this.y + this.h * 0.4, (Math.random() - 0.5) * 20, -40 - Math.random() * 40, 0.4, Math.random() < 0.5 ? '#ffb43a' : '#ff5a1a', 2, -60))
    }
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const frame = Math.floor(this.anim * 9) % 3
    const key = this.big && has('fire.pillar') ? 'fire.pillar' : 'fire.flame'
    drawArt(ctx, key, key === 'fire.pillar' ? 0 : frame, this.cx - cx, this.y + this.h - cy, false,{sy:this.big?1.5:1,sx:1+Math.sin(this.anim*14)*.04})
  }
}


/** Flint teeth have a static, inset damage area, matching their visible tips. */
export class SpikeTrap extends Enemy {
  constructor(x:number,floorY:number) {
    super({cls:'melee',key:'prop.rock',hp:999,score:0,speed:0,w:18,h:10},x-9,floorY-10)
    this.w=26;this.h=14;this.x=x-13;this.y=floorY-this.h;this.invulnerable=true
  }
  update(_g:Game,dt:number):void {this.anim+=dt}
  draw(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    drawArt(ctx,'v2.spikes',0,this.cx-cx,this.y+this.h-cy,false)
  }
}
