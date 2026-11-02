"""Whole-frame Pixelorama round-trip. AI plans only reorder, time and translate frames."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, concurrent.futures, datetime, hashlib, json, math, os, re, shutil, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/animation-v5'
WORK = ROOT / 'art-src/pixelorama'
EXE = Path(os.environ['LOCALAPPDATA']) / 'Programs/Pixelorama/Pixelorama-Windows-64bit/Pixelorama.exe'
LOOP_ACTIONS={'idle','walk','run','climb','climbIdle','charge','fly','stun','hang','wave','cheer'}
WALKS = ['p1.walk','dino1_0.walk','dino1_1.walk','bear.walk','boar.walk','spider.walk','boss.walk','boss2.walk','boss3.walk']

def read_json(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
def folder(key):
    if not re.fullmatch(r'[a-z][a-z0-9_]*(?:\.[a-z][a-zA-Z0-9_]*)+',key): raise ValueError('Invalid sprite key')
    return WORK / key
def stamp(): return datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
def backup(path):
    if path.exists():
        target=path.parent/'backups'/stamp()/path.name; target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)

def save_pxo(path, images, durations, title, tags=None):
    w,h=images[0].size;fps=12
    if not images or len(images)!=len(durations) or any(im.size!=(w,h) for im in images):raise ValueError('Inconsistent frames')
    data={'pixelorama_version':'v1.2.3-stable','pxo_version':7,'size_x':w,'size_y':h,'color_mode':5,'fps':fps,
          'layers':[{'name':'Full body','type':0,'visible':True,'locked':False,'blend_mode':0,'opacity':1.0,'parent':-1,'new_cels_linked':False}],
          'frames':[{'cels':[{'opacity':1.0,'z_index':0}],'duration':ms*fps/1000} for ms in durations],
          'current_frame':0,'current_layer':0,'tags':tags or [{'name':title,'color':'#ffc261','from':1,'to':len(images)}],
          'guides':[{'type':0,'pos':160}],'user_data':'Whole-frame animation; keep body intact.'}
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp')
    with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype','application/x-pixelorama');z.writestr('data.json',json.dumps(data))
        for i,im in enumerate(images,1):
            raw=im.convert('RGBA').tobytes();z.writestr(f'image_data/frames/{i}/layer_1',raw);z.writestr(f'image_data/final_images/{i}',raw)
    tmp.replace(path)

def load_pxo(path):
    with zipfile.ZipFile(path) as z:
        data=json.loads(z.read('data.json'))
        if data.get('color_mode',5)!=5:raise ValueError('Save the project in RGBA mode before exporting')
        size=(int(data['size_x']),int(data['size_y']));images=[];durations=[]
        for i,frame in enumerate(data['frames'],1):
            im=Image.new('RGBA',size)
            for j,layer in enumerate(data['layers'],1):
                if not layer.get('visible',True) or layer.get('type',0)!=0:continue
                if layer.get('blend_mode',0)!=0 or layer.get('effects'):raise ValueError('Export supports normal pixel layers without effects')
                tile=Image.frombytes('RGBA',size,z.read(f'image_data/frames/{i}/layer_{j}'))
                opacity=float(layer.get('opacity',1))*float(frame['cels'][j-1].get('opacity',1))
                if opacity!=1:tile.putalpha(tile.getchannel('A').point(lambda a:round(a*opacity)))
                im=Image.alpha_composite(im,tile)
            if not im.getbbox():raise ValueError(f'Empty frame {i}')
            images.append(im);durations.append(round(float(frame.get('duration',1))*1000/data.get('fps',12)))
    return images,durations

def contact_sheet(path, images, durations):
    cols=4;cell=192;sheet=Image.new('RGBA',(cols*cell,math.ceil(len(images)/cols)*cell),'#cdcbbf');d=ImageDraw.Draw(sheet)
    for i,im in enumerate(images):
        x=i%cols*cell;y=i//cols*cell;b=im.getbbox();glyph=im.crop(b);scale=min(3,150/glyph.width,140/glyph.height);glyph=glyph.resize((round(glyph.width*scale),round(glyph.height*scale)),Image.Resampling.NEAREST)
        sheet.alpha_composite(glyph,(x+(cell-glyph.width)//2,y+174-glyph.height));d.text((x+8,y+6),f'{i}: {durations[i]} ms',fill='#352718');d.line((x+8,y+174,x+184,y+174),fill='#82765c')
    sheet.save(path)

def make_plan(key,n,durations=None):
    return {'sprite':key,'reason':'Original full-frame order; edit timing, translation or order.','needs_redraw':[],
            'frames':[{'source':i,'duration_ms':(durations or [85]*n)[i],'dx':0,'dy':0} for i in range(n)]}

def apply_plan(key, plan_path, output):
    work=folder(key);images,_=load_pxo(work/'source.pxo');plan=read_json(plan_path)
    if plan.get('sprite')!=key or not 2<=len(plan.get('frames',[]))<=256:raise ValueError('Wrong sprite or frame count in plan')
    result=[];durations=[]
    for f in plan['frames']:
        idx=f['source'];ms=f['duration_ms'];dx=f['dx'];dy=f['dy']
        if not all(type(v) is int for v in (idx,ms,dx,dy)) or not 0<=idx<len(images) or not 20<=ms<=2000 or abs(dx)>24 or abs(dy)>24:raise ValueError('Invalid frame instruction')
        im=images[idx];b=im.getbbox()
        if b[0]+dx<0 or b[1]+dy<0 or b[2]+dx>im.width or b[3]+dy>im.height:raise ValueError('Instruction would clip a full-body frame')
        shifted=Image.new('RGBA',im.size);shifted.alpha_composite(im,(dx,dy));result.append(shifted);durations.append(ms)
    backup(output);save_pxo(output,result,durations,key);contact_sheet(output.with_suffix('.png'),result,durations)
    return output

def prepare(key, plan_path=None, sheet=None, columns=4, rows=3, quiet=False):
    work=folder(key);work.mkdir(parents=True,exist_ok=True)
    if not (work/'source.pxo').exists() or sheet:
        pack=read_json(ASSETS/'manifest.json');s=pack['sprites'][key];images=[]
        if sheet:
            raw=Image.open(sheet).convert('RGBA');cw=raw.width//columns;ch=raw.height//rows
            for i in range(columns*rows):
                tile=raw.crop((i%columns*cw,i//columns*ch,(i%columns+1)*cw,(i//columns+1)*ch));b=tile.getbbox()
                if not b:raise ValueError(f'Empty source cell {i}')
                glyph=tile.crop(b)
                if glyph.width>102 or glyph.height>102:raise ValueError('Import a packed sprite sheet (glyph max102px), not unscaled AI artwork')
                im=Image.new('RGBA',(256,256));im.alpha_composite(glyph,(128-glyph.width//2,160-glyph.height));images.append(im)
        else:
            for f in s['frames']:
                x,y,w,h,ax,ay=f['rect'];raw=Image.open(ASSETS/f['src']).convert('RGBA');tile=raw.crop((x,y,x+w,y+h))
                im=Image.new('RGBA',(256,256));im.alpha_composite(tile,(round(128-w*ax),round(160-h*ay)))
                if not im.getbbox() or sum(im.getchannel('A').tobytes())!=sum(tile.getchannel('A').tobytes()):raise ValueError('Frame import would clip pixels')
                images.append(im)
        durations=s.get('durationsMs') or [round(1000/s['fps'])]*len(images)
        if sheet:durations=[round(1000/s['fps'])]*len(images)
        backup(work/'source.pxo');save_pxo(work/'source.pxo',images,durations,key)
        write_json(work/'source.json',{'sprite':key,'canvas':[256,256],'pivot':[128,160],'ppu':s['ppu'],'height':s['h'],'facingLeft':s['facingLeft'],'frames':len(images),'action':key.split('.')[1],'loop':key.split('.')[1] in LOOP_ACTIONS})
    images,source_durations=load_pxo(work/'source.pxo')
    contact_sheet(work/'source.png',images,source_durations)
    if sheet and (work/'plan.json').exists():backup(work/'plan.json');write_json(work/'plan.json',make_plan(key,len(images),source_durations))
    if not (work/'plan.json').exists():write_json(work/'plan.json',make_plan(key,len(images),source_durations))
    project=work/('ai-candidate.pxo' if plan_path else 'project.pxo')
    if plan_path or sheet or not project.exists():apply_plan(key,plan_path or work/'plan.json',project)
    if not quiet:print(project)
    return project

def capture(key, project=None, quiet=False):
    work=folder(key);project=Path(project).resolve() if project else work/'project.pxo'
    images,durations=load_pxo(project);backup(work/'source.pxo')
    save_pxo(work/'source.pxo',images,durations,key);contact_sheet(work/'source.png',images,durations)
    meta=read_json(work/'source.json');meta['frames']=len(images);meta['action']=key.split('.')[1];meta['loop']=key.split('.')[1] in LOOP_ACTIONS;write_json(work/'source.json',meta)
    if not quiet:print(f'AI source snapshot: {len(images)} current full-body frames')


def pixel_run(args):
    if not EXE.is_file():raise FileNotFoundError(f'Install Pixelorama: {EXE}')
    flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
    p=subprocess.run([str(EXE),'--headless','--quit','--']+args,capture_output=True,text=True,timeout=90,creationflags=flags)
    if p.returncode:raise RuntimeError((p.stdout+p.stderr)[-1600:])
    if 'SCRIPT ERROR:' in p.stderr:raise RuntimeError(p.stderr[-1600:])
    return p

def export_project(key, project=None):
    work=folder(key);project=Path(project).resolve() if project else work/'project.pxo'
    if not project.exists():prepare(key)
    images,durations=load_pxo(project);out=work/'export';out.mkdir(exist_ok=True)
    # Include freshly blended frames, so headless export also works after GUI edits.
    staging=out/'sheet.pxo';save_pxo(staging,images,durations,key)
    png=out/'sheet.png';counted=pixel_run(['--framecount','--export','--spritesheet','--json','--output',str(png),str(staging)])
    if not png.exists() or not Image.open(png).convert('RGBA').getbbox():raise RuntimeError('Pixelorama export is empty')
    exported=Image.open(png).convert('RGBA')
    if exported.size!=(images[0].width*len(images),images[0].height):raise RuntimeError('Unexpected Pixelorama sheet layout')
    for i,im in enumerate(images):
        tile=exported.crop((i*im.width,0,(i+1)*im.width,im.height))
        # Transparent RGB is unspecified; compare visible colors and exact alpha.
        if tile.getchannel('A').tobytes()!=im.getchannel('A').tobytes():raise RuntimeError('Pixelorama changed frame alpha')
        bg=Image.new('RGBA',im.size,(0,0,0,255))
        if Image.alpha_composite(bg,tile).tobytes()!=Image.alpha_composite(bg,im).tobytes():raise RuntimeError('Pixelorama changed visible pixels')
    # Validate the native project on the command line, not just the Python writer.
    if str(len(images)) not in counted.stdout.splitlines():raise RuntimeError('Pixelorama frame-count mismatch')
    preview=[]
    for im in images:
        frame=Image.new('RGBA',(256,256),'#cdcbbf');frame.alpha_composite(im);preview.append(frame.convert('RGB'))
    preview[0].save(out/'preview.gif',save_all=True,append_images=preview[1:],duration=durations,disposal=2,**({'loop':0} if key.split('.')[1] in LOOP_ACTIONS else {}))
    write_json(out/'timing.json',{'sprite':key,'frames':len(images),'durations_ms':durations,'project':str(project)})
    print(f'Exported {len(images)} frames: {png}');return images,durations

def stage_sprite(key,project=None):
    images,durations=export_project(key,project);source=read_json(folder(key)/'source.json')
    cols=min(8,len(images));cell=256;sheet=Image.new('RGBA',(cols*cell,math.ceil(len(images)/cols)*cell))
    for i,im in enumerate(images):sheet.alpha_composite(im,(i%cols*cell,i//cols*cell))
    name=f'pixelorama-{key}-{stamp()}.webp';sheet.save(ASSETS/name,lossless=True,method=5)
    return {'h':source['height'],'ppu':source['ppu'],'fps':1000/(sum(durations)/len(durations)),
            'facingLeft':source['facingLeft'],'pixelArt':True,'durationsMs':durations,
            'frames':[{'src':name,'rect':[i%cols*cell,i//cols*cell,cell,cell,.5,160/cell]} for i in range(len(images))]}

def optimize_runtime():
    """Pack visible pixels only; preserve each frame's world-space pivot and scale."""
    manifest=ASSETS/'manifest.json';before=manifest.read_bytes();pack=json.loads(before)
    groups={};cache={};old_bytes=0;new_bytes=0
    for key,sprite in pack['sprites'].items():
        for frame in sprite['frames']:
            name=frame['src']
            if name not in cache:
                cache[name]=Image.open(ASSETS/name).convert('RGBA')
                old_bytes+=cache[name].width*cache[name].height*4
        groups.setdefault(key.split('.')[0],[]).append((key,sprite))
    for prefix,entries in groups.items():
        tiles=[];width=1024;x=1;y=1;row=0;used_width=0
        for key,sprite in entries:
            for frame in sprite['frames']:
                fx,fy,w,h,*pivot=frame['rect'];ax,ay=pivot if pivot else (.5,1)
                original=cache[frame['src']].crop((fx,fy,fx+w,fy+h))
                bounds=original.getchannel('A').getbbox() or (0,0,1,1)
                l,t,r,b=bounds;tile=original.crop(bounds);tw,th=tile.size
                if x+tw+1>width:x=1;y+=row+2;row=0
                rect=[x,y,tw,th,(w*ax-l)/tw,(h*ay-t)/th]
                tiles.append((frame,tile,rect));used_width=max(used_width,x+tw+1)
                x+=tw+2;row=max(row,th)
        atlas=Image.new('RGBA',(used_width,y+row+1))
        for _,tile,rect in tiles:atlas.paste(tile,(rect[0],rect[1]))
        digest=hashlib.sha256(atlas.tobytes()).hexdigest()[:16]
        name=f'packed-{prefix}-{digest}.webp';target=ASSETS/name
        if not target.exists():atlas.save(target,lossless=True,method=6,exact=True)
        with Image.open(target) as decoded:
            for frame,tile,rect in tiles:
                px,py,tw,th=rect[:4];actual=decoded.crop((px,py,px+tw,py+th)).convert('RGBA')
                if actual.tobytes()!=tile.tobytes():raise ValueError(f'Packed pixels differ: {prefix}')
                frame.update(src=name,rect=rect)
        new_bytes+=atlas.width*atlas.height*4
    if manifest.read_bytes()!=before:raise RuntimeError('Manifest changed during packing')
    snapshot=WORK/'backups'/stamp()/'manifest.json';snapshot.parent.mkdir(parents=True,exist_ok=True);snapshot.write_bytes(before)
    pack['packing']={'images':len(groups),'decodedBytes':new_bytes}
    temp=manifest.with_suffix('.tmp');write_json(temp,pack);temp.replace(manifest)
    print(f'Runtime packing: {len(cache)} -> {len(groups)} images; {old_bytes} -> {new_bytes} decoded bytes')


