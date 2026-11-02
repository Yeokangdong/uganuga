from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
raw=Image.open(ROOT/'art-src/weapons-v1/generated-weapons.png').convert('RGBA')
sprites={}
for i,key in enumerate(['axe','stone','bone','fire']):
    part=raw.crop((round(i*raw.width/4),0,round((i+1)*raw.width/4),raw.height))
    bbox=part.getchannel('A').point(lambda a:255 if a>40 else 0).getbbox()
    assert bbox
    part=part.crop(bbox)
    part.thumbnail((212,218),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(256,256))
    frame.alpha_composite(part,((256-part.width)//2,240-part.height))
    frame.save(ROOT/f'art-src/weapons-v1/{key}.png')
    frame.save(ROOT/f'public/assets/weapons-v1/{key}.webp',lossless=True)
    sprites['item.weapon.'+key]={'h':20,'ppu':20/part.height,'fps':1,'facingLeft':False,'pixelArt':False,'durationsMs':[1000],'frames':[{'src':key+'.webp','rect':[0,0,256,256,.5,240/256]}]}
(ROOT/'public/assets/weapons-v1/manifest.json').write_text(json.dumps({'total':4,'sprites':sprites,'images':{}},indent=2),encoding='utf-8')
print('Packed four distinct weapon pickups.')
