import { drawArt, frameAt, walkFrame } from './art'
import { Background } from './background'
import { VIEW_H, VIEW_W } from './constants'
import { STAGES } from './stages'
import { terrainTheme } from './terrainThemes'

export const JOURNEY_DURATION=6.2
type Passage='ridge'|'descent'|'river'|'forest'|'cave'|'ruins'|'dive'|'updraft'
export interface Journey {from:number;to:number;landmark:string;reason:string;clue:string;passage:Passage}
const routes:[string,string,string,Passage][]=[
  ['화산 고갯길','킹콩은 숲 끝의 화산 비탈로 달아났다. 우가는 연기 피는 산길로 올라간다.','그을린 바위에 큰 발자국이 남아 있다. 화산 쪽이다!','ridge'],
  ['눈 덮인 정상','용암길을 벗어나 산을 오르자 눈 덮인 정상이 나타났다. 발자국은 고개 너머로 이어진다.','누가의 뼈 장식에 눈이 묻어 있다. 더 높은 곳으로 갔어.','ridge'],
  ['산 아래 모래 분지','빙하 고개 너머로 메마른 분지가 펼쳐졌다. 킹콩은 눈 녹은 물길을 따라 산 아래로 내려갔다.','눈이 녹은 발자국이 모래 비탈로 이어져 있다.','descent'],
  ['오아시스 물길','사막 끝 오아시스에서 큰 발자국을 찾았다. 물길을 따라가니 안개 낀 늪이 나타났다.','젖은 진흙이 묻어 있다. 오아시스 아래 물길을 따라가자.','river'],
  ['대숲으로 이어진 둑','늪을 건넌 킹콩은 물가의 마른 둑으로 올라갔다. 둑 너머에는 빽빽한 대나무 숲이 있었다.','진흙 발자국이 대나무가 자란 둑으로 올라간다.','forest'],
  ['강물이 깎은 협곡','대숲 끝에서 강이 깊은 협곡으로 흘러든다. 부러진 가지와 발자국이 절벽 길에 남아 있다.','부러진 대나무가 협곡 쪽을 가리킨다. 아직 멀리 못 갔어.','descent'],
  ['수정빛 동굴','막다른 절벽에서 누가의 뼈 장식을 찾았다. 그 옆 바위 틈에는 수정빛 동굴이 이어져 있었다.','바위 틈에 누가의 장식이 걸려 있다. 동굴 안으로 갔구나!','cave'],
  ['바다로 흐르는 지하수','수정 동굴의 물소리를 따라가니 출구가 보였다. 지하수가 흘러나오는 곳은 노을 진 해안이었다.','동굴 바닥이 젖어 있다. 물이 흘러가는 쪽에서 파도 소리가 들려.','river'],
  ['해안 뒤 밤의 숲','킹콩은 해안 절벽 뒤의 숲길로 사라졌다. 우가가 뒤쫓는 사이 해가 지고 버섯들이 빛나기 시작했다.','모래 발자국이 숲으로 들어간다. 어두워져도 놓치지 않겠어.','forest'],
  ['숲속 옛 돌길','빛나는 버섯 사이에서 오래된 돌길을 발견했다. 킹콩은 이 길을 따라 숲속 유적으로 들어갔다.','돌길 위에 커다란 발자국과 누가의 장식이 남아 있다.','ruins'],
  ['유적의 돌계단','유적 뒤의 거대한 돌계단은 높은 고원으로 이어졌다. 구름 위쪽에서 천둥소리가 울린다.','무너진 계단에 털이 걸려 있다. 킹콩은 위로 올라갔어.','ridge'],
  ['폭포로 이어진 강','고원에 내린 비가 강으로 모여 절벽 아래로 떨어진다. 우가는 강가의 발자국을 따라 폭포로 내려간다.','비에 젖은 발자국이 강가로 이어진다. 아래쪽으로 가자.','descent'],
  ['폭포 옆 바위 통로','폭포 옆 좁은 바위 통로를 지나자 붉은 단풍 계곡이 나타났다. 킹콩의 젖은 발자국이 계속된다.','폭포 옆 통로에 누가의 뼈 장식이 떨어져 있다.','cave'],
  ['북쪽 눈 고개','단풍 계곡의 길은 점점 높은 산으로 이어졌다. 눈 고개에 도착하자 밤하늘에 오로라가 번졌다.','털에 서리가 맺혀 있다. 북쪽 고개를 넘어간 거야.','ridge'],
  ['지열이 새는 산비탈','고개를 넘자 따뜻한 김에 눈이 녹아 있었다. 킹콩은 지열이 새는 비탈을 따라 화산재 분지로 내려갔다.','눈 아래 검은 재가 보인다. 따뜻한 김이 나는 비탈로 갔어.','descent'],
  ['해안 유적의 수로','킹콩은 바다 절벽 위로 달아났다. 육로가 무너져, 우가는 해안 유적의 물속 수로로 지름길을 택한다.','절벽 아래에 누가의 장식이 있다. 끊긴 육로 대신 수로로 앞질러 가자!','dive'],
  ['해안 절벽의 상승기류','해저 수로를 빠져나오자 절벽 위로 오르는 발자국이 보였다. 우가는 상승기류를 타고 구름 위 길을 뒤쫓는다.','수로 출구에서 큰 발자국을 찾았다. 절벽 위에서 바람이 솟구쳐!','updraft'],
  ['구름 아래 모래 길','구름 사이로 사막이 보인다. 킹콩은 바위 능선을 따라 내려갔다. 우가도 바람을 타고 모래 길에 내려선다.','구름 아래 사막으로 내려가는 길에 누가의 장식이 걸려 있다.','descent'],
  ['모래 너머 새벽 정원','밤새 발자국을 따라 모래 언덕을 넘었다. 샘물이 흐르는 정원에서 누가의 목소리가 들린다. 드디어 따라잡았다!','샘물 옆에서 누가의 목소리가 들려. 바로 저 정원이야!','river'],
]
export const JOURNEYS:Journey[]=routes.map(([landmark,reason,clue,passage],i)=>({from:i+1,to:i+2,landmark,reason,clue,passage}))
const fromBackground=new Background(),toBackground=new Background()
const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)}

