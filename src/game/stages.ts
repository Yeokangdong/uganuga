import type { ProjKind } from './entities'
import { WORLD_CAST } from './world-cast'
import {planEncounters} from './encounterPlan'
import { caveRewardCount } from './caveRewards'
export const ROWS = 24

type Span = [number, number, number]
export type MapLayout=string[]&{ladders?:Span[]}
type Mark = [number, number, string]
interface Island {x:number;top:number[];depth:number}
interface Route { w: number; h?:number; islands?:Island[]; ground?: Span[]; gaps?: [number, number][]; cutouts?: Span[]; water?: [number, number][]; shelves?: Span[]; ladders?: Span[]; logs?: Span[]; marks?: Mark[] }
const contour=(...bands:[number,number][])=>bands.flatMap(([length,row])=>Array<number>(length).fill(row))
const island=(x:number,depth:number,...bands:[number,number][]):Island=>({x,depth,top:contour(...bands)})
const link=(col:number,upper:Island,lower:Island|number):Span=>[col,upper.top[col-upper.x]!,typeof lower==='number'?lower:lower.top[col-lower.x]!]
function route(a: Route): MapLayout {
  const height=a.h??14
  const g = Array.from({length: height}, () => Array<string>(a.w).fill('.'))
  const ground = a.ground ?? [[0, a.w - 1, 11]]
  for (const [l,r,y] of ground) for(let c=l;c<=r;c++) for(let row=y;row<height;row++) g[row][c]='#'
  for(const body of a.islands??[])for(let j=0;j<body.top.length;j++){
    const c=body.x+j,top=body.top[j]!
    // Elevated routes are thin timber decks. Their underside is open space,
    // never a floating volume of earth with invisible solid walls.
    if(g[top]?.[c]==='.')g[top][c]='='
  }
  for (const [l,r] of a.gaps ?? []) for(let c=l;c<=r;c++) for(let y=0;y<height;y++) g[y][c]='.'
  for(const[l,r,top]of a.cutouts??[])for(let c=l;c<=r;c++)for(let y=top;y<height;y++)g[y][c]='.'
  for (const [l,r] of a.water ?? []) for(let c=l;c<=r;c++) {
    const top=g.findIndex(row=>row[c]==='#');for(let y=top<0?height-3:top;y<height;y++)g[y][c]='w'
  }
  for (const [l,r,y] of a.shelves ?? []) {
    for(let c=l;c<=r;c++) { for(let row=y+1;row<height && g[row][c]!=='#' && g[row][c]!=='w';row++) if(g[row][c]==='.') g[row][c]='c'; g[y][c]='R' }
  }
  for (const [l,r,y] of a.logs ?? []) for(let c=l;c<=r;c++) g[y][c]='='
  for (const [c,y,k] of a.marks ?? []) {if(k==='m'||k==='f')continue;if(k!=='F'&&!g.some((line,r)=>r>y&&['#','R','=','w'].includes(line[c]!)))continue;let row=y;while(row>0&&g[row][c]!=='.'&&g[row][c]!=='c')row--;g[row][c]=k}
  return Object.assign(g.map(r=>r.join('')),{ladders:a.ladders??[]})
}
// Three traversable heights; each outcrop has its own stepped crest and tapered belly.
const j1=island(12,4,[2,17],[2,16],[2,15],[8,14],[7,13],[8,14],[2,15],[2,16],[2,17])
const j2=island(24,3,[2,9],[2,8],[8,7],[2,8],[2,9])
const j3=island(62,5,[4,17],[4,16],[8,15],[6,14],[6,15],[4,16],[4,17])
const j4=island(73,3,[2,10],[2,9],[10,8],[2,9],[2,10])
const j5=island(118,4,[3,17],[3,16],[4,15],[8,14],[6,13],[5,14],[3,15],[3,16])
const j6=island(130,3,[2,9],[2,8],[8,7],[3,8],[2,9])
const jungle=route({w:196,h:ROWS,ground:[[0,24,21],[25,38,20],[39,55,21],[56,67,22],[68,101,21],[102,111,20],[112,143,21],[144,167,22],[168,195,21]],
 islands:[j1,j2,j3,j4,j5,j6],cutouts:[[24,41,19],[32,37,12],[74,91,19],[82,88,12],[130,148,19],[138,144,12]],gaps:[[53,54],[109,110]],water:[[155,156],[163,164]],
 ladders:[link(20,j1,21),link(30,j2,j1),link(38,j2,j1),link(70,j3,21),link(80,j4,j3),link(89,j4,j3),link(126,j5,21),link(136,j6,j5),link(145,j6,j5)],
 logs:[[49,52,18],[98,101,17]],marks:[[9,20,'E'],[17,13,'M'],[28,6,'E'],[34,6,'f'],[38,12,'E'],[60,21,'U'],[74,13,'M'],[83,7,'E'],[88,7,'k'],[104,19,'E'],[123,14,'U'],[134,6,'M'],[141,6,'f'],[13,20,'D'],[159,13,'F'],[173,20,'M']]})

