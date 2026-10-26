"""Check and normalize authored VFX frame metadata without changing PNG pixels.

Usage: python tools/check-authored-vfx.py [--write] [attack.skill ...]
Requires the Pillow installation used by the art pipeline.
"""
import argparse
import json
import math
import statistics
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REQUESTED = 'fireball frostbite ground_slam headshot ice_lance impale overload pierce_the_veil piercing_shot poison_bolt puncture reap ruin sand_storm shatter shield_bash sidestep skull_crack spark thunder_strike venom_spray void_blast whirlwind'.split()
THRESHOLD = 8
PADDING = 64

def cuts(projection, length):
    result = [0]
    for boundary in range(1, 4):
        expected = boundary * length // 4
        reach = max(1, int(length / 4 * .3))
        candidates = [i for i in range(max(result[-1] + 1, expected - reach), min(length - 1, expected + reach)) if not projection[i]]
        if not candidates:
            raise ValueError(f'no empty separator near {expected}')
        result.append(min(candidates, key=lambda i: abs(i - expected)))
    return result + [length]

def check(skill_id, write):
    slug = skill_id.replace('.', '-').replace('_', '-')
    folder = ROOT / 'game/public/fx/authored' / slug / 'batch-v1'
    path = folder / 'meta.json'
    meta = json.loads(path.read_text(encoding='utf-8-sig'))
    geometry_keys = ['imageWidth', 'imageHeight', 'frames', 'virtualWidth', 'virtualHeight', 'contentWidthRatio', 'contentHeightRatio', 'alphaDiscard', 'anchorX', 'anchorY', 'impactAnchorX', 'impactAnchorY']
    previous_geometry = {key: meta.get(key) for key in geometry_keys}
    image = Image.open(folder / 'atlas.png').convert('RGBA')
    width, height = image.size
    alpha = image.getchannel('A')
    mask = alpha.point(lambda value: 255 if value > THRESHOLD else 0)
    x_projection = [mask.crop((i, 0, i + 1, height)).getbbox() is not None for i in range(width)]
    y_projection = [mask.crop((0, i, width, i + 1)).getbbox() is not None for i in range(height)]
    if x_projection[0] or x_projection[-1] or y_projection[0] or y_projection[-1]:
        raise ValueError('visible alpha touches atlas perimeter; regenerate')
    xs, ys = cuts(x_projection, width), cuts(y_projection, height)
    max_width = max(b - a for a, b in zip(xs, xs[1:]))
    max_height = max(b - a for a, b in zip(ys, ys[1:]))
    virtual_width, virtual_height = max_width + PADDING * 2, max_height + PADDING * 2
    frames = []
    visible_widths, visible_heights = [], []
    for index in range(16):
        col, row = index % 4, index // 4
        x, y = xs[col], ys[row]
        cell_width, cell_height = xs[col + 1] - x, ys[row + 1] - y
        bounds = mask.crop((x, y, x + cell_width, y + cell_height)).getbbox()
        offset_x = PADDING + (max_width - cell_width) / 2
        offset_y = PADDING + (max_height - cell_height) / 2
        if bounds:
            # The cut itself is a globally empty scanline. A visible pixel at
            # cut-1 remains in this source rectangle, so no component is lost;
            # the shared virtual canvas supplies its transparent runtime gutter.
            visible_widths.append(bounds[2] - bounds[0])
            visible_heights.append(bounds[3] - bounds[1])
            padding = [offset_x + bounds[0], offset_y + bounds[1], virtual_width - offset_x - bounds[2], virtual_height - offset_y - bounds[3]]
        else:
            padding = [virtual_width, virtual_height] * 2
        if min(padding) < math.ceil(min(virtual_width, virtual_height) * .08):
            raise ValueError(f'frame {index} lacks rendered padding')
        frames.append({'index': index, 'rect': [x, y, cell_width, cell_height], 'offsetX': offset_x, 'offsetY': offset_y, 'bounds': bounds, 'renderedPadding': padding})
    if not visible_widths:
        raise ValueError('empty atlas')
    raw_perimeter = any(alpha.crop(rect).getbbox() for rect in [(0, 0, width, 1), (0, height - 1, width, height), (0, 0, 1, height), (width - 1, 0, width, height)])
    meta.update(imageWidth=width, imageHeight=height, frames=frames, virtualWidth=virtual_width, virtualHeight=virtual_height,
                contentWidthRatio=max(visible_widths) / virtual_width, contentHeightRatio=max(visible_heights) / virtual_height,
                alphaDiscard=THRESHOLD, status='ready', groundOrigin=skill_id in ['attack.ground_slam', 'attack.whirlwind', 'attack.venom_spray'])
    active_frames = [frame for frame in frames[4:12] if frame['bounds']]
    meta['anchorX'] = statistics.median(frame['offsetX'] + (frame['bounds'][0] + frame['bounds'][2]) / 2 for frame in active_frames) / virtual_width
    meta['anchorY'] = statistics.median(frame['offsetY'] + (frame['bounds'][1] + frame['bounds'][3]) / 2 for frame in active_frames) / virtual_height
    if meta['delivery'] == 'projectile':
        impacts = [frame for frame in frames[12:15] if frame['bounds']]
        meta['impactAnchorX'] = statistics.median(frame['offsetX'] + (frame['bounds'][0] + frame['bounds'][2]) / 2 for frame in impacts) / virtual_width
        meta['impactAnchorY'] = statistics.median(frame['offsetY'] + (frame['bounds'][1] + frame['bounds'][3]) / 2 for frame in impacts) / virtual_height
    if skill_id == 'attack.thunder_strike':
        meta['anchorY'] = statistics.median(frame['offsetY'] + frame['bounds'][3] for frame in frames[4:12] if frame['bounds']) / virtual_height
    meta['qa'] = {'paddingPass': True, 'renderedPaddingPass': True, 'alphaDiscard': THRESHOLD,
                  'rawPerimeterAlphaPass': not raw_perimeter, 'sourceSeparatorsClear': True,
                  'sourcePixelsUnmodified': True, 'frameCount': 16,
                  'note': 'Renderer discards alpha <=8/255; source PNG is retained unchanged. Padding belongs to shared virtual canvas.'}
    measured_geometry = json.loads(json.dumps({key: meta.get(key) for key in geometry_keys}))
    if not write and previous_geometry != measured_geometry:
        raise ValueError('stored geometry differs from measured atlas; run with --write before promotion')
    if write:
        encoded = json.dumps(meta, indent=2) + '\n'
        path.write_text(encoded, encoding='utf-8')
        draft = ROOT / 'art-reference/skills/generated' / (slug + '-batch-v1')
        draft.mkdir(parents=True, exist_ok=True)
        (draft / 'meta.json').write_text(encoded, encoding='utf-8')
    return {'id': skill_id, 'status': 'PASS', 'frames': len(frames), 'image': [width, height], 'virtual': [virtual_width, virtual_height], 'rawPerimeterAlphaPass': not raw_perimeter}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--selected', action='store_true', help='Read-only check of current batch + spatial overrides and selected component atlases')
    parser.add_argument('skills', nargs='*')
    args = parser.parse_args()
    if args.selected:
        if args.write or args.skills:
            parser.error('--selected is read-only and does not take individual skills')
        raise SystemExit(check_selected())
    failed = False
    for skill_id in args.skills or ['attack.' + key for key in REQUESTED]:
        try:
            print(json.dumps(check(skill_id, args.write)))
        except (OSError, ValueError, KeyError) as error:
            failed = True
            print(json.dumps({'id': skill_id, 'status': 'FAIL', 'reason': str(error)}))
    raise SystemExit(1 if failed else 0)


