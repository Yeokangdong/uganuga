"""Pack current terrain and approved animation atlases with sprite validation."""
from pathlib import Path
from PIL import Image
import json
import sys
import math
import statistics
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-src/rebuild-v2'
OUT=ROOT/'public/assets/rebuild-v2'
def pack_animation():
    import numpy as np
    from scipy import ndimage
    pixel='--v4' not in sys.argv
    version=5 if pixel else 4
    source=ROOT/f'art-src/animation-v{version}'
    target=ROOT/f'public/assets/animation-v{version}'
    target.mkdir(parents=True,exist_ok=True)
    spec=json.loads((source/('sprites.json' if pixel else 'manifest.json')).read_text(encoding='utf-8-sig'))
    character_scale=spec.get('characterScale',1)
    cell=spec['cell']; usable=cell*(1-2*spec['padding'])-4
    extracted={}; problems=[]
    for sheet in spec['sheets']:
        path=source/'raw'/(sheet['id']+'.png')
        if not path.exists(): problems.append(sheet['id']+': missing');continue
        im=Image.open(path).convert('RGBA');alpha=np.asarray(im)[:,:,3]
        labels,n=ndimage.label(alpha>40,structure=np.ones((3,3),dtype=int))
        sizes=np.bincount(labels.ravel());sizes[0]=0
        threshold=max(80,int(sizes.max()*.14))
        major=np.flatnonzero(sizes>=threshold)
        boxes=ndimage.find_objects(labels)
        nodes=[]
        for idx in major:
            ys,xs=boxes[idx-1];nodes.append({'label':idx,'box':[xs.start,ys.start,xs.stop,ys.stop]})
        if any(node['box'][0]<=1 or node['box'][1]<=1 or node['box'][2]>=im.width-1 or node['box'][3]>=im.height-1 for node in nodes):
            problems.append(sheet['id']+': figure touches source edge');continue
        # The expected figure count is checked before any atlas is accepted.
        if len(nodes)!=len(sheet['poses']):
            problems.append(f"{sheet['id']}: {len(nodes)} figures, expected {len(sheet['poses'])}");continue
        nodes.sort(key=lambda p:(p['box'][1]+p['box'][3])/2)
        ordered=[]
        for row in range(sheet['rows']):
            chunk=nodes[row*sheet['cols']:(row+1)*sheet['cols']]
            ordered.extend(sorted(chunk,key=lambda p:p['box'][0]))
        # Attach tiny detached ink fragments to the nearest figure. This keeps
        # antialiasing, hair tips and claws without clipping at an assumed grid.
        centers=np.array([[(n['box'][0]+n['box'][2])/2,(n['box'][1]+n['box'][3])/2] for n in ordered])
        assignment={int(n['label']):i for i,n in enumerate(ordered)}
        for idx in np.flatnonzero(sizes>0):
            if int(idx) in assignment:continue
            ys,xs=boxes[idx-1];center=np.array([(xs.start+xs.stop)/2,(ys.start+ys.stop)/2])
            closest=int(np.argmin(np.sum((centers-center)**2,axis=1)))
            if pixel:
                l,t,r,b=ordered[closest]['box']
                distance=math.hypot(max(l-center[0],0,center[0]-r),max(t-center[1],0,center[1]-b))
                if distance>max(r-l,b-t)*.12:continue
            assignment[int(idx)]=closest
        lut=np.full(n+1,-1,dtype=np.int16)
        for label,index in assignment.items():lut[label]=index
        owners=lut[labels]
        frames=[]
        unit=min(im.width/sheet['cols'],im.height/sheet['rows'])
        pixels=np.array(im)
        for index,pose in enumerate(sheet['poses']):
            mask=owners==index
            ys,xs=np.where(mask)
            l,r,t,b=int(xs.min()),int(xs.max())+1,int(ys.min()),int(ys.max())+1
            region=pixels[t:b,l:r].copy();region[:,:,3]*=mask[t:b,l:r]
            crop=Image.fromarray(region)
            frames.append({'image':crop,'pose':pose,'unit':unit,'sheet':sheet['id']})
        extracted[sheet['id']]=frames
    if problems:
        missing=[p for p in problems if p.endswith(': missing')]
        invalid=[p for p in problems if not p.endswith(': missing')]
        print(json.dumps({'readySheets':len(extracted),'missingSheets':len(missing),'invalidSheets':invalid}))
        if '--partial' not in sys.argv:raise SystemExit(2)
        ready=[a for a in spec['actors'] if all(s['id'] in extracted for s in spec['sheets'] if s['actor']==a['id'])]
        spec['actors']=ready
        spec['sheets']=[s for s in spec['sheets'] if any(a['id']==s['actor'] for a in ready)]
        spec['total']=sum(len(s['poses']) for s in spec['sheets'])
        if not spec['total']:raise SystemExit(2)
    actor_scale={};actor_ppu={};palettes={}
    for actor in spec['actors']:
        figures=[f for sh in spec['sheets'] if sh['actor']==actor['id'] for f in extracted[sh['id']]]
        if pixel:
            # Canvas/cell dimensions are not anatomy. Normalize actual head/body
            # mass so a differently shaped source sheet cannot enlarge a hero.
            for f in figures:
                data=np.array(f['image']);mask=data[:,:,3]>100
                if actor['id']=='uga':
                    rgb=data[:,:,:3].astype(float)
                    hair=mask&(rgb[:,:,0]>195)&(rgb[:,:,1]>40)&(rgb[:,:,1]<145)&(rgb[:,:,2]<65)&(rgb[:,:,0]>rgb[:,:,1]*1.6)
                    hair[int(f['image'].height*.64):,:]=False
                    # Join outline-separated hair clusters at source resolution.
                    # Never mix a bounding-box metric with an area fallback.
                    radius=max(1,round(f['image'].width*.012))
                    joined=ndimage.binary_dilation(hair,iterations=radius)
                    lab,count=ndimage.label(joined,structure=np.ones((3,3),dtype=int));areas=np.bincount(lab.ravel());areas[0]=0
                    selected=hair&(lab==int(areas.argmax())) if count else hair
                    yy,xx=np.where(selected)
                    if len(xx):
                        l,r=np.quantile(xx,[.01,.99]);top,bottom=np.quantile(yy,[.01,.99])
                        f['headMetric']=math.sqrt((r-l+1)*(bottom-top+1))
                        f['headX']=float((l+r)/2)/f['image'].width
                        mask=selected
                elif actor['id']=='ptero':
                    rgb=data[:,:,:3].astype(float)
                    beak=mask&(rgb[:,:,0]>150)&(rgb[:,:,1]>85)&(rgb[:,:,2]<95)&(rgb[:,:,0]>rgb[:,:,1]*1.08)
                    if beak.sum()>20:mask=beak
                f['metric']=f.get('headMetric',math.sqrt(max(1,int(mask.sum()))))
            references=[f for f in figures if f['pose']['action'] in ('idle','fly')]
            if actor['id']=='uga':
                for action in {f['pose']['action'] for f in figures}:
                    group=[f for f in figures if f['pose']['action']==action]
                    middle=statistics.median(f['metric'] for f in group)
                    for f in group:f['metric']=min(middle*1.08,max(middle*.92,f['metric']))
            native=actor['nativeHeight']*character_scale
            target_metric=native*statistics.median(f['metric']/f['image'].height for f in references)
            for f in figures:f['scale']=target_metric/f['metric']
            walking=[f for f in figures if f['pose']['action']=='walk']
            if walking:
                # A single authored walk sheet keeps one scale for its entire cycle.
                reference_height=statistics.median(f['image'].height*f['scale'] for f in references)
                walk_scale=reference_height/statistics.median(f['image'].height for f in walking)
                for f in walking:f['scale']=walk_scale
            cap=min(1,usable/max(max(f['image'].size)*f['scale'] for f in figures))
            for f in figures:f['scale']*=cap
            actor_ppu[actor['id']]=actor['height']*character_scale/statistics.median(f['image'].height*f['scale'] for f in references)
            sample=Image.new('RGB',(512,math.ceil(len(figures)/8)*64))
            for i,f in enumerate(figures):
                thumb=f['image'].copy();thumb.thumbnail((64,64),Image.Resampling.NEAREST)
                sample.paste(thumb,((i%8)*64,(i//8)*64),thumb)
            palettes[actor['id']]=sample.quantize(colors=48,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
        else:
            maximum=max(max(f['image'].size)/f['unit'] for f in figures)
            actor_scale[actor['id']]=usable/maximum
            reference=[f['image'].height/f['unit'] for f in figures if f['pose']['action'] in ('idle','fly')]
            actor_ppu[actor['id']]=actor['height']*character_scale/(statistics.median(reference)*actor_scale[actor['id']])
    sprites={};checks={'frames':0,'minimumPadding':cell,'uniqueFrames':0};fingerprints={};duplicates=[]
    packed=source/'packed'
    if pixel:packed.mkdir(exist_ok=True)
    rates={'idle':6,'walk':18,'run':30,'jump':24,'fall':16,'land':24,'climb':18,'climbIdle':4,'attack':36,'attackUp':28,'attackDown':28,'throw':30,'charge':10,'hurt':24,'hit':24,'dead':16,'respawn':16,'win':12,'windup':16,'stun':6,'collapse':18,'recover':18,'fly':18,'dive':24,'hang':6,'drop':18,'spit':20,'wave':12,'cheer':12}
    for sheet in spec['sheets']:
        actor=next(a for a in spec['actors'] if a['id']==sheet['actor'])
        canvas=Image.new('RGBA',(sheet['cols']*cell,sheet['rows']*cell))
        for index,f in enumerate(extracted[sheet['id']]):
            im=f['image'];scale=f['scale'] if pixel else actor_scale[actor['id']]/f['unit']
            im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST if pixel else Image.Resampling.LANCZOS)
            if pixel:
                alpha=im.getchannel('A').point(lambda a:255 if a>100 else 0)
                im=im.convert('RGB').quantize(palette=palettes[actor['id']],dither=Image.Dither.NONE).convert('RGBA');im.putalpha(alpha)
                clean=np.array(im);clean[clean[:,:,3]==0,:3]=0;im=Image.fromarray(clean)
                if im.getbbox():im=im.crop(im.getbbox())
            x=(cell-im.width)//2;y=(cell-im.height)//2
            if min(x,y,cell-x-im.width,cell-y-im.height)<cell*spec['padding']:raise ValueError('padding '+sheet['id'])
            canvas.alpha_composite(im,((index%sheet['cols'])*cell+x,(index//sheet['cols'])*cell+y))
            action=f['pose']['action'];key=actor['prefix']+'.'+action
            sprite=sprites.setdefault(key,{'h':actor['height']*character_scale,'ppu':actor_ppu[actor['id']],'fps':rates[action],'facingLeft':actor['left'],'pixelArt':pixel,'frames':[]})
            # A frame owns its image source. An action may cross sheet boundaries.
            anchor=.5; bottom=(y+im.height)/cell
            data=np.array(im)
            if actor['id']=='uga' and 'headX' in f:
                anchor=(x+f['headX']*im.width)/cell
            elif actor['id']!='ptero':
                # A moving paw or tail tip cannot move the actor's root.
                # Use the dense torso, excluding the top/head and bottom/feet.
                mask=data[int(im.height*.35):max(int(im.height*.7),int(im.height*.35)+1),:,3]>100
                yy,xx=np.where(mask)
                if len(xx):anchor=(x+float(np.median(xx)))/cell
            if pixel and actor['id']=='uga':
                rgb=data[:,:,:3].astype(float)
                skin=(data[:,:,3]>150)&(rgb[:,:,0]>180)&(rgb[:,:,1]>110)&(rgb[:,:,2]>70)&(rgb[:,:,0]-rgb[:,:,1]<110)
                skin[:int(im.height*.6),:]=False
                yy,xx=np.where(skin)
                if len(xx):
                    sole=int(yy.max())+1;bottom=(y+sole)/cell
            if actor['id']=='ptero':
                # The wing tip is not a foot anchor. Track the yellow beak so
                # flapping wings do not drag the whole body up and down.
                rgb=data[:,:,:3].astype(float)
                mask=(data[:,:,3]>150)&(rgb[:,:,0]>150)&(rgb[:,:,1]>85)&(rgb[:,:,2]<95)&(rgb[:,:,0]>rgb[:,:,1]*1.08)
                yy,xx=np.where(mask)
                if len(xx):
                    horizontal=actor['nativeHeight']*character_scale*.18 if pixel else usable*.12
                    vertical=actor['nativeHeight']*character_scale*.22 if pixel else usable*.15
                    anchor=(x+float(xx.mean())+horizontal)/cell
                    bottom=(y+float(yy.mean())+vertical)/cell
            sprite['frames'].append({'src':sheet['id']+'.webp','rect':[(index%sheet['cols'])*cell,(index//sheet['cols'])*cell,cell,cell,anchor,bottom]})
            checks['frames']+=1;checks['minimumPadding']=min(checks['minimumPadding'],x,y,cell-x-im.width,cell-y-im.height)
            fingerprint=(im.size,im.tobytes())
            if fingerprint in fingerprints:duplicates.append(sheet['id']+':'+str(index)+' = '+fingerprints[fingerprint])
            fingerprints[fingerprint]=sheet['id']+':'+str(index)
        canvas.save(target/(sheet['id']+'.webp'),lossless=pixel,quality=95,method=5)
        if pixel:canvas.save(packed/(sheet['id']+'.png'),optimize=True)
    checks['uniqueFrames']=len(fingerprints)
    if checks['frames']!=spec['total']:raise ValueError('frame count')
    if checks['uniqueFrames']!=checks['frames']:
        print(json.dumps({'duplicateFrames':duplicates}));raise ValueError('repeated identical frames')
    (target/'manifest.json').write_text(json.dumps({'version':version,'pixelArt':pixel,'characterScale':character_scale,'total':spec['total'],'cell':cell,'padding':spec['padding'],'checks':checks,'sprites':sprites},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps(checks))

def pack_walk_bodies():
    import numpy as np
    from scipy import ndimage
    root=ROOT/'art-src/animation-v5/walk-rebuild'
    record=json.loads((root/'rig-prompt.json').read_text(encoding='utf-8'))
    source=root/'rig-bodies.png'
    if not source.exists():
        import shutil
        shutil.copy2(record['source'],source)
    im=Image.open(source).convert('RGBA');data=np.array(im)
    labels,n=ndimage.label(data[:,:,3]>100,structure=np.ones((3,3)))
    sizes=np.bincount(labels.ravel());sizes[0]=0
    major=np.flatnonzero(sizes>sizes.max()*.12);boxes=ndimage.find_objects(labels)
    nodes=[]
    for label in major:
        ys,xs=boxes[label-1];nodes.append((label,(xs.start,ys.start,xs.stop,ys.stop)))
    if len(nodes)!=9:raise ValueError(f'Expected9 connected bodies, got{len(nodes)}')
    nodes.sort(key=lambda n:(n[1][1]+n[1][3])/2);ordered=[]
    for row in range(3):ordered+=sorted(nodes[row*3:(row+1)*3],key=lambda n:n[1][0])
    config=[
      ('p1',33,64,.73,.42,False,'biped',['#402314','#eca569','#ad643a','#ffcc91']),
      ('dino1_0',36,36,.73,.64,True,'biped',['#24341a','#5c922e','#325720','#ecd18b']),
      ('dino1_1',36,36,.68,.53,True,'quad',['#48270e','#c97c24','#8d4e17','#ead19b']),
      ('bear',36,36,.68,.53,True,'quad',['#382618','#aa713d','#704529','#e2ce9b']),
      ('boar',32,36,.68,.53,True,'quad',['#342316','#9a572d','#663b23','#332a21']),
      ('spider',16,20,.6,.53,True,'spider',['#34133f','#9a47b4','#602379','#ba6bd1']),
      ('boss',78,64,.73,.64,True,'biped',['#4f2114','#cf4823','#8b2c1c','#efd6a1']),
      ('boss2',78,64,.68,.53,True,'quad',['#282125','#64534a','#443a36','#e3c99c']),
      ('boss3',78,64,.73,.64,True,'biped',['#173749','#7cc4db','#40889e','#e6eff0'])]
    out=ROOT/'public/assets/animation-v5';result={}
    for (label,box),(id,height,native,ratio,anchor,left,kind,colors) in zip(ordered,config):
        l,t,r,b=box;pixels=data[t:b,l:r].copy();pixels[:,:,3]*=(labels[t:b,l:r]==label)
        body=Image.fromarray(pixels);h=round(native*.75*ratio);w=round(body.width*h/body.height)
        body=body.resize((w,h),Image.Resampling.NEAREST)
        alpha=body.getchannel('A').point(lambda a:255 if a>100 else 0)
        body=body.convert('RGB').quantize(colors=32,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGBA');body.putalpha(alpha)
        file='walk-body-'+id+'.webp';body.save(out/file,lossless=True,method=5)
        result[id]={'src':file,'height':height*.75,'ratio':ratio,'anchor':anchor,'left':left,'kind':kind,'colors':colors}
    (out/'walk-rig.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Walking body rigs:9')


def main():
    if '--gait' in sys.argv:return pack_walk_bodies()
    if '--animation' in sys.argv:return pack_animation()
    OUT.mkdir(parents=True,exist_ok=True)
    count=0
    for source in SRC.glob('*.png'):
        im=Image.open(source).convert('RGBA')
        im.save(OUT/(source.stem+'.webp'),quality=93,method=6)
        count+=1
    manifest=json.loads((ROOT/'public/assets/art.json').read_text(encoding='utf-8-sig'))
    for src in list(manifest['images'].values())+[v['src'] for v in manifest['sprites'].values()]:
        if not (ROOT/'public/assets'/src).is_file():raise FileNotFoundError(src)
    print(f'v2 assets: {count}; UI/effects: valid')
if __name__=='__main__':main()