const v1=island(8,4,[3,18],[3,17],[4,16],[8,15],[6,14],[6,15],[3,16])
const v2=island(20,4,[2,10],[3,9],[6,8],[4,7],[3,8],[2,9])
const v3=island(60,5,[3,17],[4,16],[7,15],[9,14],[6,15],[4,16])
const v4=island(72,3,[2,9],[2,8],[5,7],[6,8],[2,9])
const v5=island(119,4,[2,18],[2,17],[3,16],[9,15],[6,14],[7,15],[3,16],[3,17])
const v6=island(131,3,[3,10],[3,9],[6,8],[3,9],[3,10])
const volcano=route({w:204,h:ROWS,ground:[[0,20,21],[21,35,22],[36,51,21],[52,68,20],[69,102,21],[103,121,22],[122,149,21],[150,169,22],[170,203,21]],
 islands:[v1,v2,v3,v4,v5,v6],cutouts:[[21,37,19],[29,37,12],[72,90,19],[81,86,12],[132,150,19],[141,146,12]],gaps:[[46,47],[115,116]],water:[[39,40],[98,99],[156,157]],
 ladders:[link(17,v1,21),link(27,v2,v1),link(38,v2,v1),link(68,v3,20),link(79,v4,v3),link(87,v4,v3),link(128,v5,21),link(139,v6,v5),link(147,v6,v5)],
 logs:[[42,45,18],[105,109,18]],marks:[[6,20,'E'],[14,16,'U'],[25,8,'E'],[32,6,'k'],[57,19,'M'],[77,6,'E'],[84,7,'f'],[106,21,'X'],[121,20,'E'],[138,7,'M'],[145,8,'k'],[164,21,'M'],[11,20,'D']]})

const i1=island(12,4,[4,17],[3,16],[6,15],[7,14],[6,15],[4,16])
const i2=island(23,3,[3,10],[2,9],[7,8],[3,9],[2,10])
const i3=island(63,4,[2,18],[3,17],[4,16],[8,15],[6,14],[7,15],[3,16])
const i4=island(77,3,[2,10],[3,9],[8,8],[3,9],[2,10])
const i5=island(123,5,[4,17],[4,16],[7,15],[8,14],[6,15],[4,16])
const i6=island(136,3,[2,9],[2,8],[7,7],[3,8],[2,9])
const glacier=route({w:208,h:ROWS,ground:[[0,27,21],[28,42,20],[43,56,21],[57,78,22],[79,108,21],[109,124,20],[125,150,21],[151,174,22],[175,207,21]],
 islands:[i1,i2,i3,i4,i5,i6],cutouts:[[25,38,19],[32,37,12],[76,92,19],[87,92,12],[136,151,19],[142,149,12]],gaps:[[49,50],[117,118]],water:[[103,104],[166,167]],
 ladders:[link(21,i1,21),link(30,i2,i1),link(38,i2,i1),link(72,i3,22),link(85,i4,i3),link(93,i4,i3),link(132,i5,21),link(140,i6,i5),link(150,i6,i5)],
 logs:[[44,48,18],[111,115,17]],marks:[[8,20,'E'],[18,15,'U'],[29,7,'E'],[35,7,'f'],[60,21,'M'],[74,14,'E'],[82,7,'E'],[90,7,'k'],[111,19,'U'],[129,15,'M'],[142,6,'M'],[146,6,'f'],[15,20,'D'],[172,16,'F'],[183,20,'E']]})

const h1=island(10,4,[3,17],[3,16],[7,15],[8,14],[4,15],[3,16])
const h2=island(21,3,[2,9],[3,8],[7,7],[3,8],[2,9])
const h3=island(62,5,[3,18],[4,17],[5,16],[8,15],[6,14],[4,15],[3,16])
const h4=island(77,3,[3,10],[3,9],[7,8],[3,9],[2,10])
const home=route({w:126,h:ROWS,ground:[[0,32,21],[33,47,22],[48,73,21],[74,88,20],[89,103,21],[104,125,21]],
 islands:[h1,h2,h3,h4],cutouts:[[22,35,19],[30,35,12],[75,92,19],[87,92,12]],gaps:[[43,44],[98,99]],water:[[112,113]],
 ladders:[link(18,h1,21),link(28,h2,h1),link(36,h2,h1),link(71,h3,21),link(85,h4,h3),link(93,h4,h3)],logs:[[39,42,18],[94,97,17]],
 marks:[[7,20,'E'],[16,15,'M'],[26,6,'E'],[33,7,'f'],[66,16,'U'],[81,7,'M'],[88,7,'k'],[92,20,'E'],[106,20,'M']]})
export type EnemyClass = 'melee' | 'thrower' | 'runner' | 'flyer' | 'charger'
export type EnemyBehavior = 'patrol' | 'skirmish' | 'hopper' | 'ambush' | 'charge' | 'swoop' | 'hover' | 'sentry'

export interface EnemyCfg {
  reward?:'weapon'|'treasure'
  fallbackKey?: string
  name?: string
  behavior?: EnemyBehavior
  patrolRadius?: number
  cls: EnemyClass
  /** ?쇰윭?ㅽ듃 ???묐몢??(?? 'caveman' ??caveman.walk) */
  key: string
  hp: number
  score: number
  speed: number
  w: number
  h: number
  /** ?섏????곸쓽 ?ъ궗泥?*/
  proj?: ProjKind
}

