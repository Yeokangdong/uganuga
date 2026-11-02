"""Pack the generated, intact cartoon frames and world art into the playable art set."""
from pathlib import Path
import json, math, statistics, hashlib, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-src/painted-v6'
OUT=ROOT/'public/assets/painted-v6'
sys.path.insert(0,str(ROOT/'tools'))
from sprite_workflow import save_pxo
OUT.mkdir(parents=True,exist_ok=True)
old=json.loads((ROOT/'public/assets/animation-v5/manifest.json').read_text(encoding='utf-8'))
sprites={};images={};preview=[]

def save_runtime(im,path,**options):
    temp=path.with_name(path.stem+'.tmp'+path.suffix)
    im.save(temp,**options);temp.replace(path)


def cells(name,cols=6,rows=4,key=False):
    im=Image.open(SRC/'raw'/f'{name}.png').convert('RGBA');result=[]
    if key:
        a=np.array(im);pink=(a[:,:,0]>150)&(a[:,:,2]>120)&(a[:,:,1]<110)
        a[pink,3]=0;im=Image.fromarray(a)
    for y in range(rows):
        for x in range(cols):
            tile=im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows)))
            a=np.array(tile);mask=a[:,:,3]>80
            labels,n=ndimage.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0
            if not n or not sizes.max():raise ValueError(f'Empty {name} {x},{y}')
            keep=np.flatnonzero(sizes>max(16,sizes.max()*.025))
            owned=np.isin(labels,keep)
            # Include edge antialiasing without importing transparent background RGB.
            near=ndimage.binary_dilation(owned,iterations=2)
            a[~near,3]=0;a[a[:,:,3]<12,3]=0
            tile=Image.fromarray(a);box=tile.getbbox()
            if not box:raise ValueError(name)
            result.append(tile.crop(box))
    return result

def hair(im,strict=True):
    a=np.array(im);r,g,b=a[:,:,:3].transpose(2,0,1)
    # Peach skin and the yellow tunic are not hair: including them made the
    # sprite pivot follow the swinging arm instead of the stationary head.
    mask=(a[:,:,3]>100)&(r>175)&(g>30)&(g<150)&(b<65)&(r>g*1.65)
    mask[round(im.height*.55):]=False
    if not strict:
        mask=(a[:,:,3]>100)&(r>160)&(g>40)&(g<170)&(b<85)&(r>g*1.35)
        mask[round(im.height*.6):]=False
    labels,n=ndimage.label(ndimage.binary_dilation(mask,iterations=2))
    if not n:return None
    size=np.bincount(labels.ravel());size[0]=0;mask&=labels==size.argmax();yy,xx=np.where(mask)
    if len(xx)<20:return None
    return (math.sqrt((xx.max()-xx.min()+1)*(yy.max()-yy.min()+1)),(xx.min()+xx.max()+1)/2,(yy.min()+yy.max()+1)/2)

def figure_cells(name,cols=6,rows=4):
    """The painted cells are guides, never scissors: retain entire connected bodies."""
    im=Image.open(SRC/'raw'/f'{name}.png').convert('RGBA');a=np.array(im)
    labels,n=ndimage.label(a[:,:,3]>80,structure=np.ones((3,3),dtype=int))
    sizes=np.bincount(labels.ravel());sizes[0]=0;boxes=ndimage.find_objects(labels)
    count=cols*rows;major=sorted(np.flatnonzero(sizes>100),key=lambda i:int(sizes[i]),reverse=True)[:count]
    if len(major)!=count:raise ValueError(f'{name}: {len(major)} bodies, expected {count}')
    def center(label):
        y,x=boxes[label-1];return np.array([(x.start+x.stop)/2,(y.start+y.stop)/2])
    major.sort(key=lambda i:center(i)[1]);ordered=[]
    for row in range(rows):ordered.extend(sorted(major[row*cols:(row+1)*cols],key=lambda i:center(i)[0]))
    centers=np.array([center(i) for i in ordered]);assignment={label:i+1 for i,label in enumerate(ordered)}
    unit=min(im.width/cols,im.height/rows)
    for label in np.flatnonzero(sizes>=8):
        if int(label) in assignment:continue
        distances=np.linalg.norm(centers-center(label),axis=1);closest=int(distances.argmin())
        if distances[closest]<unit*.7:assignment[int(label)]=closest+1
    lut=np.zeros(n+1,dtype=np.uint8)
    for label,owner in assignment.items():lut[label]=owner
    owners=lut[labels];result=[]
    for i in range(1,count+1):
        mask=ndimage.binary_dilation(owners==i,iterations=2);out=a.copy();out[~mask,3]=0;out[out[:,:,3]<12,3]=0
        tile=Image.fromarray(out);box=tile.getbbox()
        if not box:raise ValueError('Empty intact frame '+name)
        result.append(tile.crop(box))
    return result

