"""Extract authored poses, export the region cast and build review catalogs."""
from pathlib import Path
import argparse, hashlib, html, json
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage
from sprite_workflow import save_pxo
from pack_monsters_v7 import ACTIONS

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art-src/world-v8'
OUT = ROOT / 'public/assets/world-v8'

def bodies(raw, count):
    labels, _ = ndimage.label(np.asarray(raw)[:, :, 3] > 80)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    significant = np.flatnonzero(sizes > (2000 if count == 16 else 1000))
    objects = ndimage.find_objects(labels)
    if count == 1:
        yy, xx = np.where(np.isin(labels, significant))
        if not len(xx): raise ValueError('Empty entrance')
        return [raw.crop((max(0, int(xx.min())-2), max(0, int(yy.min())-2),
                          min(raw.width, int(xx.max())+3), min(raw.height, int(yy.max())+3)))]
    if len(significant) != count:
        raise ValueError(f'Expected {count} separate full bodies, found {len(significant)}')
    boxes = []
    for label in significant:
        ys, xs = objects[label-1]
        boxes.append((max(0,xs.start-2),max(0,ys.start-2),min(raw.width,xs.stop+2),min(raw.height,ys.stop+2)))
    boxes.sort(key=lambda b:(b[1]+b[3])/2)
    ordered=[]
    for r in range(4): ordered.extend(sorted(boxes[r*4:r*4+4],key=lambda b:b[0]))
    return [raw.crop(box) for box in ordered]

