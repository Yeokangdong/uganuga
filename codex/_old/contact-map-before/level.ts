import { SCALE, TILE } from './constants'
import { drawArt, has, image } from './art'
import { ROWS, type StageDef } from './stages'
import { pixelRockTexture, pixelSurface } from './pixelMap'

export const T = { Empty: 0, Solid: 1, Platform: 2, Rock: 3, Ladder: 4, Water: 5 } as const

export type ItemKind = 'meat' | 'bigmeat' | 'fruit' | 'bone' | 'fire' | 'clock'

export interface SpawnDef {
  col: number
  row: number
  /** E M U F S(거미) X(불 함정) ? m f k b */
  kind: string
  done?: boolean
}

export interface Rect4 {
  x: number
  y: number
  w: number
  h: number
}

/** 스테이지 테마 키: 'tile.ground' → 'tile2.ground' (없으면 스테이지1 그림) */
export function themeKey(base: string, n: string): string {
  if (!n) return base
  const i = base.indexOf('.')
  const k = `${base.slice(0, i)}${n}${base.slice(i)}`
  return has(k) || image(k) ? k : base
}

export class Level {
  cols: number
  rows = ROWS
  tiles: Uint8Array
  /** 동굴 안 칸 (뒤에 동굴 벽, 어둡게) */
  cave: Uint8Array
  caveRects: Rect4[] = []
  spawns: SpawnDef[] = []
  arenaCol: number
  canvas: HTMLCanvasElement
  scale = SCALE
  /** 스테이지 그림이 아직 없어 스테이지1 그림을 쓰는 중 */
  fallbackTint: string | null = null