def sync_many(keys, project=None, use_ai=False):
    manifest=ASSETS/'manifest.json';before=manifest.read_bytes();staged={}
    def stage(key):
        selected=project or (folder(key)/'ai-candidate.pxo' if use_ai else None)
        if use_ai and not selected.is_file():raise FileNotFoundError(f'Missing AI candidate: {key}')
        return stage_sprite(key,selected)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs={pool.submit(stage,key):key for key in keys}
        for future in concurrent.futures.as_completed(jobs):
            key=jobs[future];staged[key]=future.result();print(f'Validated {len(staged)}/{len(keys)}: {key}',flush=True)
    if manifest.read_bytes()!=before:raise RuntimeError('Game manifest changed during export; rerun sync to preserve concurrent edits')
    snapshot=WORK/'backups'/stamp()/'manifest.json';snapshot.parent.mkdir(parents=True,exist_ok=True);snapshot.write_bytes(before)
    pack=json.loads(before);pack['sprites'].update(staged)
    pack['total']=sum(len(s['frames']) for s in pack['sprites'].values());pack['checks']['frames']=pack['total']
    pack['checks'].pop('uniqueFrames',None);pack['checks'].pop('minimumPadding',None)
    pack['pixelorama']={'actions':len(staged),'frames':sum(len(s['frames']) for s in staged.values()),'ai':use_ai}
    temp=manifest.with_suffix('.tmp');write_json(temp,pack);temp.replace(manifest)
    print(f'Game connected atomically: {len(staged)} actions; backup: {snapshot}',flush=True)
    optimize_runtime()


