/**
 * 도트 스프라이트: 문자열 픽셀아트 → 오프스크린 캔버스.
 * 자동으로 1px 외곽선을 둘러서 아케이드 느낌을 낸다.
 */
export interface Sprite {
  w: number
  h: number
  img: HTMLCanvasElement
  flip: HTMLCanvasElement
  white: HTMLCanvasElement
  whiteFlip: HTMLCanvasElement
}

export type Palette = Record<string, string>

const OUTLINE = '#1c0f08'

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function flipped(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.translate(src.width, 0)
  g.scale(-1, 1)
  g.drawImage(src, 0, 0)
  return c
}

function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = canvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  return c
}

export function makeSprite(rows: string[], pal: Palette, outline = true): Sprite {
  const pw = Math.max(...rows.map((r) => r.length))
  const ph = rows.length
  const pad = outline ? 1 : 0
  const w = pw + pad * 2
  const h = ph + pad * 2
  const img = canvas(w, h)
  const g = img.getContext('2d')!
  const filled: boolean[] = new Array(w * h).fill(false)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x + pad, y + pad, 1, 1)
      filled[(y + pad) * w + x + pad] = true
    }
  })
  if (outline) {
    g.fillStyle = OUTLINE
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (filled[y * w + x]) continue
        const n =
          (x > 0 && filled[y * w + x - 1]) ||
          (x < w - 1 && filled[y * w + x + 1]) ||
          (y > 0 && filled[(y - 1) * w + x]) ||
          (y < h - 1 && filled[(y + 1) * w + x])
        if (n) g.fillRect(x, y, 1, 1)
      }
    }
  }
  const white = silhouette(img, '#ffffff')
  return { w, h, img, flip: flipped(img), white, whiteFlip: flipped(white) }
}

/** 중심 x, 바닥 y 기준으로 그리기 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  cx: number,
  bottom: number,
  faceLeft: boolean,
  white = false,
): void {
  const src = white ? (faceLeft ? s.whiteFlip : s.white) : faceLeft ? s.flip : s.img
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, Math.round(cx - s.w / 2), Math.round(bottom - s.h + 1))
  ctx.imageSmoothingEnabled = prev
}

/** 회전하며 그리기 (죽는 연출 등) */
export function drawSpriteRot(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  cx: number,
  cy: number,
  rot: number,
  faceLeft: boolean,
  white = false,
): void {
  const src = white ? (faceLeft ? s.whiteFlip : s.white) : faceLeft ? s.flip : s.img
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(Math.round(cx), Math.round(cy))
  ctx.rotate(rot)
  ctx.drawImage(src, -Math.round(s.w / 2), -Math.round(s.h / 2))
  ctx.restore()
}

// ───────────────────────── 플레이어 (원시인 형제) ─────────────────────────

const P_HEAD = [
  '....hhhhhh......',
  '..hhhhhhhhhh....',
  '.hhhhhhhhhhhh...',
  '.hhHssssssshh...',
  '.hHsssksssks....',
  '..hssssssssS....',
  '..hsssSkkkSs....',
  '...sssssssS.....',
]
const P_TORSO = [
  '...ssssssss.....',
  '..sssSssssSss...',
  '.ss.ssssssss.ss.',
  '.ss.pppPpppp.ss.',
  '.Ss.pPppppPp.sS.',
  '....ppppPppp....',
]
const P_TORSO_THROW = [
  '...ssssssss.....',
  '..sssSssssSsssss',
  '.ss.ssssssss..SS',
  '.ss.pppPpppp....',
  '.Ss.pPppppPp....',
  '....ppppPppp....',
]
const P_TORSO_UP = [
  '..ss.ssssssss.ss',
  '..ss.sSssssSs.ss',
  '.....ssssssss...',
  '....pppPpppp....',
  '....pPppppPp....',
  '....ppppPppp....',
]
const P_LEGS_IDLE = [
  '....pPpp.pPp....',
  '....sss..sss....',
  '....sss..sss....',
  '....SsS..SsS....',
  '...kSSS..SSSk...',
  '...kkkk..kkkk...',
]
const P_LEGS_RUN = [
  '...pPpp..pPp....',
  '..sss.....sss...',
  '.sss.......sss..',
  '.SS.........SS..',
  'kSS.........SSk.',
  'kkk..........kk.',
]
const P_LEGS_RUN2 = [
  '....pPppPpp.....',
  '.....ssssss.....',
  '.....sss.ss.....',
  '....SsS..SS.....',
  '...kSSS..SSk....',
  '...kkkk..kkk....',
]
const P_LEGS_JUMP = [
  '..sssPpp.sss....',
  '..SSs....SSs....',
  '..kkk....kkk....',
  '................',
  '................',
  '................',
]