def pack_one(spec):
    key=spec['key']; raw=Image.open(SRC/'raw'/f'{key}.png').convert('RGBA')
    if raw.getchannel('A').getextrema()[0] != 0: raise ValueError('Missing transparency')
    door=spec['kind']=='door'
    poses=bodies(raw,1 if door else 16)
    scale=min(232/max(p.width for p in poses),222/max(p.height for p in poses))
    frames=[]
    for pose in poses:
        pose=pose.resize((max(1,round(pose.width*scale)),max(1,round(pose.height*scale))),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(256,256));frame.alpha_composite(pose,((256-pose.width)//2,240-pose.height));frames.append(frame)
    if len({hashlib.sha256(f.tobytes()).digest() for f in frames}) != len(frames): raise ValueError('Duplicate poses')
    sheet=Image.new('RGBA',(256,256) if door else (1024,1024))
    for i,f in enumerate(frames): sheet.alpha_composite(f,((i%4)*256,(i//4)*256))
    sheet.save(SRC/'sheets'/f'{key}.png')
    # Small enemies use 128px cells; large guardians retain 256px detail.
    full_size=door or spec['kind']=='boss'
    runtime=sheet if full_size else sheet.resize((512,512),Image.Resampling.LANCZOS)
    runtime.save(OUT/f'{key}.webp',lossless=True,method=4)
    idle=0 if door else 4
    frames[idle].save(SRC/'portraits'/f'{key}.png')
    idle_px=round(poses[idle].height*scale)
    entries={}
    for action,indices in ({'entrance':[0]} if door else ACTIONS).items():
        ms=130 if action in ('walk','run','fly','charge','hit','collapse','dead','recover') else 260
        cell=256 if full_size else 128
        name=key if door else key+'.'+action
        entries[name]={'h':spec['height'],'ppu':spec['height']/idle_px*(256/cell),'fps':1000/ms,
                      'facingLeft':False,'pixelArt':False,'durationsMs':[ms]*len(indices),
                      'frames':[{'src':key+'.webp','rect':[(i%4)*cell,(i//4)*cell,cell,cell,.5,240/256]} for i in indices]}
    if not door:
        save_pxo(SRC/'sheets'/f'{key}.pxo',frames,[130]*16,key,
                 [{'name':name,'color':'#ffc261','from':a,'to':b} for name,a,b in
                  [('walk',1,4),('idle',5,6),('hit',7,7),('attack',8,8),('collapse',9,11),('stun',11,12),('recover',13,15),('alert',16,16)]])
        sequence=[0,1,2,3]*2+[4,5,6,8,9,10,11,12,13,14]
        preview=[]
        for i in sequence:
            bg=Image.new('RGBA',(256,256),'#efe3c9');bg.alpha_composite(frames[i]);preview.append(bg.convert('RGB'))
        preview[0].save(SRC/'previews'/f'{key}.gif',save_all=True,append_images=preview[1:],duration=150,loop=0)
    return entries

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--scan',action='store_true');parser.add_argument('--incremental',action='store_true');args=parser.parse_args()
    source=json.loads((SRC/'generation.json').read_text(encoding='utf-8'))
    for folder in [OUT,SRC/'sheets',SRC/'portraits',SRC/'previews',SRC/'packed']:folder.mkdir(parents=True,exist_ok=True)
    failed=[];missing=[];all_entries={}
    for spec in source['monsters']:
        key=spec['key'];path=SRC/'raw'/f'{key}.png';cache=SRC/'packed'/f'{key}.json'
        if not path.exists(): missing.append(key);continue
        try:
            if args.scan:
                im=Image.open(path).convert('RGBA');bodies(im,1 if spec['kind']=='door' else 16)
            else:
                cached=json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else {}
                if args.incremental and cached.get('revision')==2 and cache.stat().st_mtime>=path.stat().st_mtime:
                    entries=cached['sprites']
                else:
                    entries=pack_one(spec);cache.write_text(json.dumps({'revision':2,'sprites':entries}),encoding='utf-8')
                all_entries.update(entries)
        except Exception as e: failed.append({'key':key,'error':str(e)})
    report={'expected':122,'ready':122-len(missing)-len(failed),'missing':missing,'failed':failed}
    (SRC/'packing-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
    if args.scan:return
    pack={'version':8,'sprites':all_entries,'images':{},'total':sum(len(v['frames']) for v in all_entries.values())}
    if not missing and not failed:
        (OUT/'manifest.json').write_text(json.dumps(pack,separators=(',',':')),encoding='utf-8')
    font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
    for start in range(0,20,5):
        if any(not(SRC/'portraits'/f'{key}.png').exists() for cast in source['cast'][start:start+5]
               for key in list(cast['normal'])+[cast['boss'],cast['door']]):continue
        board=Image.new('RGB',(1440,5*218),'#efe3c9');d=ImageDraw.Draw(board)
        for row,cast in enumerate(source['cast'][start:start+5]):
            keys=list(cast['normal'])+[cast['boss'],cast['door']]
            for col,key in enumerate(keys):
                im=Image.open(SRC/'portraits'/f'{key}.png').convert('RGBA').resize((198,198),Image.Resampling.LANCZOS)
                x=col*240;y=row*218;board.paste(im,(x+21,y),im)
                spec=next(s for s in source['monsters'] if s['key']==key)
                d.text((x+8,y+195),f"{cast['stage']:02} {spec['name']}",font=font,fill='#39291f')
        board.save(SRC/f'catalog-{start+1:02}-{start+5:02}.jpg',quality=95)
    if missing or failed:return
    sections=[]
    def card(key):
        spec=next(s for s in source['monsters'] if s['key']==key)
        name=html.escape(spec['name']);kind={'boss':'지역 보스','door':'동굴 입구','monster':'몬스터'}[spec['kind']]
        motion='' if spec['kind']=='door' else f'<a href="previews/{key}.gif">움직임</a>'
        return f'<article><a href="sheets/{key}.png"><img loading="lazy" src="portraits/{key}.png" alt="{name}"></a><small>{kind}</small><h3>{name}</h3><p><a href="sheets/{key}.png">PNG 시트</a> {motion}</p></article>'
    for cast in source['cast']:
        keys=list(cast['normal'])+[cast['boss'],cast['door']]
        region=next(s['name'] for s in source['monsters'] if s['key']==cast['door']).replace(' 동굴 입구','')
        sections.append(f'<section id="stage{cast["stage"]}"><h2>{cast["stage"]:02} · {region}</h2><div class="grid">'+''.join(card(key) for key in keys)+'</div></section>')
    sections.append('<section><h2>동굴·수중 몬스터</h2><div class="grid">'+card('spider')+card('piranha')+'</div></section>')
    companion_path=SRC.parent/'monsters-v9/generation.json'
    if companion_path.exists():
        companion_specs=json.loads(companion_path.read_text(encoding='utf-8'))['monsters']
        cards=[]
        for key,name,*_ in companion_specs:
            name=html.escape(name);base='../monsters-v9'
            cards.append(f'<article><a href="{base}/sheets/{key}.png"><img loading="lazy" src="{base}/portraits/{key}.png" alt="{name}"></a><small>지역 추가 몬스터</small><h3>{name}</h3><p><a href="{base}/sheets/{key}.png">PNG 시트</a> <a href="{base}/previews/{key}.gif">움직임</a></p></article>')
        sections.append('<section><h2>함께 등장하는 추가 10종 · 전체 112종</h2><div class="grid">'+''.join(cards)+'</div></section>')
    document='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>우가누가 세계 몬스터 도감</title><style>
    *{box-sizing:border-box}body{margin:0;background:#1d2020;color:#eee8d7;font:15px/1.5 system-ui,'Malgun Gothic',sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}header{padding-top:44px}h1{font-size:36px;margin:0}header p{color:#c9bc9f}section{margin-bottom:38px}h2{color:#efc373;border-bottom:1px solid #4b483b;padding-bottom:10px}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}article{background:#f0e4ca;color:#39291f;border-radius:12px;padding:12px;text-align:center}img{width:100%;aspect-ratio:1;object-fit:contain}h3{font-size:17px;margin:2px 0 10px}small{color:#746448}a{color:#2f6669}article p{margin:0}article p a{display:inline-block;margin:0 5px}nav a{display:inline-block;color:#efc373;padding:5px 10px}@media(max-width:1000px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header,main{padding:16px}h1{font-size:27px}}
    </style><header><h1>우가누가! 세계 몬스터 도감</h1><p>일반 80종 · 지역 보스 20종 · 동굴·수중 2종 · 지역별 동굴 입구 20개</p><p>각 캐릭터 16자세. 그림을 누르면 PNG 시트, 움직임을 누르면 애니메이션을 볼 수 있습니다.</p><nav>'''
    document+=''.join(f'<a href="#stage{i}">{i:02}</a>' for i in range(1,21))+'</nav></header><main>'+''.join(sections)+'<p><a href="generation.json">기본 102종·입구 제작 프롬프트</a> · <a href="../monsters-v9/generation.json">추가 10종 제작 프롬프트</a></p></main></html>'
    (SRC/'index.html').write_text(document,encoding='utf-8')
    print(f'Complete: 102 species, 20 entrances, 1632 authored character poses, {len(all_entries)} action entries')

if __name__=='__main__':main()