def analyze_character(prefix, keys, instruction):
    context=[];fingerprint=hashlib.sha256(instruction.encode());pages=[]
    for key in keys:
        prepare(key,quiet=True);capture(key,quiet=True)
        images,durations=load_pxo(folder(key)/'source.pxo')
        for im in images:fingerprint.update(im.tobytes())
        fingerprint.update(json.dumps(durations).encode())
        context.append({'sprite':key,'frames':len(images),'durations_ms':durations,'loop':key.split('.')[1] in LOOP_ACTIONS})
    for page in range(math.ceil(len(keys)/6)):
        selected=keys[page*6:(page+1)*6];canvas=Image.new('RGBA',(1536,len(selected)*148),'#cdcbbf');draw=ImageDraw.Draw(canvas)
        for row,key in enumerate(selected):
            images,durations=load_pxo(folder(key)/'source.pxo');y=row*148
            draw.text((4,y+2),key+' / '+('LOOP' if key.split('.')[1] in LOOP_ACTIONS else 'ONE SHOT'),fill='#241a0e')
            for i,im in enumerate(images):
                x=i*128;tile=im.crop((64,64,192,192));canvas.alpha_composite(tile,(x,y+20))
                draw.text((x+4,y+15),f'{i} / {durations[i]}ms',fill='#463a23');draw.line((x,y+116,x+127,y+116),fill='#b1a58b')
        path=WORK/f'ai-{prefix}-page{page+1}.png';canvas.save(path);pages.append(path)
    checkpoint=WORK/'ai-batch.json';state=read_json(checkpoint) if checkpoint.exists() else {}
    response=WORK/f'ai-{prefix}.json';signature=fingerprint.hexdigest()
    if state.get(prefix)==signature and response.exists():result=read_json(response);print(f'AI cached: {prefix}',flush=True)
    else:
        node=shutil.which('node');cli=Path(os.environ['APPDATA'])/'npm/node_modules/@openai/codex/bin/codex.js'
        if not node or not cli.is_file():raise FileNotFoundError('Codex CLI not installed')
        args=[node,str(cli),'exec','--sandbox','read-only','--skip-git-repo-check','--ephemeral','--cd',str(ROOT),
              '--output-schema',str(ROOT/'tools/sprite-batch.schema.json'),'--output-last-message',str(response)]
        for path in pages:args+=['--image',str(path)]
        args+=['--','-']
        prompt=(f'You are analyzing full-body sprite animation for character {prefix}. User request: {instruction}. '
                'Return ONLY schema JSON. Do not execute tools or edit files. Each image row is one action, with zero-based source frame indexes. '
                'Analyze EVERY action in the metadata exactly once. Retain EVERY source frame exactly once in its plan; never invent/delete/repeat frames. '
                'Preserve complete raster bodies. Only whole-frame integer translation and durations/order may change. Keep the original total duration approximately. '
                'LOOP actions require a coherent final-to-first transition. ONE SHOT actions must progress from anticipation through action to recovery/hold; '
                'never turn deaths, attacks, jumps, hurt or landing into ping-pong loops. For attack actions keep the impact around40-62percent of clip time. '
                'Only reorder when the evidence clearly supports it. Do not align airborne/flying/dead poses to the ground. Preserve body/head center through those poses. '
                'For grounded movement maintain a supporting foot and alternate leg phases. Body splitting, skeletal rigging, stretching, morphing, and crossfading are forbidden. '
                'Flag source indexes needing new drawing in needs_redraw; be honest that ordering cannot fix those. Use concise Korean reasons. '
                'The schema sprite keys and character must exactly match metadata. Metadata: '+json.dumps(context,ensure_ascii=False))
        print(f'AI analyzing: {prefix}, {len(keys)} actions',flush=True)
        run=subprocess.run(args,input=prompt,capture_output=True,text=True,encoding='utf-8',timeout=600,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if run.returncode:raise RuntimeError(f'AI {prefix}: '+(run.stderr+run.stdout)[-1800:])
        result=read_json(response)
    plans=result.get('plans',[])
    if result.get('character')!=prefix or {p['sprite'] for p in plans}!=set(keys) or len(plans)!=len(keys):raise ValueError(f'AI action coverage mismatch: {prefix}')
    for plan in plans:
        key=plan['sprite'];images,_=load_pxo(folder(key)/'source.pxo')
        if sorted(f['source'] for f in plan['frames'])!=list(range(len(images))):raise ValueError(f'AI dropped/repeated source frames: {key}')
        if any(type(i) is not int or i<0 or i>=len(images) for i in plan['needs_redraw']):raise ValueError('Invalid redraw index')
        path=folder(key)/'ai-plan.json';write_json(path,plan);apply_plan(key,path,folder(key)/'ai-candidate.pxo')
    state[prefix]=signature;write_json(checkpoint,state)
    print(f'AI ready: {prefix}, redraw flags in {sum(bool(p["needs_redraw"]) for p in plans)}/{len(plans)} actions',flush=True)


def analyze_all(keys,instruction):
    groups={}
    for key in keys:groups.setdefault(key.split('.')[0],[]).append(key)
    for prefix,selected in groups.items():analyze_character(prefix,selected,instruction)


def character_keys(prefix):
    keys=list(read_json(ASSETS/'manifest.json')['sprites'])
    result=keys if prefix=='all' else [k for k in keys if k.split('.')[0]==prefix]
    if not result:raise ValueError(f'Unknown character: {prefix}')
    return result


def import_cycle(key,sheet,columns=4,rows=2):
    """Import a generated whole-body gait while retaining native size and footing."""
    work=folder(key);old,times=load_pxo(work/'source.pxo')
    bounds=sorted((im.getbbox() for im in old),key=lambda b:b[3]-b[1])
    reference=bounds[len(bounds)//2];height=reference[3]-reference[1]
    center=sorted((b[0]+b[2])/2 for b in bounds)[len(bounds)//2]
    floor=max(b[3] for b in bounds)
    raw=Image.open(sheet).convert('RGBA')
    raw.putalpha(raw.getchannel('A').point(lambda a:255 if a>=128 else 0))
    cw=raw.width//columns;ch=raw.height//rows;images=[];tiles=[]
    for i in range(columns*rows):
        tile=raw.crop((i%columns*cw,i//columns*ch,(i%columns+1)*cw,(i//columns+1)*ch))
        box=tile.getchannel('A').getbbox()
        if not box:raise ValueError(f'Empty generated frame: {i}')
        tiles.append(tile.crop(box))
    climbing=key.endswith('.climb')
    def head_center(im):
        box=im.getchannel('A').getbbox();points=[]
        for y in range(box[1],box[1]+round((box[3]-box[1])*.52)):
            for x in range(box[0],box[2]):
                r,g,b,a=im.getpixel((x,y))
                if a and r>170 and 40<g<145 and b<65:points.append((x,y))
        if not points:raise ValueError('Cannot locate orange hair for climbing alignment')
        return ((min(x for x,y in points)+max(x for x,y in points))/2,(min(y for x,y in points)+max(y for x,y in points))/2)
    if climbing:
        heads=[head_center(im) for im in old];target=(sum(x for x,y in heads)/len(heads),sum(y for x,y in heads)/len(heads))
        scale=height/max(im.height for im in tiles)
    for tile in tiles:
        if climbing:
            tile=tile.resize((round(tile.width*scale),round(tile.height*scale)),Image.Resampling.NEAREST)
            hx,hy=head_center(tile);pos=(round(target[0]-hx),round(target[1]-hy))
        else:
            tile=tile.resize((round(tile.width*height/tile.height),height),Image.Resampling.NEAREST);pos=(round(center-tile.width/2),floor-height)
        im=Image.new('RGBA',(256,256));im.alpha_composite(tile,pos);images.append(im)
    total=1200 if climbing else sum(times);count=len(images);durations=[round((i+1)*total/count)-round(i*total/count) for i in range(count)]
    art_name='crossing-'+stamp()+'.png';shutil.copy2(sheet,work/art_name)
    for name in ['source.pxo','project.pxo','ai-candidate.pxo']:
        backup(work/name);save_pxo(work/name,images,durations,key)
    meta=read_json(work/'source.json');meta.update(frames=count,art=art_name);backup(work/'source.json');write_json(work/'source.json',meta)
    plan={'sprite':key,'reason':'전신 교대 등반 재원화. 머리 기준 정렬, 손발의 뻗기·잡기·당기기 연결, 1.2초 주기.' if climbing else '전신 교대 보행 재원화. 교차 통과와 좌우 지지 전환, 기존 표시 크기·접지·주기 유지.','needs_redraw':[],
          'frames':[{'source':i,'duration_ms':t,'dx':0,'dy':0} for i,t in enumerate(durations)]}
    for name in ['plan.json','ai-plan.json']:backup(work/name);write_json(work/name,plan)
    for name in ['source.png','ai-candidate.png']:contact_sheet(work/name,images,durations)
    print(f'Imported crossing gait: {key}, {count} frames')


def bundle(prefix,use_ai=False):
    groups={}
    for key in character_keys(prefix):groups.setdefault(key.split('.')[0],[]).append(key)
    for name,keys in groups.items():
        images=[];durations=[];tags=[];colors=['#ffc261','#75bde9','#e78a84','#a4cb80','#bd96dc']
        for i,key in enumerate(keys):
            path=folder(key)/('ai-candidate.pxo' if use_ai else 'project.pxo')
            frames,times=load_pxo(path);start=len(images)+1;images.extend(frames);durations.extend(times)
            tags.append({'name':key,'color':colors[i%len(colors)],'from':start,'to':len(images)})
        target=WORK/'characters'/(name+'.pxo');backup(target);save_pxo(target,images,durations,name,tags)
        print(f'Character project: {target} ({len(keys)} actions, {len(images)} frames)')


def unbundle(prefix,project=None):
    keys=character_keys(prefix);path=Path(project) if project else WORK/'characters'/(prefix+'.pxo')
    images,durations=load_pxo(path)
    with zipfile.ZipFile(path) as z:tags=json.loads(z.read('data.json'))['tags']
    bykey={t['name']:t for t in tags}
    if set(bykey)!=set(keys):raise ValueError('Keep the original action tag names when editing the character project')
    for key in keys:
        tag=bykey[key];a=int(tag['from'])-1;b=int(tag['to'])
        if not 0<=a<b<=len(images):raise ValueError('Invalid action range')
    for key in keys:
        tag=bykey[key];a=int(tag['from'])-1;b=int(tag['to']);target=folder(key)/'project.pxo'
        backup(target);save_pxo(target,images[a:b],durations[a:b],key)
    sync_many(keys)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['prepare','export','sync','status','capture','ai-all','batch','bundle','unbundle','optimize','import-cycle']);parser.add_argument('sprite',nargs='?',default='p1.walk')
    parser.add_argument('--plan',type=Path);parser.add_argument('--project',type=Path);parser.add_argument('--sheet',type=Path)
    parser.add_argument('--use-ai',action='store_true');parser.add_argument('--instruction',default='모든 동작의 자연스러운 전신 연결과 타이밍을 점검해')
    parser.add_argument('--columns',type=int,default=4);parser.add_argument('--rows',type=int,default=3)
    args=parser.parse_args()
    if args.action=='import-cycle':
        if not args.sheet:raise ValueError('Specify --sheet for the generated gait')
        import_cycle(args.sprite,args.sheet,args.columns,args.rows);return
    if args.action=='optimize':optimize_runtime();return
    if args.action=='bundle':bundle(args.sprite,args.use_ai);return
    if args.action=='unbundle':unbundle(args.sprite,args.project);return
    keys=list(read_json(ASSETS/'manifest.json')['sprites']) if args.sprite=='all' else WALKS if args.sprite=='walks' else [args.sprite]
    if args.action in ('ai-all','batch'):
        analyze_all(keys,args.instruction)
        if args.action=='batch':sync_many(keys,use_ai=True)
        return
    if args.action=='sync':
        if len(keys)>1 and args.project:raise ValueError('Specify one sprite when passing a project path')
        sync_many(keys,args.project,args.use_ai);return
    for key in keys:
        if args.action=='prepare':prepare(key,args.plan,args.sheet,args.columns,args.rows)
        elif args.action=='export':export_project(key,args.project)
        elif args.action=='capture':capture(key,args.project)
        else:print(json.dumps({'sprite':key,'editorInstalled':EXE.is_file(),'project':(folder(key)/'project.pxo').exists()},ensure_ascii=False))

if __name__=='__main__':main()
