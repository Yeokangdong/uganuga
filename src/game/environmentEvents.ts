import { image } from './art'
import { RUN_SPEED, TILE, VIEW_H, VIEW_W, overlap } from './constants'
import type { Game } from './game'
import type { Level } from './level'

export type EnvironmentPhase = 'IDLE' | 'TELEGRAPH' | 'ACTIVE' | 'RESOLVED' | 'CANCELLED'
const LEAVES = 1.2, WARNING = 2.4, FALL = .8, LENGTH = 72, WARNING_ANGLE = .18

/** One encounter per stage visit. No wall-clock timers or persistent colliders. */
const fallAngle = (elapsed: number): number => WARNING_ANGLE + Math.min(1, elapsed / FALL) * (Math.PI / 2 - WARNING_ANGLE)

export class EnvironmentEvents {
  phase: EnvironmentPhase = 'IDLE'
  elapsed = 0
  x = 0
  floor = 0
  rockX = 0
  private reward = false
  get suppressesPatterns(): boolean {
    return this.level?.def.id===7 && (this.phase==='TELEGRAPH'||this.phase==='ACTIVE'||this.phase==='RESOLVED'&&this.elapsed<2)
  }
  private level: Level | null = null
  private hit = false
  private lives: number | null = null

  reset(level: Level): void {
    this.level = level
    this.phase = 'IDLE'; this.elapsed = 0; this.x = 0; this.hit = false; this.lives = null
    this.rockX=0;this.reward=false
  }

  cancel(): void {
    this.phase = 'CANCELLED'; this.elapsed = 0; this.hit = false
  }

