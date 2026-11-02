import { drawArt, frameAt, image, progressFrame, walkFrame } from './art'
import { VIEW_H, VIEW_W } from './constants'

export const OPENING_DURATION=11.7
export const OPENING_GRAB_START=3.2
export const OPENING_GRAB_END=4.4
export const OPENING_PLEA_START=3.6
export const OPENING_DIALOGUE_START=5.3
export const OPENING_ESCAPE_START=7.7
export const OPENING_HERO_LINE_START=8.35

/** A single outlined shape keeps the speech tail free of overlapping seams. */
function drawSpeech(g:CanvasRenderingContext2D,age:number,speaker:string,lines:[string,string],x:number,y:number,accent:string):void {
  const p=Math.min(1,Math.max(0,age/.16)),size=.72,scale=size*(.94+.06*(1-(1-p)**3))
  // Keep the tail aimed at the speaker as the bubble becomes more compact.
  g.save();g.translate(x-19*(1-size),y+35*(1-size)-5);g.scale(scale,scale);g.translate(-78,-24)
  g.globalAlpha=Math.min(1,Math.max(0,age/.08));g.lineJoin='round';g.lineCap='round'
  const paper=g.createLinearGradient(0,0,0,47)
  paper.addColorStop(0,'#fffdf0');paper.addColorStop(1,'#ffe7b8')
  g.fillStyle=paper;g.strokeStyle='#67432e';g.lineWidth=1.25
  g.shadowColor='rgba(44,27,15,.24)';g.shadowBlur=3;g.shadowOffsetY=2
  g.beginPath();g.moveTo(18,1)
  g.bezierCurveTo(6,-1,0,7,1,18);g.bezierCurveTo(-1,35,5,45,21,45)
  g.quadraticCurveTo(35,46,49,45);g.quadraticCurveTo(52,52,59,59)
  g.quadraticCurveTo(62,53,63,46);g.bezierCurveTo(92,48,130,48,143,44)
  g.bezierCurveTo(156,42,158,32,157,20);g.bezierCurveTo(159,7,150,-1,137,1)
  g.quadraticCurveTo(78,-1,18,1);g.closePath();g.fill();g.stroke()
  g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0
  // A warm speaker tab and a small bone/leaf accent match the game's HUD.
  const tabWidth=Math.max(30,speaker.length*6.2+10)
  g.fillStyle=accent;g.strokeStyle='#67432e';g.lineWidth=.8
  g.beginPath();g.roundRect(12,-4,tabWidth,11,5);g.fill();g.stroke()
  g.font='bold 6.2px "Malgun Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle'
  g.fillStyle='#fff5d8';g.fillText(speaker,12+tabWidth/2,1.5)
  g.save();g.translate(147,7);g.rotate(-.45)
  g.fillStyle='#fff4d3';g.strokeStyle='#84613c';g.lineWidth=.7
  g.beginPath();g.moveTo(-4,-1.4);g.bezierCurveTo(-8,-5,-10,-1,-7,1)
  g.bezierCurveTo(-9,5,-5,6,-3,2);g.lineTo(4,2)
  g.bezierCurveTo(8,6,11,2,8,0);g.bezierCurveTo(10,-4,6,-5,4,-1.4)
  g.closePath();g.fill();g.stroke();g.restore()
  g.fillStyle='#7b914c';g.strokeStyle='#536637';g.lineWidth=.7
  g.beginPath();g.moveTo(149,43);g.quadraticCurveTo(151,34,158,35);g.quadraticCurveTo(159,42,149,43)
  g.moveTo(149,43);g.quadraticCurveTo(144,36,140,39);g.quadraticCurveTo(141,45,149,43);g.fill();g.stroke()
  g.fillStyle='#70513a';g.font='bold 8px "Malgun Gothic",sans-serif';g.fillText(lines[0],78,19)
  g.fillStyle='#4e3023';g.font='bold 9px "Malgun Gothic",sans-serif';g.fillText(lines[1],78,34)
  g.restore()
}