function footprint(g:CanvasRenderingContext2D,x:number,y:number,scale=1):void {
  g.save();g.translate(x,y);g.scale(scale,scale);g.fillStyle='rgba(34,26,20,.48)'
  g.beginPath();g.ellipse(0,0,3.4,1.5,-.22,0,Math.PI*2);g.fill()
  for(let i=0;i<4;i++){g.beginPath();g.ellipse(2+i*.8,-2+i*.5,.65,.45,0,0,Math.PI*2);g.fill()}
  g.restore()
}
function bone(g:CanvasRenderingContext2D,x:number,y:number):void {
  g.save();g.translate(x,y);g.rotate(-.35);g.strokeStyle='#75654b';g.lineWidth=1
  g.fillStyle='#eee0bc';g.beginPath();g.roundRect(-4,-1,8,2,1);g.fill();g.stroke()
  for(const dx of [-4,4])for(const dy of [-1,1]){g.beginPath();g.arc(dx,dy,1.2,0,Math.PI*2);g.fill();g.stroke()}
  g.restore()
}

/** Side-view tracking marks are scenery, not food or collision obstacles. */
export function drawPursuitExit(g:CanvasRenderingContext2D,stage:number,arenaX:number,floorBelow:(x:number)=>number,cx:number,cy:number):void {
  const route=JOURNEYS[stage-1];if(!route)return
  for(const offset of [-152,116,270]){
    const x=arenaX+offset,y=floorBelow(x)
    if(x-cx<-20||x-cx>VIEW_W+20)continue
    for(let i=0;i<3;i++)footprint(g,x+i*10-cx,y+2+(i%2)*2-cy,.8)
    if(offset===-152)bone(g,x+19-cx,y-3-cy)
  }
  const x=arenaX+296-cx,y=floorBelow(arenaX+296)-cy
  if(x<-90||x>VIEW_W+80)return
  const material=terrainTheme(route.to)
  g.save();g.fillStyle=material.base;g.strokeStyle='#554936';g.lineWidth=.7
  // A low cairn and an arrow carved into local stone mark a real onward trail.
  g.beginPath();g.moveTo(x-24,y+2);g.lineTo(x-21,y-8);g.lineTo(x-5,y-12);g.lineTo(x+8,y-10);g.lineTo(x+23,y-4);g.lineTo(x+8,y+1);g.closePath();g.fill();g.stroke()
  g.strokeStyle=material.edge;g.lineWidth=1.3;g.beginPath();g.moveTo(x-14,y-5);g.lineTo(x+10,y-5);g.moveTo(x+5,y-9);g.lineTo(x+10,y-5);g.lineTo(x+5,y-2);g.stroke()
  g.font='bold 6px "Malgun Gothic",sans-serif';g.textAlign='center';g.lineWidth=2;g.strokeStyle='#30271f';g.fillStyle='#fff1c9'
  g.strokeText(route.landmark,x,y-17);g.fillText(route.landmark,x,y-17)
  g.restore()
}

function lines(g:CanvasRenderingContext2D,text:string,maxWidth:number):string[]{
  const result:string[]=[];let line=''
  for(const word of text.split(' ')){
    const next=line?line+' '+word:word
    if(line&&g.measureText(next).width>maxWidth){result.push(line);line=word}else line=next
  }
  if(line)result.push(line)
  return result
}

