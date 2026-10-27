"""QC gate for an authored active-skill VFX draft.

Measures one atlas against the authored-VFX standard and, with --write, records `qc.json` in the
draft folder. Read-only by default.

    python tools/vfx-qc.py game/public/fx/skill-pool/attack-firestorm/v2
    python tools/vfx-qc.py game/public/fx/skill-pool/attack-blizzard/v2 --write

Gates come from the approved Firestorm v1 measurement; the wording that produced it lives in
the authored VFX production notes. Exit code 1 means at least one gate failed.

Requires Pillow in the tooling environment.
"""
import json
import math
import os
import sys

from PIL import Image

ALPHA_FLOOR = 16
MIN_MARGIN_PCT = 8.0
MAX_SIZE_DRIFT_PCT = 4.0
MAX_CENTER_DRIFT_PCT = 5.0
MAX_ANCHOR_DRIFT_PCT = 2.0
MAX_SEAM_RATIO = 1.2
LOOP_COVERAGE_BAND = 3.0
GROUND_ANCHOR_MIN, GROUND_ANCHOR_MAX = 0.84, 0.92


def _atlas_block(meta):
    for key in ('atlas', 'storm'):
        block = meta.get(key)
        if isinstance(block, dict) and block.get('cellWidth'):
            return block
    raise SystemExit('atlas-v1.json: no atlas/storm block with cellWidth')


def _frames(meta, block):
    # Ranges live inside the atlas block in newer drafts and beside it in the first approved preset.
    source = block if block.get('opening') else (meta.get('frames') or {})
    frame_ranges = {name: source.get(name) for name in ('opening', 'loop', 'exit') if source.get(name)}
    if len(frame_ranges) != 3:
        raise SystemExit('atlas-v1.json: opening/loop/exit ranges are required')
    return frame_ranges


def _ground(meta, block):
    return (block.get('anchor') or meta.get('anchor') or {}).get('groundY')


