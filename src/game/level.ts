import { SCALE, TILE } from './constants'
import { has, image } from './art'
import { ROWS, type StageDef, type EnemyCfg } from './stages'
import { rockPattern, surface, ladder, terrainSupport, terrainDeck, elevatedObject, terrainDrawAudit, type ElevatedObject } from './paintedMap'
import { terrainTheme } from './terrainThemes'
import { cloudFloor } from './cloudTerrain'
import {drawStageSign} from './stageSign'
import type {Weapon} from './weapons'

export const T = { Empty: 0, Solid: 1, Platform: 2, Rock: 3, Ladder: 4, Water: 5 } as const

export type ItemKind = 'meat' | 'bigmeat' | 'fruit' | Weapon | 'clock' | 'cross'

export interface SpawnDef {
  weapon?:Weapon
  cfg?:EnemyCfg
  group?:string
  facing?:1|-1
  col: number
  row: number
  /** E M U F S(거미) X(불 함정) ? m f k b */
  kind: string
  done?: boolean
  width?: number
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
  patternCliffs: {x:number;top:number;bottom:number}[]=[]
  cols: number
  rows = ROWS
  tiles: Uint8Array
  ladders: Uint8Array
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
    if(import.meta.env.DEV){terrainDrawAudit.stage=def.id;terrainDrawAudit.cameraX=0;terrainDrawAudit.cameraY=0}
    const map = def.map
    this.rows=map.length
    this.cols = Math.max(...map.map((r) => r.length))
    this.arenaCol = def.arenaCol
    this.tiles = new Uint8Array(this.cols * this.rows)
    this.ladders = new Uint8Array(this.cols * this.rows)
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
          case 'H': this.ladders[i]=1; break
          case 'w': this.tiles[i] = T.Water; break
          case 'c': this.cave[i] = 1; break
          case '.': break
          default:
            this.spawns.push({ col: c, row: r, kind: ch })
            if (line[c - 1] === 'c' || line[c + 1] === 'c') this.cave[i] = 1
        }
      }
    }
    for(const[col,top,bottom]of map.ladders??[])for(let r=top;r<bottom;r++)for(let c=col;c<col+1;c++){
      if(c>=0&&c<this.cols&&r>=0&&r<this.rows)this.ladders[r*this.cols+c]=1
    }
    // A ladder may overlay a cliff face, but its foot must not continue into
    // the solid ground below an exposed landing. Share the corrected end
    // between rendering and climbing, rather than only hiding the artwork.
    for(let c=0;c<this.cols;c++)for(let r=0;r<this.rows;){
      if(!this.isLadder(c,r)){r++;continue}
      const top=r
      while(this.isLadder(c,r))r++
      const end=r
      let floor=end
      while(floor>top&&this.isSolidTile(this.tile(c,floor-1)))floor--
      if(floor>top&&floor<end&&this.tile(c,floor-1)===T.Empty)
        for(let y=floor;y<end;y++)this.ladders[y*this.cols+c]=0
    }
    // One fish per connected jungle pool, never in lava or an ice field.
    let poolGuard=false
    if(!this.def.cave&&!this.def.aquatic&&this.def.theme.n==='')for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;){
      if(this.tile(c,r)!==T.Water||this.tile(c,r-1)===T.Water){c++;continue}
      const start=c
      while(c<this.cols&&this.tile(c,r)===T.Water&&this.tile(c,r-1)!==T.Water)c++
      if(!poolGuard&&start>=25&&!this.spawns.some(s=>/[EMUFA]/.test(s.kind)&&Math.abs(s.col-start)<12)){
        this.spawns.push({col:start,row:r,kind:'P',width:c-start});poolGuard=true
      }
    }
    for(const encounter of def.encounters??[]){
      this.spawns.push({col:encounter.col,row:encounter.row,kind:'A',cfg:encounter.cfg,group:encounter.group,facing:encounter.facing})
    }
    if(def.cave)this.cave.fill(1)
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
    return c>=0&&c<this.cols&&r>=0&&r<this.rows&&this.ladders[r*this.cols+c]===1
  }

  /** 사다리 꼭대기 칸 (위가 사다리가 아님) → 발판처럼 밟을 수 있음 */
  isLadderTop(c: number, r: number): boolean {
    return this.isLadder(c, r) && !this.isLadder(c, r - 1)
  }

  waterAt(px: number, py: number): boolean {
    const sea=this.def.aquatic,c=Math.floor(px/TILE),r=Math.floor(py/TILE)
    if(sea&&c>=sea.startCol&&c<=sea.endCol&&r>=sea.surfaceRow&&r<this.rows&&!this.solidAt(px,py)){
      if(!sea.airPockets.some(p=>c>=p.col&&c<p.col+p.w&&r>=p.row&&r<p.row+p.h))return true
    }
    return this.tile(Math.floor(px / TILE), Math.floor(py / TILE)) === T.Water
  }

  updraftAt(px:number,py:number):boolean {
    return this.def.aerial?.updrafts.some(p=>px>=p.col*TILE&&px<(p.col+p.w)*TILE&&py>=p.row*TILE&&py<(p.row+p.h)*TILE)??false
  }

  swimmableAt(px:number,py:number):boolean {
    return !!this.def.aquatic&&this.waterAt(px,py)
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
    const g=cv.getContext('2d')!;g.scale(this.scale,this.scale);g.imageSmoothingEnabled=true
    const theme=this.def.theme.background,material=terrainTheme(theme)
    const textures=new Map<number,CanvasPattern>()
    const draw=(i:number,x:number,y:number,w:number,h:number,_cap=false)=>{
      let pattern=textures.get(i)
      if(!pattern){
        pattern=rockPattern(g,theme,this.def.cave?128:64);textures.set(i,pattern)
      }
      g.fillStyle=pattern;g.fillRect(x,y,w,h)
    }
    if(this.def.cave){
      g.fillStyle=material.base;g.fillRect(0,0,this.width,this.height)
      draw(10,0,0,this.width,this.height)
      g.fillStyle='rgba(8,12,18,.38)';g.fillRect(0,0,this.width,this.height)
    }
    // Group platform runs by their actual ground bank and region support material.
    const decks:{x:number;y:number;width:number;support:number;bottom:number}[]=[]
    const supports:{x:number;top:number;bottom:number;left:number;right:number;object:ElevatedObject}[]=[]
    if(!this.def.cave)for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;){
      if(this.tile(c,r)!==T.Platform){c++;continue}
      const start=c;while(c<this.cols&&this.tile(c,r)===T.Platform)c++
      const end=c-1,y=r*TILE
      let center=Math.floor((start+end)/2),hasLadder=false
      for(let k=start;k<=end;k++)if(this.isLadder(k,r)||this.isLadder(k,r+1)){center=k;hasLadder=true;break}
      let root=-1,bottom=0
      for(let offset=0;offset<=8&&root<0;offset++)for(const sign of offset?[-1,1]:[1]){
        const k=center+offset*sign;if(k<0||k>=this.cols)continue
        for(let below=r+1;below<this.rows;below++){
          const t=this.tile(k,below)
          if(t===T.Water)break
          if(this.isSolidTile(t)){root=k;bottom=below*TILE;break}
        }
        if(root>=0)break
      }
      if(root<0){
        // Bridges over water and floating ledges still have collision geometry.
        decks.push({x:start*TILE,y,width:(end-start+1)*TILE,support:-1,bottom:this.height})
        continue
      }
      const groundRow=Math.round(bottom/TILE)
      let bankLeft=root,bankRight=root
      while(bankLeft>0&&this.isSolidTile(this.tile(bankLeft-1,groundRow)))bankLeft--
      while(bankRight+1<this.cols&&this.isSolidTile(this.tile(bankRight+1,groundRow)))bankRight++
      const left=bankLeft*TILE,right=(bankRight+1)*TILE
      const x=(root+.5)*TILE
      const object=elevatedObject(this.def.id,root)
      let support=supports.findIndex(t=>t.object===object&&t.left===left&&t.right===right&&Math.abs(t.x-x)<(hasLadder?20:112)&&Math.abs(t.bottom-bottom)<TILE)
      if(support<0){support=supports.length;supports.push({x,top:y-14,bottom,left,right,object})}
      else supports[support]!.top=Math.min(supports[support]!.top,y-14)
      // The two feet of a wide structure can sit on different terraces. A
      // single ladder/root column is not a valid baseline for the whole art.
      // Extend behind the lowest bank; foreground terrain hides buried roots.
      let foundation=bottom
      for(let k=start;k<=end;k++){
        let floor=this.height+TILE
        for(let below=r+1;below<this.rows;below++){
          if(this.isSolidTile(this.tile(k,below))){floor=below*TILE;break}
        }
        foundation=Math.max(foundation,floor)
      }
      decks.push({x:start*TILE,y,width:(end-start+1)*TILE,support,bottom:foundation})
    }
    if(this.def.id===3){
      const im=image('terrain.3.support')
      if(im)for(const tree of supports){
        const scale=Math.min((tree.bottom-tree.top+6)/im.height,(tree.right-tree.left)/im.width)
        const width=im.width*scale,height=im.height*scale
        const center=Math.max(tree.left+width/2,Math.min(tree.right-width/2,tree.x))
        this.patternCliffs.push({x:center+width/2,top:tree.bottom+6-height,bottom:tree.bottom})
      }
    }
    for(const tree of supports){
      if(tree.object!=='local'&&image('world.elevated.'+tree.object))continue
      terrainSupport(g,tree.x,tree.top,tree.bottom,theme,tree.left,tree.right,tree.object)
    }
    for(const deck of decks){
      const support=supports[deck.support]
      if(!support)continue
      if(support.object!=='local'&&image('world.elevated.'+support.object))
        terrainDeck(g,deck.x,deck.y,theme,deck.width,support.object,deck.bottom)
    }
    // Broad coherent faces: texture scale never depends on the number of rows.
    if(this.def.aerial)for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;){
      if(!this.isSolidTile(this.tile(c,r))||this.isSolidTile(this.tile(c,r-1))){c++;continue}
      const start=c
      while(c<this.cols&&this.isSolidTile(this.tile(c,r))&&!this.isSolidTile(this.tile(c,r-1)))c++
      let bottom=r+1
      const middle=Math.floor((start+c-1)/2)
      while(bottom<this.rows&&this.isSolidTile(this.tile(middle,bottom)))bottom++
      cloudFloor(g,start*TILE,r*TILE,(c-start)*TILE,(bottom-r)*TILE)
    }
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      if(this.def.aerial)continue
      const t=this.tile(c,r),x=c*TILE,y=r*TILE
      if(this.isSolidTile(t)){
        const exposed=!this.isSolidTile(this.tile(c,r-1))
        const left=!this.isSolidTile(this.tile(c-1,r)),right=!this.isSolidTile(this.tile(c+1,r))
        const bottom=!this.isSolidTile(this.tile(c,r+1))
        g.save();g.beginPath()
        // Small chipped rock corners soften the silhouette without moving the
        // traversable top or filling gaps that the player needs to jump across.
        const tl=exposed&&left?6:0,tr=exposed&&right?6:0
        const br=bottom&&right?7:0,bl=bottom&&left?7:0
        g.moveTo(x+tl,y);g.lineTo(x+TILE-tr,y)
        if(tr)g.quadraticCurveTo(x+TILE,y,x+TILE,y+tr)
        g.lineTo(x+TILE,y+TILE-br)
        if(br)g.quadraticCurveTo(x+TILE,y+TILE,x+TILE-br,y+TILE)
        g.lineTo(x+bl,y+TILE)
        if(bl)g.quadraticCurveTo(x,y+TILE,x,y+TILE-bl)
        g.lineTo(x,y+tl)
        if(tl)g.quadraticCurveTo(x,y,x+tl,y)
        g.closePath();g.clip()
        g.fillStyle=material.base
        g.fillRect(x,y,TILE,TILE)
        draw(this.def.cave?9:theme*3+1,x,y,TILE,TILE)
        if(exposed&&this.def.cave&&r>=this.rows-2)surface(g,theme,x,y,c)
        if(exposed&&!this.def.cave){
          if(t===T.Solid)surface(g,theme,x,y,c)
          else{
            g.strokeStyle=material.edge;g.lineWidth=1.3
            g.beginPath();g.moveTo(x+tl,y+.7);g.lineTo(x+TILE-tr,y+.7);g.stroke()
          }
        }
        if(left||right){g.fillStyle='rgba(12,18,13,.16)';if(left)g.fillRect(x,y,1,TILE);if(right)g.fillRect(x+TILE-1,y,1,TILE)}
        g.restore()
      }else if(this.isCave(c,r)){
        draw(10,x,y,TILE,TILE)
        g.fillStyle='rgba(8,12,18,.22)';g.fillRect(x,y,TILE,TILE)
      }
    }
    for(const deck of decks){
      const support=supports[deck.support]
      if(!support){terrainDeck(g,deck.x,deck.y,theme,deck.width);continue}
      if(support.object!=='local'&&image('world.elevated.'+support.object))continue
      terrainDeck(g,deck.x,deck.y,theme,deck.width,support.object)
    }
    // Actual ladder span, shared with physics; one narrow shaft per connected run.
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      if(!this.isLadderTop(c,r))continue
      let w=1,bottom=r;while(this.isLadder(c,bottom))bottom++
      while(this.isLadderTop(c+w,r)){
        let nextBottom=r;while(this.isLadder(c+w,nextBottom))nextBottom++
        if(nextBottom!==bottom)break
        w++
      }
      const x=(c+w/2)*TILE,top=r*TILE-(theme<=5?0:1),end=bottom*TILE
      ladder(g,theme,x,top,end)
      c+=w-1
    }
    if(this.def.aquatic){
      g.save();g.globalCompositeOperation='source-atop';g.fillStyle='rgba(26,128,147,.28)';g.fillRect(0,0,this.width,this.height);g.restore()
      for(let c=this.def.aquatic.startCol+3;c<this.def.aquatic.endCol;c+=11){
        const x=c*TILE,y=this.floorBelow(x,22*TILE)
        g.save();g.strokeStyle=c%2?'#e889ab':'#6ecfc0';g.lineCap='round';g.lineWidth=3
        g.beginPath();g.moveTo(x,y);g.lineTo(x,y-16);g.moveTo(x,y-7);g.lineTo(x-7,y-14);g.lineTo(x-7,y-19);g.moveTo(x,y-10);g.lineTo(x+7,y-18);g.stroke();g.restore()
      }
    }
    if(!this.def.cave){
      const x=3*TILE
      drawStageSign(g,this.def.id,x,this.floorBelow(x+35,0))
    }
    return cv
  }
}