def check_selected():
    """Validate actual selected manifests, including explicit rectangles of arbitrary dimensions."""
    shelf = ROOT / 'game/public/fx/authored'
    manifests = ROOT / 'game/src/ui/combat/fx-manifests'
    selected = json.loads((manifests / 'batch-manifest.json').read_text(encoding='utf-8-sig'))
    selected.update(json.loads((manifests / 'spatial-v2-manifest.json').read_text(encoding='utf-8-sig'))['entries'])
    live = {row['id'] for row in json.loads((ROOT / 'tools/data/skills.json').read_text(encoding='utf-8-sig'))['skills'] if not row.get('retired')}
    failures = []
    if set(selected) != live:
        failures.append({'coverage': {'missing': sorted(live - set(selected)), 'extra': sorted(set(selected) - live)}})
    component_pack = json.loads((manifests / 'components-v2-manifest.json').read_text())
    entries = list(selected.items()) + [(component_pack['skillId'] + ':' + part['key'], part['art']) for part in component_pack['components']]
    for key, art in entries:
        try:
            src = art['src']
            if not src.startswith('/fx/authored/'):
                raise ValueError('source is outside the runtime art shelf')
            image_path = (ROOT / 'game/public' / src.lstrip('/')).resolve()
            if not image_path.is_relative_to(shelf.resolve()):
                raise ValueError('source escapes the runtime art shelf')
            image = Image.open(image_path)
            if image.mode != 'RGBA':
                raise ValueError('PNG must retain an RGBA channel')
            alpha = image.getchannel('A')
            mask = alpha.point(lambda v: 255 if v > art.get('alphaDiscard', THRESHOLD) else 0)
            width, height = image.size
            if [width, height] != [art.get('imageWidth'), art.get('imageHeight')]:
                raise ValueError('stored image dimensions differ from original pixels')
            if alpha.getextrema()[0] == 255 or not mask.getbbox():
                raise ValueError('opaque background or empty atlas')
            if any(mask.crop(rect).getbbox() for rect in [(0, 0, width, 1), (0, height-1, width, height), (0, 0, 1, height), (width-1, 0, width, height)]):
                raise ValueError('visible alpha touches atlas perimeter')
            frames = art.get('frames', [])
            if not frames or len({f['index'] for f in frames}) != len(frames):
                raise ValueError('missing or duplicated explicit frame rectangles')
            for frame in frames:
                x, y, w, h = frame['rect']
                if not all(math.isfinite(v) for v in [x, y, w, h]) or min(x, y) < 0 or min(w, h) <= 0 or x+w > width or y+h > height:
                    raise ValueError(f"frame {frame['index']} exceeds source bounds")
                ox, oy = frame.get('offsetX', 0), frame.get('offsetY', 0)
                if min(ox, oy) < 0 or ox+w > art['virtualWidth'] or oy+h > art['virtualHeight']:
                    raise ValueError(f"frame {frame['index']} clips in its virtual canvas")
            for phase in ['opening', 'loop', 'exit']:
                first, last = art[phase]
                if not 0 <= first <= last < len(frames):
                    raise ValueError(f'{phase} range is invalid')
        except (OSError, ValueError, KeyError, TypeError) as error:
            failures.append({'id': key, 'reason': str(error)})
    for failure in failures:
        print(json.dumps({'status': 'FAIL', **failure}))
    print(json.dumps({'status': 'FAIL' if failures else 'PASS', 'liveSkills': len(live), 'selectedSkills': len(selected), 'componentAtlases': len(component_pack['components']), 'checkedAtlases': len(entries), 'failures': len(failures), 'scope': 'source pixels, alpha, rectangles and coverage; motion and arena acceptance are separate'}))
    return 1 if failures else 0

if __name__ == '__main__':
    main()
