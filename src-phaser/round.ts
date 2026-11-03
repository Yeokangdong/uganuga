import type { Game } from '../src/game/game'

/** Explicit compatibility interface for the existing single-round rules. */
export type RoundRuntime = {
  saved: { door: { x:number; floor:number } } | null
  doors: { x:number; floor:number; used:boolean; id:number }[]
  spawn():void
  enterCave(door:RoundRuntime['doors'][number]):void
  exitCave():void
  drawDoors(ctx:CanvasRenderingContext2D,x:number,y:number):void
  updateTimer(dt:number):void
  updateCamera(dt:number):void
  startBoss():void
  completeStage():void
  checkAmbush():void
}
// Private legacy methods remain behind this one boundary; no second rules engine.
export const round = (game:Game) => game as unknown as RoundRuntime
export function spawnRound(game:Game) {
  const r=round(game), all=game.level.spawns
  game.level.spawns=all.filter(s=>r.saved || ['D','?','X','^'].includes(s.kind))
  try { r.spawn() } finally { game.level.spawns=all }
  r.checkAmbush()
}