def pack_actor(prefix,sheets,actions,height=None,left=False,runtime_quality=1):
    parts={name:figure_cells(name,4,2) if name.endswith(('-gait','-walk-v7','-walk-v8','-walk-v9')) or name=='piranha' else figure_cells(name) for name in sheets};ground=parts[sheets[0]][:6]
    reference=statistics.median(im.height for im in ground)
    target=128 if prefix=='p1' else 116
    base=old['sprites'].get(prefix+'.'+('fly' if prefix=='dino1_2' else 'idle'),{'h':height or 27})
    ppu=base['h']/target
    scale=target/reference
    atlas_size=4096 if runtime_quality>1 else 2048
    native=[];times=[];tags=[];atlas=Image.new('RGBA',(atlas_size,atlas_size));px=2;py=2;rowh=0
    for action,(sheet,indices) in actions.items():
        entries=[];start=len(native)+1;group=[]
        total=sum(old['sprites'].get(prefix+'.'+action,{}).get('durationsMs',[120]*len(indices)))
        if prefix=='squirrel':total={'pet':1080,'startled':280}.get(action,total)
        if prefix=='p1' and action=='angel':total=800
        durations=[round((i+1)*total/len(indices))-round(i*total/len(indices)) for i in range(len(indices))]
        # Geometry is authored in the images. One fixed scale per source cycle,
        # never a scale estimated independently from each moving head or foot.
        action_ratio=scale
        if sheet.endswith(('-gait','-walk-v7','-walk-v8','-walk-v9')):
            action_ratio=target/statistics.median(im.height for im in parts[sheet])
            if prefix=='p1':
                # Match the idle model's head size with ONE scale for the entire
                # cycle. A moving foot must never rescale the head or torso.
                idle_heads=[hair(im)[0] for im in ground if hair(im)]
                walk_heads=[hair(im)[0] for im in parts[sheet] if hair(im)]
                if idle_heads and walk_heads:action_ratio=scale*statistics.median(idle_heads)/statistics.median(walk_heads)
            elif prefix=='kingkong' and action=='carry':
                # Continue the final princess-holding pose at the same scale.
                action_ratio=scale*parts['kingkong'][11].height/statistics.median(im.height for im in parts[sheet])
        elif prefix=='p1' and sheet=='hero-states':action_ratio=target/parts[sheet][17].height
        if prefix=='p1' and action in ('angel','dead'):action_ratio=128/statistics.median(parts[sheet][i].height for i in indices)
        action_ratio=min(action_ratio,174/max(max(parts[sheet][i].size) for i in indices))
        for index in indices:
            tile=parts[sheet][index];head=hair(tile,strict=action not in ('climb','climbIdle')) if prefix=='p1' else None
            # Build the runtime atlas directly from the original drawings. Do
            # not enlarge the already reduced editor frames for large actors.
            ratio=action_ratio*runtime_quality
            size=tuple(max(1,round(v*ratio)) for v in tile.size)
            tile=tile.resize(size,Image.Resampling.LANCZOS)
            if action in ('angel','dead') and prefix=='p1':
                alpha=tile.getchannel('A');tile=ImageOps.grayscale(tile).convert('RGBA');tile.putalpha(alpha)
            w,h=tile.size
            if head:
                rootx=head[1]*ratio
                rooty=head[2]*ratio+target*.79 if action in ('climb','climbIdle') else h
            else:
                mask=np.array(tile)[:,:,3]>96;yy,xx=np.where(mask[round(h*.35):max(round(h*.7),round(h*.35)+1)])
                rootx=float(np.median(xx)) if len(xx) else w/2;rooty=h
            if px+w+2>atlas_size:px=2;py+=rowh+4;rowh=0
            if py+h+2>atlas_size:raise ValueError('Atlas full '+prefix)
            atlas.alpha_composite(tile,(px,py));entries.append({'rect':[px,py,w,h,rootx/w,rooty/h]})
            editor_tile=tile if runtime_quality==1 else tile.resize((round(w/runtime_quality),round(h/runtime_quality)),Image.Resampling.LANCZOS)
            ew,eh=editor_tile.size
            frame=Image.new('RGBA',(384,384));frame.alpha_composite(editor_tile,(max(58,min(326-ew,round(192-rootx/runtime_quality))),max(58,min(326-eh,round(250-rooty/runtime_quality)))))
            assert frame.getbbox() and min(frame.getbbox())>=58 and max(frame.getbbox())<=326,(prefix,action,frame.getbbox())
            native.append(frame);group.append(frame);px+=w+4;rowh=max(rowh,h)
        hworld=old['sprites'].get(prefix+'.'+action,base)['h']
        sprites[prefix+'.'+action]={'h':hworld,'ppu':ppu/runtime_quality,'fps':1000/(total/len(indices)),'facingLeft':left,'pixelArt':False,'durationsMs':durations,'frames':entries}
        times.extend(durations);tags.append({'name':prefix+'.'+action,'color':'#e6aa63','from':start,'to':len(native)})
    atlas=atlas.crop((0,0,atlas_size,py+rowh+2));name=prefix+'-'+hashlib.sha256(atlas.tobytes()).hexdigest()[:12]+'.webp';save_runtime(atlas,OUT/name,lossless=True,method=5)
    for key,s in sprites.items():
        if key.startswith(prefix+'.'):
            for f in s['frames']:f['src']=name
    save_pxo(SRC/'characters'/(prefix+'.pxo'),native,times,prefix,tags)
    preview.append((prefix,parts[sheets[0]][0]))