def _measure(atlas, block):
    cell_w, cell_h = block['cellWidth'], block['cellHeight']
    cols, rows = block['columns'], block['rows']
    alpha = atlas.getchannel('A').point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    out = []
    for index in range(cols * rows):
        cx, cy = (index % cols) * cell_w, (index // cols) * cell_h
        cell = atlas.crop((cx, cy, cx + cell_w, cy + cell_h))
        mask = alpha.crop((cx, cy, cx + cell_w, cy + cell_h))
        bbox = mask.getbbox()
        if not bbox:
            out.append({'frame': index, 'empty': True})
            continue
        left, top, right, bottom = bbox
        opaque = mask.histogram()[255]
        out.append({
            'frame': index,
            'bbox': [left, top, right, bottom],
            'coveragePct': round(opaque / (cell_w * cell_h) * 100, 2),
            'leftPct': round(left / cell_w * 100, 2),
            'rightPct': round((cell_w - right) / cell_w * 100, 2),
            'topPct': round(top / cell_h * 100, 2),
            'bottomPct': round((cell_h - bottom) / cell_h * 100, 2),
            'widthPct': round((right - left) / cell_w * 100, 2),
            'heightPct': round((bottom - top) / cell_h * 100, 2),
            'anchorY': round(bottom / cell_h, 4),
            'centerX': round((left + right) / 2 / cell_w, 4),
        })
    return out


def _rms(a, b):
    diff = 0.0
    count = 0
    for pa, pb in zip(a.getdata(), b.getdata()):
        if pa[3] <= ALPHA_FLOOR and pb[3] <= ALPHA_FLOOR:
            continue
        diff += (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2 + (pa[3] - pb[3]) ** 2
        count += 1
    return math.sqrt(diff / max(1, count))


def _loop_stats(atlas, block, frames, measured):
    cell_w, cell_h = block['cellWidth'], block['cellHeight']
    cols = block['columns']
    start, end = frames['loop']
    def cell_patch(index):
        cx, cy = (index % cols) * cell_w, (index // cols) * cell_h
        return atlas.crop((cx, cy, cx + cell_w, cy + cell_h))
    adjacent = [_rms(cell_patch(i), cell_patch(i + 1)) for i in range(start, end)]
    seam = _rms(cell_patch(end), cell_patch(start))
    mean_adj = sum(adjacent) / max(1, len(adjacent))
    loop = [row for row in measured if start <= row['frame'] <= end]
    drift = {
        'widthRangePct': round(max(r['widthPct'] for r in loop) - min(r['widthPct'] for r in loop), 2),
        'heightRangePct': round(max(r['heightPct'] for r in loop) - min(r['heightPct'] for r in loop), 2),
        'centerXRangePct': round((max(r['centerX'] for r in loop) - min(r['centerX'] for r in loop)) * 100, 2),
        'anchorYRangePct': round((max(r['anchorY'] for r in loop) - min(r['anchorY'] for r in loop)) * 100, 2),
    }
    coverage = [r['coveragePct'] for r in loop]
    return {
        'seamRms': round(seam, 2),
        'adjacentRms': [round(v, 2) for v in adjacent],
        'adjacentMeanRms': round(mean_adj, 2),
        'seamToAdjacentRatio': round(seam / max(1e-6, mean_adj), 2),
        'coverageRangePct': round(max(coverage) - min(coverage), 2),
        'drift': drift,
    }


def evaluate(meta, measured, loop, frames, block):
    problems = []
    used = [row for row in measured if not row.get('empty')]
    if len(used) != len(measured):
        problems.append('one or more cells are empty or fully transparent')
    open_rows = [r for r in measured if frames['opening'][0] <= r['frame'] <= frames['opening'][1]]
    loop_rows = [r for r in measured if frames['loop'][0] <= r['frame'] <= frames['loop'][1]]
    exit_rows = [r for r in measured if frames['exit'][0] <= r['frame'] <= frames['exit'][1]]

    for row in used:
        margins = (row['leftPct'], row['rightPct'], row['topPct'], row['bottomPct'])
        if min(margins) < MIN_MARGIN_PCT:
            problems.append(f"frame {row['frame']}: margin {min(margins):.2f}% is below {MIN_MARGIN_PCT}%")
    if block.get('cellWidth') and min(r['widthPct'] for r in loop_rows) == 0:
        problems.append('loop frames have no measurable width')
    if loop['drift']['widthRangePct'] > MAX_SIZE_DRIFT_PCT or loop['drift']['heightRangePct'] > MAX_SIZE_DRIFT_PCT:
        problems.append(f"loop size drift {loop['drift']['widthRangePct']}/{loop['drift']['heightRangePct']}% exceeds {MAX_SIZE_DRIFT_PCT}%")
    if loop['drift']['centerXRangePct'] > MAX_CENTER_DRIFT_PCT:
        problems.append(f"loop centerX drift {loop['drift']['centerXRangePct']}% exceeds {MAX_CENTER_DRIFT_PCT}%")
    if loop['drift']['anchorYRangePct'] > MAX_ANCHOR_DRIFT_PCT:
        problems.append(f"loop anchorY drift {loop['drift']['anchorYRangePct']}% exceeds {MAX_ANCHOR_DRIFT_PCT}%")
    if loop['seamToAdjacentRatio'] > MAX_SEAM_RATIO:
        problems.append(f"loop seam is {loop['seamToAdjacentRatio']}x a normal step (max {MAX_SEAM_RATIO})")
    # Coverage spread is reported, not gated: it tracks how much ribbon the shape carries, while the
    # size and position drifts above are what tell a player the loop is breathing or sliding.
    open_cov = [r['coveragePct'] for r in open_rows]
    exit_cov = [r['coveragePct'] for r in exit_rows]
    if any(b <= a for a, b in zip(open_cov, open_cov[1:])):
        problems.append(f'opening coverage is not monotonically increasing: {open_cov}')
    if any(b >= a for a, b in zip(exit_cov, exit_cov[1:])):
        problems.append(f'exit coverage is not monotonically decreasing: {exit_cov}')
    if exit_cov and exit_cov[-1] > 15:
        problems.append(f'last exit frame still covers {exit_cov[-1]}% (max 15%)')
    anchor = sum(r['anchorY'] for r in loop_rows) / max(1, len(loop_rows))
    ground = _ground(meta, block)
    if ground is not None and not (GROUND_ANCHOR_MIN <= anchor <= GROUND_ANCHOR_MAX):
        problems.append(f'loop ground anchor {anchor:.3f} sits outside {GROUND_ANCHOR_MIN}-{GROUND_ANCHOR_MAX}')
    return problems


def main(argv):
    if len(argv) < 2:
        raise SystemExit('usage: python tools/vfx-qc.py <draft-dir> [--write]')
    folder = argv[1]
    write = '--write' in argv
    meta_path = os.path.join(folder, 'atlas-v1.json')
    with open(meta_path, 'r', encoding='utf-8') as handle:
        meta = json.load(handle)
    block = _atlas_block(meta)
    frames = _frames(meta, block)
    atlas = Image.open(os.path.join(folder, block['file'])).convert('RGBA')
    if atlas.size != (block['cellWidth'] * block['columns'], block['cellHeight'] * block['rows']):
        print(f"FAIL atlas size {atlas.size} does not match {block['columns']}x{block['rows']} of {block['cellWidth']}px")
    measured = _measure(atlas, block)
    loop = _loop_stats(atlas, block, frames, measured)
    problems = evaluate(meta, measured, loop, frames, block)

    print(f"{meta.get('skill', folder)} | {atlas.size[0]}x{atlas.size[1]} | {block['frameCount']} frames | alpha>{ALPHA_FLOOR}")
    for row in measured:
        if row.get('empty'):
            print(f"  {row['frame']:02d} EMPTY")
            continue
        print(f"  {row['frame']:02d} cov {row['coveragePct']:5.1f}%  margins L{row['leftPct']:.1f} R{row['rightPct']:.1f} "
              f"T{row['topPct']:.1f} B{row['bottomPct']:.1f}  anchorY {row['anchorY']:.3f}  centerX {row['centerX']:.3f}")
    print(f"  loop: seam {loop['seamRms']} vs adjacent mean {loop['adjacentMeanRms']} = {loop['seamToAdjacentRatio']}x")
    print(f"  drift: width {loop['drift']['widthRangePct']}% height {loop['drift']['heightRangePct']}% "
          f"centerX {loop['drift']['centerXRangePct']}% anchorY {loop['drift']['anchorYRangePct']}% | coverage band {loop['coverageRangePct']}")

    minimum = {axis: round(min(r[key] for r in measured if not r.get('empty')), 2)
               for axis, key in (('left', 'leftPct'), ('right', 'rightPct'), ('top', 'topPct'), ('bottom', 'bottomPct'))}
    if write:
        record = {
            'raw': meta.get('source', {}).get('raw'),
            'rawSize': list(Image.open(os.path.join(folder, meta['source']['raw'])).size) if meta.get('source', {}).get('raw') else None,
            'grid': {'columns': block['columns'], 'rows': block['rows'], 'cell': block['cellWidth'], 'frameCount': block['frameCount']},
            'alphaFloor': ALPHA_FLOOR,
            'frames': measured,
            'loop': loop,
            'minMarginsPct': minimum,
            'gates': {'minMarginPct': MIN_MARGIN_PCT, 'sizeDriftPct': MAX_SIZE_DRIFT_PCT,
                      'centerDriftPct': MAX_CENTER_DRIFT_PCT, 'anchorDriftPct': MAX_ANCHOR_DRIFT_PCT,
                      'seamRatio': MAX_SEAM_RATIO, 'loopCoverageAdvisoryPct': LOOP_COVERAGE_BAND},
            'problems': problems,
        }
        with open(os.path.join(folder, 'qc.json'), 'w', encoding='utf-8') as handle:
            json.dump(record, handle, indent=1)
            handle.write('\n')
        print('  wrote qc.json')

    if problems:
        for problem in problems:
            print(f'  FAIL {problem}')
        return 1
    print('  PASS - all gates clear')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
