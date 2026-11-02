/** Hand-authored routes: one cell = 16 world pixels; no mirrored/repeated chunks. */
import type { ProjKind } from './entities'
export const ROWS = 14

type Span = [number, number, number]
type Mark = [number, number, string]
interface Route { w: number; ground?: Span[]; gaps?: [number, number][]; water?: [number, number][]; shelves?: Span[]; ladders?: Span[]; logs?: Span[]; marks?: Mark[] }
function route(a: Route): string[] {
  const g = Array.from({length: ROWS}, () => Array<string>(a.w).fill('.'))
  const ground = a.ground ?? [[0, a.w - 1, 11]]
  for (const [l,r,y] of ground) for(let c=l;c<=r;c++) for(let row=y;row<ROWS;row++) g[row][c]='#'
  for (const [l,r] of a.gaps ?? []) for(let c=l;c<=r;c++) for(let y=0;y<ROWS;y++) g[y][c]='.'
  for (const [l,r] of a.water ?? []) for(let c=l;c<=r;c++) for(let y=11;y<ROWS;y++) g[y][c]='w'
  for (const [l,r,y] of a.shelves ?? []) {
    for(let c=l;c<=r;c++) { for(let row=y+1;row<ROWS && g[row][c]!=='#' && g[row][c]!=='w';row++) if(g[row][c]==='.') g[row][c]='c'; g[y][c]='R' }
  }
  // Narrow shafts: one cell, with collision and artwork using the same endpoints.
  for (const [c,top,bottom] of a.ladders ?? []) for(let y=top;y<bottom;y++) { g[y][c]='H'; g[y][c+1]='H' }
  for (const [l,r,y] of a.logs ?? []) for(let c=l;c<=r;c++) g[y][c]='='
  for (const [c,y,k] of a.marks ?? []) g[y][c]=k
  return g.map(r=>r.join(''))
}
const jungle = route({w:196,ground:[[0,77,11],[80,114,12],[117,144,11],[147,195,11]],gaps:[[78,79],[115,116]],water:[[145,146],[151,152],[157,158],[163,164]],
 shelves:[[18,38,8],[23,34,5],[44,54,8],[57,68,8],[83,104,9],[87,98,6],[122,138,8],[125,135,5],[172,187,8]],
 ladders:[[20,8,11],[29,5,8],[49,8,11],[63,8,11],[90,6,12],[130,5,11],[179,8,11]],
 logs:[[55,56,8]], marks:[[26,10,'E'],[32,7,'D'],[33,4,'m'],[47,7,'M'],[52,10,'D'],[60,7,'m'],[66,7,'^'],[86,11,'U'],[96,8,'D'],[93,5,'f'],[102,5,'k'],[125,7,'M'],[132,4,'b'],[136,7,'D'],[148,5,'F'],[160,6,'F'],[174,10,'E'],[184,7,'m'],[183,10,'D'],[188,10,'k']]})
const volcano = route({w:204,ground:[[0,40,11],[43,71,12],[74,115,11],[118,154,12],[157,203,11]],gaps:[[41,42],[116,117]],water:[[72,73],[155,156],[161,162],[167,168]],
 shelves:[[14,32,8],[19,28,5],[47,65,9],[52,62,6],[81,101,8],[84,94,5],[121,144,9],[129,140,6],[177,195,8]],
 ladders:[[16,8,11],[24,5,8],[50,9,12],[57,6,9],[88,5,11],[124,9,12],[135,6,9],[182,8,11]],
 logs:[[102,108,8]], marks:[[21,10,'E'],[27,7,'D'],[26,4,'b'],[36,10,'X'],[53,11,'M'],[61,8,'D'],[59,5,'m'],[67,11,'m'],[83,7,'E'],[91,4,'k'],[99,7,'^'],[110,10,'D'],[126,11,'U'],[133,8,'D'],[138,5,'m'],[145,11,'X'],[159,5,'F'],[166,5,'F'],[179,10,'E'],[190,7,'m'],[193,10,'D']]})
