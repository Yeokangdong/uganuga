"""Prepare the generated cloud floor without changing its painted pixels."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
im = Image.open(ROOT / 'art-src/sky-v1/clouds/generated-cloud.png').convert('RGBA')
bbox = im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
assert bbox, 'Cloud must contain visible pixels'
im = im.crop(bbox)
im.thumbnail((1600, 512), Image.Resampling.LANCZOS)
im.save(ROOT / 'public/assets/sky-v1/cloud-floor.webp', lossless=True)
print('Cloud floor:', im.size)
bg = Image.open(ROOT / 'art-src/sky-v1/clouds/generated-background.png').convert('RGB')
bg.save(ROOT / 'public/assets/sky-v1/cloud-background.webp', quality=92)