  constructor(public def: StageDef) {
    const map = def.map
    this.cols = Math.max(...map.map((r) => r.length))
    this.arenaCol = def.arenaCol
    this.tiles = new Uint8Array(this.cols * this.rows)
    this.cave = new Uint8Array(this.cols * this.rows)
    for (let r = 0; r < this.rows; r++) {
      const line = map[r] ?? ''
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] ?? '.'
        const i = r * this.cols + c
        switch (ch) {
          case '#': this.tiles[i] = T.Solid; break
          case 'R': this.tiles[i] = T.Rock; break
          case '=': this.tiles[i] = T.Platform; break
          case 'H': this.tiles[i] = T.Ladder; break
          case 'w': this.tiles[i] = T.Water; break
          case 'c': this.cave[i] = 1; break
          case '.': break
          default:
            this.spawns.push({ col: c, row: r, kind: ch })
            if (line[c - 1] === 'c' || line[c + 1] === 'c') this.cave[i] = 1
        }
      }
    }
    this.buildCaveRects()
    this.spawns.sort((a, b) => a.col - b.col)
    this.canvas = this.prerender()
  }

  get width(): number {
    return this.cols * TILE
  }
  get height(): number {
    return this.rows * TILE
  }
  get arenaX(): number {
    return this.arenaCol * TILE
  }

  tile(c: number, r: number): number {
    if (c < 0 || c >= this.cols) return T.Rock
    if (r < 0 || r >= this.rows) return T.Empty
    return this.tiles[r * this.cols + c]
  }

  isSolidTile(t: number): boolean {
    return t === T.Solid || t === T.Rock
  }

  solidAt(px: number, py: number): boolean {
    return this.isSolidTile(this.tile(Math.floor(px / TILE), Math.floor(py / TILE)))
  }

  isCave(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false
    return this.cave[r * this.cols + c] === 1
  }

  caveAt(px: number, py: number): boolean {
    return this.isCave(Math.floor(px / TILE), Math.floor(py / TILE))
  }

  isLadder(c: number, r: number): boolean {
    return this.tile(c, r) === T.Ladder
  }

  /** 사다리 꼭대기 칸 (위가 사다리가 아님) → 발판처럼 밟을 수 있음 */
  isLadderTop(c: number, r: number): boolean {
    return this.isLadder(c, r) && !this.isLadder(c, r - 1)
  }

  waterAt(px: number, py: number): boolean {
    return this.tile(Math.floor(px / TILE), Math.floor(py / TILE)) === T.Water
  }

  /** 열에서 가장 아래쪽의 설 수 있는 바깥 지면 y (부활·스폰용). 없으면 null */
  groundY(px: number): number | null {
    const c = Math.floor(px / TILE)
    for (let r = this.rows - 1; r > 1; r--) {
      const t = this.tile(c, r)
      if (t === T.Water) return null
      const up1 = this.tile(c, r - 1)
      const up2 = this.tile(c, r - 2)
      if ((this.isSolidTile(t) || t === T.Platform) && up1 === T.Empty && up2 === T.Empty && !this.isCave(c, r - 1)) return r * TILE
    }
    return null
  }

  /** (px, py) 아래로 처음 만나는 바닥 y */
  floorBelow(px: number, py: number): number {
    const c = Math.floor(px / TILE)
    for (let r = Math.max(0, Math.floor(py / TILE)); r < this.rows; r++) {
      const t = this.tile(c, r)
      if (this.isSolidTile(t) || t === T.Platform || this.isLadderTop(c, r) || t === T.Water) return r * TILE
    }
    return this.height
  }

  /** (px, py) 위로 처음 만나는 천장 y (거미줄 길이용) */
  ceilingAbove(px: number, py: number): number {
    const c = Math.floor(px / TILE)
    for (let r = Math.floor(py / TILE); r >= 0; r--) {
      if (this.isSolidTile(this.tile(c, r))) return (r + 1) * TILE
    }
    return 0
  }

  private buildCaveRects(): void {
    for (let r = 0; r < this.rows; r++) {
      let c = 0
      while (c < this.cols) {
        if (!this.isCave(c, r)) {
          c++
          continue
        }
        const s = c
        while (c < this.cols && this.isCave(c, r)) c++
        this.caveRects.push({ x: s * TILE, y: r * TILE, w: (c - s) * TILE, h: TILE })
      }
    }
  }

  // ─────────────── 프리렌더 ───────────────
  private prerender():HTMLCanvasElement {
    const cv=document.createElement('canvas');cv.width=this.width*this.scale;cv.height=this.height*this.scale
    const g=cv.getContext('2d')!;g.scale(this.scale,this.scale);g.imageSmoothingEnabled=false
    const theme=this.def.theme.n==='2'?1:this.def.theme.n==='3'?2:0
    const textures=new Map<number,CanvasPattern>()
    const draw=(i:number,x:number,y:number,w:number,h:number,_cap=false)=>{
      let pattern=textures.get(i)
      if(!pattern){
        const tile=pixelRockTexture(i===10?theme:Math.floor(i/3),i>=9)
        pattern=g.createPattern(tile,'repeat')!;textures.set(i,pattern)
      }
      g.fillStyle=pattern;g.fillRect(x,y,w,h)
    }
    if(this.def.cave){
      g.fillStyle='#15100d';g.fillRect(0,0,this.width,this.height)
      draw(10,0,0,this.width,this.height)
      g.fillStyle='rgba(14,9,8,.32)';g.fillRect(0,0,this.width,this.height)
    }
    // Broad coherent faces: texture scale never depends on the number of rows.
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      const t=this.tile(c,r),x=c*TILE,y=r*TILE
      if(this.isSolidTile(t)){
        const exposed=!this.isSolidTile(this.tile(c,r-1))
        const left=!this.isSolidTile(this.tile(c-1,r)),right=!this.isSolidTile(this.tile(c+1,r))
        const bottom=!this.isSolidTile(this.tile(c,r+1))
        g.save();g.beginPath()
        // Small chipped rock corners soften the silhouette without moving the
        // traversable top or filling gaps that the player needs to jump across.
        const tl=exposed&&left?3:0,tr=exposed&&right?3:0
        const br=bottom&&right?4:0,bl=bottom&&left?4:0
        g.moveTo(x+tl,y);g.lineTo(x+TILE-tr,y);g.lineTo(x+TILE-tr,y+1);g.lineTo(x+TILE,y+1)
        g.lineTo(x+TILE,y+TILE-br);g.lineTo(x+TILE-br,y+TILE-br);g.lineTo(x+TILE-br,y+TILE)
        g.lineTo(x+bl,y+TILE);g.lineTo(x+bl,y+TILE-bl);g.lineTo(x,y+TILE-bl)
        g.lineTo(x,y+1);g.lineTo(x+tl,y+1);g.closePath();g.clip()
        g.fillStyle=this.def.cave?'#4d3725':theme===0?'#6d4a2d':theme===1?'#29282a':'#577f98'
        g.fillRect(x,y,TILE,TILE)
        draw(this.def.cave?9:theme*3+1,x,y,TILE,TILE)
        if(exposed&&!this.def.cave){
          pixelSurface(g,theme,x,y,c)
        }
        if(left||right){g.fillStyle='rgba(12,18,13,.16)';if(left)g.fillRect(x,y,1,TILE);if(right)g.fillRect(x+TILE-1,y,1,TILE)}
        g.restore()
      }else if(this.isCave(c,r)){
        draw(10,x,y,TILE,TILE)
        g.fillStyle='rgba(17,13,11,.22)';g.fillRect(x,y,TILE,TILE)
      }else if(t===T.Platform){
        g.fillStyle='#805531';g.fillRect(x,y,TILE,6)
        drawArt(g,'v2.log',0,x+TILE/2,y+7,false)
      }
    }
    // Actual ladder span, shared with physics; one narrow shaft per connected run.
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      if(!this.isLadderTop(c,r)||this.isLadder(c-1,r))continue
      let w=1,bottom=r;while(this.isLadder(c+w,r))w++;while(this.isLadder(c,bottom))bottom++
      const x=(c+w/2)*TILE,top=r*TILE,end=bottom*TILE
      for(const dx of [-7,7]){g.fillStyle='#442b18';g.fillRect(x+dx-2,top,4,end-top);g.fillStyle='#c39152';g.fillRect(x+dx-1,top,1,end-top)}
      for(let y=top+3;y<end;y+=7){g.fillStyle='#b68448';g.fillRect(x-7,y,14,2);g.fillStyle='#e2c38b';g.fillRect(x-9,y,4,1);g.fillRect(x+5,y,4,1)}
    }
    return cv
  }
}

