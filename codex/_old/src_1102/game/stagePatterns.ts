import type {StageDef} from './stages'
import {TILE,type Rect} from './constants'

export const STAGE_PATTERNS=[
  ['덩굴 건너기','덩굴 끝에서 ↑ 잡기 · ← → 흔들기 · ↑ 다시 눌러 뛰기 · ↓ 놓기'],
  ['용암 바위 승강기','오르내리는 바위에 올라타 용암을 건너고 분출이 멎을 때 뛰세요.'],
  ['움직이는 유빙','흘러가는 얼음판에 올라타 다음 얼음판으로 건너뛰세요.'],
  ['가라앉는 모래 바위','올라서면 바위가 가라앉습니다. 멈추지 말고 다음 바위로 뛰세요.'],
  ['떠내려가는 통나무','좌우로 떠다니는 통나무를 타고 늪을 건너세요. 오래 타면 낮아집니다.'],
  ['대나무 탄성 도약','휘어지는 대나무 발판을 밟으면 튀어 오릅니다. 다음 발판으로 방향을 잡으세요.'],
  ['협곡 줄다리','좌우로 움직이는 밧줄 발판을 타고 반대쪽 절벽으로 뛰세요.'],
  ['수정 승강기','상하로 떠오르는 수정판을 타고 위층 길로 건너가세요.'],
  ['파도 뗏목','파도에 흔들리는 뗏목을 갈아타며 물결이 낮을 때 건너세요.'],
  ['버섯 트램펄린','버섯 발판을 밟으면 튀어 오릅니다. 공중에서 다음 버섯을 겨냥하세요.'],
  ['유적 도르래','돌판 승강기를 타고 이동하며 압착 장치가 내려오는 곳을 피하세요.'],
  ['고원 공중 발판','좌우로 왕복하는 발판을 갈아타고 낙뢰 경고 구역을 벗어나세요.'],
  ['폭포 통나무 타기','물살에 흔들리는 통나무와 폭포 물줄기를 이용해 건너세요.'],
  ['낙엽 숲 덩굴','↑로 덩굴을 잡고 ← →로 흔든 뒤 ↑를 다시 눌러 다음 가지로 뛰세요.'],
  ['부서지는 얼음','얼음판에 금이 가면 무너지기 전에 다음 얼음판으로 뛰세요.'],
  ['무너지는 현무암','밟은 바위가 갈라집니다. 화산재를 피하며 다음 바위로 건너세요.'],
  ['산호 바다 잠수','방향키로 수영하고 수면과 공기 주머니에서 숨을 회복하세요.'],
  ['구름 활공','상승기류를 타고 이동하세요. ↑를 길게 누르면 활공합니다.'],
  ['달 궤도 발판','원을 그리며 움직이는 돌판을 갈아타고 별똥별을 피하세요.'],
  ['꽃 덩굴 길','↑로 덩굴을 잡고 좌우로 흔들어 건너세요. 꽃길에서는 체력이 회복됩니다.'],
] as const

export interface PatternZone {x:number;y:number;w:number;index:number}
const cache=new WeakMap<StageDef,PatternZone[]>()
export function patternZones(def:StageDef):PatternZone[]{
  if(def.cave||def.aquatic||def.aerial)return []
  const cached=cache.get(def);if(cached)return cached
  const zones:PatternZone[]=[]
  for(let c=28;c<def.arenaCol-12;c+=44){
    for(let r=def.map.length-1;r>4;r--){
      const clear=[1,2,3].every(d=>['.','c'].includes(def.map[r-d]?.[c]??''))
      if(!clear||!['#','R','='].includes(def.map[r]?.[c]??''))continue
      if(!Array.from({length:4},(_,i)=>def.map[r]?.[c-2+i]).every(t=>['#','R','='].includes(t??'')))continue
      zones.push({x:(c-2)*TILE,y:r*TILE,w:4*TILE,index:zones.length});break
    }
  }
  cache.set(def,zones);return zones
}
export function localZone(def:StageDef,body:Rect):PatternZone|undefined {
  return patternZones(def).find(z=>body.x+body.w>z.x&&body.x<z.x+z.w&&Math.abs(body.y+body.h-z.y)<8)
}
export function patternMovement(def:StageDef,time:number,body:Rect&{onGround:boolean}){
  const m={speed:1,gravity:1,jump:1,climb:1,wind:0,fallCap:480,slip:false,bounce:0}
  if(def.cave||body.x>=def.arenaCol*TILE)return m
  const zone=localZone(def,body),t=Number.isFinite(time)?time:0
  switch(def.id){
    case 1:m.climb=1.45;break
    case 3:m.slip=true;break
    case 4:if(t%9>3){m.wind=-24;m.speed=body.onGround?.8:1}break
    case 5:if(zone&&body.onGround)m.speed=.48;break
    case 6:if(zone)m.jump=1.35;break
    case 7:m.wind=Math.sin(t*.9)*32;break
    case 8:if(zone&&t%6<3)m.jump=1.4;break
    case 10:if(zone)m.bounce=350;break
    case 13:if(patternZones(def).some(z=>body.x+body.w>z.x&&body.x<z.x+z.w)){m.jump=1.2;m.gravity=.55;m.fallCap=115}break
    case 14:if(!body.onGround){m.fallCap=95;m.wind=18}break
    case 15:if(t%10<4)m.gravity=.58;break
    case 19:m.gravity=.65;break
  }
  return m
}
export function patternHazard(def:StageDef,time:number,z:PatternZone):{phase:'rest'|'warn'|'active';progress:number;rect:Rect;color:string}{
  const ids=[2,9,11,12,16,19],active=ids.includes(def.id)&&!def.cave
  const period=def.id===12?6.5:def.id===9?5:7
  const cycle=((time+z.index*.83)%period+period)%period
  const phase=!active||cycle<period-2?'rest':cycle<period-1?'warn':'active'
  const progress=cycle-(period-1)
  const height=def.id===9?14:def.id===11?65:90
  const rect={x:z.x,y:z.y-height,w:z.w,h:height}
  if(def.id===16||def.id===19){rect.x=z.x+z.w*.5-9;rect.y=z.y-112+Math.max(0,progress)*112;rect.w=18;rect.h=20}
  return {phase,progress,rect,color:({2:'#ff864c',9:'#80ddff',11:'#edcd7d',12:'#fff0a4',16:'#d4a098',19:'#dcc4ff'} as Record<number,string>)[def.id]??'#bbefb7'}
}
