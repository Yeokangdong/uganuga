from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
for name in ['support','vine']:
    im=Image.open(ROOT/f'art-src/traversal-v2/{name}.png').convert('RGBA')
    bbox=im.getchannel('A').point(lambda a:255 if a>48 else 0).getbbox()
    assert bbox
    im=im.crop(bbox)
    im.thumbnail((1024,1400),Image.Resampling.LANCZOS)
    im.save(ROOT/f'public/assets/traversal-v2/{name}.webp',lossless=True)
    print(name,im.size)