motion='hero-motion';combat='hero-combat';states='hero-states'
hero={
 'idle':(motion,list(range(6))),'walk':('hero-walk-v9',list(range(8))),'run':('hero-walk-v9',list(range(8))),
 'rescueRun':('hero-rescue-sprint-gait',list(range(8))),
 'jump':(motion,[18,19,20]),'fall':(motion,[20,21]),'land':(motion,[22,23]),
 'attack':(combat,list(range(6))),'attackUp':(combat,list(range(6,12))),
 'attackDown':(combat,list(range(12,18))),'throw':(combat,list(range(18,24))),
 'climb':(states,list(range(6))),'climbIdle':(states,[0,4]),'charge':(states,[6,7,8]),
 'hurt':(states,[12,13,14]),'respawn':(states,[15,16,17]),'win':(states,[18,20]),
 'dead':(states,[21,22,23]),'angel':('hero-angel-front-gait',list(range(8)))}
pack_actor('p1',[motion,combat,states,'hero-walk-v9','hero-rescue-sprint-gait','hero-angel-front-gait'],hero)

ground_actions={'walk':list(range(6)),'idle':[6,7,8],'hit':[9,10,11],'stun':[12,13,14],
 'collapse':[15,16,17],'recover':[18,19,20],'windup':[21,22],'attack':[21,22,23]}
