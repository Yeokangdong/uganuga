import {image} from './art'

/** One connected cloud bank per collision ledge; gaps stay completely open. */
export function cloudFloor(g:CanvasRenderingContext2D,x:number,y:number,width:number,depth:number):void {
  const im=image('sky.cloudFloor')
  const height=Math.max(40,Math.min(68,depth+8))
  if(im){
    // Soft puffs rise slightly around the actual, flat standing surface.
    g.drawImage(im,x,y-5,width,height)
    return
  }
  const light=g.createLinearGradient(0,y,0,y+height)
  light.addColorStop(0,'#fffef3');light.addColorStop(.5,'#e7f5ff');light.addColorStop(1,'#a8bee9')
  g.fillStyle=light;g.beginPath();g.roundRect(x,y,width,height*.75,18);g.fill()
}
