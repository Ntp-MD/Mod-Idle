"""Publish baked Unity art into the existing flat skill pool.

Run after tools/bake-unity-vfx.cs in the local Unity import project.
Requires the existing art-tool environment (Pillow and NumPy).
"""
from pathlib import Path
import hashlib
import json
import re
import shutil

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'tools/data/external-vfx.json').read_text(encoding='utf-8-sig'))
SKILLS = json.loads((ROOT / 'tools/data/skills.json').read_text(encoding='utf-8-sig'))['skills']
BAKE = CONFIG['bake']
POOL = ROOT / 'game/public/fx/skill-pool'
SOURCE = ROOT / '.cache/unity-baked-vfx'
CACHE = ROOT / '.cache/unity-runtime-atlases'
CACHE.mkdir(parents=True, exist_ok=True)

def prepare(effect):
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', effect), 'Invalid effect filename'
    spec = CONFIG['sources'][effect]
    path = ROOT / spec['image'] if 'image' in spec else SOURCE / (effect + '.png')
    grid = spec['grid']
    size, columns, count = grid['cell'], grid['columns'], grid['count']
    cell_height = grid.get('cellHeight', size)
    assert all(isinstance(value, int) and value > 0 for value in (size, columns, count))
    assert grid['fps'] > 0
    with Image.open(path) as image:
        assert image.size == (size * columns, cell_height * ((count + columns - 1) // columns)), path
        pixels = np.asarray(image.convert('RGBA')).astype(np.float32) / 255
    if spec['premultiplied']:
        # Additive camera renders retain emitted RGB even where the target alpha is zero.
        alpha = pixels[:, :, :3].max(axis=2) if spec.get('alphaFromRGB') else np.maximum(pixels[:, :, 3], pixels[:, :, :3].max(axis=2))
        pixels[:, :, :3] = np.divide(pixels[:, :, :3], alpha[:, :, None], out=np.zeros_like(pixels[:, :, :3]), where=alpha[:, :, None] > 0)
        pixels[:, :, 3] = alpha
    frames = [pixels[(i // columns) * cell_height:(i // columns + 1) * cell_height,
                     (i % columns) * size:(i % columns + 1) * size] for i in range(count)]
    mask = np.stack([frame[:, :, 3] > 3 / 255 for frame in frames]).any(axis=0)
    ys, xs = np.where(mask)
    assert len(xs) > 0, f'Empty effect: {effect}'
    bounds = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    boxes = [Image.fromarray((frame[:, :, 3] > 3 / 255).astype(np.uint8)).getbbox() for frame in frames]
    if spec.get('centerFrames'):
        painted_width = max(box[2] - box[0] for box in boxes if box)
        painted_height = max(box[3] - box[1] for box in boxes if box)
    else:
        painted_width, painted_height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    runtime = BAKE['runtimeCell']
    limit = int(runtime * (1 - 2 * BAKE['padding']))
    fit = min(limit / painted_width, limit / painted_height)
    width = max(1, round(painted_width * fit))
    height = max(1, round(painted_height * fit))
    atlas = Image.new('RGBA', (runtime * columns, runtime * ((count + columns - 1) // columns)))
    for i, frame in enumerate(frames):
        box = boxes[i] if spec.get('centerFrames') else bounds
        if box is None:
            continue
        painted = Image.fromarray(np.round(np.clip(frame, 0, 1) * 255).astype(np.uint8)).crop(box)
        frame_width = max(1, round(painted.width * fit))
        frame_height = max(1, round(painted.height * fit))
        painted = painted.resize((frame_width, frame_height), Image.Resampling.LANCZOS)
        cell = Image.new('RGBA', (runtime, runtime))
        x, y = (runtime - frame_width) // 2, (runtime - frame_height) // 2
        cell.paste(painted, (x, y))
        atlas.paste(cell, ((i % columns) * runtime, (i // columns) * runtime))
    destination = CACHE / path.name
    atlas.save(destination, optimize=True)
    return destination, {'widthRatio': width / runtime, 'heightRatio': height / runtime}, hashlib.sha256(path.read_bytes()).hexdigest()

live = [skill for skill in SKILLS if not skill.get('retired')]
assert set(CONFIG['recipes']) == {skill['id'] for skill in live}, 'Every live skill needs an explicit recipe'
used = {layer['effect'] for recipe in CONFIG['recipes'].values() for layer in recipe['layers']}
assert used == set(CONFIG['sources']), 'Unregistered or unused source'
# Validate and prepare all inputs before changing any runtime recipe.
prepared = {}
for effect in used:
    spec = CONFIG['sources'][effect]
    image = ROOT / spec['image'] if 'image' in spec else SOURCE / (effect + '.png')
    assert image.is_file(), f'Missing source: {effect}'
for index, effect in enumerate(sorted(used), 1):
    prepared[effect] = prepare(effect)
    if index % 10 == 0:
        print(f'Prepared {index}/{len(used)} animation sheets.', flush=True)
versions = {}
for skill in live:
    skill_id, kind = skill['id'], skill['type']
    group = 'attack-' + ('phy' if skill['element'] == 'physical' else skill['element']) if kind == 'attack' else kind
    slug = skill_id.replace('.', '-').replace('_', '-')
    folder = POOL / group / slug
    folder.mkdir(parents=True, exist_ok=True)
    previous = json.loads((folder / 'meta.json').read_text()) if (folder / 'meta.json').exists() else None
    area = skill.get('area') or {}
    size_policy = 'footprint' if area.get('radius_m', 0) > 0 and area.get('shape') not in ('line', 'cone') else 'body'
    layers, sources = [], []
    for recipe in CONFIG['recipes'][skill_id]['layers']:
        effect = recipe['effect']
        spec = CONFIG['sources'][effect]
        image, content, source_hash = prepared[effect]
        shutil.copyfile(image, folder / image.name)
        grid = spec['grid']
        travel = 'Travel' in recipe['phases']
        phases = ['Impact', 'Field', 'Channel'] if 'Field' in recipe['phases'] and kind != 'aura' else recipe['phases']
        layer = {
            'id': effect, 'role': 'upright',
            'src': f'/fx/skill-pool/{group}/{slug}/{image.name}',
            'frame': {'width': BAKE['runtimeCell'], 'height': BAKE['runtimeCell'], 'count': grid['count'], 'columns': grid['columns'], 'rows': (grid['count'] + grid['columns'] - 1) // grid['columns']},
            'fps': grid['fps'], 'loop': kind == 'aura' or travel or 'Field' in phases,
            'phases': phases, 'sizePolicy': 'body' if travel else size_policy,
            'binding': 'caster' if kind in ('buff', 'heal', 'aura') else 'area',
            'anchor': [0.5, 0.5], 'content': content,
            'authoring': {'shape': 'single' if travel else 'circle' if size_policy == 'footprint' else 'single', **({'delivery': 'projectile'} if travel else {})},
            'orient': travel
        }
        if skill.get('element'):
            layer['palette'] = skill['element']
        layer.update({key: value for key, value in recipe.items() if key not in ('effect', 'phases')})
        layers.append(layer)
        sources.append({'packId': spec['packId'], 'pack': spec['pack'], 'url': f"https://assetstore.unity.com/packages/package/{spec['packId']}", 'license': spec['license'], 'effect': effect, 'bakedSha256': source_hash})
    version = {'id': 'pool', 'label': ' + '.join(dict.fromkeys(source['pack'] for source in sources)), 'default': True, 'arena': True, 'layers': layers}
    metadata = {'id': skill_id, 'sources': sources, 'version': version}
    (folder / 'meta.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf8')
    if previous and previous.get('id') == skill_id:
        current_files = {Path(layer['src']).name for layer in layers}
        for old_layer in previous.get('version', {}).get('layers', []):
            filename = Path(old_layer['src']).name
            old_image = folder / filename
            if filename not in current_files and old_image.suffix == '.png' and old_image.is_file():
                old_image.unlink()
    versions[skill_id] = [version]

assert len(versions) == len(live)
generated = '/* GENERATED by tools/build-external-vfx.py. Do not hand-edit. */\n'
generated += "import type { VfxVersion } from './catalog';\n\n"
generated += 'export const POOL_VERSIONS: Record<string, VfxVersion[]> = ' + json.dumps(versions, indent=2) + ';\n'
(ROOT / 'game/src/ui/fx/pool.generated.ts').write_text(generated, encoding='utf8')
print(f'Published {len(versions)} skill recipes from {len(prepared)} baked effects.')