/** A camera-following pursuit links the actual source and destination scenery. */
export function drawJourney(g:CanvasRenderingContext2D,route:Journey,elapsed:number):void {
  const t=Math.max(0,Math.min(JOURNEY_DURATION,elapsed)),blend=smooth((t-.7)/(JOURNEY_DURATION-1.5))
  fromBackground.setStage(route.from);toBackground.setStage(route.to)
  fromBackground.draw(g,t*130,t)
  g.save();g.globalAlpha=blend;toBackground.draw(g,t*130,t);g.restore()
  const rise=route.passage==='ridge'?-10:route.passage==='descent'?9:route.passage==='updraft'?-18:0
  const floor=146+rise*smooth(t/JOURNEY_DURATION)
  const old=terrainTheme(route.from),next=terrainTheme(route.to)
  const road=g.createLinearGradient(0,0,VIEW_W,0)
  road.addColorStop(0,old.base);road.addColorStop(1,next.base)
  g.save();g.fillStyle=road;g.strokeStyle=next.edge;g.lineWidth=2
  g.beginPath();g.moveTo(0,floor+4);g.quadraticCurveTo(96,floor-4,192,floor);g.quadraticCurveTo(300,floor+4,VIEW_W,floor-2)
  g.lineTo(VIEW_W,VIEW_H);g.lineTo(0,VIEW_H);g.closePath();g.fill()
  g.beginPath();g.moveTo(0,floor+4);g.quadraticCurveTo(96,floor-4,192,floor);g.quadraticCurveTo(300,floor+4,VIEW_W,floor-2);g.stroke()
  for(let i=0;i<15;i++)footprint(g,(i*31-t*45+VIEW_W*3)%VIEW_W,floor+7+(i%2)*2,.9)
  if(route.passage==='river'||route.passage==='dive'){
    g.globalAlpha=.35;g.fillStyle=route.passage==='dive'?'#448eac':'#6db0bd';g.fillRect(0,floor+3,VIEW_W,13);g.globalAlpha=1
  }
  const distance=t*80,heroFrame=walkFrame('p1.rescueRun',distance)
  const hop=heroFrame===3||heroFrame===7?2:0
  if(route.passage==='dive'&&blend>.35){
    drawArt(g,'p1.swim',frameAt('p1.swim',t),114,floor+Math.sin(t*3)*2,false)
  }else if(route.from===17&&blend<.45){
    drawArt(g,'p1.swim',frameAt('p1.swim',t),114,floor+2,false)
  }else if(route.passage==='updraft'||(route.from===18&&blend<.65)){
    drawArt(g,'p1.jump',2,114,floor-16-10*Math.sin(t*1.5),false)
    g.strokeStyle='rgba(222,251,255,.7)';g.lineWidth=1
    for(let i=0;i<4;i++){const y=floor+12-(t*40+i*13)%55;g.beginPath();g.moveTo(96+i*12,y);g.quadraticCurveTo(92+i*12,y-6,98+i*12,y-13);g.stroke()}
  }else drawArt(g,'p1.rescueRun',heroFrame,114,floor-hop,false)
  // The kidnapper takes the cliff path while Uga dives through the shortcut below.
  g.save()
  if(route.passage==='dive')g.globalAlpha=1-blend
  if(route.from===17)g.globalAlpha=blend
  const cliff=route.passage==='dive'||route.passage==='updraft'
  if(cliff){
    g.fillStyle=old.base;g.beginPath();g.moveTo(242,floor-21);g.lineTo(VIEW_W,floor-21);g.lineTo(VIEW_W,floor+20);g.lineTo(260,floor+20);g.closePath();g.fill()
  }
  drawArt(g,'kingkong.carry',walkFrame('kingkong.carry',distance*.8),282,floor-(cliff?21:0),false)
  g.restore()
  bone(g,202,floor-2)
  g.fillStyle='rgba(32,24,19,.84)';g.beginPath();g.roundRect(12,12,VIEW_W-24,28,7);g.fill()
  g.textAlign='center';g.fillStyle='#fff0ca';g.font='bold 9px "Malgun Gothic",sans-serif'
  g.fillText(`${STAGES[route.from-1]!.sub}  →  ${STAGES[route.to-1]!.sub}`,VIEW_W/2,25)
  g.font='6px "Malgun Gothic",sans-serif';g.fillStyle='#d8c6a4';g.fillText(route.landmark,VIEW_W/2,35)
  g.fillStyle='rgba(255,245,217,.95)';g.strokeStyle='#795a3a';g.lineWidth=1
  g.beginPath();g.roundRect(12,166,VIEW_W-24,37,6);g.fill();g.stroke()
  g.font='bold 7px "Malgun Gothic",sans-serif';g.fillStyle='#563d2b'
  const caption=lines(g,route.reason,VIEW_W-48)
  caption.slice(0,3).forEach((line,i)=>g.fillText(line,VIEW_W/2,179+i*9))
  g.fillStyle='#fff0c9';g.font='5px "Malgun Gothic",sans-serif';g.fillText('클릭 · Enter로 계속',VIEW_W/2,VIEW_H-4)
  const fade=Math.max(1-t/.3,(t-(JOURNEY_DURATION-.3))/.3,0)
  if(fade>0){g.fillStyle=`rgba(16,13,11,${Math.min(1,fade)})`;g.fillRect(0,0,VIEW_W,VIEW_H)}
  g.restore()
}
