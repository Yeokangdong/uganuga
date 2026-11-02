/** Each reward slot independently rolls one of the four requested cave rewards. */
export const CAVE_REWARDS=['clock','cross','meat','fruit'] as const
export type CaveReward=typeof CAVE_REWARDS[number]
export function rollCaveReward(random:()=>number=Math.random):CaveReward {
  return CAVE_REWARDS[Math.max(0,Math.min(3,Math.floor(random()*4)))]!
}
export function caveRewardCount(random:()=>number=Math.random):number {
  return 1+Math.max(0,Math.min(2,Math.floor(random()*3)))
}
export function addCaveLife(lives:number):number {return Math.min(9,lives+1)}
