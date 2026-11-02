"""Prepare editable pose atlases and pack the AI-redrawn fierce monster cast."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import label, find_objects

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art-src/fierce-monsters-v1'
OUT = ROOT / 'public/assets/fierce-monsters-v1'
PROMPT = '''Edit this production sprite atlas into more frightening enemies for a prehistoric action platform game. Preserve EVERY creature identity, species, body scale, complete body, pose, facing direction, cell position and all transparent margins EXACTLY. This atlas contains independent 4x4 character sheets in a 2-column by 3-row arrangement: each sub-sheet has 16 consecutive full-body poses. Do not merge creatures, copy or delete poses, add characters to empty cells, add labels, backgrounds, grids, shadows or text. Keep the source canvas aspect ratio. Keep real transparent alpha, including between legs and inside wings. All sprites remain within their individual cells with >=15% transparent margin on all four sides. Source drawings are only composition and motion references; REDRAW the visible creatures themselves. Change cute friendly faces to angry threatening predators: small narrow eyes, heavy slanted brow, tiny slit pupils with no cute glossy highlights; snarling angular muzzle, sharp clearly readable teeth where anatomically appropriate, pronounced horns or tusks and hooked claws, rugged armor scales or bristled fur. Strong silhouette, angular cheekbones, muscular limbs, slightly darker richer earth colors with clear contrast. No smiles, puppy eyes, baby faces, plush toy shapes, comedy expressions or pet appeal. Keep readable clean inked cel-shaded 2D game illustration, not pixel art, not photorealistic. Frightening adventurous fantasy monsters, no gore or blood. Walk poses still alternate near and far feet; flying poses retain original wing positions. Injured/stunned/fallen poses keep their pose but no smiling. Boss creatures look especially formidable. All limbs and tails remain intact; no weapons for animals. Preserve the blank bottom-right sub-sheet if it is blank. Creature groups, in reading order of sub-sheets: '''


def prepare():
    world = json.loads((ROOT / 'art-src/world-v8/generation.json').read_text(encoding='utf-8'))
    extra = json.loads((ROOT / 'art-src/monsters-v9/generation.json').read_text(encoding='utf-8'))
    packs = {folder: json.loads((ROOT / f'public/assets/{folder}/manifest.json').read_text())
             for folder in ['world-v8', 'monsters-v9']}
    specs = {s['key']: {**s, 'folder': 'world-v8'} for s in world['monsters'] if s['kind'] != 'door'}
    specs.update({s[0]: {'key': s[0], 'name': s[1], 'description': s[2], 'folder': 'monsters-v9'} for s in extra['monsters']})
    groups = [(f'stage-{cast["stage"]:02}', [*cast['normal'], cast['boss']]) for cast in world['cast']]
    remaining = ['spider', 'piranha', *[s[0] for s in extra['monsters']]]
    groups += [(f'extra-{i // 6 + 1:02}', remaining[i:i + 6]) for i in range(0, len(remaining), 6)]
    entries = []
    for group, keys in groups:
        board = Image.new('RGBA', (1024, 1536))
        for slot, key in enumerate(keys):
            spec = specs[key]
            sprite = packs[spec['folder']]['sprites'][key + '.walk']
            old_cell = sprite['frames'][0]['rect'][2]
            atlas = Image.open(ROOT / f'public/assets/{spec["folder"]}' / sprite['frames'][0]['src']).convert('RGBA')
            for i in range(16):
                pose = atlas.crop(((i % 4) * old_cell, (i // 4) * old_cell,
                                   (i % 4 + 1) * old_cell, (i // 4 + 1) * old_cell))
                pose = pose.resize((96, 96), Image.Resampling.LANCZOS)
                x = (slot % 2) * 512 + (i % 4) * 128 + 16
                y = (slot // 2) * 512 + (i // 4) * 128 + 16
                board.alpha_composite(pose, (x, y))
        board.save(SRC / 'references' / f'{group}.png')
        descriptions = '; '.join(f'{n + 1}: {specs[key]["name"]} ({key}), {specs[key]["description"]}' for n, key in enumerate(keys))
        entries.append({'id': group, 'keys': keys, 'prompt': PROMPT + descriptions})
    (SRC / 'generation.json').write_text(json.dumps({'tool': 'built-in image_gen', 'groups': entries}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Prepared {len(groups)} pose atlases for {len(specs)} species')


def pack():
    config = json.loads((SRC / 'generation.json').read_text(encoding='utf-8'))
    originals = {}
    for folder in ['world-v8', 'monsters-v9']:
        pack = json.loads((ROOT / f'public/assets/{folder}/manifest.json').read_text())
        originals.update(pack['sprites'])
    sprites = {}
    portraits = []
    for group in config['groups']:
        path = SRC / 'raw' / (group['id'] + '.png')
        if not path.exists():
            raise ValueError(f'Missing redrawn atlas: {group["id"]}')
        sheet = Image.open(path).convert('RGBA')
        if sheet.getchannel('A').getextrema()[0] != 0:
            raise ValueError(f'No transparent background: {group["id"]}')
        labels, _ = label(np.array(sheet)[:, :, 3] > 80)
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        boxes = find_objects(labels)
        bodies = {}
        for component in np.flatnonzero(sizes > 250):
            yy, xx = boxes[component - 1]
            col = int((xx.start + xx.stop) / 2 / (sheet.width / 8))
            row = int((yy.start + yy.stop) / 2 / (sheet.height / 12))
            cell_id = (row // 4 * 2 + col // 4, row % 4 * 4 + col % 4)
            if cell_id in bodies:
                raise ValueError(f'Overlapping pose assignments: {group["id"]} {cell_id}')
            bounds = (max(0, xx.start - 2), max(0, yy.start - 2), min(sheet.width, xx.stop + 2), min(sheet.height, yy.stop + 2))
            bodies[cell_id] = sheet.crop(bounds)
        for slot, key in enumerate(group['keys']):
            poses = [bodies.get((slot, i)) for i in range(16)]
            if any(pose is None for pose in poses):
                raise ValueError(f'Missing intact poses: {key}')
            # One scale per creature, never per pose or body part. Extract whole
            # connected bodies rather than clipping at the approximate AI grid.
            scale = min(88 / max(p.width for p in poses), 88 / max(p.height for p in poses))
            actor = Image.new('RGBA', (512, 512))
            for i, pose in enumerate(poses):
                pose = pose.resize((max(1, round(pose.width * scale)), max(1, round(pose.height * scale))), Image.Resampling.LANCZOS)
                pose.putalpha(pose.getchannel('A').point(lambda a: 0 if a < 16 else a))
                actor.alpha_composite(pose, (i % 4 * 128 + (128 - pose.width) // 2, i // 4 * 128 + 106 - pose.height))
            idle_height = max(1, round(poses[4].height * scale))
            cell = 192
            padded = Image.new('RGBA', (cell * 4, cell * 4))
            for i in range(16):
                pose = actor.crop((i % 4 * 128, i // 4 * 128, (i % 4 + 1) * 128, (i // 4 + 1) * 128))
                if not pose.getbbox():
                    raise ValueError(f'Missing pose {key}:{i}')
                padded.alpha_composite(pose, (i % 4 * cell + 32, i // 4 * cell + 32))
            portraits.append((key, actor.crop((0, 128, 128, 256))))
            padded.save(SRC / 'sheets' / (key + '.png'))
            # Runtime cells keep only necessary transparent space; the editor
            # sheet above retains >= 32 px gutters on every side of each pose.
            cell = 128
            name = f'{key}-{hashlib.sha256(actor.tobytes()).hexdigest()[:8]}.webp'
            actor.save(OUT / name, lossless=True, method=4)
            for action, entry in originals.items():
                if not action.startswith(key + '.'):
                    continue
                old_cell = entry['frames'][0]['rect'][2]
                frames = []
                for frame in entry['frames']:
                    rect = frame['rect']
                    i = round(rect[1] / old_cell) * 4 + round(rect[0] / old_cell)
                    frames.append({'src': name, 'rect': [(i % 4) * cell, (i // 4) * cell, cell, cell, .5, 106 / 128]})
                sprites[action] = {**entry, 'ppu': entry['h'] / idle_height, 'frames': frames}
    manifest = {'version': 1, 'sprites': sprites, 'images': {}, 'total': sum(len(s['frames']) for s in sprites.values())}
    temp = OUT / 'manifest.tmp.json'
    temp.write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    temp.replace(OUT / 'manifest.json')
    preview = Image.new('RGB', (8 * 128, ((len(portraits) + 7) // 8) * 148), '#ded5c3')
    draw = ImageDraw.Draw(preview)
    for i, (key, pose) in enumerate(portraits):
        x, y = i % 8 * 128, i // 8 * 148
        preview.paste(pose, (x, y), pose)
        draw.text((x + 4, y + 126), key, fill='#342c24')
    preview.save(SRC / 'cast-preview.webp', quality=95)
    print(f'Packed {len(set(k.rsplit(".", 1)[0] for k in sprites))} fierce species, {manifest["total"]} action frames')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    for directory in [SRC, SRC / 'references', SRC / 'raw', SRC / 'sheets', OUT]:
        directory.mkdir(parents=True, exist_ok=True)
    prepare() if args.prepare else pack()