for prefix,sheet in [('dino1_0','raptor'),('dino1_1','bronto'),('bear','bear'),('boar','boar')]:
    gait=sheet+'-walk-v7' if sheet in ('raptor','bear') else sheet+'-gait'
    if (SRC/'raw'/(gait+'.png')).exists():
        acts={a:(sheet,i) for a,i in ground_actions.items()};acts['walk']=(gait,list(range(8)));pack_actor(prefix,[sheet,gait],acts)
    else:pack_actor(prefix,[sheet],{a:(sheet,i) for a,i in ground_actions.items()})
ptero={'fly':list(range(6)),'idle':[6,7,8],'dive':[9,10,11],'hit':[12,13,14],
 'stun':[15,16,17],'collapse':[18,19,20],'recover':[21,22,23]}
pack_actor('dino1_2',['ptero'],{a:('ptero',i) for a,i in ptero.items()})
spider={'walk':list(range(6)),'idle':[6,7,8],'hang':[9,10,11],'drop':[12,13,14],
 'hit':[15,16,17],'stun':[18,19,20],'dead':[21,22,23],'attack':[12,13,14]}
pack_actor('spider',['spider','spider-gait'],{a:('spider-gait',list(range(8))) if a=='walk' else ('spider',i) for a,i in spider.items()})
for prefix,sheet in [('boss','boss-jungle'),('boss2','boss-volcano'),('boss3','boss-glacier')]:
    acts={'walk':list(range(6)),'idle':[6,7,8],'hit':[9,10,11],'stun':[12,13,14],
     'dead':[15,16,17],'windup':[18,19,20],'attack':[21,22,23],'spit':[21,22,23],
     'charge':list(range(6)),'jump':[18,19,20],'land':[9,10,11]}
    pack_actor(prefix,[sheet,sheet+'-gait'],{a:(sheet+'-gait',list(range(8))) if a in ('walk','charge') else (sheet,i) for a,i in acts.items()})
pack_actor('nuga',['princess','princess-chase-gait'],{'idle':('princess',list(range(6))),'wave':('princess',list(range(6,12))),'cheer':('princess',list(range(12,18))),'run':('princess-chase-gait',list(range(8)))})
pack_actor('squirrel',['squirrel-scrat-gait','squirrel-pet-gait','squirrel-run-v2-gait'],{'run':('squirrel-run-v2-gait',list(range(8))),'idle':('squirrel-scrat-gait',[0]),'pet':('squirrel-pet-gait',list(range(6))),'startled':('squirrel-pet-gait',[6,7])},height=16)
sprites['squirrel.pet'].update(durationsMs=[180]*6,fps=1000/180)
sprites['squirrel.startled'].update(durationsMs=[140]*2,fps=1000/140)
# The cutscene drawings face left; the new neutral gait faces right.
pack_actor('kingkong',['kingkong','kingkong-gait','kingkong-carry-v2-gait'],{'walk':('kingkong-gait',list(range(8))),'grab':('kingkong',list(range(6,12))),'carry':('kingkong-carry-v2-gait',list(range(8))),'jump':('kingkong',list(range(18,24)))},height=62,left=True,runtime_quality=3)
sprites['kingkong.walk']['facingLeft']=False
sprites['kingkong.carry']['facingLeft']=False
pack_actor('piranha',['piranha'],{'idle':('piranha',[0]),'jump':('piranha',[0,1,2,3]),'fall':('piranha',[4,5,6]),'stun':('piranha',[7])},height=16)

def single(key,tile,height,frames=None,fps=1):
    tiles=frames or [tile];w=max(im.width for im in tiles);h=max(im.height for im in tiles)
    cv=Image.new('RGBA',(w*len(tiles),h));rect=[]
    for i,im in enumerate(tiles):
        x=i*w+(w-im.width)//2;y=h-im.height;cv.alpha_composite(im,(x,y));rect.append({'rect':[i*w,0,w,h,.5,1]})
    name=key.replace('.','-')+'-'+hashlib.sha256(cv.tobytes()).hexdigest()[:12]+'.webp';save_runtime(cv,OUT/name,lossless=True,method=5)
    sprites[key]={'h':height,'ppu':height/h,'fps':fps,'facingLeft':False,'pixelArt':False,'frames':[dict(f,src=name) for f in rect]}

