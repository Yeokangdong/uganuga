// Development-only headless input runner. Never writes player or rule state.
// node src-phaser/complete.mjs [stage] [policy]
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']})
const page=await browser.newPage({viewport:{width:960,height:540}})
page.setDefaultTimeout(120000)
try {
if(process.argv[2]==='--preview'){
 await page.goto('http://127.0.0.1:5277/')
 await page.waitForFunction(()=>window.__phaserGame?.scene.isActive('Title'))
 const previews=[];
 for(let stage=1;stage<=15;stage++){
  await page.evaluate(stage=>window.__phaserGame.scene.start('Play',{stage}),stage)
  await page.waitForFunction(stage=>window.__movement?.ready&&window.__movement.level.def.id===stage,stage)
  previews.push(await page.evaluate(async({stage,base})=>{
   const {Game}=await import(base+'/src/game/game.ts');
   const cv=document.createElement('canvas'),old=new Game(cv,{onHud(){},onEnd(){}},stage-1,true);
   old.skipIntro();old.render();
   const s=window.__movement; s.draw();
   const result={stage,old:cv.toDataURL(),phaser:s.textures.get('movement-view').getSourceImage().toDataURL(),tiles:old.level.tiles.every((t,i)=>t===s.level.tiles[i]),ladders:old.level.ladders.every((t,i)=>t===s.level.ladders[i])};
   old.stop();old.level.canvas.width=1;old.level.canvas.height=1;return result;
  },{stage,base:'/@fs/'+process.cwd().replaceAll('\\','/')}))
 }
 await page.evaluate(()=>window.__phaserGame.scene.start('Journey',{kind:'rescue',stage:15,score:0,lives:3}))
 await page.waitForFunction(()=>window.__phaserGame.scene.getScene('Journey').ready)
 const ending=await page.evaluate(()=>window.__phaserGame.textures.get('journey-view').getSourceImage().toDataURL())
 const data=await page.evaluate(async({previews,ending})=>{
  const cv=document.createElement('canvas');cv.width=1560;cv.height=1160;const ctx=cv.getContext('2d');
  ctx.fillStyle='#142328';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#ffe2a0';ctx.font='bold 24px sans-serif';ctx.fillText('277 | Phaser 8단계 — 15판 동일 시작 구간 비교',24,36);
  ctx.font='16px sans-serif';ctx.fillText('각 칸 왼쪽: 기존판 / 오른쪽: Phaser · 엔딩은 연출 미리보기 (완주 증거 아님)',24,64);
  const draw=async(src,x,y,w,h)=>{const im=new Image();im.src=src;await im.decode();ctx.drawImage(im,x,y,w,h)};
  for(const [i,p] of previews.entries()){const x=18+(i%3)*516,y=90+Math.floor(i/3)*174;ctx.fillStyle='#ffe2a0';ctx.fillText(`STAGE ${p.stage} · 지형 ${p.tiles?'일치':'차이'} / 사다리 ${p.ladders?'일치':'차이'}`,x,y);await draw(p.old,x,y+8,248,139.5);await draw(p.phaser,x+254,y+8,248,139.5)}
  ctx.fillStyle='#ffe2a0';ctx.fillText('누가 구출 연출 미리보기 · 실제 완주 결과는 구현_277.md 참조',540,1010);await draw(ending,18,966,320,180);
  return cv.toDataURL().split(',')[1];
 },{previews,ending})
 await writeFile('codex/reports/shots/277_phaser.png',Buffer.from(data,'base64'))
 console.log(JSON.stringify({comparison:previews.map(({stage,tiles,ladders})=>({stage,tiles,ladders})),preview:'codex/reports/shots/277_phaser.png'}))
} else {
await page.goto('http://127.0.0.1:5277/?stage='+ (process.argv[2]||1))
await page.waitForFunction(()=>window.__phaserGame?.scene.isActive('Title'))
await page.keyboard.press('Space')
await page.waitForFunction(()=>window.__movement?.ready)
if(process.argv.includes('--qa')){
 await page.keyboard.press('Space',{delay:40});await page.keyboard.press('Escape',{delay:40});
 await page.waitForFunction(()=>window.__movement.paused);
 const paused=await page.evaluate(()=>({paused:window.__movement.paused,time:window.__movement.runtime.time}))
 await page.waitForTimeout(300)
 const pauseFrozen=await page.evaluate(t=>window.__movement.runtime.time===t,paused.time)
 await page.keyboard.press('Escape',{delay:40});await page.waitForFunction(()=>!window.__movement.paused);await page.evaluate(()=>window.__phaserGame.loop.stop())
 const timer=await page.evaluate(()=>{
  const s=window.__movement,g=s.runtime,p=s.player,draw=s.draw.bind(s);let k=0,extensions=0,respawns=0,was=p.dead;
  s.draw=()=>{if(k++%30===0)draw()};
  for(let i=0;i<22000&&!p.out;i++){
   const t=g.timeLeft;s.update(i*1000/60,1000/60);
   if(g.timeLeft>t+.1)extensions++;if(was&&!p.dead)respawns++;was=p.dead;
  }
  s.draw=draw;return {extensions,respawns,out:p.out,hud:Math.ceil(g.timeLeft/3.6),lives:p.lives};
 })
 await page.evaluate(()=>window.__phaserGame.loop.wake())
 await page.waitForFunction(()=>window.__phaserGame.scene.getScene('Journey').journey?.kind==='result')
 await page.waitForFunction(()=>{const s=window.__phaserGame.scene.getScene('Journey');return s.ready&&s.elapsed>.6});await page.keyboard.press('Enter')
 await page.waitForFunction(()=>window.__phaserGame.scene.getScene('Journey').journey?.kind==='opening')
 const sizes=[];
 for(const [width,height] of [[640,360],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  sizes.push(await page.evaluate(()=>{const b=document.querySelector('canvas').getBoundingClientRect();return {width:innerWidth,height:innerHeight,canvas:[b.width,b.height],fits:b.width<=innerWidth+1&&b.height<=innerHeight+1}}))
 }
 const lifecycle=[];
 for(let i=0;i<5;i++){
  await page.evaluate(()=>window.__phaserGame.scene.start('Play',{stage:1}));await page.waitForFunction(()=>window.__movement?.ready);
  lifecycle.push(await page.evaluate(()=>({textures:Object.keys(window.__phaserGame.textures.list).length,blur:window.__phaserGame.events.listenerCount('blur'),keys:window.__movement.input.keyboard.keys.filter(Boolean).length})))
 }
 await page.waitForTimeout(3000)
 console.log(JSON.stringify({qa:{pauseFrozen,timer,restart:true,sizes,lifecycle,fps:await page.evaluate(()=>window.__phaserGame.loop.actualFps)}}))
} else {
await page.evaluate(()=>window.__phaserGame.loop.stop())
const result=await page.evaluate(async({stage,policy})=>{
 const adaptive=policy===9;if(adaptive)policy=2;
 const s=window.__movement,g=s.runtime,p=s.player,lv=s.level;
 const nodes=[],byCell=new Map();
 for(let c=1;c<lv.cols-1;c++)for(let r=2;r<lv.rows;r++){
  const t=lv.tile(c,r),ladder=lv.isLadder(c,r-1);
  if((lv.isSolidTile(t)||t===2||ladder||lv.isLadderTop(c,r))&&!lv.solidAt(c*16+8,r*16-8)&&!lv.solidAt(c*16+8,r*16-24)){
   const n={x:c*16+8,y:r*16,c,r,ladder,edges:[],cost:Infinity};byCell.set(c+','+r,n);nodes.push(n);
  }
 }
 for(const n of nodes)for(let dc=-3;dc<=3;dc++)for(let dr=-3;dr<=5;dr++){
  const b=byCell.get((n.c+dc)+','+(n.r+dr));if(!b||b===n)continue;
  let kind='jump',ok=false;
  if(Math.abs(dc)<=1&&Math.abs(dr)<=1&&n.ladder&&b.ladder){ok=true;kind='ladder'}
  else if(Math.abs(dc)===1&&dr>=0&&dr<=1){ok=true;kind='walk'}
  else if(dc){
   const h=b.y-n.y,disc=340*340+2400*h;
   if(disc>=0){const duration=(340+Math.sqrt(disc))/1200;ok=Math.abs(dc*16)<=duration*90-2;
    if(ok)for(let k=1;k<20;k++){const t=duration*k/20,x=n.x+(b.x-n.x)*k/20,y=n.y-340*t+600*t*t;if(lv.solidAt(x-6,y-8)||lv.solidAt(x+6,y-8)||lv.solidAt(x,y-24)){ok=false;break}}
   }
  }
  if(ok)n.edges.push({b,kind,cost:Math.hypot(dc*16,dr*16)+(kind==='jump'?8:0)});
 }
 const goal=nodes.filter(n=>n.x>=lv.arenaX+32).sort((a,b)=>Math.abs(a.y-p.y-p.h)-Math.abs(b.y-p.y-p.h))[0];
 if(goal){goal.cost=0;const queue=[goal];while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const n=queue.shift();for(const a of nodes.filter(a=>Math.abs(a.x-n.x)<=48&&Math.abs(a.y-n.y)<=80))for(const e of a.edges)if(e.b===n&&a.cost>n.cost+e.cost){a.cost=n.cost+e.cost;a.next={node:n,kind:e.kind};queue.push(a)}}}
 // Render at 10Hz while preserving every 60Hz gameplay/input tick.
 const draw=s.draw.bind(s);let renderTick=0;
 s.draw=()=>{if(renderTick++%6===0)draw()};
 let prev={},extended=0,clocks=0,bossAt=null,fullAt=null,lastX=p.x,lastY=p.y,stuck=0,trace=[],deaths=0,wasDead=false;
 let furthest=p.x,progressAt=0;const foes=new WeakMap();
 let caveEntered=false,caveReturned=false,airTarget=null,routeTarget=null;
 const keys={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',attack:'Space'};
 for(let tick=0;tick<36000;tick++){
  if(adaptive&&g.food>=60)policy=stage===7?6:8;
  if(!s.ready||p.out||g.mode==='clear'||g.mode==='rescue'||caveReturned)break;
  const input={left:false,right:false,up:false,down:false,attack:false};
  if(p.alive){
   if(p.x>furthest+24){furthest=p.x;progressAt=g.time}
   const hungry=g.food<60||policy>=8&&p.hp<7;
   const foods=hungry?g.items.filter(i=>!i.dead&&['fruit','meat','bigmeat'].includes(i.kind)&&Math.abs(i.y-p.y)<75&&i.x>p.x-80):[];
   foods.sort((a,b)=>Math.hypot(a.x-p.cx,(a.y-p.y)*2)-Math.hypot(b.x-p.cx,(b.y-p.y)*2));
   const enemies=g.enemies.filter(e=>{
    let seen=foes.get(e);if(!seen||seen.hp!==e.hp){seen={hp:e.hp,at:g.time};foes.set(e,seen)}
    return (policy<6||p.onGround)&&!e.dead&&!e.dying&&!e.invulnerable&&Math.abs(e.y+e.h-p.y-p.h)<(policy>=6?18:40)&&Math.abs(e.cx-p.cx)<150&&g.time-seen.at<12;
   });
   enemies.sort((a,b)=>Math.abs(a.cx-p.cx)-Math.abs(b.cx-p.cx));
   const foe=g.mode==='boss'?g.boss:hungry?enemies[0]:null;
   let target=lv.arenaX+48;
   if(hungry)target=foods[0]?.x??foe?.cx??target;
   if(foe){
    const distance=foe.cx-p.cx;
    target=foe.cx-Math.sign(distance||1)*(foe.w/2+9);
    if(Math.abs(distance)<foe.w/2+40){
     input.attack=p.swingT<=0&&!prev.attack;
     if(p.facing!==Math.sign(distance)){input.left=distance<0;input.right=distance>0;}
    }
   }
   if(!input.left&&!input.right){input.left=target<p.cx-3;input.right=target>p.cx+3;}
   const dir=input.left?-1:1,feet=p.y+p.h;
   stuck=Math.hypot(p.x-lastX,p.y-lastY)<.15?stuck+1:0;lastX=p.x;lastY=p.y;
   const wall=lv.solidAt(p.cx+dir*14,feet-8);
   const support=(x,y)=>{const c=Math.floor(x/16),r=Math.floor(y/16);return lv.solidAt(x,y)||lv.tile(c,r)===2||lv.isLadderTop(c,r)};
   const gap=!support(p.cx+dir*(policy===0?3:9),feet+4);
   const pickup=foods[0]&&Math.abs(foods[0].x-p.cx)<35&&foods[0].y<p.y-5;
   const fallback=g.time-progressAt>8&&Math.floor((g.time-progressAt)/8)%2===1;
   const jump=(wall||gap||pickup||stuck>18||(policy===1||policy===3||policy>=4||fallback)&&tick%75<2)&&p.onGround;
   input.up=p.climbing||jump;
   if(policy>=2&&!foe&&!foods[0]&&g.mode==='play'){
    if(p.onGround||p.climbing)airTarget=null;
    if(policy===2)routeTarget=null;
    const near=nodes.filter(n=>Number.isFinite(n.cost)&&Math.abs(n.x-p.cx)<40&&Math.abs(n.y-feet)<30).sort((a,b)=>Math.hypot(a.x-p.cx,(a.y-feet)*2)-Math.hypot(b.x-p.cx,(b.y-feet)*2))[0];
    if(routeTarget&&(Math.hypot(routeTarget.node.x-p.cx,routeTarget.node.y-feet)<6||stuck>100))routeTarget=null;
    if(!routeTarget&&near?.next)routeTarget={...near.next,from:near};
    if(routeTarget){const to=routeTarget.node,from=routeTarget.from;input.left=to.x<p.cx-2;input.right=to.x>p.cx+2;
     input.down=policy>=6&&to.y>feet+6&&Math.abs(to.x-p.cx)<10;
     input.up=!input.down&&(routeTarget.kind==='ladder'||p.climbing||routeTarget.kind==='jump'&&p.onGround&&Math.abs(p.cx-from.x)<10);
     if(routeTarget.kind==='jump'&&p.onGround&&Math.abs(p.cx-from.x)>=10){input.left=from.x<p.cx;input.right=from.x>p.cx}
     if(routeTarget.kind==='jump'&&input.up&&p.onGround)airTarget=to;
    }
    // Keep the selected landing point while airborne instead of reversing toward
    // whichever graph node happens to become nearest during the jump.
    if(airTarget&&!p.onGround&&!p.climbing){input.left=airTarget.x<p.cx-2;input.right=airTarget.x>p.cx+2;input.up=false;}
   }
   if(g.mode==='boss'&&foe?.phase==='attack'&&foe.move==='chest'&&p.onGround)input.up=true;
   if(g.mode==='boss'&&policy>=6&&foe?.phase){
    if(p.onGround&&((foe.move==='charge'&&foe.phase==='attack'&&Math.abs(foe.cx-p.cx)<110)||(foe.move==='chest'&&foe.phase==='warning'&&foe.remaining<.2)))input.up=true;
    if(foe.move==='jump'&&foe.phase==='warning'&&Math.abs(foe.target-p.cx)<70){input.left=p.cx<foe.target;input.right=!input.left;input.attack=false;}
   }
   if(p.climbing&&stuck>100){input.up=false;input.right=true;}
   if(policy>=6&&!p.climbing&&g.enemies.some(e=>!e.dead&&!e.dying&&Math.abs(e.cx-p.cx)<e.w/2+35&&Math.abs(e.y+e.h-feet)<24))input.attack=p.swingT<=0&&!prev.attack;
   if(policy===5){
    const clock=g.saved?g.items.find(i=>i.kind==='clock'&&!i.dead):null;
    const door=g.saved?{x:64,floor:p.y+p.h}:g.doors.find(d=>!d.used);
    if(door){input.left=door.x<p.cx-3;input.right=door.x>p.cx+3;input.attack=false;
     if(Math.abs(door.x-p.cx)<8&&p.onGround){input.up=false;input.down=!prev.down}
    }
    if(clock){input.left=clock.x<p.cx-3;input.right=clock.x>p.cx+3;input.down=false;}
   }
  }
  for(const [action,code] of Object.entries(keys))if(input[action]!==!!prev[action]){
   window.dispatchEvent(new KeyboardEvent(input[action]?'keydown':'keyup',{key:code==='Space'?' ':code,code,keyCode:{ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Space:32}[code],which:{ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Space:32}[code],bubbles:true}));
  }
  const before=g.timeLeft,items=g.items.filter(i=>i.kind==='clock'&&!i.dead);
  s.input.keyboard.update(); s.input.keyboard.manager.queue.length=0; s.update(tick*1000/60,1000/60);
  if(g.saved)caveEntered=true;else if(caveEntered)caveReturned=true;
  if(g.timeLeft>before+.1){if(items.some(i=>i.dead))clocks++;else extended++;}
  if(p.dead&&!wasDead)deaths++;wasDead=p.dead;
  if(g.food>=60&&fullAt===null)fullAt=g.time;
  if(g.mode==='boss'&&bossAt===null)bossAt=g.time;
  if(tick%600===0)trace.push([+g.time.toFixed(1),Math.round(p.x),Math.round(p.y),g.food,p.hp,p.lives,g.mode,g.boss?.hp,...g.enemies.filter(e=>Math.abs(e.cx-p.cx)<100).map(e=>[e.hp,Math.round(e.x),Math.round(e.y),e.stunT,e.finishHits])]);
  prev=input;
 }
 s.draw=draw;s.draw();
 return {stage,policy,food:g.food,elapsed:+g.time.toFixed(2),hud:Math.ceil(g.timeLeft/3.6),extended,clocks,fullAt,bossAt,mode:g.mode,out:p.out,deaths,x:p.x,y:p.y,caveEntered,caveReturned,trace};
},{stage:Number(process.argv[2]||1),policy:Number(process.argv[3]||0)})
 if(result.mode==='clear'||result.mode==='rescue'){
  await page.evaluate(()=>window.__phaserGame.loop.wake())
  await page.waitForFunction(stage=>stage<15?window.__movement?.ready&&window.__movement.level.def.id===stage+1:window.__phaserGame.scene.getScene('Journey').journey?.kind==='rescue',result.stage)
  result.next=result.stage<15?result.stage+1:'rescue';
 }
 console.log(JSON.stringify(result))
}
}
} finally { await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,2000))]) }
process.exit(0)

