import { loadKingKong, replaceOpeningKingKong } from './kingKong'
import lettersUrl from './letter-art.png'
import letters from './letter-art.json'
import { loadSuukuret, replaceOpeningAnimal } from './suukuret'
﻿import Phaser from 'phaser'
import { loadStageArt, image, drawArt, frameAt, textArtKey } from '../src/game/art'
import { drawOpening, OPENING_DURATION, OPENING_GRAB_START } from '../src/game/opening'
import { drawJourney, JOURNEYS, JOURNEY_DURATION } from '../src/game/journey'
import { Background } from '../src/game/background'
import { STAGES } from '../src/game/stages'
import { sfx } from '../src/game/audio'

const letterSheet=new Image();letterSheet.src=lettersUrl
function drawLetters(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,h:number){
  const advance=h*.85,width=text.length*advance
  for(const [i,c] of [...text].entries()){
    const n=letters.indexOf(c);if(n<0||!letterSheet.complete)continue
    ctx.drawImage(letterSheet,n%16*48,Math.floor(n/16)*48,48,48,x-width/2+i*advance,y-h,h,h)
  }
}
export function paintedLabel(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,h:number){
  const key=textArtKey(text), art=key?image(key):null
  if(art){const w=art.width*h/art.height;ctx.drawImage(art,x-w/2,y-h,w,h)}
  else drawLetters(ctx,text,x,y,h)
}
type JourneyData={kind:'opening'|'travel'|'rescue'|'result';stage?:number;score?:number;lives?:number;clear?:boolean}
/** Phaser owns the timeline and input; original painters retain all sprite pivots and proportions. */
export class JourneyScene extends Phaser.Scene {
  journey!:JourneyData
  elapsed=0
  ready=false
  private surface!:Phaser.Textures.CanvasTexture
  private background=new Background()
  constructor(){super('Journey')}
  create(data:JourneyData){
    this.journey=data;this.elapsed=0;this.ready=false
    const loading=this.add.text(480,270,'원화 불러오는 중',{fontSize:'22px'}).setOrigin(.5)
    const proceed=()=>{sfx.init();if(!this.ready||this.elapsed<.6)return;if(this.journey.kind==='travel')this.scene.start('Play',{stage:(this.journey.stage??1)+1,score:this.journey.score,lives:this.journey.lives});else if(this.journey.kind==='result')this.scene.start('Journey',{kind:'opening'})}
    const title=()=>{if(this.journey.kind==='result')this.scene.start('Title')}
    this.input.on('pointerdown',proceed);this.input.keyboard?.on('keydown-SPACE',proceed);this.input.keyboard?.on('keydown-ENTER',proceed);this.input.keyboard?.on('keydown-ESC',title)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.ready=false;sfx.stopMusic();this.input.off('pointerdown',proceed)
      this.input.keyboard?.off('keydown-SPACE',proceed);this.input.keyboard?.off('keydown-ENTER',proceed);this.input.keyboard?.off('keydown-ESC',title)
      if(this.textures.exists('journey-view'))this.textures.remove('journey-view')
    })
    const stage=data.kind==='opening'?1:data.stage??15
    const load=()=>Promise.all([loadStageArt(stage),loadSuukuret(),loadKingKong(),letterSheet.decode(),...(data.kind==='travel'?[loadStageArt(stage+1)]:[])]).then(()=>{
      if(!this.scene.isActive())return
      replaceOpeningAnimal();replaceOpeningKingKong()
      loading.destroy();this.background.setStage(STAGES[stage-1]!.theme.background)
      this.surface=this.textures.createCanvas('journey-view',384,216)!
      this.add.image(0,0,'journey-view').setOrigin(0).setDisplaySize(960,540)
      this.ready=true
      if(data.kind==='rescue')sfx.fanfare()
      else if(data.kind==='result'){if(!data.clear)sfx.sad()}
      else sfx.playMusic('stage',STAGES[stage-1]!.theme.n)
      this.renderFrame()
    }).catch(()=>{loading.setText('불러오기 실패 · 클릭하여 재시도');this.input.once('pointerdown',()=>void load())})
    void load()
  }
  update(_time:number,delta:number){
    if(!this.ready)return
    const before=this.elapsed;this.elapsed+=Math.min(delta/1000,.1)
    if(this.journey.kind==='opening'&&before<OPENING_GRAB_START&&this.elapsed>=OPENING_GRAB_START)sfx.roar()
    const duration=this.journey.kind==='opening'?OPENING_DURATION:this.journey.kind==='travel'?JOURNEY_DURATION:this.journey.kind==='rescue'?7:Infinity
    if(this.elapsed>=duration){
      if(this.journey.kind==='rescue')this.scene.start('Journey',{...this.journey,kind:'result',clear:true})
      else this.scene.start('Play',{stage:this.journey.kind==='opening'?1:(this.journey.stage??1)+1,score:this.journey.score,lives:this.journey.lives})
      return
    }
    this.renderFrame()
  }
  renderFrame(){
    if(!this.surface)return
    const ctx=this.surface.context,t=this.elapsed,d=this.journey
    ctx.clearRect(0,0,384,216)
    if(d.kind==='opening')drawOpening(ctx,t)
    else if(d.kind==='travel'){
      const original=ctx.fillText
      ctx.fillText=(text,x,y)=>{const h=Number.parseFloat(ctx.font.replace('bold ',''))||7;drawLetters(ctx,text,x,y,h)}
      try{drawJourney(ctx,JOURNEYS[(d.stage??1)-1]!,t)}finally{ctx.fillText=original}
    }
    else {
      this.background.draw(ctx,0,t,0,0)
      ctx.fillStyle='rgba(30,20,10,.55)';ctx.fillRect(0,0,384,216)
      if(d.kind==='rescue'){
        drawArt(ctx,'p1.rescueRun',frameAt('p1.rescueRun',t),Math.min(176,55+t*35),178,false)
        const key=t<3?'nuga.wave':'nuga.cheer';drawArt(ctx,key,frameAt(key,t),208,178,false)
        paintedLabel(ctx,'누가 공주 구출!',192,60,24)
      }else{
        paintedLabel(ctx,d.clear?'모두 클리어!':'게임 오버',192,53,28)
        paintedLabel(ctx,'점수',130,98,16);paintedLabel(ctx,String(d.score??0),235,98,18)
        paintedLabel(ctx,`STAGE ${d.stage??15}`,192,128,15)
        paintedLabel(ctx,'Space / Enter · 다시 시작',192,170,13)
        paintedLabel(ctx,'Esc · 타이틀',192,193,11)
      }
    }
    this.surface.refresh()
  }
}