export interface PlayerSprites {
  idle: Sprite
  run1: Sprite
  run2: Sprite
  jump: Sprite
  throw: Sprite
  throwUp: Sprite
}

export function makePlayerSprites(hair: string, hairDark: string): PlayerSprites {
  const pal: Palette = {
    h: hair,
    H: hairDark,
    s: '#f2b78a',
    S: '#c9875a',
    k: '#2b1a12',
    w: '#ffffff',
    p: '#e9a23b',
    P: '#7a4415',
  }
  const mk = (torso: string[], legs: string[]) => makeSprite([...P_HEAD, ...torso, ...legs], pal)
  return {
    idle: mk(P_TORSO, P_LEGS_IDLE),
    run1: mk(P_TORSO, P_LEGS_RUN),
    run2: mk(P_TORSO, P_LEGS_RUN2),
    jump: mk(P_TORSO_UP, P_LEGS_JUMP),
    throw: mk(P_TORSO_THROW, P_LEGS_IDLE),
    throwUp: mk(P_TORSO_UP, P_LEGS_IDLE),
  }
}

// ───────────────────────── 적: 네안데르탈 몽둥이맨 ─────────────────────────

const CAVE_TOP = [
  '......hhhhh.......',
  '....hhhhhhhhh.....',
  '...hhhhhhhhhhh....',
  '...hSSSSSSSShh....',
  '...hsksssskss.....',
  '...hssssSsssss....',
  '....sskkkkkss.....',
  '....ssssssss......',
  '..sssssssssssss...',
  '.ssssSssssssSsss..',
  '.sss.ssssssss.sss.',
  '.SSs.pppPpppp.SS..',
  '.....pPppppPp.....',
  '.....ppppPppp.....',
]
const CAVE_LEGS1 = [
  '.....ppp...ppp....',
  '.....sss...sss....',
  '.....sss...sss....',
  '.....SSS...SSS....',
  '....kSSS...SSSk...',
  '....kkkk...kkkk...',
]
const CAVE_LEGS2 = [
  '....ppp.....ppp...',
  '...sss.......sss..',
  '...sss.......sss..',
  '...SSS.......SSS..',
  '..kSSS.......SSSk.',
  '..kkkk.......kkkk.',
]

const CAVE_PAL: Palette = {
  h: '#3d2a1e',
  S: '#7d4f2c',
  s: '#b8875a',
  k: '#22140c',
  p: '#8a8a78',
  P: '#4b4b40',
}

// ───────────────────────── 적: 랩터 ─────────────────────────
const RAPTOR_TOP = [
  '................gggg....',
  '...............gggwkg...',
  '..............gggggggggg',
  'G............ggggrrrr...',
  'GG..........gggggwwgg...',
  '.GGg.......gggggg.......',
  '..GGgg...ggggggg........',
  '...GGgggggggggggg.......',
  '....Gggggyyyyggg.k......',
  '.....ggggyyyyyggk.......',
  '......gggggyygg.........',
]
const RAPTOR_LEGS1 = [
  '.......GGg..gGG.........',
  '.......Gg....gG.........',
  '......GG......GG........',
  '.....kk........kk.......',
]
const RAPTOR_LEGS2 = [
  '.......GGgggGG..........',
  '........GgGg............',
  '.......GG..GG...........',
  '......kk..kk............',
]
const RAPTOR_PAL: Palette = {
  g: '#5fae3e',
  G: '#2f6a28',
  y: '#e0d77a',
  k: '#2a1a10',
  w: '#ffffff',
  r: '#c0392b',
}

