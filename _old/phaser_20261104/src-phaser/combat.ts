import { ContactAnimal, Item, type Player } from '../src/game/entities'
import type { Game } from '../src/game/game'
import { has } from '../src/game/art'
import { VIEW_W, TILE } from '../src/game/constants'

/** Stage-four contract: three distinct swings, then two finishing swings. */
export class CombatEnemy extends ContactAnimal {
  override hit(g:Game,_damage:number,fromX:number,by:Player|null) {
    if(this.dead||this.dying||this.invulnerable||this.flash>0)return
    if(this.stunT>0&&this.finishHits===0)this.finishHits=1
    super.hit(g,1,fromX,by)
  }
}
export function spawnCombat(g:Game) {
  for(const spawn of g.level.spawns){
    const x=spawn.col*TILE
    if(spawn.done||x>g.camX+VIEW_W+8)continue
    const cfg=spawn.cfg??g.stage.roles[spawn.kind as 'E'|'M'|'U'|'F']
    if(['A','E','M','U','F','S'].includes(spawn.kind)&&cfg){
      if(g.enemies.filter(e=>!e.dead&&e.x+e.w>g.camX&&e.x<g.camX+VIEW_W).length>=2)continue
      if(x<g.camX+8||g.players.some(p=>Math.abs(p.cx-x)<96))continue
      const rawFloor=g.level.floorBelow(x+8,spawn.row*TILE)
      const placement=g.level.findCombatPlacement(x,rawFloor,cfg.w*1.5,cfg.h*1.5)
      if(!placement||Math.abs(placement.x-x)>32)continue
      const floor=placement.floor
      if(g.players.some(p=>Math.abs(p.cx-placement.x)<96))continue
      if(floor<g.camY||floor>g.camY+216)continue
      const key=has(cfg.key+'.walk')?cfg.key:cfg.fallbackKey??'dino1_0'
      g.enemies.push(new CombatEnemy({...cfg,key,score:100,hp:3},placement.x,floor-cfg.h))
      spawn.done=true
    }else if(spawn.kind==='k'){
      g.items.push(new Item('clock',x+2,g.level.floorBelow(x+8,spawn.row*TILE)-12,false,g.stage.theme.n))
      spawn.done=true
    }
  }
}