export interface BossCfg {
  key: string
  name: string
  hp: number
  w: number
  h: number
  /** 湲곗? ?쒖떆 ?믪씠 (?쇰윭?ㅽ듃 ?놁쓣 ???꾪듃 蹂댁뒪 ?ш린) */
  chargeSpeed: number
  spit: ProjKind
  drop: ProjKind
  /** ?⑦꽩 媛以묒튂 */
  moves: { charge: number; spit: number; jump: number; roar: number }
}

export interface Theme {
  /** Music selection is independent of the legacy combat/terrain bank. */
  music?: 'jungle' | 'volcano' | 'glacier'
  /** Unique scenery ID, independent of terrain assets. */
  background: number
  /** ?쇰윭?ㅽ듃 ??踰덊샇: '' = ?ㅽ뀒?댁?1, '2', '3' */
  n: '' | '2' | '3'
  /** ?쇰윭?ㅽ듃媛 ?꾩쭅 ?놁쓣 ???ㅽ뀒?댁?1 洹몃┝ ?꾩뿉 ??쓣 ??*/
  tint: string | null
  /** 臾?w) ??*/
  water: string
  props: [string, number][]
}

export interface EncounterDef {
  col:number
  row:number
  cfg:EnemyCfg
  group:string
  facing:1|-1
}

export interface StageDef {
  firstTrail?:{climbX:number;upperClimbX:number;retryX:number;traceX:number;traceY:number;rejoinX:number}
  flood?: {start:number;end:number;floor:number;safe:number;deck:number}
  chase?: {start:number;end:number;floor:number;obstacle:number}
  aerial?: {updrafts:{col:number;row:number;w:number;h:number}[]}
  aquatic?: {surfaceRow:number;startCol:number;endCol:number;airPockets:{col:number;row:number;w:number;h:number}[]}
  encounters?:EncounterDef[]
  id: number
  title: string
  sub: string
  map: MapLayout
  arenaCol: number
  theme: Theme
  roles: Partial<Record<'E' | 'M' | 'U' | 'F', EnemyCfg>>
  boss: BossCfg
  caveEntrance: string
  /** 臾닿린 ?꾩씠??(b ?쒖떆 / ?숆뎬 蹂대Ъ) */
  weapon: 'bone' | 'fire'
  kind?: 'explore'
  final?: boolean
  /** ?쇱쓬 諛붾떏: 誘몃걚?ъ? */
  icy?: boolean
  /** ?숆뎬 諛?(蹂꾨룄 ?붾㈃) */
  cave?: boolean
}


/** A local-material reward room. Rolls once on entry; revisits keep collected items. */
export function makeCaveRoom(base: StageDef, seed: number, random:()=>number=Math.random): StageDef {
  const slots=seed%2===0?[8,13,18]:[9,14,18]
  const marks:Mark[]=slots.slice(0,caveRewardCount(random)).map(col=>[col,11,'?'])
  const map=route({w:22,ground:[[0,21,12]],marks}).map((r,y)=>y<3?'R'.repeat(22): y<12?'R'+r.slice(1,-1)+'R':r)
  return {...base,aquatic:undefined,aerial:undefined,encounters:[],map,arenaCol:21,cave:true,kind:'explore',final:false,icy:false}
}

/** Open sky under every island; wind columns connect the different altitudes. */
export function makeSkyMap():{map:MapLayout;aerial:NonNullable<StageDef['aerial']>} {
  const width=216,height=32
  const grid=Array.from({length:height},()=>Array<string>(width).fill('.'))
  const islands:[number,number,number][]=[
    [0,22,23],[27,41,21],[47,61,24],[67,83,19],[89,103,22],
    [109,125,17],[131,147,20],[153,169,23],[175,191,25],[197,215,29],
  ]
  const updrafts:NonNullable<StageDef['aerial']>['updrafts']=[]
  islands.forEach(([left,right,top],i)=>{
    for(let c=left;c<=right;c++){
      const depth=2+Math.min(2,c-left,right-c)
      for(let r=top;r<Math.min(height,top+depth);r++)grid[r]![c]='#'
    }
    if(i){
      const prev=islands[i-1]!,row=Math.min(top,prev[2])-5
      updrafts.push({col:prev[1]-1,row,w:left-prev[1]+3,h:height-row})
    }
    if(i>0&&i<9){
      const kinds=['E','M','U']
      grid[top-1]![left+8]=kinds[(i-1)%3]!
      if(i%2===0)grid[top-5]![left+4]='F'
    }
  })
  grid[22]![10]='D'
  grid[22]![17]='E'
  grid[28]![207]='M'
  return {map:Object.assign(grid.map(row=>row.join('')),{ladders:[] as Span[]}),aerial:{updrafts}}
}