  update(g: Game, dt: number, blocked: number[]): void {
    const p = g.players[0], lv = g.level
    if (lv.def.id !== 1 && lv.def.id !== 7) return
    if (p && this.lives !== null && p.lives !== this.lives) {
      if(lv.def.id===7&&this.phase==='IDLE'){this.lives=p.lives;return}
      this.cancel(); return
    }
    if (p) this.lives = p.lives
    if(lv.def.id===7&&this.phase==='IDLE'&&p&&!p.alive)return
    if (lv !== this.level || lv.def.cave || g.mode !== 'play' || !p?.alive) {
      this.cancel(); return
    }
    if (this.phase === 'CANCELLED') return
    if(lv.def.id===7){this.updateChase(g,dt);return}
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
        const angle = fallAngle(this.elapsed)
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

  private updateChase(g:Game,dt:number):void {
    const p=g.players[0]!, route=g.level.def.chase
    if(!route){this.cancel();return}
    this.x=route.start;this.floor=route.floor
    const visible=(x:number,margin=32)=>x>g.camX+margin&&x<g.camX+VIEW_W-margin
    const vertical=this.floor-64>g.camY+4&&this.floor<g.camY+VIEW_H-4
    if(this.phase==='IDLE'){
      // The entrance, left warning and a generous right-hand runway are all on screen.
      if(p.onGround&&!p.climbing&&p.invuln<=0&&p.cx>=this.x+96&&p.cx<this.x+144
        &&Math.abs(p.y+p.h-this.floor)<8&&vertical&&visible(p.cx-100)&&visible(p.cx+112)){
        this.phase='TELEGRAPH';this.elapsed=0;this.rockX=p.cx-100
      }
      return
    }
    if(p.climbing){this.cancel();return}
    this.elapsed+=dt
    if(this.phase==='TELEGRAPH'){
      // Pebbles remain at the visible left edge as the player runs during the warning.
      this.rockX=Math.max(this.x+24,p.cx-112)
      if(!vertical||p.cx<this.x+48||p.cx>route.end-48){this.cancel();return}
      if(this.elapsed>=2.8&&visible(this.rockX)&&p.x-this.rockX>64){
        this.phase='ACTIVE';this.elapsed=0
      }
    }else if(this.phase==='ACTIVE'){
      // Player simulation is globally 0.75x; use the same time base for fair pursuit.
      this.rockX=Math.min(route.end-32,this.rockX+RUN_SPEED*.75*.78*dt)
      const rock={x:this.rockX-26,y:this.floor-52,w:52,h:52}
      const nearestX=Math.max(p.x,Math.min(this.rockX,p.x+p.w))
      const nearestY=Math.max(p.y,Math.min(this.floor-26,p.y+p.h))
      if(!this.hit&&visible(this.rockX,28)&&vertical
        &&Math.hypot(nearestX-this.rockX,nearestY-(this.floor-26))<24&&overlap(p,rock)){
        this.hit=true;p.hurt(g,1,this.rockX)
      }
      if(this.rockX>=route.end-32){
        this.phase='RESOLVED';this.elapsed=0
        // Reuse ordinary fruit and collection rules, no score or FOOD injection.
        if(!this.reward){
          this.reward=true
          for(let i=0;i<3;i++)g.level.spawns.push({kind:'f',col:route.end/TILE+2+i*2,row:this.floor/TILE-1})
        }
      }
    }
  }

  private drawChase(ctx:CanvasRenderingContext2D,cx:number,cy:number):void {
    const route=this.level?.def.chase
    if(!route||!this.x||this.phase==='CANCELLED'||this.phase==='IDLE')return
    const t=this.elapsed,y=this.floor-cy
    ctx.save()
    // A low rock spur catches the large boulder; Uga can freely step/jump past it.
    if(this.phase==='ACTIVE'||this.phase==='RESOLVED'){
      ctx.fillStyle='#947059';ctx.beginPath();ctx.moveTo(route.end-cx-8,y)
      ctx.lineTo(route.end-cx-2,y-15);ctx.lineTo(route.end-cx+10,y-9);ctx.lineTo(route.end-cx+18,y);ctx.fill()
    }
    if(this.phase==='TELEGRAPH'){
      const x=this.rockX-cx+Math.sin(t*42)*1.5
      ctx.fillStyle='#c8ab88'
      for(let i=0;i<7;i++){
        const fall=(t*55+i*17)%65
        ctx.fillRect(x-20+i*7,y-78+fall,3+i%2,3)
      }
      ctx.strokeStyle='rgba(224,185,128,.6)';ctx.lineWidth=1
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.ellipse(x,y-1,15+i*10+(t*16)%10,2,0,0,Math.PI*2);ctx.stroke()
      }
    }else if(this.phase==='ACTIVE'||this.phase==='RESOLVED'&&t<2){
      if(this.phase==='RESOLVED')ctx.globalAlpha=Math.max(0,1-(t-1))
      ctx.save();ctx.translate(this.rockX-cx,y-26);ctx.rotate((this.rockX-this.x)/26)
      ctx.fillStyle='#8d7263';ctx.strokeStyle='#493d39';ctx.lineWidth=2
      ctx.beginPath()
      for(let i=0;i<9;i++){
        const a=i*Math.PI*2/9,r=i%2?25:27
        if(i===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r)
        else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)
      }
      ctx.closePath();ctx.fill();ctx.stroke()
      ctx.strokeStyle='#c5ab8b';ctx.beginPath();ctx.moveTo(-15,-9);ctx.lineTo(0,-18);ctx.lineTo(13,-7);ctx.stroke()
      ctx.restore();ctx.fillStyle='rgba(204,167,118,.5)'
      for(let i=0;i<6;i++){
        ctx.beginPath();ctx.ellipse(this.rockX-cx-20-i*8,y-3-(t*22+i*3)%12,4+i,2+i%3,0,0,Math.PI*2);ctx.fill()
      }
    }
    ctx.restore()
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if(this.level?.def.id===7){this.drawChase(ctx,cx,cy);return}
    if (!this.x || this.phase === 'CANCELLED' || this.phase === 'RESOLVED' && this.elapsed > 1.4) return
    const im = image('world.rootedTree')
    const t = this.elapsed
    const angle = this.phase === 'ACTIVE' ? fallAngle(t)
      : this.phase === 'RESOLVED' ? Math.PI/2
      : this.phase === 'TELEGRAPH' ? (t < LEAVES ? Math.sin(t*30)*.025 : (t-LEAVES)/(WARNING-LEAVES)*WARNING_ANGLE) : 0
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