const glacier = route({w:208,ground:[[0,46,11],[49,78,12],[81,124,11],[127,161,12],[164,207,11]],gaps:[[47,48],[125,126]],water:[[79,80],[162,163],[169,170],[176,177]],
 shelves:[[16,37,8],[22,33,5],[53,71,9],[57,67,6],[90,112,8],[95,105,5],[132,151,9],[138,147,6],[184,199,8]],
 ladders:[[19,8,11],[27,5,8],[55,9,12],[62,6,9],[98,5,11],[135,9,12],[143,6,9],[190,8,11]],
 logs:[[113,118,8]], marks:[[25,10,'E'],[32,7,'D'],[30,4,'m'],[36,7,'^'],[59,11,'U'],[65,8,'D'],[64,5,'k'],[72,11,'m'],[93,7,'M'],[103,4,'b'],[108,7,'D'],[116,7,'m'],[139,11,'E'],[146,8,'D'],[145,5,'f'],[165,5,'F'],[174,6,'F'],[187,10,'M'],[195,7,'m'],[198,10,'D']]})
const home = route({w:126,ground:[[0,31,11],[34,62,12],[65,91,11],[94,125,11]],gaps:[[32,33],[63,64]],water:[[92,93]],shelves:[[12,28,8],[41,58,9],[46,54,6],[72,86,8],[102,116,8]],ladders:[[17,8,11],[44,9,12],[50,6,9],[77,8,11],[108,8,11]],marks:[[22,7,'D'],[25,10,'E'],[48,11,'M'],[52,5,'k'],[57,8,'D'],[78,7,'U'],[82,10,'m'],[89,5,'F'],[106,7,'D'],[112,7,'m']]})
const arena = route({w:24})
export type EnemyClass = 'melee' | 'thrower' | 'runner' | 'flyer' | 'charger'

export interface EnemyCfg {
  cls: EnemyClass
  /** 일러스트 키 접두어 (예: 'caveman' → caveman.walk) */
  key: string
  hp: number
  score: number
  speed: number
  w: number
  h: number
  /** 던지는 적의 투사체 */
  proj?: ProjKind
}

export interface BossCfg {
  key: string
  name: string
  hp: number
  w: number
  h: number
  /** 기준 표시 높이 (일러스트 없을 때 도트 보스 크기) */
  chargeSpeed: number
  spit: ProjKind
  drop: ProjKind
  /** 패턴 가중치 */
  moves: { charge: number; spit: number; jump: number; roar: number }
}

export interface Theme {
  /** 일러스트 키 번호: '' = 스테이지1, '2', '3' */
  n: '' | '2' | '3'
  /** 일러스트가 아직 없을 때 스테이지1 그림 위에 덮을 색 */
  tint: string | null
  /** 물(w) 색 */
  water: string
  props: [string, number][]
}

export interface StageDef {
  id: number
  title: string
  sub: string
  map: string[]
  arenaCol: number
  theme: Theme
  roles: Partial<Record<'E' | 'M' | 'U' | 'F', EnemyCfg>>
  boss: BossCfg
  /** 무기 아이템 (b 표시 / 동굴 보물) */
  weapon: 'bone' | 'fire'
  kind?: 'explore' | 'boss'
  final?: boolean
  /** 얼음 바닥: 미끄러움 */
  icy?: boolean
  /** 동굴 방 (별도 화면) */
  cave?: boolean
}