/** A continuous lagoon with dry shores, a deep seabed and reachable air bells. */
export function makeUnderwaterMap(): {map:MapLayout;aquatic:NonNullable<StageDef['aquatic']>} {
  const w=200,h=32,startCol=18,endCol=175,surfaceRow=9
  const grid=Array.from({length:h},()=>Array<string>(w).fill('.'))
  for(let c=0;c<w;c++)for(let r=(c<startCol||c>endCol?9:29);r<h;r++)grid[r]![c]='#'
  for(const [c,top,width] of [[38,26,5],[68,24,6],[97,26,5],[127,25,6],[155,26,5]])
    for(let x=c!;x<c!+width!;x++)for(let r=top!;r<29;r++)grid[r]![x]='R'
  const airPockets=[34,62,90,118,146].map((col,i)=>({col,row:i%2===0?13:18,w:8,h:4}))
  for(const pocket of airPockets){
    for(let c=pocket.col-1;c<=pocket.col+pocket.w;c++)grid[pocket.row-1]![c]='R'
    for(let r=pocket.row;r<pocket.row+pocket.h;r++)for(const c of [pocket.col-1,pocket.col+pocket.w])grid[r]![c]='R'
  }
  const marks:Mark[]=[[10,8,'D'],[14,8,'E'],[30,28,'E'],[50,28,'M'],[61,28,'U'],[54,20,'F'],
    [77,28,'E'],[88,28,'M'],[108,28,'U'],[105,19,'F'],[138,28,'E'],[145,28,'M'],[164,28,'U'],[159,20,'F'],[185,8,'M']]
  for(const [c,r,k]of marks)grid[r]![c]=k
  return {map:Object.assign(grid.map(row=>row.join('')),{ladders:[] as Span[]}),aquatic:{surfaceRow,startCol,endCol,airPockets}}
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
 {background:1,n:'',tint:null,water:'#2f8fd8',props:[['prop.palm',.05],['prop.bush',.09],['prop.fern',.14]]},
 {background:2,n:'2',tint:null,water:'#ff5a1a',props:[['prop2.tree',.04],['prop2.vent',.07],['prop2.rock',.12]]},
 {background:3,n:'3',tint:null,water:'#7fd0ff',props:[['prop3.pine',.05],['prop3.crystal',.09],['prop3.bush',.13]]}
]
const bosses: BossCfg[] = [
 {key:'boss',name:'폭군룡 쿵쾅이',hp:24,w:70,h:62,chargeSpeed:175,spit:'fireball',drop:'rock',moves:{charge:1,spit:1,jump:1,roar:1}},
 {key:'boss2',name:'용암룡 들이박',hp:45,w:76,h:58,chargeSpeed:195,spit:'lavablob',drop:'lavarock',moves:{charge:2,spit:1,jump:1,roar:.5}},
 {key:'boss3',name:'빙하룡 만년설',hp:36,w:82,h:68,chargeSpeed:185,spit:'iceball',drop:'icicle',moves:{charge:1.3,spit:1,jump:1,roar:.5}}
]
const areas = [jungle,volcano,glacier]
/** Continue the route into a flat clearing without changing maps or stage IDs. */
function withBossArena(map:MapLayout):MapLayout {
  const last=map[0]!.length-1,floor=map.findIndex(row=>row[last]==='#')
  return Object.assign(map.map((row,r)=>row+(r>=floor?'#':'.').repeat(24)),{ladders:map.ladders??[]})
}
/** Species have their own silhouettes, timings and tactics, not recolored aliases. */
export const BESTIARY:Record<string,EnemyCfg>={
  sprout:{...SMALL,name:'초록 아기 티라노',behavior:'patrol'},
  ptero:{...FLY,name:'정글 익룡',behavior:'swoop'},
  ember:{...FIRE,name:'불꽃 도마뱀',behavior:'sentry'},
  lavaRunner:{...LIZARD,name:'용암 질주룡',behavior:'skirmish'},
  bat:{...BAT,name:'화산 박쥐',behavior:'swoop'},
  frost:{...SPEAR,name:'서리 공룡',behavior:'sentry',proj:'iceball'},
  saber:{...SABER,name:'빙하 검치호',behavior:'skirmish'},
  iceWing:{...BAT,key:'dino3_2',name:'얼음 익룡',behavior:'hover'},
  bear:{...HEAVY,key:'bear',name:'동굴곰',behavior:'charge',speed:26},
  boar:{...RUNNER,key:'boar',name:'붉은 멧돼지',behavior:'charge'},
  spider:{cls:'melee',key:'spider',name:'덤불거미',hp:2,score:150,speed:24,w:17,h:12,behavior:'ambush'},
  scarab:{cls:'charger',key:'scarab',name:'갑옷딱정벌레',hp:4,score:220,speed:22,w:23,h:18,behavior:'charge'},
  scorpion:{cls:'melee',key:'sandScorpion',name:'모래전갈',hp:3,score:180,speed:26,w:24,h:19,behavior:'ambush'},
  frog:{cls:'runner',key:'marshFrog',name:'늪개구리',hp:2,score:160,speed:42,w:20,h:16,behavior:'hopper'},
  crab:{cls:'runner',key:'coralCrab',name:'산호집게게',hp:3,score:180,speed:35,w:22,h:17,behavior:'skirmish'},
  mushroom:{cls:'melee',key:'sporeling',name:'포자버섯',hp:2,score:150,speed:18,w:18,h:22,behavior:'hopper'},
  golem:{cls:'charger',key:'stoneGuard',name:'돌수호자',hp:5,score:300,speed:18,w:25,h:27,behavior:'charge'},
  mantis:{cls:'runner',key:'bambooMantis',name:'대나무사마귀',hp:3,score:200,speed:42,w:23,h:22,behavior:'ambush'},
  owl:{cls:'flyer',key:'moonOwl',name:'달빛부엉이',hp:2,score:180,speed:30,w:21,h:19,behavior:'swoop'},
  tortoise:{cls:'melee',key:'emberTortoise',name:'불씨등거북',hp:4,score:240,speed:15,w:23,h:17,behavior:'patrol'},
  ray:{cls:'flyer',key:'cloudRay',name:'구름가오리',hp:3,score:220,speed:28,w:29,h:17,behavior:'hover'}
}
interface Habitat {ground:string[];canopy:string[];air:string[];formation:string}
export const HABITATS:Habitat[]=[
  {ground:['sprout','scarab','boar','bear'],canopy:['spider','sprout'],air:['ptero'],formation:'정글 길목과 나뭇가지 순찰'},
  {ground:['ember','tortoise','lavaRunner','scarab'],canopy:['ember','tortoise'],air:['bat'],formation:'용암길의 거북 방벽과 화염 보초'},
  {ground:['frost','saber','bear','scarab'],canopy:['frost','saber'],air:['iceWing','owl'],formation:'설원 추격대와 얼음 보초'},
  {ground:['scorpion','scarab','tortoise','golem'],canopy:['scorpion','scarab'],air:['bat'],formation:'모래전갈 매복과 딱정벌레 쌍 순찰'},
  {ground:['frog','mushroom','spider','scarab'],canopy:['frog','spider'],air:['ptero'],formation:'물가 개구리의 엇박 도약'},
  {ground:['mantis','scarab','boar','frog'],canopy:['mantis','spider'],air:['owl','ptero'],formation:'대나무 상하단 사마귀 협공'},
  {ground:['scorpion','golem','lavaRunner','scarab'],canopy:['scorpion','golem'],air:['ptero','bat'],formation:'협곡 수호자와 공중 급강하'},
  {ground:['golem','frost','scarab','mushroom'],canopy:['frost','mushroom'],air:['iceWing','ray'],formation:'수정 수호자 뒤의 원거리 보초'},
  {ground:['crab','frog','scarab','boar'],canopy:['crab','frog'],air:['ptero','ray'],formation:'해안 집게게 무리와 저공 활공'},
  {ground:['mushroom','spider','frog','mantis'],canopy:['mushroom','spider'],air:['owl','bat'],formation:'버섯 도약대와 야행성 사냥꾼'},
  {ground:['golem','scarab','scorpion','mantis'],canopy:['golem','mantis'],air:['owl','bat'],formation:'유적의 돌수호자와 매복 경비'},
  {ground:['boar','golem','saber','scarab'],canopy:['scarab','golem'],air:['ray','ptero'],formation:'고원의 교대 돌진과 가오리 편대'},
  {ground:['frog','crab','mantis','sprout'],canopy:['frog','mantis'],air:['ray','ptero'],formation:'폭포 발판의 개구리 도약전'},
  {ground:['boar','bear','scarab','mushroom'],canopy:['mantis','mushroom'],air:['owl'],formation:'단풍 숲의 멧돼지와 곰 돌진'},
  {ground:['saber','frost','golem','scarab'],canopy:['frost','golem'],air:['owl','iceWing','ray'],formation:'오로라 아래 검치호와 야간 비행대'},
  {ground:['tortoise','ember','golem','scorpion','lavaRunner'],canopy:['ember','tortoise'],air:['bat'],formation:'화산재의 중장갑 방벽과 불꽃 보초'},
  {ground:['crab','frog','scarab','mantis'],canopy:['crab','mantis'],air:['ray','ptero'],formation:'산호게 쌍 순찰과 해풍 비행대'},
  {ground:['golem','mantis','frost','scarab'],canopy:['mantis','frost'],air:['ray','iceWing','owl'],formation:'하늘섬의 높이별 비행 편대'},
  {ground:['scorpion','scarab','golem','tortoise'],canopy:['scorpion','golem'],air:['owl','bat','ray'],formation:'별빛 사막의 전갈 매복과 야간 급습'},
  {ground:['mantis','golem','scarab','boar','mushroom'],canopy:['mantis','mushroom','golem'],air:['owl','ray'],formation:'새벽 정원의 마지막 혼성 경비대'}
]

