"""Pack the authored 4x4 monster sheets without synthesizing animation poses."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
from sprite_workflow import save_pxo
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-src/monsters-v7'
OUT = ROOT / 'public/assets/monsters-v7'
ACTIONS = {
    'walk': [0, 1, 2, 3], 'run': [0, 1, 2, 3], 'fly': [0, 1, 2, 3],
    'jump': [0, 1, 2, 3], 'idle': [4, 5], 'hit': [6],
    'fall': [3, 2, 1, 0],
    'attack': [7], 'collapse': [8, 9, 10], 'dead': [8, 9, 10],
    'stun': [10, 11], 'recover': [12, 13, 14],
    'charge': [0, 1, 2, 3], 'dive': [7], 'roar': [5, 7],
    'windup': [5], 'swing': [7], 'throw': [7], 'hang': [4, 5],
}

def main():
    spec = json.loads((SOURCE / 'generation.json').read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    (SOURCE / 'portraits').mkdir(exist_ok=True)
    (SOURCE / 'previews').mkdir(exist_ok=True)
    (SOURCE / 'sheets').mkdir(exist_ok=True)
    pack = {'version': 7, 'sprites': {}, 'images': {}, 'total': 0}
    overview = Image.new('RGB', (1200, 5 * 224), '#efe3c9')
    draw = ImageDraw.Draw(overview)
    font_path = Path('C:/Windows/Fonts/malgun.ttf')
    font = ImageFont.truetype(str(font_path), 17)
    for n, monster in enumerate(spec['monsters']):
        key, name, _, height = monster
        raw = Image.open(SOURCE / 'raw' / f'{key}.png').convert('RGBA')
        if raw.getchannel('A').getextrema() != (0, 255):
            raise ValueError(f'{key}: missing transparent background')
        # Generated grid spacing is approximate. Extract intact connected bodies,
        # rather than cutting tails and wings at assumed quarter-image boundaries.
        labels, _ = ndimage.label(np.asarray(raw)[:, :, 3] > 80)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        bodies = np.flatnonzero(sizes > 2000)
        if len(bodies) != 16:
            raise ValueError(f'{key}: expected 16 intact bodies, got {len(bodies)}')
        objects = ndimage.find_objects(labels)
        bounds = []
        for label in bodies:
            ys, xs = objects[label - 1]
            bounds.append((max(0, xs.start - 2), max(0, ys.start - 2),
                           min(raw.width, xs.stop + 2), min(raw.height, ys.stop + 2)))
        bounds.sort(key=lambda b: (b[1] + b[3]) / 2)
        ordered = []
        for row in range(4):
            ordered.extend(sorted(bounds[row * 4:row * 4 + 4], key=lambda b: b[0]))
        poses = [raw.crop(b) for b in ordered]
        scale = min(232 / max(p.width for p in poses), 222 / max(p.height for p in poses))
        frames = []
        sheet = Image.new('RGBA', (1024, 1024))
        for i, pose in enumerate(poses):
            pose = pose.resize((max(1, round(pose.width * scale)), max(1, round(pose.height * scale))), Image.Resampling.LANCZOS)
            frame = Image.new('RGBA', (256, 256))
            frame.alpha_composite(pose, ((256 - pose.width) // 2, 240 - pose.height))
            frames.append(frame)
            sheet.alpha_composite(frame, ((i % 4) * 256, (i // 4) * 256))
        sheet.save(OUT / f'{key}.webp', lossless=True, method=6)
        sheet.save(SOURCE / 'sheets' / f'{key}.png')
        save_pxo(SOURCE / 'sheets' / f'{key}.pxo', frames, [130] * 16, key,
                 [{'name': action, 'color': '#ffc261', 'from': first, 'to': last}
                  for action, first, last in [('walk', 1, 4), ('idle', 5, 6), ('hit', 7, 7),
                      ('attack', 8, 8), ('collapse', 9, 11), ('stun', 11, 12), ('recover', 13, 15), ('alert', 16, 16)]])
        frames[4].save(SOURCE / 'portraits' / f'{key}.png')
        idle_px = round(poses[4].height * scale)
        for action, indices in ACTIONS.items():
            duration = 130 if action in ('walk', 'fly', 'run', 'jump', 'charge') else 260
            if action in ('hit', 'collapse', 'dead', 'recover'): duration = 130
            pack['sprites'][f'{key}.{action}'] = {
                'h': height, 'ppu': height / idle_px, 'fps': 1000 / duration,
                'pixelArt': False, 'facingLeft': False,
                'durationsMs': [duration] * len(indices),
                'frames': [{'src': f'{key}.webp', 'rect': [(i % 4) * 256, (i // 4) * 256, 256, 256, .5, 240 / 256]} for i in indices],
            }
            pack['total'] += len(indices)
        # A contact sheet and GIF make the actual exported frames reviewable.
        animation = [frames[i] for i in ([0, 1, 2, 3] * 3 + [4, 5, 6, 8, 9, 10, 11, 12, 13, 14])]
        previews = []
        for frame in animation:
            bg = Image.new('RGBA', frame.size, '#efe3c9')
            bg.alpha_composite(frame)
            previews.append(bg.convert('RGB'))
        previews[0].save(SOURCE / 'previews' / f'{key}.gif', save_all=True, append_images=previews[1:], duration=150, loop=0)
        x, y = (n % 5) * 240, (n // 5) * 224
        thumb = frames[4].resize((200, 200), Image.Resampling.LANCZOS)
        overview.paste(thumb, (x + 20, y), thumb)
        draw.text((x + 12, y + 196), f'{n+1:02} {name}', font=font, fill='#39291f')
    # Three rows of artwork; leave a small footer for the scope and frame count.
    overview = overview.crop((0, 0, 1200, 3 * 224))
    overview.save(SOURCE / 'monster-catalog.jpg', quality=95)
    (OUT / 'manifest.json').write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Packed {len(spec['monsters'])} monsters, 240 authored poses, {len(pack['sprites'])} action entries")

if __name__ == '__main__':
    main()
