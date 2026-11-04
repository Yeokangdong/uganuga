import { image } from './art'
import { TILE, VIEW_H, VIEW_W, overlap } from './constants'
import type { Game } from './game'
import type { Level } from './level'

export type EnvironmentPhase = 'IDLE' | 'TELEGRAPH' | 'ACTIVE' | 'RESOLVED' | 'CANCELLED'
const LEAVES = 1.2, WARNING = 2.4, FALL = .8, LENGTH = 72

/** One encounter per stage visit. No wall-clock timers or persistent colliders. */
export class EnvironmentEvents {
  phase: EnvironmentPhase = 'IDLE'
  elapsed = 0
  x = 0
  floor = 0
  private level: Level | null = null
  private hit = false
  private lives: number | null = null

  reset(level: Level): void {
    this.level = level
    this.phase = 'IDLE'; this.elapsed = 0; this.x = 0; this.hit = false; this.lives = null
  }

  cancel(): void {
    this.phase = 'CANCELLED'; this.elapsed = 0; this.hit = false
  }

  update(g: Game, dt: number, blocked: number[]): void {
    const p = g.players[0], lv = g.level
    if (lv.def.id !== 1) return
    if (p && this.lives !== null && p.lives !== this.lives) { this.cancel(); return }
    if (p) this.lives = p.lives
    if (lv !== this.level || lv.def.cave || g.mode !== 'play' || !p?.alive) {
      this.cancel(); return
    }
    if (this.phase === 'CANCELLED') return
    if (!this.x) {
      // Keep the first four fruit, spawn and all entrances well outside the sweep.
      for (let x = 448; x < lv.arenaX - 384; x += TILE) {
        const floor = lv.groundY(x)
        if (floor === null || floor === undefined || blocked.some(b => Math.abs(b - x) < 160)) continue
        let safe = true
        for (let dx = -128; dx <= 80; dx += 8) {
          if (lv.groundY(x + dx) !== floor || lv.waterAt(x + dx, floor + 1)) { safe = false; break }
          const c = Math.floor((x + dx) / TILE)
          for (let r = Math.floor((floor - 88) / TILE); r <= Math.floor(floor / TILE); r++) {
            if (lv.isLadder(c, r) || lv.caveAt(x + dx, r * TILE)) safe = false
            if (r * TILE < floor - 16 && lv.solidAt(x + dx, r * TILE)) safe = false
          }
        }
        if (safe) { this.x = x; this.floor = floor; break }
      }
      if (!this.x) { this.cancel(); return }
    }
    const visible = this.x - LENGTH > g.camX + 12 && this.x + 20 < g.camX + VIEW_W - 12
      && this.floor - LENGTH > g.camY + 12 && this.floor < g.camY + VIEW_H - 4
    if (this.phase === 'IDLE') {
      if (visible && p.onGround && !p.climbing && p.cx > this.x - 240 && p.cx < this.x - 90
        && Math.abs(p.y + p.h - this.floor) < 8) {
        this.phase = 'TELEGRAPH'; this.elapsed = 0
      }
      return
    }
    if (this.phase === 'TELEGRAPH' || this.phase === 'ACTIVE') {
      // Leaving the viewport cancels rather than creating a blind attack.
      if (!visible) { this.cancel(); return }
      this.elapsed += dt
      if (this.phase === 'TELEGRAPH' && this.elapsed >= WARNING) {
        this.phase = 'ACTIVE'; this.elapsed = 0
      }
      if (this.phase === 'ACTIVE') {
        const angle = Math.min(1, this.elapsed / FALL) * Math.PI / 2
        // Sample the same rotating trunk drawn below; each event can hurt once.
        for (let d = 8; d < LENGTH; d += 5) {
          if (!this.hit && overlap(p, {x:this.x - Math.sin(angle)*d-6,
            y:this.floor-Math.cos(angle)*d-6,w:12,h:12})) {
            this.hit = true; p.hurt(g, 1, this.x)
          }
        }
        if (this.elapsed >= FALL) { this.phase = 'RESOLVED'; this.elapsed = 0 }
      }
    } else if (this.phase === 'RESOLVED') this.elapsed += dt
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.x || this.phase === 'CANCELLED' || this.phase === 'RESOLVED' && this.elapsed > 1.4) return
    const im = image('world.rootedTree')
    const t = this.elapsed
    const angle = this.phase === 'ACTIVE' ? Math.min(1,t/FALL)*Math.PI/2
      : this.phase === 'RESOLVED' ? Math.PI/2
      : this.phase === 'TELEGRAPH' ? (t < LEAVES ? Math.sin(t*30)*.025 : (t-LEAVES)/(WARNING-LEAVES)*.18) : 0
    ctx.save(); ctx.translate(this.x-cx,this.floor-cy); ctx.rotate(-angle)
    if (this.phase === 'RESOLVED') ctx.globalAlpha = Math.max(0, 1-(t-.7)/.7)
    if (im) ctx.drawImage(im, im.width*.15, 0, im.width*.7, im.height, -18,-LENGTH,36,LENGTH)
    else { ctx.fillStyle='#785132'; ctx.fillRect(-6,-LENGTH,12,LENGTH) }
    ctx.restore()
    if (this.phase === 'TELEGRAPH') {
      ctx.save(); ctx.fillStyle='rgba(235,184,67,.5)'
      ctx.fillRect(this.x-LENGTH-cx,this.floor-3-cy,LENGTH,3)
      for(let i=0;i<4;i++) { ctx.beginPath(); ctx.ellipse(this.x-16-i*9-cx,this.floor-65+(t*24+i*13)%54-cy,2,1,t+i,0,Math.PI*2);ctx.fill() }
      ctx.restore()
    }
  }
}