/** Local silhouettes for the bamboo, canyon, crystal, coast and moonlit trails. */
function middleDecks(index:number,x:number,section:number):[Island,Island] {
  const shift=section%2
  const bands:[number,number][][]=[
    [[4,18],[5,17],[12,15+shift],[5,17],[4,18]],
    [[5,18],[5,16],[10,14+shift],[5,16],[5,18]],
    [[4,18],[6,16],[10,15-shift],[6,16],[4,18]],
    [[6,18],[6,17],[6,16+shift],[6,17],[6,18]],
    [[5,18],[5,17],[10,16-shift],[5,17],[5,18]],
  ]
  const top=index===5?10+shift:index===6?8+shift:index===7?9+shift:index===8?12:11+shift
  return [island(x,1,...bands[index-5]!),island(x+8,1,[3,top+1],[8,top],[3,top+1])]
}
/** Distinct late-game terraces, with wide ladder landings on both levels. */
function lateDecks(index:number,x:number,section:number):[Island,Island] {
  const shift=section%2
  const bands:[number,number][][]=[
    [[5,18],[5,16],[10,15],[5,16],[5,18]],
    [[4,18],[4,16],[14,14+shift],[4,16],[4,18]],
    [[6,18],[5,17],[8,15+shift],[5,17],[6,18]],
    [[4,18],[5,17],[12,15+shift],[5,17],[4,18]],
    [[6,18],[5,17],[8,16],[5,17],[6,18]],
  ]
  const top=[9+shift,8+shift,11+shift,10+shift,11][index-10]!
  return [island(x,1,...bands[index-10]!),island(x+8,1,[3,top+1],[8,top],[3,top+1])]
}
/** New routes keep jump gaps short and connect every raised deck with ladders. */
function expedition(index:number):MapLayout {
  const w=176+(index%5)*8
  const ground:Span[]=[],islands:Island[]=[],ladders:Span[]=[],marks:Mark[]=[]
  for(let x=0;x<w;x+=16)ground.push([x,Math.min(w-1,x+15),21+((Math.floor(x/16)+index)%3===0?1:0)])
  for(let section=0;section<3;section++){
    const x=16+section*48+(index%3)*2+(index===3?[0,4,-3][section]!:0)
    let low=index===3?island(x,3,[4,18],[4,16],[8,15],[4,16])
      :index===4?island(x,3,[5,18],[10,17],[5,18]):island(x,3,[4,17],[12,16],[4,17])
    let high=index===3?island(x+6,3,[3,10],[8,9],[3,10])
      :index===4?island(x+6,3,[4,13],[6,12],[4,13]):island(x+6,3,[3,11],[8,10],[3,11])
    if(index>=5&&index<=9)[low,high]=middleDecks(index,x,section)
    if(index>=10&&index<=14)[low,high]=lateDecks(index,x,section)
    islands.push(low,high)
    const floor=index>=3&&index<=14?ground.find(([l,r])=>x+3>=l&&x+3<=r)![2]:22
    ladders.push(link(x+3,low,floor),link(x+9,high,low),link(x+17,high,low))
    marks.push([x+6,15,'E'],[x+12,9,'M'],[x+25,20,'U'])
  }
  // Center the entrance within the first 16-tile terrace so its full width is supported.
  marks.push([8,20,'E'],[10,20,'D'],[w-20,20,'M'],[w-28,14,'F'])
  const gap=44+(index%4)*2,pool=136+(index%3)*3
  return route({w,h:ROWS,ground,islands,ladders,marks,gaps:[[gap,gap+1]],water:[[pool,pool+1]],logs:[[gap-2,gap+3,18]]})
}
/** A second exploration leg, not a stretched or copied first half. */
function extendExpedition(map:MapLayout,index:number):MapLayout {
  const w=map[0]!.length
  const ground:Span[]=[],islands:Island[]=[],ladders:Span[]=[],marks:Mark[]=[],cutouts:Span[]=[]
  const sections=w<150?2:3
  const entryFloor=map.findIndex(row=>row[w-1]==='#')
  for(let x=0;x<w;x+=8){
    const top=x===0?entryFloor:x>=w-8?21:21+((Math.floor(x/8)+index)%4===0?1:0)
    ground.push([x,Math.min(w-1,x+7),top])
  }
  for(let section=0;section<sections;section++){
    const x=8+Math.floor(section*w/sections)+(index+section)%3
    const crest=15+(index+section)%2
    let low=index===0?island(x,1,[3,18],[4,17],[6,16],[8,15+section%2],[6,16],[3,17])
      :index===1?island(x,1,[4,18],[4,16],[12,14+section%2],[6,16],[4,18])
      :index===2?island(x,1,[6,18],[6,17],[8,16-section%2],[6,17],[4,18])
      :index===3?island(x,1,[5,18],[5,16],[10,15-section%2],[5,16],[5,18])
      :index===4?island(x,1,[6,18],[6,17],[8,16+section%2],[6,17],[4,18])
      :island(x,1,[3,18],[4,17],[6,16],[6,crest],[6,16],[3,17],[2,18])
    let high=index===1?island(x+8,1,[4,10],[6,8],[4,10])
      :index===2?island(x+8,1,[4,11],[6,10],[4,11])
      :index===3?island(x+8,1,[4,11],[6,9],[4,11])
      :index===4?island(x+8,1,[5,12],[5,11],[4,12])
      :island(x+8,1,[3,11],[3,10],[5,9+(index+section)%2],[3,10])
    if(index>=5&&index<=9)[low,high]=middleDecks(index,x,section+1)
    if(index>=10&&index<=14)[low,high]=lateDecks(index,x,section+1)
    islands.push(low,high)
    const floorAt=(col:number)=>ground.find(([l,r])=>col>=l&&col<=r)![2]
    ladders.push(link(x+2,low,floorAt(x+2)),link(x+11,high,low),
      link(x+20,high,low),link(x+27,low,floorAt(x+27)))
    // The broken lower trail leads up into the canopy and back down on its far side.
    cutouts.push([x+9,x+22,19])
    if(index>=10&&index<=14){
      // Hollow the bank below the lower deck, without cutting away its landing.
      for(let c=x+14;c<=x+18;c++)cutouts.push([c,c,low.top[c-low.x]!+1])
    }else cutouts.push([x+14,x+18,14])
    marks.push([x+6,16,'E'],[x+16,8,'M'],[x+25,15,'U'])
  }
  const pool=w-7
  marks.push([4,entryFloor-1,'E'],[w-15,20,'M'],[Math.floor(w*.6),6,'F'])
  const extra=route({w,h:map.length,ground,islands,ladders,cutouts,water:[[pool,pool+1]],marks})
  return Object.assign(map.map((row,y)=>row+extra[y]),{
    ladders:[...(map.ladders??[]),...ladders.map(([col,top,bottom]):Span=>[col+w,top,bottom])],
  })
}
export const STAGE_NAMES = [
  '원시 정글','불타는 화산','얼어붙은 빙하','황금 모래사막','안개 늪지',
  '대나무 숲','붉은 협곡','반짝이는 수정 계곡','노을 해안','달빛 버섯 숲',
  '고대 돌기둥 유적','천둥 고원','거대한 폭포','가을 단풍 숲','오로라 설원',
  '검은 화산재 황무지','산호 바닷속 유적','하늘섬','별빛 사막','공주의 새벽 정원'
].slice(0,15)
const terrainSets=[0,1,2,1,0,0,1,2,0,0,1,1,0,0,2,1,0,2,1,0]
/** Distribute 2–4 caves along exploration routes, never inside the opening screen. */
export function placeCaveEntrances(source:MapLayout,stage:number):MapLayout {
  const grid=source.map(row=>row.replace(/D/g,'.').split(''))
  const width=grid[0]!.length,candidates:{col:number;floor:number}[]=[]
  for(let col=32;col<width-14;col++){
    const floor=grid.findIndex((row,r)=>row[col]==='#'&&grid[r-1]?.[col]==='.')
    if(floor<5)continue
    if(!Array.from({length:9},(_,i)=>col-4+i).every(c=>grid[floor]?.[c]==='#'&&!['#','R'].includes(grid[floor-1]?.[c]??'#')))continue
    if(!Array.from({length:4},(_,i)=>grid[floor-1-i]?.[col]==='.').every(Boolean))continue
    if((source.ladders??[]).some(([x,top,bottom])=>Math.abs(x-col)<4&&floor>=top&&floor<=bottom+3))continue
    candidates.push({col,floor})
  }
  const count=2+stage%3,chosen:typeof candidates=[]
  for(let i=0;i<count;i++){
    const target=32+(width-56)*(i+1)/(count+1)+((stage*7+i*11)%13-6)
    const available=candidates.filter(c=>chosen.every(other=>Math.abs(c.col-other.col)>=24))
    const best=available.sort((a,b)=>Math.abs(a.col-target)-Math.abs(b.col-target))[0]
    if(!best)break
    chosen.push(best);grid[best.floor-1]![best.col]='D'
  }
  return Object.assign(grid.map(row=>row.join('')),{ladders:source.ladders??[]})
}
/** Catch missed jumps on the opening trails and the reported repeat-fall sites. */
function softenFallSites(source:MapLayout,index:number):MapLayout {
  if([3,4,7,8,10].includes(index)){
    const grid=source.map(row=>row.split(''))
    // Upper decks must not hide an open pit in the lower walking route.
    for(let col=1;col<grid[0]!.length-1;){
      const open=(c:number)=>[21,22,23].every(r=>grid[r]?.[c]!==undefined&&!['#','R','w'].includes(grid[r]![c]!))
      if(!open(col)){col++;continue}
      const left=col
      while(col<grid[0]!.length-1&&open(col))col++
      if(col-left<=2)continue
      const gap=left+Math.floor((col-left-2)/2)
      for(let c=left;c<col;c++)if(c<gap||c>gap+1)grid[21]![c]='='
    }
    return Object.assign(grid.map(row=>row.join('')),{ladders:source.ladders??[]})
  }
  const target=index===7?3398:index===10?785:undefined
  if(index>2&&target===undefined)return source
  const grid=source.map(row=>row.split(''))
  const center=target===undefined?0:Math.floor(target/16)
  // A level walking deck bypasses the overlapping ladder/ledge at x=1266.
  if(index===0)for(let col=74;col<=93;col++)if(grid[14]![col]==='.')grid[14]![col]='='
  for(let col=1;col<grid[0]!.length-1;col++){
    if(target!==undefined&&Math.abs(col-center)>6)continue
    // Retain upper decks and ladders; only restore missing ground underneath.
    if(grid.some(row=>row[col]==='#'||row[col]==='w'))continue
    for(let row=22;row<grid.length;row++)if(grid[row]![col]==='.')grid[row]![col]='#'
  }
  return Object.assign(grid.map(row=>row.join('')),{ladders:source.ladders??[]})
}
export const STAGES: StageDef[] = STAGE_NAMES.map((sub,index)=>{
  const set=terrainSets[index]!,last=index===STAGE_NAMES.length-1
  const sea=index===16?makeUnderwaterMap():undefined
  const sky=index===17?makeSkyMap():undefined
  let map=sea?.map??sky?.map??(index===19?home:index<3?areas[index]!:expedition(index))
  // The final garden also has its local flying species and a guardian clearing.
  if(!map.some(row=>row.includes('F')))map=Object.assign(map.map((row,y)=>y===13?row.slice(0,45)+'F'+row.slice(46):row),{ladders:map.ladders})
  if(!map.some(row=>row.includes('D')))map=Object.assign(map.map((row,y)=>y===20?row.slice(0,10)+'D'+row.slice(11):row),{ladders:map.ladders})
  if(!sea&&!sky)map=extendExpedition(map,index)
  map=softenFallSites(map,index)
  map=placeCaveEntrances(map,index+1)
  const progress=Math.floor(index/4)
  const cast=WORLD_CAST[index]!,habitat=HABITATS[index]!
  const localRoles: StageDef['roles']={
    E:{...BESTIARY[habitat.ground[0]!]!,fallbackKey:BESTIARY[habitat.ground[0]!]!.key,key:cast.normal[0],name:cast.names[0]},
    M:{...BESTIARY[habitat.ground[1]!]!,fallbackKey:BESTIARY[habitat.ground[1]!]!.key,key:cast.normal[1],name:cast.names[1]},
    U:{...BESTIARY[habitat.ground[2]!]!,fallbackKey:BESTIARY[habitat.ground[2]!]!.key,key:cast.normal[2],name:cast.names[2]},
    F:{...BESTIARY[habitat.air[0]!]!,fallbackKey:BESTIARY[habitat.air[0]!]!.key,key:cast.normal[3],name:cast.names[3]},
  }
  const planned=planEncounters(map,index,localRoles,habitat,BESTIARY)
  map=planned.map
  let encounters=planned.encounters
  let firstTrail:StageDef['firstTrail']
  if(index===0){
    // Keep the original four +5 fruit and two existing animal introductions,
    // but connect their rewards to one readable root/vine/canopy detour.
    const grid=map.map(row=>row.replace(/[fEU]/g,'.').split(''))
    grid[20]![14]='E'
    for(let col=24;col<=26;col++)for(let row=17;row<=21;row++)grid[row]![col]='R'
    for(let col=32;col<=37;col++)grid[14]![col]='='
    for(const [col,row] of [[18,20],[25,13],[30,6],[34,6]])grid[row]![col]='f'
    const ladders=[...(map.ladders??[]),[34,14,22] as Span]
    map=Object.assign(grid.map(row=>row.join('')),{ladders})
    encounters=[...encounters,{col:28,row:12,cfg:{...localRoles.U!,patrolRadius:16},group:'상층 먹이와 추적길 지킴이',facing:-1}]
    firstTrail={climbX:328,upperClimbX:488,retryX:552,traceX:440,traceY:208,rejoinX:848}
  }
  // Insert a dedicated dry corridor between exploration legs, after encounter planning.
  // Existing doors, ladders and encounters retain their relative geometry.
  let chase:StageDef['chase']
  if(index===6){
    const at=184, length=48, floor=21
    map=Object.assign(map.map((row,r)=>row.slice(0,at)+(r>=floor?'#':'.').repeat(length)+row.slice(at)),{
      ladders:(map.ladders??[]).map(([c,t,b]):Span=>[c>=at?c+length:c,t,b])
    })
    const grid=map.map(row=>row.split(''))
    for(const c of [at+27,at+28])grid[floor-1]![c]='R'
    map=Object.assign(grid.map(row=>row.join('')),{ladders:map.ladders})
    encounters=encounters.map(e=>({...e,col:e.col>=at?e.col+length:e.col}))
    chase={start:at*16,end:(at+36)*16,floor:floor*16,obstacle:(at+27)*16}
  }
  let flood:StageDef['flood']
  if(index===12){
    const at=24,length=30,floor=21
    map=Object.assign(map.map((row,r)=>row.slice(0,at)+(r>=floor?'#':'.').repeat(length)+row.slice(at)),{
      ladders:(map.ladders??[]).map(([c,t,b]):Span=>[c>=at?c+length:c,t,b])
    })
    const grid=map.map(row=>row.split(''))
    for(let c=at+6;c<=at+13;c++)grid[19]![c]='='
    map=Object.assign(grid.map(row=>row.join('')),{ladders:map.ladders})
    encounters=encounters.map(e=>({...e,col:e.col>=at?e.col+length:e.col}))
    flood={start:at*16,end:(at+24)*16,floor:floor*16,safe:(at+8)*16,deck:19*16}
  }
  return {
    firstTrail,flood,chase,
    id:index+1,title:`STAGE ${index+1}`,sub,kind:'explore',aquatic:sea?.aquatic,aerial:sky?.aerial,
    theme:{...themes[set]!,background:index+1,music:index===1?'volcano':[2,7,14].includes(index)?'glacier':'jungle'},roles:localRoles,caveEntrance:cast.door,
    encounters,
    boss:{...bosses[set]!,key:last?'kingkong':cast.boss,name:last?'킹콩':cast.bossName,hp:24+index*2+progress,w:last?88:66+(index%5)*4,h:last?82:56+(index%4)*3,chargeSpeed:175+index*4},
    weapon:set===1?'fire':'bone',icy:index===2,final:last,
    map:withBossArena(map),arenaCol:map[0]!.length
  }
})