/** Small fixed-screen cave. Revisits preserve the collected items and hazards. */
export function makeCaveRoom(base: StageDef, seed: number): StageDef {
  const v = seed % 4
  const marks: Mark[] = [[6,11,'X'],[12,11,'X'],[17,11,'f'],[19,11,'m']]
  if(v===1 || v===3) marks.push([15,3,'S'])
  if(v===2) marks.push([9,11,'k'])
  if(v===3) marks.push([9,11,'b'])
  const map=route({w:22,ground:[[0,21,12]],marks}).map((r,y)=>y<3?'R'.repeat(22): y<12?'R'+r.slice(1,-1)+'R':r)
  return {...base,map,arenaCol:21,cave:true,kind:'explore',final:false,icy:false}
}
const SMALL: EnemyCfg = {cls:'melee',key:'dino1_0',hp:3,score:100,speed:42,w:14,h:20}
const RUNNER: EnemyCfg = {cls:'runner',key:'dino1_1',hp:2,score:150,speed:70,w:20,h:17}
const FLY: EnemyCfg = {cls:'flyer',key:'dino1_2',hp:2,score:150,speed:46,w:18,h:14}
const FIRE: EnemyCfg = {cls:'thrower',key:'dino2_0',hp:3,score:150,speed:30,w:14,h:20,proj:'lavarock'}
const LIZARD: EnemyCfg = {cls:'runner',key:'dino2_1',hp:2,score:150,speed:76,w:20,h:17}
const BAT: EnemyCfg = {cls:'flyer',key:'dino2_2',hp:2,score:150,speed:50,w:18,h:14}
const SPEAR: EnemyCfg = {cls:'thrower',key:'dino3_0',hp:3,score:150,speed:30,w:14,h:20,proj:'spear'}
const SABER: EnemyCfg = {cls:'runner',key:'dino3_1',hp:3,score:200,speed:80,w:22,h:17}
const HEAVY: EnemyCfg = {cls:'charger',key:'dino3_1',hp:4,score:250,speed:26,w:24,h:20}
const themes: Theme[] = [
 {n:'',tint:null,water:'#2f8fd8',props:[['prop.palm',.05],['prop.bush',.09],['prop.fern',.14]]},
 {n:'2',tint:null,water:'#ff5a1a',props:[['prop2.tree',.04],['prop2.vent',.07],['prop2.rock',.12]]},
 {n:'3',tint:null,water:'#7fd0ff',props:[['prop3.pine',.05],['prop3.crystal',.09],['prop3.bush',.13]]}
]
const bosses: BossCfg[] = [
 {key:'boss',name:'폭군룡 쿵쾅이',hp:24,w:70,h:62,chargeSpeed:175,spit:'fireball',drop:'rock',moves:{charge:1,spit:1,jump:1,roar:1}},
 {key:'boss2',name:'용암룡 들이박',hp:45,w:76,h:58,chargeSpeed:195,spit:'lavablob',drop:'lavarock',moves:{charge:2,spit:1,jump:1,roar:.5}},
 {key:'boss3',name:'빙하룡 만년설',hp:36,w:82,h:68,chargeSpeed:185,spit:'iceball',drop:'icicle',moves:{charge:1.3,spit:1,jump:1,roar:.5}}
]
const areas = [jungle,volcano,glacier]
const roles: StageDef['roles'][] = [
 {E:SMALL,M:{...SMALL,key:'bear',hp:4,score:200,w:20,h:20},U:{...RUNNER,key:'boar'},F:FLY},
 {E:FIRE,M:{...FIRE,cls:'melee',key:'bear',hp:4,score:200},U:LIZARD,F:BAT},
 {E:SPEAR,M:HEAVY,U:{...SABER,key:'boar'},F:{...BAT,key:'dino3_2'}}
]
export const STAGES: StageDef[] = []
for(let a=0;a<3;a++) {
  const common={theme:themes[a]!,roles:roles[a]!,boss:bosses[a]!,weapon:(a===1?'fire':'bone') as 'fire'|'bone',icy:a===2}
  STAGES.push({...common,id:a*2+1,title:`STAGE ${a*2+1}`,sub:['원시 정글','불타는 화산','얼어붙은 빙하'][a]!,kind:'explore',map:areas[a]!,arenaCol:areas[a]![0]!.length-6})
  STAGES.push({...common,id:a*2+2,title:`STAGE ${a*2+2}`,sub:bosses[a]!.name,kind:'boss',map:arena,arenaCol:0})
}
STAGES.push({...STAGES[0]!,id:7,title:'STAGE 7',sub:'누가 공주를 찾아서',kind:'explore',final:true,map:home,arenaCol:home[0]!.length-6})