obj=figure_cells('objects',4,3)
# The flame next to the apple crosses the authored guide column. Keep the apple
# itself; guide columns must never import a neighboring weapon fragment.
apple=np.array(obj[3]);labels,n=ndimage.label(apple[:,:,3]>80,structure=np.ones((3,3),dtype=int))
areas=np.bincount(labels.ravel());areas[0]=0;mask=ndimage.binary_dilation(labels==areas.argmax(),iterations=2)
apple[~mask,3]=0;obj[3]=Image.fromarray(apple);obj[3]=obj[3].crop(obj[3].getbbox())
for index,key,h in [(0,'v2.log',8),(1,'item.bone',14),(2,'item.fire',17),(3,'item.fruit',10),(4,'item.meat',12),
 (5,'cave.clock',12),(6,'cave.empty',12),(7,'v2.flag',42),(8,'v2.door',56),(9,'v2.spikes',17),(10,'world.platform',7),(11,'proj.rock',12)]:single(key,obj[index],h)
for n in ['', '2','3']:
    for kind in ['meat','fruit','bone']:sprites[f'item{n}.{kind}']=sprites['item.'+kind]
sprites['item.bigmeat']=sprites['item.meat'];sprites['cave.treasure']=sprites['item.meat']
effects=cells('effects')
for key,indices,h,fps in [('fx.hit',list(range(6)),20,24),('fx.slash',list(range(6,12)),27,24),
 ('spawn.ring',list(range(18,24)),48,12)]:
    single(key,effects[indices[0]],h,[effects[i] for i in indices],fps)
fire=figure_cells('floor-fire',4,4)
single('fire.flame',fire[0],14,fire[:8],12)
single('fire.pillar',fire[8],30,fire[8:],12)
for a,b in [('fx.ko','fx.hit'),('fx.shock','fx.hit'),('fx.slashUp','fx.slash'),('fx.slashFire','fx.slash')]:sprites[a]=sprites[b]
projectiles=cells('projectiles',4,2)
for i,key in enumerate(['proj.rock','proj.fireball','proj2.lava','proj2.lavarock','proj3.ice','proj3.icicle','proj3.spear','cave.stalactite']):single(key,projectiles[i],14 if i==6 else 12)

def world_image(key,name,im=None):
    im=im or Image.open(SRC/'raw'/f'{name}.png').convert('RGBA')
    if max(im.size)>1920:im.thumbnail((1920,1080),Image.Resampling.LANCZOS)
    target=name+'.webp';save_runtime(im,OUT/target,quality=90,method=6);images[key]=target

for n,name in enumerate(['bg-jungle-bridges','bg-volcano-bridges','bg-glacier-bridges'],1):world_image('v2.bg'+str(n),name)
world_image('title.bg','title-scene-costume-v2');world_image('intro.uga','intro-dream')
world_image('world.rootedTree','jungle-rooted-tree')
thought=Image.open(SRC/'raw/nuga-thought-lookdown.png').convert('RGBA')
thought=thought.crop(thought.getbbox())
world_image('ui.nuga_thought','nuga-thought-lookdown',thought)
title_scrat=Image.open(SRC/'raw/title-scrat-acorn-offer.png').convert('RGBA')
title_scrat.putalpha(title_scrat.getchannel('A').point(lambda a:0 if a<16 else a))
world_image('title.scrat','title-scrat-acorn-offer',title_scrat.crop(title_scrat.getbbox()))
terrain=Image.open(SRC/'raw/terrain.png').convert('RGBA')
for theme in range(3):
    for row,kind in enumerate(['rock','surface','ladder']):
        tile=terrain.crop((round(theme*terrain.width/3),round(row*terrain.height/3),round((theme+1)*terrain.width/3),round((row+1)*terrain.height/3)))
        tile=tile.crop((5,5,tile.width-5,tile.height-5))
        if row:
            a=np.array(tile);a[(a[:,:,0]>150)&(a[:,:,2]>120)&(a[:,:,1]<120),3]=0;tile=Image.fromarray(a)
            box=tile.getbbox()
            if box:tile=tile.crop(box)
        tile.thumbnail((384,384),Image.Resampling.LANCZOS)
        if row==0:
            base=tile;tile=Image.new('RGBA',(base.width*2,base.height*2))
            tile.paste(base,(0,0));tile.paste(ImageOps.mirror(base),(base.width,0))
            tile.paste(ImageOps.flip(base),(0,base.height));tile.paste(ImageOps.mirror(ImageOps.flip(base)),(base.width,base.height))
        world_image(f'world.{kind}{theme}',f'{kind}{theme}',tile)
