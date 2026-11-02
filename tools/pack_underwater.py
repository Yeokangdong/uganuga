from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from PIL import Image
from sprite_workflow import save_pxo

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-src/underwater-v1'
OUT=ROOT/'public/assets/underwater-v1'
OUT.mkdir(parents=True,exist_ok=True)
raw=Image.open(SRC/'raw/swim.png').convert('RGBA')
labels,_=ndimage.label(np.asarray(raw)[:,:,3]>80)
sizes=np.bincount(labels.ravel());sizes[0]=0
ids=np.flatnonzero(sizes>2000)
assert len(ids)==8,f'Expected eight intact swim poses: {len(ids)}'
objects=ndimage.find_objects(labels);boxes=[]
for label in ids:
    ys,xs=objects[label-1]
    boxes.append((max(0,xs.start-2),max(0,ys.start-2),min(raw.width,xs.stop+2),min(raw.height,ys.stop+2)))
boxes.sort(key=lambda b:(b[1]+b[3])/2)
boxes=sorted(boxes[:4],key=lambda b:b[0])+sorted(boxes[4:],key=lambda b:b[0])
poses=[raw.crop(b) for b in boxes]
scale=min(232/max(p.width for p in poses),210/max(p.height for p in poses))
frames=[];heads=[];sheet=Image.new('RGBA',(1024,512))
for i,p in enumerate(poses):
    p=p.resize((round(p.width*scale),round(p.height*scale)),Image.Resampling.LANCZOS)
    x=(256-p.width)//2;y=240-p.height
    pixels=np.asarray(p);r,g,b=pixels[:,:,:3].transpose(2,0,1)
    hair=(pixels[:,:,3]>100)&(r>180)&(g>60)&(g<170)&(b<80)&(r.astype(float)>g*1.4)
    hair[round(p.height*.65):]=False
    hy,hx=np.where(hair)
    heads.append((x+float(hx.mean()),y+float(hy.mean())) if len(hx) else (x+p.width*.7,y+p.height*.2))
    frame=Image.new('RGBA',(256,256));frame.alpha_composite(p,(x,y))
    frames.append(frame);sheet.alpha_composite(frame,((i%4)*256,(i//4)*256))
sheet.save(SRC/'hero-swim.png');sheet.save(OUT/'hero-swim.webp',lossless=True,method=6)
save_pxo(SRC/'hero-swim.pxo',frames,[140]*8,'p1.swim')
head_dx=heads[0][0]-128;head_dy=240-heads[0][1]
entry={'h':18,'ppu':18/round(poses[0].height*scale),'fps':7.14,'facingLeft':False,'pixelArt':False,
       'durationsMs':[140]*8,'frames':[{'src':'hero-swim.webp','rect':[(i%4)*256,(i//4)*256,256,256,(heads[i][0]-head_dx)/256,(heads[i][1]+head_dy)/256]} for i in range(8)]}
background=Image.open(SRC/'raw/background.png').convert('RGB')
background.thumbnail((1920,1280),Image.Resampling.LANCZOS)
background.save(OUT/'background.webp',quality=91,method=6)
manifest={'version':1,'total':16,'sprites':{'p1.swim':entry,'p2.swim':entry},'images':{'underwater.background':'background.webp'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
print('Packed eight authored swim poses and underwater background')
