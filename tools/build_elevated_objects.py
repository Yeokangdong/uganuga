"""Pack complete environment supports from the 3 x 3 transparent source atlas."""
import json
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-src/painted-v6/raw/elevated-structures-v1.png'
OUT = ROOT / 'public/assets/elevated-objects-v1'
OUT.mkdir(parents=True, exist_ok=True)
sheet = Image.open(SOURCE).convert('RGBA')
names = ['vine', 'stone', 'basalt', 'ice', 'ruin', 'mushroom', 'bone', 'coral', 'crystal']
images = {}
for i, name in enumerate(names):
    col, row = i % 3, i // 3
    cell = sheet.crop((round(col * sheet.width / 3), round(row * sheet.height / 3),
                       round((col + 1) * sheet.width / 3), round((row + 1) * sheet.height / 3)))
    alpha = np.array(cell.getchannel('A'))
    components, _ = label(alpha > 24)
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    # The generated rows do not perfectly follow cell boundaries. Keep only the
    # whole connected support, excluding neighboring caps at the cell edges.
    keep = np.arange(len(sizes)) == sizes.argmax()
    cell.putalpha(Image.fromarray(np.where(keep[components], alpha, 0).astype('uint8')))
    cell = cell.crop(cell.getbbox())
    filename = f'{name}-{hashlib.sha256(cell.tobytes()).hexdigest()[:8]}.webp'
    cell.save(OUT / filename, quality=95, method=4)
    images[f'world.elevated.{name}'] = filename
(OUT / 'manifest.json').write_text(json.dumps({'images': images}, indent=2), encoding='utf-8')
print(f'Packed {len(images)} grounded structures')