panel_source=Image.open(SRC/'raw/ui-panels.png').convert('RGBA')
panels=[]
for box in [(0,0,1050,470),(1050,0,1536,470),(0,470,1020,1024),(1020,470,1536,1024)]:
    tile=panel_source.crop(box);tile.putalpha(tile.getchannel('A').point(lambda a:0 if a<16 else a));panels.append(tile.crop(tile.getbbox()))
world_image('ui.status_panel','status-panel',panels[0]);world_image('ui.timer_panel','timer-panel',panels[1]);world_image('ui.portrait','portrait',panels[3])
dolmen=Image.open(SRC/'raw/dolmen.png').convert('RGBA');dolmen.putalpha(dolmen.getchannel('A').point(lambda a:0 if a<16 else a));dolmen=dolmen.crop(dolmen.getbbox())
font=ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf',48)
for stage in range(1,8):
    sign=dolmen.copy();sign.thumbnail((480,300),Image.Resampling.LANCZOS);d=ImageDraw.Draw(sign)
    text=f'STAGE {stage}';box=d.textbbox((0,0),text,font=font);x=(sign.width-(box[2]-box[0]))/2
    d.text((x,sign.height*.11+2),text,font=font,fill='#d0b58e',stroke_width=1,stroke_fill='#d0b58e')
    d.text((x,sign.height*.11),text,font=font,fill='#493a31');world_image(f'ui.stage_sign_{stage}',f'stage-sign-{stage}',sign)
for stage in range(1,4):
    world_image(f'ui.stage_sign_{stage}',f'legacy-stage-sign-{stage}',Image.open(ROOT/f'public/assets/runtime_stage_sign_{stage}.webp').convert('RGBA'))
supports=Image.open(ROOT/'public/assets/pixel-map/sign-supports.webp').convert('RGBA')
supports.putalpha(supports.getchannel('A').point(lambda a:0 if a<16 else a))
world_image('ui.sign_supports','stone-supports-grounded-v2',supports.crop(supports.getbbox()))
snow_supports=Image.open(SRC/'raw/snow-sign-supports.png').convert('RGBA')
snow_supports.putalpha(snow_supports.getchannel('A').point(lambda a:0 if a<16 else a))
world_image('ui.sign_supports_3','snow-sign-supports',snow_supports.crop(snow_supports.getbbox()))
manifest={'version':6,'pixelArt':False,'total':sum(len(s['frames']) for s in sprites.values()),'sprites':sprites,'images':images}
manifest_temp=OUT/'manifest.tmp.json';manifest_temp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');manifest_temp.replace(OUT/'manifest.json')
board=Image.new('RGB',(1200,math.ceil(len(preview)/6)*220),'#eee1c6');d=ImageDraw.Draw(board)
for i,(name,im) in enumerate(preview):
    im=im.copy();im.thumbnail((170,170),Image.Resampling.LANCZOS);x=i%6*200;y=i//6*220;board.paste(im,(x+(200-im.width)//2,y+10),im);d.text((x+12,y+190),name,fill='#49372b')
board.save(SRC/'cast.jpg',quality=94)
print(f'Packed {len(preview)} characters, {len(sprites)} actions/assets, {manifest["total"]} frames, {len(images)} world images')
