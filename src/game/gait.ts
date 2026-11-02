/** Distance-driven foot contacts. Body sprites stay unchanged throughout a step. */
export interface WalkPose { owner: object; distance: number; moving: boolean; time: number }
export interface WalkBody { img: HTMLImageElement; height: number; ratio: number; anchor: number; left: boolean; kind: 'biped'|'quad'|'spider'; colors: string[] }
export const walkBodies: Record<string, WalkBody> = {}
const rests = new WeakMap<object, {distance:number; moving:boolean; changed:number}>()
const surfaces = new Map<string, HTMLCanvasElement>()
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const smooth=(x:number)=>x*x*(3-2*x)

/** During support, dx/ddistance = -1, so world foot position stays constant. */
export function footAt(distance:number,stride:number,offset:number,duty:number,lift:number) {
  const phase=((distance/stride+offset)%1+1)%1
  const reach=stride*duty/2
  if(phase<duty)return {x:reach-phase*stride,y:0,planted:true,phase}
  const u=(phase-duty)/(1-duty), tangent=-stride*(1-duty)
  const x=-reach+2*reach*smooth(u)+tangent*(2*u*u*u-3*u*u+u)
  return {x,y:-lift*Math.sin(Math.PI*u)**2,planted:false,phase}
}

export function kneeAt(hx:number,hy:number,fx:number,fy:number,a:number,b:number,bend:number) {
  const dx=fx-hx,dy=fy-hy,raw=Math.hypot(dx,dy)
  const d=clamp(raw,Math.abs(a-b)+1e-6,a+b-1e-6),ux=dx/(raw||1),uy=dy/(raw||1)
  const along=(a*a-b*b+d*d)/(2*d),side=Math.sqrt(Math.max(0,a*a-along*along))*bend
  return {x:hx+ux*along+uy*side,y:hy+uy*along-ux*side}
}

function limb(ctx:CanvasRenderingContext2D,x:number,y:number,kx:number,ky:number,fx:number,fy:number,width:number,colors:string[],far:boolean,footSize:number) {
  const [outline,base,shade,tip]=colors
  const segment=(ax:number,ay:number,bx:number,by:number,w:number)=>{
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=outline!;ctx.lineWidth=w+Math.min(.65,w*.4)
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke()
    ctx.strokeStyle=(far?shade:base)!;ctx.lineWidth=w;ctx.stroke()
    if(!far){ctx.strokeStyle=shade!;ctx.lineWidth=Math.max(.5,w*.22);ctx.beginPath();ctx.moveTo(ax-w*.2,ay);ctx.lineTo(bx-w*.2,by);ctx.stroke()}
  }
  segment(x,y,kx,ky,width);segment(kx,ky,fx,fy,width*.8)
  const sole=fy+footSize*.65
  ctx.fillStyle=outline!;ctx.beginPath();ctx.moveTo(fx-footSize*.42,sole-footSize*.8);ctx.lineTo(fx+footSize*.6,sole-footSize*.65);ctx.lineTo(fx+footSize*.85,sole-.1);ctx.lineTo(fx-footSize*.5,sole-.1);ctx.closePath();ctx.fill()
  ctx.fillStyle=(far?shade:base)!;ctx.fillRect(fx-footSize*.28,sole-footSize*.6,footSize*.85,footSize*.42)
  ctx.fillStyle=tip!;ctx.fillRect(fx+footSize*.37,sole-footSize*.4,footSize*.28,footSize*.28)
}

export function drawWalk(ctx:CanvasRenderingContext2D,key:string,cx:number,bottom:number,left:boolean,pose:WalkPose,style:{scale?:number;white?:boolean;glow?:string}={}):boolean {
  let id=key.split('.')[0]!
  id=id.replace(/^dino[23]_/, 'dino1_')
  const body=walkBodies[id];if(!body)return false
  const H=body.height,bodyH=H*body.ratio,bodyW=bodyH*body.img.width/body.img.height
  const bodyBottom=-H*(1-body.ratio),hipY=bodyBottom-H*.025
  const footSize=H*(body.kind==='spider'?.04:id==='p1'?.12:.14)
  const ankleY=-footSize*.65,legH=ankleY-hipY
  const stride=legH*(body.kind==='quad'?2.1:body.kind==='spider'?1.8:2.5)
  const duty=body.kind==='quad'?.77:body.kind==='spider'?.7:.62
  let state=rests.get(pose.owner)
  if(!state){state={distance:pose.distance,moving:pose.moving,changed:pose.time-.2};rests.set(pose.owner,state)}
  if(state.moving!==pose.moving){state.moving=pose.moving;state.changed=pose.time}
  if(pose.moving)state.distance=pose.distance
  const fade=smooth(clamp((pose.time-state.changed)/.14,0,1))
  const weight=pose.moving?fade:1-fade
  const d=pose.moving?pose.distance:state.distance
  const sourceSign=body.left?-1:1
  const hipX=(fraction:number)=>(fraction-body.anchor)*bodyW*sourceSign
  const legs=body.kind==='biped'
    ? [{x:hipX(id==='p1'?.42:.64),phase:.5,far:true,bend:1},{x:hipX(id==='p1'?.42:.64),phase:0,far:false,bend:1}]
    : body.kind==='quad'
      ? [{x:hipX(.29),phase:.5,far:true,bend:-1},{x:hipX(.73),phase:.25,far:true,bend:1},{x:hipX(.29),phase:0,far:false,bend:-1},{x:hipX(.73),phase:.75,far:false,bend:1}]
      : Array.from({length:8},(_,i)=>({x:hipX(.3+(i%4)*.12),phase:(i%2===0?0:.5)+(i<4?0:.5),far:i<4,bend:i%4<2?-1:1}))
  const resolution=Math.max(1,body.img.height/bodyH)
  const margin=H*.5,w=Math.ceil((bodyW+margin*2)*resolution),h=Math.ceil((H+4)*resolution)
  let cv=surfaces.get(id);if(!cv){cv=document.createElement('canvas');surfaces.set(id,cv)}
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  const g=cv.getContext('2d')!;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h)
  const ox=w/resolution/2,oy=h/resolution-2;g.setTransform(resolution,0,0,resolution,ox*resolution,oy*resolution);g.imageSmoothingEnabled=false
  for(const leg of legs){
    const f=footAt(d,stride,leg.phase,duty,legH*.38)
    const footX=leg.x+f.x*weight,footY=ankleY+f.y*weight
    const a=legH*.69,b=legH*.65,k=kneeAt(leg.x,hipY,footX,footY,a,b,leg.bend)
    limb(g,leg.x,hipY,k.x,k.y,footX,footY,H*(body.kind==='spider'?.035:id==='p1'?.115:.14),body.colors,leg.far,footSize)
  }
  g.save();g.scale(sourceSign,1);g.drawImage(body.img,-bodyW*body.anchor,bodyBottom-bodyH,bodyW,bodyH);g.restore()
  ctx.save();ctx.translate(cx,bottom);ctx.scale((left?-1:1)*(style.scale??1),style.scale??1);ctx.imageSmoothingEnabled=false
  if(style.white)ctx.filter='brightness(2.6) saturate(0.2)'
  if(style.glow)ctx.filter=`drop-shadow(0 0 2px ${style.glow})`
  ctx.drawImage(cv,-ox,-oy,w/resolution,h/resolution);ctx.restore();return true
}