/** A fixed-screen story sequence. Gameplay and the stage timer wait for its end. */
export function drawOpening(g:CanvasRenderingContext2D,t:number):void {
  const bg=image('v2.bg1'),floor=184
  g.save();g.imageSmoothingEnabled=true
  if(bg)g.drawImage(bg,0,0,VIEW_W,VIEW_H)
  const rock=image('world.rock0'),grass=image('world.surface0')
  if(rock)for(let x=0;x<VIEW_W;x+=64)g.drawImage(rock,x,floor,64,64)
  if(grass)for(let x=0;x<VIEW_W;x+=64)g.drawImage(grass,x,floor,64,12)
  g.fillStyle='rgba(42,33,22,.18)'
  const shadow=(x:number,w:number)=>{g.beginPath();g.ellipse(x,floor+1,w,2,0,0,Math.PI*2);g.fill()}
  const chase=Math.max(0,t-(OPENING_ESCAPE_START+.15))
  const chaseDistance=80*(chase-.12*(1-Math.exp(-chase/.12)))
  const heroX=48+chaseDistance
  shadow(heroX,9)
  const hero=chase>0?'p1.rescueRun':t>=OPENING_GRAB_START?'p1.charge':'p1.idle'
  const heroFrame=hero==='p1.rescueRun'?walkFrame(hero,chaseDistance):frameAt(hero,t)
  const flight=hero==='p1.rescueRun'?(heroFrame===3||heroFrame===7?3:heroFrame===2||heroFrame===6?1:0):0
  drawArt(g,hero,heroFrame,heroX,floor-flight,false)
  if(t<OPENING_GRAB_START){
    // Affection belongs to the playful chase; it ends as soon as Kong grabs Nuga.
    const appear=Math.min(1,t/.25),fade=Math.min(1,(OPENING_GRAB_START-t)/.22)
    const beat=1+.09*Math.sin(t*Math.PI*3),rise=Math.sin(t*2.5)*1.2
    g.save();g.translate(heroX+2,floor-43+rise);g.scale(beat,beat)
    g.globalAlpha=appear*fade
    g.fillStyle='#fff6df';g.strokeStyle='#67432e';g.lineWidth=.8;g.lineJoin='round'
    g.beginPath();g.moveTo(-5,-9)
    g.bezierCurveTo(-13,-9,-14,-4,-13,1);g.quadraticCurveTo(-13,7,-6,7)
    g.lineTo(-3,7);g.quadraticCurveTo(-3,10,-5,12);g.quadraticCurveTo(1,10,2,7)
    g.lineTo(6,7);g.bezierCurveTo(14,7,15,3,14,-2)
    g.quadraticCurveTo(14,-9,6,-9);g.closePath();g.fill();g.stroke()
    g.fillStyle='#f37891';g.strokeStyle='#853b46';g.lineWidth=.75
    g.beginPath();g.moveTo(0,4.5);g.bezierCurveTo(-1,3,-7,-.4,-5,-3.4)
    g.bezierCurveTo(-3.5,-5.8,-.6,-5,0,-2.8);g.bezierCurveTo(1,-5,4,-5.8,5.2,-3.4)
    g.bezierCurveTo(7,-.4,1,3,0,4.5);g.closePath();g.fill();g.stroke()
    g.strokeStyle='#ffd7dc';g.lineWidth=1;g.beginPath();g.moveTo(-3.5,-2.3);g.quadraticCurveTo(-2.5,-3.5,-1.5,-2.5);g.stroke()
    g.restore()
  }
  if(t<6.4){
    const notice=.45,flee=.8,alarmed=t>=notice&&t<flee
    // First clutch the acorn, notice Nuga behind, then spring away and accelerate.
    // Leave a clear chase gap while Scrat pauses and Nuga keeps approaching.
    const run=Math.max(0,t-flee),distance=56*(run-.16*(1-Math.exp(-run/.16))),x=166+distance
    const frame=t<flee?(alarmed?1:0):walkFrame('squirrel.run',distance)
    const jump=alarmed?Math.sin((t-notice)/(flee-notice)*Math.PI)*8:0
    const hop=t<flee?jump:frame===3||frame===7?3:frame===2||frame===6?1:0
    shadow(x,5);drawArt(g,'squirrel.run',frame,x,floor-hop,alarmed)
    if(alarmed){
      g.save();g.translate(x+2,floor-hop-26);g.strokeStyle='#67432e';g.lineWidth=2.1;g.lineCap='round'
      g.beginPath();g.moveTo(0,-5);g.lineTo(0,-1);g.moveTo(0,2);g.lineTo(0,2.1);g.stroke()
      g.strokeStyle='#fff1bf';g.lineWidth=1;g.stroke();g.restore()
    }
  }
  if(t<OPENING_GRAB_START){
    const distance=t*25,x=86+distance
    shadow(x,7);drawArt(g,'nuga.run',walkFrame('nuga.run',distance),x,floor,false)
    if(t<1.7){
      g.save();g.translate(x+8,floor-46);g.globalAlpha=Math.min(1,t/.12,(1.7-t)/.15)
      g.fillStyle='#fff6df';g.strokeStyle='#67432e';g.lineWidth=.8;g.lineJoin='round'
      g.beginPath();g.moveTo(-15,-9);g.quadraticCurveTo(-21,-9,-21,-3)
      g.lineTo(-21,3);g.quadraticCurveTo(-21,9,-15,9);g.lineTo(-7,9)
      g.lineTo(-10,14);g.quadraticCurveTo(-3,12,-2,9);g.lineTo(15,9)
      g.quadraticCurveTo(21,9,21,3);g.lineTo(21,-3);g.quadraticCurveTo(21,-9,15,-9)
      g.closePath();g.fill();g.stroke();g.fillStyle='#613e2c'
      g.font='bold 7.5px "Malgun Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle'
      g.fillText('스크렛!',0,0);g.restore()
    }
    if(t>=1.7){
      const x=VIEW_W+40-(VIEW_W+40-232)*(t-1.7)/1.5
      shadow(x,22);drawArt(g,'kingkong.walk',walkFrame('kingkong.walk',VIEW_W+40-x),x,floor,true)
    }
  }else if(t<OPENING_GRAB_END){
    shadow(232,25);drawArt(g,'kingkong.grab',progressFrame('kingkong.grab',(t-OPENING_GRAB_START)/1.2),232,floor,true)
  }else if(t<OPENING_ESCAPE_START){
    shadow(232,25);drawArt(g,'kingkong.grab',progressFrame('kingkong.grab',1),232,floor,true)
    if(t>=OPENING_DIALOGUE_START)drawSpeech(g,t-OPENING_DIALOGUE_START,'킹콩',['누가 예쁘다…','내 색시로 삼을 거다!'],230,88,'#925537')
  }else if(t<11.1){
    const run=t-OPENING_ESCAPE_START,x=232+run*70
    shadow(x,23);drawArt(g,'kingkong.carry',walkFrame('kingkong.carry',run*70),x,floor,false)
  }
  if(t>=OPENING_PLEA_START&&t<OPENING_DIALOGUE_START){
    const lift=Math.min(1,(t-OPENING_GRAB_START)/1.2)
    drawSpeech(g,t-OPENING_PLEA_START,'누가 공주',['우가! 도와줘!','무서워!'],185+78*lift,128-21*lift,'#925b63')
  }
  if(t>=OPENING_HERO_LINE_START&&t<11.1)
    drawSpeech(g,t-OPENING_HERO_LINE_START,'우가',['누가! 기다려!','내가 꼭 구해줄게!'],heroX+19,127,'#65733e')
  g.textAlign='center';g.lineJoin='round';g.lineWidth=1.5;g.strokeStyle='#4c3526';g.fillStyle='#fff1c9'
  g.font='bold 9px "Malgun Gothic",sans-serif'
  const text=t<1.7?'도토리를 든 다람쥐를 쫓아가던 누가…':t<OPENING_GRAB_START?'그 앞에 킹콩이 나타났다!':t<OPENING_ESCAPE_START?'킹콩이 누가 공주를 데려간다!':'누가, 기다려! 내가 구해줄게!'
  g.strokeText(text,VIEW_W/2,31);g.fillText(text,VIEW_W/2,31)
  g.font='6px "Malgun Gothic",sans-serif';g.fillText('클릭하면 건너뛰기',VIEW_W/2,VIEW_H-8)
  const fade=Math.max(0,(t-(OPENING_DURATION-.45))/.45)
  if(fade){g.fillStyle=`rgba(0,0,0,${Math.min(1,fade)})`;g.fillRect(0,0,VIEW_W,VIEW_H)}
  g.restore()
}
