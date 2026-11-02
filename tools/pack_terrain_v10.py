"""Extract the four authored region pieces and package their runtime material set."""
from pathlib import Path
import json, shutil, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-src/terrain-v10'
OUT=ROOT/'public/assets/terrain-v10'

def main():
    spec=json.loads((SRC/'generation.json').read_text(encoding='utf-8'))
    (SRC/'raw').mkdir(exist_ok=True)
    OUT.mkdir(parents=True,exist_ok=True)
    images={};hashes=set()
    catalog=Image.new('RGB',(1600,1240),'#e7deca')
    draw=ImageDraw.Draw(catalog);font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
    for entry in spec['entries']:
        n=entry['stage'];slug=entry['slug']
        original=SRC/'raw'/f'{n:02}-{slug}.png'
        if not original.exists():shutil.copy2(entry['source'],original)
        raw=Image.open(original).convert('RGBA')
        assert raw.getchannel('A').getextrema()[0]==0
        digest=hashlib.sha256(original.read_bytes()).hexdigest()
        assert digest not in hashes;hashes.add(digest)
        entry['original']=original.relative_to(ROOT).as_posix()
        entry['sha256']=digest
        # AI layout spacing varies: find whole connected objects instead of
        # slicing across a support cap or copying ladder fragments into a ledge.
        labels,_=ndimage.label(np.asarray(raw)[:,:,3]>55)
        sizes=np.bincount(labels.ravel());sizes[0]=0
        bodies=np.flatnonzero(sizes>2000)
        if len(bodies)!=4:raise ValueError(f'Region {n}: expected 4 complete objects, found {len(bodies)}')
        bounds=[];objects=ndimage.find_objects(labels)
        for body in bodies:
            ys,xs=objects[body-1]
            bounds.append((max(0,xs.start-2),max(0,ys.start-2),min(raw.width,xs.stop+2),min(raw.height,ys.stop+2)))
        bounds.sort(key=lambda b:(b[1]+b[3])/2)
        ordered=sorted(bounds[:2],key=lambda b:b[0])+sorted(bounds[2:],key=lambda b:b[0])
        pieces={name:raw.crop(box) for name,box in zip(['ground','platform','support','ladder'],ordered)}
        ground=pieces['ground'];w,h=ground.size
        # Fill excludes grass, snow and all edge transparency. Surface is separate.
        pieces['fill']=ground.crop((int(w*.12),int(h*.38),int(w*.88),int(h*.9)))
        pieces['surface']=ground.crop((int(w*.04),0,int(w*.96),max(1,int(h*.24))))
        for name,im in pieces.items():
            im.thumbnail((512,768),Image.Resampling.LANCZOS)
            filename=f'{n:02}-{slug}-{name}.webp'
            im.save(OUT/filename,'WEBP',lossless=True,method=6)
            images[f'terrain.{n}.{name}']=filename
        # Compose a region card from the actual runtime pieces.
        card=Image.new('RGBA',(384,210))
        support=ImageOps.contain(pieces['support'],(140,184),Image.Resampling.LANCZOS)
        card.alpha_composite(support,(8,204-support.height))
        platform=pieces['platform'].resize((190,35),Image.Resampling.LANCZOS)
        card.alpha_composite(platform,(150,68))
        ladder=ImageOps.contain(pieces['ladder'],(45,150),Image.Resampling.LANCZOS)
        card.alpha_composite(ladder,(273,54))
        base=pieces['ground'].resize((240,56),Image.Resampling.LANCZOS)
        card.alpha_composite(base,(140,153))
        x=8+((n-1)%4)*400;y=8+((n-1)//4)*246
        catalog.paste(card,(x,y),card)
        draw.text((x+4,y+215),f'{n:02}  {entry["name"]}',font=font,fill='#403629')
    (OUT/'manifest.json').write_text(json.dumps({'version':10,'images':images},indent=2)+'\n',encoding='utf-8')
    (SRC/'generation.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    catalog.save(SRC/'terrain-catalog.jpg',quality=94)
    print(f'Packed {len(spec["entries"])} original region atlases, {len(images)} material images')

if __name__=='__main__':main()
