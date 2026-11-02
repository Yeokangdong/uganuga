export const VIEW_W = 384
export const VIEW_H = 216
export const TILE = 16
/** 화면 해상도 배율 (월드 384x216 → 캔버스 1536x864) */
export const SCALE = 4
export const GRAVITY = 1200
export const MAX_FALL = 480
/** 캐릭터는 달리지 않고 걷는다 */
export const CHARACTER_SCALE = 0.75
export const RUN_SPEED = 120 * CHARACTER_SCALE
export const CLIMB_SPEED = 60 * CHARACTER_SCALE
export const JUMP_VEL = 340
export const CHARGE_TIME = 0.7
export const STEP = 1 / 60
export const MAX_OXYGEN = 20
export const SWIM_SPEED = 78

export function approach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(v + delta, target)
  if (v > target) return Math.max(v - delta, target)
  return v
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** 결정적 난수 (레벨/배경 생성용) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
