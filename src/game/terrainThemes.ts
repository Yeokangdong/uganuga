export type StructureKind='tree'|'basalt'|'ice'|'sandstone'|'mangrove'|'bamboo'|'canyon'|'crystal'|'limestone'|'mushroom'|'ruins'|'slate'|'wet-rock'|'autumn'|'snow'|'ash'|'coral'|'floating'|'moonstone'|'garden'
export const TERRAIN_THEMES: {id:number;name:string;structure:StructureKind;organic:boolean;floating:boolean;base:string;edge:string}[] = [
  [1,'원시 정글','tree',true,false,'#725034','#99b64a'],
  [2,'불타는 화산','basalt',false,false,'#363137','#e4823e'],
  [3,'얼어붙은 빙하','ice',false,false,'#7eb6cf','#e5f7ff'],
  [4,'황금 모래사막','sandstone',false,false,'#b48550','#f1ca7b'],
  [5,'안개 늪지','mangrove',true,false,'#4d5d45','#8ca36b'],
  [6,'대나무 숲','bamboo',true,false,'#667052','#a3bc77'],
  [7,'붉은 협곡','canyon',false,false,'#a95e49','#d99a75'],
  [8,'반짝이는 수정 계곡','crystal',false,false,'#655180','#baade5'],
  [9,'노을 해안','limestone',false,false,'#ab947a','#efd6ac'],
  [10,'달빛 버섯 숲','mushroom',true,false,'#665078','#d4b3de'],
  [11,'고대 돌기둥 유적','ruins',false,false,'#7f8069','#bbbc9d'],
  [12,'천둥 고원','slate',false,false,'#5e6771','#9eac96'],
  [13,'거대한 폭포','wet-rock',false,false,'#597d7d','#b5d3be'],
  [14,'가을 단풍 숲','autumn',true,false,'#836044','#dbab66'],
  [15,'오로라 설원','snow',false,false,'#69849c','#e6f3f7'],
  [16,'검은 화산재 황무지','ash',false,false,'#4b464a','#9d8b7a'],
  [17,'산호 바다 절벽','coral',false,false,'#a9b9ac','#e8c3b7'],
  [18,'하늘섬','floating',false,true,'#8d999e','#c6d8ad'],
  [19,'별빛 사막','moonstone',false,false,'#706685','#b9b2cb'],
  [20,'공주의 새벽 정원','garden',false,false,'#a2a18a','#e6cdbd'],
].map(([id,name,structure,organic,floating,base,edge])=>({id:id as number,name:name as string,structure:structure as StructureKind,organic:organic as boolean,floating:floating as boolean,base:base as string,edge:edge as string}))
export const terrainTheme=(stage:number)=>TERRAIN_THEMES[Math.max(0,Math.min(19,stage===15?19:stage-1))]!
