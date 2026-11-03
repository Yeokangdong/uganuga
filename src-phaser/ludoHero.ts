import Phaser from 'phaser'
import type { Player } from '../src/game/entities'
const files=import.meta.glob('./assets/*',{query:'?url',import:'default',eager:true}) as Record<string,string>
type Box={x:number;y:number;w:number;h:number}
type Pack={image:HTMLImageElement;frames:Box[];height:number}
/** Atlas cells keep their source files; alpha bounds supply a shared foot pivot. */
export class LudoHero {
  private packs:Record<string,Pack>={}
  private age=0
  private mode='idle'
  private jumpAge=0
  private wasGround=true
  private landingAge=1
  private fallAge=0
  async load(scene:Phaser.Scene){
    for(const [name,file] of Object.entries({walk:'uga_walk_ludo',attack:'uga_attack_ludo',jump:'uga_jump_ludo',ladder:'uga_ladder_ludo_v2'})){
      const data=await (await fetch(files[`./assets/${file}.json`]!)).json()
      const image=new Image();image.src=files[`./assets/${file}.png`]!;await image.decode()
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0)
      const pixels=ctx.getImageData(0,0,image.width,image.height).data
      const frames=Object.values(data.frames as Record<string,{frame:Box}>).map(({frame:f})=>{
        let l=f.w,t=f.h,r=0,b=0
        for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[((f.y+y)*image.width+f.x+x)*4+3]!>16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}
        return{x:f.x+l,y:f.y+t,w:r-l+1,h:b-t+1}
      })
      this.packs[name]={image,frames,height:Math.max(...frames.filter((_,i)=>name!=='jump'||i<8||i>11).map(f=>f.h))}
      if(!scene.textures.exists(file))scene.textures.addAtlas(file,image,data)
    }
  }
  advance(p:Player,dt:number){
    if(!this.wasGround&&p.onGround)this.landingAge=0
    else this.landingAge+=dt
    if(!p.onGround&&p.vy>=0)this.fallAge+=dt;else this.fallAge=0
    const mode=p.climbing?'ladder':p.swingT>0?'attack':!p.onGround?'jump':this.landingAge<.5?'landing':Math.abs(p.vx)>5?'walk':'idle'
    if(mode!==this.mode){this.age=0;this.mode=mode}
    if(mode!=='ladder'||Math.abs(p.vy)>.5)this.age+=dt
    if(this.wasGround&&!p.onGround)this.jumpAge=0
    if(!p.onGround)this.jumpAge+=dt
    this.wasGround=p.onGround
  }
  draw(ctx:CanvasRenderingContext2D,p:Player,cx:number,cy:number,reducedMotion=false){
    if(p.dead||p.out||p.swimming||p.ropeAngle!==null){p.draw(ctx,cx,cy,reducedMotion);return}
    if(!reducedMotion&&p.invuln>0&&p.spawnFireT<=0&&Math.floor(p.invuln*20)%2===0)return
    const name=this.mode==='idle'?'walk':this.mode==='landing'?'jump':this.mode,pack=this.packs[name];if(!pack){p.draw(ctx,cx,cy,reducedMotion);return}
    let index=0
    if(name==='walk'&&this.mode!=='idle')index=Math.floor(this.age/.082)%20
    if(name==='ladder')index=Math.floor(this.age/.085)%20
    if(name==='attack')index=Math.min(8,Math.floor((1-p.swingT/Math.max(.001,p.swingDur))*9))
    if(name==='jump')index=this.mode==='landing'?Math.min(24,15+Math.floor(this.landingAge*20)):p.vy<0?Math.min(7,Math.floor(this.jumpAge*50)):Math.min(14,12+Math.floor(this.fallAge*12))
    const f=pack.frames[index]!,scale=24.75/pack.height
    ctx.save();if(reducedMotion&&p.invuln>0&&p.spawnFireT<=0)ctx.globalAlpha*=.55;ctx.translate(p.cx-cx,p.y+p.h-cy);if(p.facing<0&&name!=='ladder')ctx.scale(-1,1)
    ctx.drawImage(pack.image,f.x,f.y,f.w,f.h,-f.w*scale/2,-f.h*scale,f.w*scale,f.h*scale);ctx.restore()
  }
}
