"""Pack individually authored high-definition monster sheets without enlarging pixels."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, find_objects, binary_dilation

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art-src/hq-monsters-v1'
OUT = ROOT / 'public/assets/hq-monsters-v1'
STYLE = '''Create a PREMIUM HIGH-RESOLUTION production 2D GAME ANIMATION SPRITE SHEET. The reference image is ONLY a rendering-quality, shading and grid-layout style guide: draw the TARGET SPECIES described below, not the reference dinosaur. Exactly ONE identical creature in SIXTEEN distinct whole-body poses, precise 4 COLUMNS x 4 ROWS grid. Square atlas, aim for 2048x2048 output with real newly painted fine detail, not a filtered enlargement. Each body centered in the central 65 percent of its cell with >=17 percent totally empty transparent margin on all four sides. TRUE TRANSPARENT alpha throughout, including between legs and inside wings. No background, cast shadows outside sprites, grid, text, labels or extra creatures. Commercial-quality hand-painted fantasy platformer art: strong adult predator anatomy, defined muscles and joints, angular threatening face, small narrowed eyes beneath heavy brows, anatomically appropriate sharp teeth/tusks/claws/beak, convincing layered fur or scales or armor or feathers specific to this species. Rich controlled local palette, warm upper-left key light, soft cool occlusion in creases, restrained rim light, sophisticated varied contour weight. Crisp, readable shapes at small game size, not microdetail noise. More sophisticated than flat mascot cartoon, but still an illustrated 2D adventure game asset, not photorealism or 3D renders. No baby proportions, huge glossy eyes, cute smiles, plush toy shapes, gore or blood. Animals have NO weapons. Entire body, all limbs, tails, antennae and wings remain intact in every cell. ALL face RIGHT in side view. Identical torso dimensions and consistent body scale across EVERY pose. Never detach body parts or stretch the torso. EXACT frame order: Row1 four consecutive locomotion poses covering one complete cycle: near foot forward/far back, passing, opposite foot forward, opposite passing; for four-legged animals alternate diagonal pairs, for insects alternate leg groups, for flyers use wings up/half-down/down/half-up. Row2: alert idle, threatening raised-head roar or warning posture, recoiling hurt, forward attack appropriate to species. Row3: losing balance backward, rolling onto side, lying prone stunned, lying prone dazed. Row4: beginning to push up, crouched half-up, standing recovered, braced alert. All poses must be different and readable. SOURCE-POSE GRID IS A GUIDE ONLY; target creature anatomy and materials take priority. TARGET SPECIES: '''


def prepare():
    world = json.loads((ROOT / 'art-src/world-v8/generation.json').read_text(encoding='utf-8'))
    extra = json.loads((ROOT / 'art-src/monsters-v9/generation.json').read_text(encoding='utf-8'))
    specs = [s for s in world['monsters'] if s['kind'] != 'door']
    specs += [{'key': s[0], 'name': s[1], 'description': s[2], 'kind': 'monster'} for s in extra['monsters']]
    for s in specs:
        description = re.sub(r'friendly|gentle|cute|cartoon|baby|rounded|round ears|big dark eyes|big.*?eyes|expressive.*?eyes', '', s['description'], flags=re.I)
        s['prompt'] = STYLE + description + ('. A formidable REGION BOSS, especially powerful anatomy and intricate large material forms.' if s['kind'] == 'boss' else '.')
    (SRC / 'generation.json').write_text(json.dumps({'tool': 'built-in image_gen', 'monsters': specs}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Prepared {len(specs)} individual high-resolution sheets')


def read_poses(path, key):
    raw = Image.open(path).convert('RGBA')
    if raw.getchannel('A').getextrema()[0] != 0:
        raise ValueError(f'Opaque sheet: {key}')
    labels, _ = label(np.array(raw)[:, :, 3] > 80)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    objects = find_objects(labels)
    components = sorted(np.flatnonzero(sizes > 200), key=lambda i: sizes[i], reverse=True)[:16]
    bodies = {}
    for component in components:
        yy, xx = objects[component - 1]
        if xx.start == 0 or yy.start == 0 or xx.stop == raw.width or yy.stop == raw.height:
            raise ValueError(f'Body touches source image edge: {key}')
        row = int((yy.start + yy.stop) / 2 / (raw.height / 4))
        col = int((xx.start + xx.stop) / 2 / (raw.width / 4))
        idx = row * 4 + col
        if idx in bodies or not 0 <= idx < 16:
            raise ValueError(f'Ambiguous whole-body grid: {key} pose {idx}')
        bounds = (max(0, xx.start - 2), max(0, yy.start - 2), min(raw.width, xx.stop + 2), min(raw.height, yy.stop + 2))
        pose = raw.crop(bounds)
        # Keep this whole body and its antialiasing, excluding neighboring poses
        # that may intrude into the rectangular bounding box of a long tail.
        mask = binary_dilation(labels[bounds[1]:bounds[3], bounds[0]:bounds[2]] == component, iterations=2)
        pixels = np.array(pose)
        pixels[:, :, 3] *= mask
        bodies[idx] = Image.fromarray(pixels)
    if len(bodies) != 16:
        raise ValueError(f'Incomplete sheet: {key}')
    return [bodies[i] for i in range(16)]


def scan():
    specs = json.loads((SRC / 'generation.json').read_text(encoding='utf-8'))['monsters']
    bad, missing, ready = [], [], 0
    for spec in specs:
        key = spec['key']; path = SRC / 'raw' / f'{key}.png'
        if not path.exists():
            missing.append(key); continue
        try:
            read_poses(path, key); ready += 1
        except ValueError as error:
            bad.append({'key': key, 'error': str(error)})
    print(json.dumps({'ready': ready, 'missing': missing, 'bad': bad}))


def pack(partial=False):
    specs = json.loads((SRC / 'generation.json').read_text(encoding='utf-8'))['monsters']
    originals = {}
    for folder in ['world-v8', 'monsters-v9']:
        originals.update(json.loads((ROOT / f'public/assets/{folder}/manifest.json').read_text())['sprites'])
    sprites, portraits = {}, []
    for spec in specs:
        key = spec['key']
        path = SRC / 'raw' / f'{key}.png'
        if not path.exists():
            if partial: continue
            raise ValueError(f'Missing {key}')
        try:
            poses = read_poses(path, key)
        except ValueError:
            if partial: continue
            raise
        cap = 320 if spec['kind'] == 'boss' else 192
        scale = min(1, cap / max(max(p.width, p.height) for p in poses))
        frames = []
        for pose in poses:
            pose = pose.resize((max(1, round(pose.width * scale)), max(1, round(pose.height * scale))), Image.Resampling.LANCZOS)
            pose.putalpha(pose.getchannel('A').point(lambda a: 0 if a < 16 else a))
            frames.append(pose)
        idle_box = frames[4].getchannel('A').getbbox()
        idle_height = idle_box[3] - idle_box[1]
        # Tight lossless runtime packing avoids loading transparent editor gutters.
        width = 1024 if spec['kind'] != 'boss' else 1536
        x = y = row_height = 2
        rects = []
        for pose in frames:
            if x + pose.width + 2 > width:
                x = 2; y += row_height + 2; row_height = 0
            box = pose.getchannel('A').getbbox()
            rects.append([x, y, pose.width, pose.height, .5, box[3] / pose.height])
            x += pose.width + 2; row_height = max(row_height, pose.height)
        atlas = Image.new('RGBA', (width, y + row_height + 2))
        for pose, rect in zip(frames, rects):
            atlas.alpha_composite(pose, (rect[0], rect[1]))
        filename = f'{key}-{hashlib.sha256(atlas.tobytes()).hexdigest()[:8]}.webp'
        atlas.save(OUT / filename, lossless=True, method=4)
        cell = max(320, math.ceil(max(max(p.width, p.height) for p in frames) / .65 / 32) * 32)
        baseline = round(cell * .82)
        editor = Image.new('RGBA', (cell * 4, cell * 4))
        for i, pose in enumerate(frames):
            editor.alpha_composite(pose, (i % 4 * cell + (cell - pose.width) // 2, i // 4 * cell + baseline - pose.height))
        editor.save(SRC / 'sheets' / f'{key}.png')
        frames[4].save(SRC / 'portraits' / f'{key}.png')
        portraits.append((key, frames[4]))
        for action, entry in originals.items():
            if not action.startswith(key + '.'):
                continue
            old_cell = entry['frames'][0]['rect'][2]
            entries = []
            for f in entry['frames']:
                r = f['rect']; i = round(r[1] / old_cell) * 4 + round(r[0] / old_cell)
                entries.append({'src': filename, 'rect': rects[i]})
            sprites[action] = {**entry, 'ppu': entry['h'] / idle_height, 'frames': entries}
    pack = {'version': 1, 'sprites': sprites, 'images': {}, 'total': sum(len(s['frames']) for s in sprites.values())}
    temp = OUT / 'manifest.tmp.json'; temp.write_text(json.dumps(pack, separators=(',', ':')), encoding='utf-8'); temp.replace(OUT / 'manifest.json')
    if not partial:
        active = {f['src'] for s in sprites.values() for f in s['frames']}
        for old_atlas in OUT.glob('*.webp'):
            if old_atlas.name not in active:
                old_atlas.unlink()
    for start in range(0, len(portraits), 20):
        board = Image.new('RGB', (5 * 224, 4 * 240), '#d4cebf'); d = ImageDraw.Draw(board)
        for i, (key, pose) in enumerate(portraits[start:start + 20]):
            im = pose.copy(); im.thumbnail((200, 200), Image.Resampling.LANCZOS)
            x, y = i % 5 * 224, i // 5 * 240
            board.paste(im, (x + (224 - im.width) // 2, y + 200 - im.height), im)
            d.text((x + 10, y + 210), key, fill='#302a26')
        board.save(SRC / f'cast-{start // 20 + 1}.webp', quality=95)
    print(f'Packed {len(portraits)} individual HD monsters; no source pixels enlarged')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--prepare', action='store_true'); parser.add_argument('--scan', action='store_true'); parser.add_argument('--partial', action='store_true'); args = parser.parse_args()
    for folder in [SRC, SRC / 'raw', SRC / 'sheets', SRC / 'portraits', OUT]:
        folder.mkdir(parents=True, exist_ok=True)
    prepare() if args.prepare else scan() if args.scan else pack(args.partial)