// ───────────────────────── 적: 익룡 ─────────────────────────
const PTERO1 = [
  'B..................B....',
  'BB................BB....',
  '.BBb............bBB.....',
  '..BBbb........bbBB......',
  '...BBbbb....bbbBB.......',
  '....BBbbbbbbbbBB..bb....',
  '.....BBbbbbbbbB..bwkb...',
  '......bbbbbbbbbbbbbbyyyy',
  '.......bbbbbbbbb..yyy...',
  '........kk..kk..........',
]
const PTERO2 = [
  '........................',
  '........................',
  '...................bb...',
  '..................bwkb..',
  '.......bbbbbbbbbbbbbbyyy',
  '....BBbbbbbbbbbbbB.yyy..',
  '..BBbbbbbbbbbbbbbbBB....',
  '.BBb....bbbbbbb....bBB..',
  'BB......kk..kk......BB..',
  'B....................B..',
]
const PTERO_PAL: Palette = {
  b: '#b0689a',
  B: '#6a3060',
  y: '#f0b840',
  k: '#2a1a10',
  w: '#ffffff',
}

// ───────────────────────── 아이템 ─────────────────────────
const MEAT = [
  '...rrrr...',
  '..rrrrrr..',
  '.rrRrrrrr.',
  '.rrrrrRrr.',
  '.rrrrrrrr.',
  '..rrrrrr..',
  '...rrrrww.',
  '......wwww',
  '.......ww.',
]
const BIGMEAT = [
  '....rrrrrr....',
  '..rrrrrrrrrr..',
  '.rrRrrrrrrRrr.',
  'rrrrrrRrrrrrrr',
  'rrRrrrrrrrrrrr',
  'rrrrrrrrrRrrr.',
  '.rrrrrrrrrrr..',
  '..rrrrrrrrww..',
  '....rrrr.wwww.',
  '..........ww..',
]
const FRUIT = [
  '.....g....',
  '....gL....',
  '..rrrrr...',
  '.rrwrrrr..',
  '.rrrrrrr..',
  '.rrrrrRr..',
  '..rrrRr...',
  '...rrr....',
]
const BONE_ITEM = [
  'ww......ww',
  'www....www',
  '.wwwwwwww.',
  'www....www',
  'ww......ww',
]
const TORCH_ITEM = [
  '...oy...',
  '..oyyo..',
  '.oyyyyo.',
  '..oyyo..',
  '...cc...',
  '...cc...',
  '...cc...',
  '...cc...',
]
const ITEM_PAL: Palette = {
  r: '#d9483b',
  R: '#ff8c6b',
  w: '#f5f0e0',
  g: '#4a8a2a',
  L: '#7cc04a',
  o: '#ff7a1a',
  y: '#ffe14a',
  c: '#8b5a2b',
}

export interface SpriteBank {
  p1: PlayerSprites
  cave1: Sprite
  cave2: Sprite
  raptor1: Sprite
  raptor2: Sprite
  ptero1: Sprite
  ptero2: Sprite
  meat: Sprite
  bigmeat: Sprite
  fruit: Sprite
  bone: Sprite
  torch: Sprite
}

let bank: SpriteBank | null = null

export function sprites(): SpriteBank {
  if (bank) return bank
  bank = {
    p1: makePlayerSprites('#ff7a1a', '#b84a00'),
    cave1: makeSprite([...CAVE_TOP, ...CAVE_LEGS1], CAVE_PAL),
    cave2: makeSprite([...CAVE_TOP, ...CAVE_LEGS2], CAVE_PAL),
    raptor1: makeSprite([...RAPTOR_TOP, ...RAPTOR_LEGS1], RAPTOR_PAL),
    raptor2: makeSprite([...RAPTOR_TOP, ...RAPTOR_LEGS2], RAPTOR_PAL),
    ptero1: makeSprite(PTERO1, PTERO_PAL),
    ptero2: makeSprite(PTERO2, PTERO_PAL),
    meat: makeSprite(MEAT, ITEM_PAL),
    bigmeat: makeSprite(BIGMEAT, ITEM_PAL),
    fruit: makeSprite(FRUIT, ITEM_PAL),
    bone: makeSprite(BONE_ITEM, ITEM_PAL),
    torch: makeSprite(TORCH_ITEM, ITEM_PAL),
  }
  return bank
}
