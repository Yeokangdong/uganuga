"""Pack the twenty biome dolmens from their transparent 4 x 5 source atlas."""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-src/painted-v6/raw/biome-stage-dolmens-v1.png'
OUT = ROOT / 'public/assets/stage-signs-v1'
OUT.mkdir(parents=True, exist_ok=True)
sheet = Image.open(SOURCE).convert('RGBA')
images = {}
for i in range(20):
    col, row = i % 4, i // 4
    cell = sheet.crop((round(col * sheet.width / 4), round(row * sheet.height / 5),
                       round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / 5)))
    # Ignore tiny isolated generation flecks when aligning the shared ground baseline.
    alpha = np.array(cell.getchannel('A'))
    components, count = label(alpha > 24)
    sizes = np.bincount(components.ravel())
    keep = sizes >= 100
    keep[0] = False
    cell.putalpha(Image.fromarray(np.where(keep[components], alpha, 0).astype('uint8')))
    cell = cell.crop(cell.getbbox())
    name = f'dolmen-{i + 1:02}.webp'
    cell.save(OUT / name, quality=95, method=6)
    images[f'ui.biome_sign_{i + 1}'] = name
(OUT / 'manifest.json').write_text(json.dumps({'images': images}, indent=2), encoding='utf-8')
print(f'Packed {len(images)} biome dolmens')
