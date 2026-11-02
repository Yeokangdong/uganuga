import {CHARACTER_SCALE} from './constants'

export type Weapon='axe'|'stone'|'bone'|'fire'
export const WEAPON_NAME:Record<Weapon,string>={axe:'나무몽둥이',stone:'돌몽둥이',bone:'뼈몽둥이',fire:'불몽둥이'}
export const WEAPON_STAT:Record<Weapon,{reach:number;dmg:number;time:number}>={
  axe:{reach:20*CHARACTER_SCALE,dmg:1,time:.3},
  stone:{reach:19*CHARACTER_SCALE,dmg:3,time:.42},
  bone:{reach:27*CHARACTER_SCALE,dmg:2,time:.26},
  fire:{reach:22*CHARACTER_SCALE,dmg:3,time:.3},
}
export const isWeapon=(kind:string):kind is Weapon=>Object.prototype.hasOwnProperty.call(WEAPON_STAT,kind)
export const WEAPON_DROP_RATE=.03
export function rollWeaponDrop(random:()=>number=Math.random):Weapon|null {
  const r=random()
  if(r<0||r>=WEAPON_DROP_RATE)return null
  return r<.012?'stone':r<.021?'bone':r<.027?'fire':'axe'
}

