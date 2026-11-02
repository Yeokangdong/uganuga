import type {EncounterDef,EnemyCfg,MapLayout,StageDef} from './stages'

interface Habitat {ground:string[];canopy:string[];air:string[]}
/** Double the authored encounters, keeping a clear approach to doors and ladders. */
export function planEncounters(source:MapLayout,index:number,roles:StageDef['roles'],habitat:Habitat,bestiary:Record<string,EnemyCfg>):{map:MapLayout;encounters:EncounterDef[]}{
  const grid=source.map(row=>[...row.replace(/[EMUFS]/g,'.')]),width=grid[0]!.length
  const doors:number[]=[]
  grid.forEach(row=>row.forEach((v,c)=>{if(v==='D')doors.push(c)}))
  const result:EncounterDef[]=[],supports:{col:number;row:number}[]=[]
  const empty=(c:number,r:number)=>grid[r]?.[c]==='.'||grid[r]?.[c]==='c'
  for(let c=25;c<width-12;c++)for(let r=5;r<grid.length;r++){
    if(doors.some(d=>Math.abs(d-c)<7))continue
    if(![-1,0,1,2].every(dx=>['#','R','='].includes(grid[r]?.[c+dx]??'')))continue
    if(![1,2,3].every(d=>empty(c,r-d)))continue
    if((source.ladders??[]).some(([x,top,bottom])=>Math.abs(x-c)<4&&r>=top-1&&r<=bottom+2))continue
    supports.push({col:c,row:r-1})
  }
  const placeGround=(target:number,cfg:EnemyCfg,group:string,upper=false)=>{
    const free=supports.filter(p=>result.every(e=>Math.abs(e.col-p.col)>=(upper?14:20)))
    const upperRoute=free.filter(p=>p.row<grid.length-8&&Math.abs(p.col-target)<width*.25)
    const candidates=upper&&upperRoute.length?upperRoute:free
    const sorted=candidates.sort((a,b)=>{
      const score=(p:typeof a)=>Math.abs(p.col-target)*5+(upper?p.row:Math.max(0,grid.length-4-p.row))*2
      return score(a)-score(b)
    })
    const p=sorted[0];if(!p)return
    result.push({...p,cfg:{...cfg,patrolRadius:24},group,facing:-1})
  }
  const companions=habitat.ground.map(k=>bestiary[k]!).filter(c=>['scarab','sandScorpion','marshFrog','coralCrab','sporeling','stoneGuard','bambooMantis','moonOwl','emberTortoise','cloudRay'].includes(c.key))
  const companion=companions[index%companions.length]
  const groups=['첫 길목 수문장','교차로 경비','중간 길목 수문장','후반 길목 경비','보스 전초병','마지막 길목 경비']
  for(let i=0;i<6;i++){
    const key=(['E','M','U'] as const)[i%3]!
    const cfg=i===3&&companion?companion:roles[key]!
    placeGround(Math.max(28,Math.round(width*[.12,.29,.46,.63,.79,.92][i]!)),cfg,groups[i]!)
  }
  placeGround(Math.round(width*.53),{...roles.U!,reward:'treasure',hp:Math.max(4,roles.U!.hp),score:roles.U!.score*2},'샛길 보물 지킴이',true)
  const airTarget=Math.round(width*.7)
  for(let offset=0;offset<width;offset++){
    const col=airTarget+(offset%2===0?1:-1)*Math.ceil(offset/2)
    if(col<32||col>=width-16||doors.some(d=>Math.abs(d-col)<8)||result.some(e=>Math.abs(e.col-col)<12))continue
    const ground=supports.filter(p=>Math.abs(p.col-col)<4).sort((a,b)=>b.row-a.row)[0]
    const row=Math.max(4,(ground?.row??18)-5)
    if(![0,1,2].every(d=>empty(col,row-d)))continue
    result.push({col,row,cfg:{...roles.F!,patrolRadius:32},group:'상단 경로 공중 경비',facing:-1});break
  }
  const original=[...result]
  for(const encounter of original){
    const air=encounter.cfg.cls==='flyer'
    const free=supports.filter(p=>result.every(e=>Math.abs(e.col-p.col)>=6||Math.abs(e.row-p.row)>=4))
    const preferred=encounter.col+(encounter.col<width*.8?10:-10)
    const candidate=free.sort((a,b)=>Math.abs(a.col-preferred)-Math.abs(b.col-preferred)||Math.abs(a.row-encounter.row)-Math.abs(b.row-encounter.row))[0]
    if(!candidate)throw new Error(`No safe companion encounter in stage ${index+1}`)
    let row=candidate.row
    if(air){
      const raised=Math.max(4,row-5)
      if([0,1,2].every(d=>empty(candidate.col,raised-d)))row=raised
    }
    result.push({...encounter,col:candidate.col,row,cfg:{...encounter.cfg},group:encounter.group+' · 두 번째 경비',facing:1})
  }
  // Preserve one authored introduction for each local species without duplicating it.
  for(const key of ['E','M','U','F'] as const){
    const at=result.findIndex(e=>e.cfg.key===roles[key]!.key&&e.cfg.reward!=='treasure')
    if(at<0)continue
    const [e]=result.splice(at,1);grid[e!.row]![e!.col]=key
  }
  return {map:Object.assign(grid.map(row=>row.join('')),{ladders:source.ladders??[]}),encounters:result.sort((a,b)=>a.col-b.col)}
}
