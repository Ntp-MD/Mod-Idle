import argparse
import hashlib
import json
import shutil
from statistics import median
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PREVIEWS = OUT / 'previews'
CARDINALS = ['south', 'north', 'west', 'east']
DIAGONALS = ['north-east', 'south-east', 'south-west', 'north-west']
DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']


def prepare():
    species = json.loads((ROOT / 'tools/data/engine.json').read_text(encoding='utf-8'))['mob']['species']
    entries = [{'id': 'player', 'name': 'Player', 'race': 'player', 'source': 'archive/art-reference/players/body/idle/south.png'}]
    for row in species:
        base = ROOT / 'archive/art-reference/monsters' / row['race'] / row['id'] / row['id']
        choices = [base / 'reference.png', base / 'animation/poses/idle/south.png']
        source = next((p for p in choices if p.exists()), None)
        if source is None:
            raise ValueError(f"Missing identity source: {row['id']}")
        entries.append({'id': row['id'], 'name': row['name'], 'race': row['race'], 'source': source.relative_to(ROOT).as_posix()})
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
    contact = Image.new('RGB', (6 * 200, 7 * 220), '#f1eee7')
    draw = ImageDraw.Draw(contact)
    for i, entry in enumerate(entries):
        source = ROOT / entry['source']
        im = Image.open(source).convert('RGBA')
        box = im.getbbox()
        if not box:
            raise ValueError(f"Empty identity source: {source}")
        im = im.crop(box)
        scale = 320 / max(im.size)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.NEAREST)
        portrait = Image.new('RGBA', (384, 384), 'white')
        portrait.alpha_composite(im, ((384 - im.width) // 2, (384 - im.height) // 2))
        portrait.convert('RGB').save(OUT / 'sources' / f"{entry['id']}.png")
        entry['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        thumb = portrait.convert('RGB').resize((180, 180), Image.Resampling.LANCZOS)
        x, y = (i % 6) * 200, (i // 6) * 220
        contact.paste(thumb, (x + 10, y + 5))
        draw.text((x + 10, y + 190), entry['name'], font=font, fill='#252832')
    contact.save(OUT / 'sources' / 'identity-contact-sheet.jpg', quality=90)
    (OUT / 'roster.json').write_text(json.dumps({'speciesCount': len(species), 'entries': entries}, indent=2) + '\n', encoding='utf-8')
    print(f"Prepared {len(entries)} identities: {len(species)} species + player")


def collect():
    roster = json.loads((OUT / 'roster.json').read_text(encoding='utf-8'))
    for entry in roster['entries']:
        pattern = 'modworld-pawn-player-four-views_*.png' if entry['id'] == 'player' else f"pawn-{entry['id']}_*.png"
        files = [ROOT / entry['generatedSource']] if entry.get('generatedSource') else list((ROOT / 'vibe_images').glob(pattern))
        if len(files) != 1:
            raise ValueError(f"Expected one generated sheet for {entry['id']}, got {len(files)}")
        image = Image.open(files[0])
        assert image.size == (1024, 1024), (entry['id'], image.size)
        shutil.copyfile(files[0], OUT / 'sheets' / f"{entry['id']}.png")
        entry['generatedSource'] = files[0].relative_to(ROOT).as_posix()
        entry['sheetSha256'] = hashlib.sha256(files[0].read_bytes()).hexdigest()
    (OUT / 'roster.json').write_text(json.dumps(roster, indent=2) + '\n', encoding='utf-8')
    PREVIEWS.mkdir(exist_ok=True)
    for start in range(0, len(roster['entries']), 12):
        rows = roster['entries'][start:start + 12]
        board = Image.new('RGB', (4 * 256, 3 * 282), '#eeebe5')
        draw = ImageDraw.Draw(board)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
        for i, entry in enumerate(rows):
            sheet = Image.open(OUT / 'sheets' / f"{entry['id']}.png").convert('RGB').resize((256, 256))
            x, y = (i % 4) * 256, (i // 4) * 282
            board.paste(sheet, (x, y))
            draw.text((x + 8, y + 258), entry['name'], fill='#262b32', font=font)
        board.save(PREVIEWS / f'review-{start // 12 + 1}.jpg', quality=94)
    print(f"Collected {len(roster['entries'])} complete four-view sheets")


def kebab(text):
    return ''.join(ch if ch.isalnum() else '-' for ch in text.lower()).strip('-').replace('--', '-')


def variants_prepare():
    engine = json.loads((ROOT / 'tools/data/engine.json').read_text(encoding='utf-8'))
    roster = json.loads((OUT / 'roster.json').read_text(encoding='utf-8'))
    base = {entry['id']: entry for entry in roster['entries']}
    variants = []
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
    for species in engine['mob']['species']:
        names = []
        for row in engine['mob']['variants']:
            if row['species'] == species['id'] and row['name'] not in names:
                names.append(row['name'])
        for name in names:
            slug = kebab(name)
            folder = ROOT / 'archive/art-reference/monsters' / species['race'] / species['id'] / slug
            identity = None
            for candidate in (folder / 'reference.png', folder / 'source/reference.png'):
                if candidate.exists():
                    identity = candidate
                    break
            if identity is None:
                for atlas in (folder / 'atlas/animation.png', folder / 'atlas/animation-draft.png', folder / 'clips/animation.png'):
                    if atlas.exists():
                        identity = atlas
                        break
            board = Image.new('RGB', (1024, 512), 'white')
            sheet = Image.open(OUT / 'sheets' / f"{species['id']}.png").convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
            board.paste(sheet, (0, 0))
            source_kind = 'none'
            if identity is not None:
                source_kind = 'atlas-front' if identity.parent.name == 'atlas' or identity.parent.name == 'clips' else 'reference'
                crop = Image.open(identity).convert('RGBA')
                if source_kind == 'atlas-front':
                    assert crop.size[0] % 8 == 0 and crop.size[1] % 5 == 0, (identity, crop.size)
                    cell_w, cell_h = crop.size[0] // 8, crop.size[1] // 5
                    crop = crop.crop((0, 0, cell_w, cell_h))
                box = crop.getbbox()
                if box:
                    crop = crop.crop(box)
                scale = min(460 / crop.width, 460 / crop.height)
                crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
                patch = Image.new('RGBA', (512, 512), 'white')
                patch.alpha_composite(crop, ((512 - crop.width) // 2, (512 - crop.height) // 2))
                board.paste(patch.convert('RGB'), (512, 0))
            out = OUT / 'sources' / f"variant-{species['id']}-{slug}.jpg"
            board.save(out, quality=93)
            variants.append({
                'id': f"{species['id']}--{slug}",
                'name': name,
                'race': species['race'],
                'kind': 'variant',
                'variantOf': species['id'],
                'identitySource': identity.relative_to(ROOT).as_posix() if identity else None,
                'identityKind': source_kind,
                'board': out.relative_to(ROOT).as_posix(),
            })
    (OUT / 'variant-roster.json').write_text(json.dumps({'count': len(variants), 'entries': variants}, indent=2) + '\n', encoding='utf-8')
    print(f"Prepared {len(variants)} unique named variants across {len(engine['mob']['species'])} species")


def collect_variants():
    roster = json.loads((OUT / 'variant-roster.json').read_text(encoding='utf-8'))
    (OUT / 'sheets' / 'variants').mkdir(parents=True, exist_ok=True)
    pending = []
    for entry in roster['entries']:
        files = list((OUT / 'generation').glob(f"pawn-variant-{entry['id'].replace('--', '-')}_*.png"))
        if not files:
            pending.append(entry['id'])
            continue
        if len(files) > 1:
            raise ValueError(f"Expected one generated sheet for {entry['id']}, got {len(files)}")
        image = Image.open(files[0])
        assert image.size == (1024, 1024), (entry['id'], image.size)
        entry['generatedSource'] = files[0].relative_to(ROOT).as_posix()
        entry['sheet'] = f"sheets/variants/{entry['id']}.png"
        shutil.copyfile(files[0], OUT / entry['sheet'])
        entry['sheetSha256'] = hashlib.sha256(files[0].read_bytes()).hexdigest()
    (OUT / 'variant-roster.json').write_text(json.dumps(roster, indent=2) + '\n', encoding='utf-8')
    print(f"Collected {len(roster['entries']) - len(pending)} variant sheets; {len(pending)} pending")


def check():
    rosters = [json.loads((OUT / 'roster.json').read_text(encoding='utf-8'))]
    if (OUT / 'variant-roster.json').exists():
        rosters.append(json.loads((OUT / 'variant-roster.json').read_text(encoding='utf-8')))
    bad = []
    for data in rosters:
        for entry in data['entries']:
            sheet_path = OUT / entry.get('sheet', f"sheets/{entry['id']}.png")
            if not sheet_path.exists():
                continue
            sheet = Image.open(sheet_path)
            for i in range(4):
                x, y = (i % 2) * 512, (i // 2) * 512
                try:
                    extract(sheet.crop((x, y, x + 512, y + 512)), entry.get('shadowCutoffByView', [None] * 4)[i])
                except AssertionError as error:
                    bad.append(f"{entry['id']}[{DIRECTIONS[i]}]: {error}")
    print('\n'.join(bad) if bad else 'All collected sheets are on-grid with unclipped tiles')


def extract(tile, shadow_top=None):
    r, g, b = tile.convert('RGB').split()
    low = ImageChops.darker(ImageChops.darker(r, g), b)
    high = ImageChops.lighter(ImageChops.lighter(r, g), b)
    spread = ImageChops.subtract(high, low)
    # Near-white, or light neutral gray with no dark contour: soft ground shadows fade into the
    # background and are flooded away, while an enclosed gray body (stone golem) keeps its outline.
    white = low.point(lambda v: 255 if v >= 230 else 0)
    gray = ImageChops.multiply(
        low.point(lambda v: 255 if v >= 150 else 0),
        spread.point(lambda v: 255 if v <= 12 else 0))
    background = ImageChops.lighter(white, gray)
    padded = Image.new('L', (tile.width + 2, tile.height + 2), 255)
    padded.paste(background, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    alpha = padded.crop((1, 1, tile.width + 1, tile.height + 1)).point(lambda x: 0 if x == 128 else 255)
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    if shadow_top is not None:
        ImageDraw.Draw(alpha).rectangle((0, shadow_top, tile.width, tile.height), fill=0)
    tile = tile.convert('RGBA')
    tile.putalpha(ImageChops.darker(tile.getchannel('A'), alpha))
    # Ignore alpha-only edge specks below the documented source threshold when finding cell bounds.
    visible = tile.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    bounds = visible.getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < tile.width and bounds[3] < tile.height, bounds
    assert bounds[2] - bounds[0] > 40 and bounds[3] - bounds[1] > 40, bounds
    return tile.crop(bounds), bounds
    tile.putalpha(ImageChops.darker(tile.getchannel('A'), alpha))
    bounds = tile.getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < tile.width and bounds[3] < tile.height, bounds
    assert bounds[2] - bounds[0] > 40 and bounds[3] - bounds[1] > 40, bounds
    return tile.crop(bounds), bounds


def pack(entry, atlas_path, thumb):
    sheet = Image.open(OUT / entry['sheet'])
    cutouts = {}
    bounds = {}
    for i, direction in enumerate(CARDINALS):
        x, y = (i % 2) * 512, (i // 2) * 512
        cutout, box = extract(sheet.crop((x, y, x + 512, y + 512)), entry.get('shadowCutoffByView', [None] * 4)[i])
        cutouts[direction] = cutout
        bounds[direction] = list(box)
    diagonal_sheet = diagonal_sheet_for(entry)
    if diagonal_sheet.exists():
        entry['diagonalSheet'] = diagonal_sheet.relative_to(ROOT).as_posix()
        diagonals = Image.open(diagonal_sheet)
        if diagonals.width != diagonals.height or diagonals.width % 2:
            raise ValueError(f"{entry['id']}: diagonal sheet must be an even square, got {diagonals.size}")
        diagonal_cell = diagonals.width // 2
        diagonal_cutouts = {}
        for i, direction in enumerate(DIAGONALS):
            x, y = (i % 2) * diagonal_cell, (i // 2) * diagonal_cell
            try:
                cutout, box = extract(diagonals.crop((x, y, x + diagonal_cell, y + diagonal_cell)))
            except AssertionError as error:
                raise ValueError(f"{entry['id']} {direction} diagonal cell is clipped or empty: {error}") from error
            diagonal_cutouts[direction] = cutout
            bounds[direction] = list(box)
        runtime = runtime_cardinal_frames(entry)
        if runtime:
            cardinal_frames, cardinal_bounds = runtime
            target_height = max(box[3] - box[1] for box in cardinal_bounds.values())
            diagonal_scale = target_height / median(frame.height for frame in diagonal_cutouts.values())
            entry['diagonalScaleFactor'] = round(diagonal_scale, 6)
            diagonal_frames = {}
            packed_bounds = dict(cardinal_bounds)
            for direction, cutout in diagonal_cutouts.items():
                width = round(cutout.width * diagonal_scale)
                height = round(cutout.height * diagonal_scale)
                if width > 248 or height > 216:
                    raise ValueError(f"{entry['id']} {direction}: normalized diagonal does not fit the 256px cell")
                sprite = cutout.resize((width, height), Image.Resampling.LANCZOS)
                frame = Image.new('RGBA', (256, 256))
                frame.alpha_composite(sprite, (128 - width // 2, 224 - height))
                diagonal_frames[direction] = frame
                packed_bounds[direction] = list(frame.getchannel('A').getbbox())
            layout = {'columns': 4, 'rows': 2, 'frameCount': 8, 'directions': DIRECTIONS}
            atlas = Image.new('RGBA', (1024, 512))
            frames = {**cardinal_frames, **diagonal_frames}
            folder = OUT / 'frames' / entry['id']
            folder.mkdir(parents=True, exist_ok=True)
            for i, direction in enumerate(DIRECTIONS):
                frame = frames[direction]
                frame.save(folder / f'{direction}.png')
                atlas.alpha_composite(frame, (i % 4 * 256, i // 4 * 256))
            atlas_path.parent.mkdir(parents=True, exist_ok=True)
            atlas.save(atlas_path)
            ordered_bounds = [packed_bounds[d] for d in DIRECTIONS]
            return cardinal_frames['south'], ordered_bounds, layout
        cutouts.update(diagonal_cutouts)
    layout = {'columns': 4 if len(cutouts) == 8 else 2, 'rows': 2, 'frameCount': len(cutouts),
              'directions': [d for d in DIRECTIONS if d in cutouts]}
    factor = min(thumb / max(c.width for c in cutouts.values()), (thumb - 8) / max(c.height for c in cutouts.values()))
    atlas = Image.new('RGBA', (layout['columns'] * 256, layout['rows'] * 256))
    folder = OUT / 'frames' / entry['id']
    folder.mkdir(parents=True, exist_ok=True)
    first = None
    for i, direction in enumerate(layout['directions']):
        cutout = cutouts[direction]
        sprite = cutout.resize((round(cutout.width * factor), round(cutout.height * factor)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (256, 256))
        frame.alpha_composite(sprite, (128 - sprite.width // 2, 224 - sprite.height))
        frame.save(folder / f'{direction}.png')
        atlas.alpha_composite(frame, ((i % layout['columns']) * 256, (i // layout['columns']) * 256))
        first = first or frame
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path)
    return first, [bounds[d] for d in layout['directions']], layout


def runtime_cardinal_frames(entry):
    public = ROOT / 'game/public'
    if entry['id'] == 'player':
        folder = public / 'combat/arpg/player/pawn'
    elif entry.get('kind') == 'variant':
        folder = public / 'combat/mob-pool' / entry['race'] / entry['variantOf'] / 'variants' / entry['id'].split('--', 1)[1]
    else:
        folder = public / 'combat/mob-pool' / entry['race'] / entry['id']
    pointer = folder / 'default/version.json'
    if not pointer.exists():
        return None
    version = json.loads(pointer.read_text(encoding='utf-8'))['version']
    version_root = folder / version
    metadata_path = version_root / 'meta.json'
    atlas_path = version_root / 'atlas.png'
    if not metadata_path.exists() or not atlas_path.exists():
        return None
    metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
    layout = metadata.get('layout', {})
    directions = layout.get('directions', CARDINALS if layout.get('frameCount') == 4 else DIRECTIONS)
    if any(direction not in directions for direction in CARDINALS):
        return None
    image = Image.open(atlas_path).convert('RGBA')
    columns = layout.get('columns', 2 if layout.get('frameCount') == 4 else 4)
    frames, bounds = {}, {}
    for direction in CARDINALS:
        index = directions.index(direction)
        x, y = index % columns * 256, index // columns * 256
        frame = image.crop((x, y, x + 256, y + 256))
        box = frame.getchannel('A').getbbox()
        if not box:
            return None
        frames[direction] = frame
        bounds[direction] = list(box)
    return frames, bounds


def diagonal_sheet_for(entry):
    folder = OUT / 'generation/eight-direction'
    names = [entry['id'], entry['id'].replace('--', '-')]
    return next((folder / f'pawn-{name}-diagonals.png' for name in dict.fromkeys(names)
                 if (folder / f'pawn-{name}-diagonals.png').exists()), folder / f"pawn-{entry['id']}-diagonals.png")


def build():
    PREVIEWS.mkdir(exist_ok=True)
    previous_manifest_path = OUT / 'manifest.json'
    previous_manifest = json.loads(previous_manifest_path.read_text(encoding='utf-8')) if previous_manifest_path.exists() else {}
    runtime_integrated = bool(previous_manifest.get('runtimeIntegrated'))
    previous_entries = {entry['id']: entry for entry in [*previous_manifest.get('entries', []), *previous_manifest.get('variants', [])]}

    def pack_for_build(entry, atlas_path, thumb):
        diagonal_path = diagonal_sheet_for(entry)
        diagonal_sha256 = None
        if diagonal_path.exists():
            diagonal_sha256 = hashlib.sha256(diagonal_path.read_bytes()).hexdigest()
            entry['diagonalSheet'] = diagonal_path.relative_to(ROOT).as_posix()
            entry['diagonalSheetSha256'] = diagonal_sha256
        previous = previous_entries.get(entry['id'], {})
        reusable_eight = previous.get('layout', {}).get('frameCount') == 8 and previous.get('productionApproved')
        if previous.get('sheetSha256') == entry.get('sheetSha256') \
                and (diagonal_sha256 is None or previous.get('diagonalSheetSha256') == diagonal_sha256) \
                and previous.get('sourceBounds') and atlas_path.exists() \
                and (not diagonal_path.exists() or reusable_eight):
            image = Image.open(atlas_path).convert('RGBA')
            columns, rows = image.width // 256, image.height // 256
            frame_count = columns * rows
            directions = previous.get('layout', {}).get('directions')
            if not directions:
                directions = CARDINALS if frame_count == 4 else DIRECTIONS
            layout = {'columns': columns, 'rows': rows, 'frameCount': frame_count, 'directions': directions}
            return image.crop((0, 0, 256, 256)), previous['sourceBounds'], layout
        return pack(entry, atlas_path, thumb)

    roster = json.loads((OUT / 'roster.json').read_text(encoding='utf-8'))
    live = json.loads((ROOT / 'tools/data/engine.json').read_text(encoding='utf-8'))['mob']['species']
    assert {e['id'] for e in roster['entries']} == {'player'} | {s['id'] for s in live}
    variant_file = OUT / 'variant-roster.json'
    variants = json.loads(variant_file.read_text(encoding='utf-8')) if variant_file.exists() else {'entries': []}
    manifest = {
        'schemaVersion': 1,
        'status': 'runtime-default' if runtime_integrated else 'art-reference-candidate',
        'runtimeIntegrated': runtime_integrated,
        'generator': 'ImageGen',
        'speciesCount': len(live),
        'characterCount': len(roster['entries']),
        'variantCount': len(variants['entries']),
        'directions': DIRECTIONS,
        'atlasLayout': 'Per identity: 2x2 cardinal or 4x2 eight-direction row-major atlas',
        'frameSize': 256,
        'anchor': [128, 224],
        'scalePolicy': 'One shared scale per character; species are normalized for comparison, not gameplay size.',
        'motionPolicy': 'One static image per facing; idle/walk/attack/hit/death preview uses whole-sprite transforms, not authored limb animation.',
        'alphaPolicy': 'Remove border-connected near-white pixels, inset mask by one source pixel, keep silhouette parts connected to the main body so detached ground shadows are dropped. Production edge cleanup still requires review.',
        'promptBrief': 'Species: restyle the canonical identity as an original minimalist colony-sim pawn. Variants: staff sheet supplies the pawn style and anatomy; existing draft art supplies identity only. Exactly four full views on white in south/north/west/east order. Humanoids omit articulated limbs; beasts retain their body plan. No weapons, text, grids, shadows or scene.',
        'limitations': ['Generated views are approximate, not certified orthographic rotations.', 'Variants are generated from draft atlases where no reference.png exists, so identity fidelity is approximate.', 'No gameplay/runtime size, collision, weapon sockets, animation timing or camera calibration is implied.', 'No weapon sheets or articulated animation frames are included.'],
        'entries': [],
        'variants': [],
    }

    def production_approved(entry, layout):
        if not runtime_integrated:
            return False
        if layout['frameCount'] == 4:
            return True
        sidecar = diagonal_sheet_for(entry).with_suffix('.meta.json')
        if not sidecar.exists():
            return False
        review = json.loads(sidecar.read_text(encoding='utf-8-sig')).get('review', {})
        pose = review.get('pose', review.get('directionPose'))
        required = (pose, review.get('anchor'), review.get('sharedScale'),
                    review.get('alphaAndCellBounds'), review.get('approved', True))
        return bool(review) and all(value is True or value == 'passed' for value in required)

    for entry in roster['entries']:
        entry['sheet'] = entry.get('sheet', f"sheets/{entry['id']}.png")
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
    overview = Image.new('RGB', (7 * 180, 6 * 220), '#f0ede7')
    draw = ImageDraw.Draw(overview)
    for index, entry in enumerate(roster['entries']):
        thumb, bounds, layout = pack_for_build(entry, OUT / 'atlases' / f"{entry['id']}.png", 200)
        small = thumb.resize((180, 180), Image.Resampling.LANCZOS)
        overview.paste(small, ((index % 7) * 180, (index // 7) * 220), small)
        draw.text(((index % 7) * 180 + 10, (index // 7) * 220 + 184), entry['name'], font=font, fill='#282b31')
        manifest['entries'].append({**entry, 'atlas': f"atlases/{entry['id']}.png", 'sheet': entry['sheet'], 'sourceBounds': bounds, 'layout': layout, 'productionApproved': production_approved(entry, layout)})
    overview.save(PREVIEWS / 'overview.jpg', quality=94)
    rows = [entry for entry in variants['entries'] if entry.get('sheet') and (OUT / entry['sheet']).exists()]
    manifest['variantCount'] = len(rows)
    for start in range(0, len(rows), 24):
        page = rows[start:start + 24]
        board = Image.new('RGB', (6 * 160, 4 * 196), '#f0ede7')
        page_draw = ImageDraw.Draw(board)
        for index, entry in enumerate(page):
            thumb, bounds, layout = pack_for_build(entry, OUT / 'atlases' / 'variants' / f"{entry['id']}.png", 150)
            small = thumb.resize((140, 140), Image.Resampling.LANCZOS)
            x, y = (index % 6) * 160, (index // 6) * 196
            board.paste(small, (x + 10, y + 4), small)
            page_draw.text((x + 6, y + 158), entry['name'][:24], font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 14), fill='#282b31')
            manifest['variants'].append({**entry, 'atlas': f"atlases/variants/{entry['id']}.png", 'sourceBounds': bounds, 'layout': layout, 'productionApproved': production_approved(entry, layout)})
        board.save(PREVIEWS / f'overview-variants-{start // 24 + 1}.jpg', quality=94)
    text = json.dumps(manifest, indent=2) + '\n'
    (OUT / 'manifest.json').write_text(text, encoding='utf-8')
    (OUT / 'manifest.js').write_text('window.PAWN_STUDY = ' + text.rstrip() + ';\n', encoding='utf-8')
    packed = manifest['entries'] + manifest['variants']
    for entry in packed:
        assert (OUT / entry['atlas']).exists(), entry['atlas']
        for direction in entry['layout']['directions']:
            assert (OUT / 'frames' / entry['id'] / f'{direction}.png').exists(), (entry['id'], direction)
    assert len(packed) == len(roster['entries']) + len(rows)
    print(f"Verified {len(roster['entries'])} species atlases / {4 * len(roster['entries'])} frames and {len(rows)} variant atlases / {4 * len(rows)} frames; roster parity and unclipped bounds pass")


def integrate(only_ids=None):
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest['speciesCount'] != 36 or len(manifest['entries']) != manifest['speciesCount'] + 1:
        raise ValueError('Pawn study roster does not match the live species roster')
    if len(manifest['variants']) != manifest['variantCount']:
        raise ValueError('Pawn study variant count does not match its manifest')
    selected = set(only_ids) if only_ids else None
    to_install = [entry for entry in [*manifest['entries'], *manifest['variants']]
                  if selected is None or entry['id'] in selected]
    unreviewed = [entry['id'] for entry in to_install
                  if entry.get('layout', {}).get('frameCount') == 8 and not entry.get('productionApproved')]
    if unreviewed:
        raise ValueError(f"Eight-direction art requires pose, anchor and shared-scale review: {', '.join(unreviewed)}")

    public = ROOT / 'game/public'
    pool = public / 'combat/mob-pool'
    directions = manifest['directions']
    anchor_x, anchor_y = manifest['anchor']
    integrated = []

    def install(entry, folder, kind):
        atlas_source = OUT / entry['atlas']
        image = Image.open(atlas_source).convert('RGBA')
        layout = entry['layout']
        if image.width != layout['columns'] * 256 or image.height != layout['rows'] * 256:
            raise ValueError(f"{entry['id']}: atlas dimensions do not match its frame layout: {image.size}")
        frames = []
        for index, direction in enumerate(layout['directions']):
            left, top = index % layout['columns'] * 256, index // layout['columns'] * 256
            bounds = image.crop((left, top, left + 256, top + 256)).getchannel('A').getbbox()
            if not bounds:
                raise ValueError(f"{entry['id']} {direction}: empty frame")
            x, y, right, bottom = bounds
            frames.append({
                'x': left + x, 'y': top + y, 'width': right - x, 'height': bottom - y,
                'offsetX': x, 'offsetY': y,
            })

        folder.mkdir(parents=True, exist_ok=True)
        versions = sorted(
            ((int(child.name[1:]), child) for child in folder.iterdir()
             if child.is_dir() and child.name.startswith('v') and child.name[1:].isdigit()),
            key=lambda item: item[0],
        )
        source_hash = hashlib.sha256(atlas_source.read_bytes()).hexdigest()
        diagonal_hash = entry.get('diagonalSheetSha256')
        version_root = None
        for _, candidate in versions:
            meta_path = candidate / 'meta.json'
            atlas_path = candidate / 'atlas.png'
            if not meta_path.exists() or not atlas_path.exists():
                continue
            old = json.loads(meta_path.read_text(encoding='utf-8'))
            if old.get('artSet') != 'pawn-study':
                raise FileExistsError(f"Existing non-pawn sprite version at {candidate}")
            if (old.get('studyEntryId') == entry['id']
                    and old.get('sourceSha256') == entry.get('sourceSha256')
                    and old.get('diagonalSourceSha256') == diagonal_hash
                    and old.get('layout', {}).get('frameCount') == layout['frameCount']
                    and hashlib.sha256(atlas_path.read_bytes()).hexdigest() == source_hash):
                version_root = candidate
                break
        if version_root is None:
            version_root = folder / f"v{versions[-1][0] + 1 if versions else 1}"
        default_root = folder / 'default'
        version_root.mkdir(parents=True, exist_ok=True)
        default_root.mkdir(parents=True, exist_ok=True)

        metadata = {
            'artSet': 'pawn-study',
            'studyEntryId': entry['id'],
            'name': entry['name'],
            'sourceCanvas': {'width': image.width, 'height': image.height},
            'frameCanvas': {'width': 256, 'height': 256},
            'anchor': {'x': anchor_x, 'y': anchor_y},
            'sourceFrames': frames,
            'layout': {**layout, 'cellOrder': 'row-major'},
            'animationKind': f"static-{layout['frameCount']}-view",
            'frames': [{'index': i, 'action': 'idle', 'direction': direction} for i, direction in enumerate(layout['directions'])],
            'motionPolicy': manifest['motionPolicy'],
            'source': entry.get('source'),
            'sourceSha256': entry.get('sourceSha256'),
            'diagonalSource': entry.get('diagonalSheet'),
            'diagonalSourceSha256': diagonal_hash,
            'diagonalScaleFactor': entry.get('diagonalScaleFactor'),
        }
        if kind == 'variant':
            metadata.update({'speciesId': entry['variantOf'], 'variantId': entry['id'].split('--', 1)[1]})
        if entry['id'] == 'player':
            metadata['gripsByDirection'] = {
                'south': {'mainHand': {'x': 165, 'y': 168}, 'offHand': {'x': 91, 'y': 168}},
                'north': {'mainHand': {'x': 165, 'y': 168}, 'offHand': {'x': 91, 'y': 168}},
                'west': {'mainHand': {'x': 116, 'y': 169}, 'offHand': {'x': 163, 'y': 169}},
                'east': {'mainHand': {'x': 140, 'y': 169}, 'offHand': {'x': 93, 'y': 169}},
            }
        if not (version_root / 'atlas.png').exists():
            shutil.copyfile(atlas_source, version_root / 'atlas.png')
            (version_root / 'meta.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
        pointer = default_root / 'version.json'
        content = json.dumps({'version': version_root.name}, indent=2) + '\n'
        if not pointer.exists() or pointer.read_text(encoding='utf-8') != content:
            pointer.write_text(content, encoding='utf-8')
        return version_root.name

    def current_version(folder):
        pointer = folder / 'default/version.json'
        return json.loads(pointer.read_text(encoding='utf-8')).get('version') if pointer.exists() else None

    versions_by_id = {}
    for entry in manifest['entries']:
        folder = public / 'combat/arpg/player/pawn' if entry['id'] == 'player' else pool / entry['race'] / entry['id']
        if selected and entry['id'] not in selected:
            versions_by_id[entry['id']] = current_version(folder)
        else:
            versions_by_id[entry['id']] = install(entry, folder, 'species')
            integrated.append(entry)
    for entry in manifest['variants']:
        slug = entry['id'].split('--', 1)[1]
        folder = pool / entry['race'] / entry['variantOf'] / 'variants' / slug
        if selected and entry['id'] not in selected:
            versions_by_id[entry['id']] = current_version(folder)
        else:
            versions_by_id[entry['id']] = install(entry, folder, 'variant')
            integrated.append(entry)

    manifest['status'] = 'runtime-default'
    manifest['runtimeIntegrated'] = True
    for entry in integrated:
        entry['productionApproved'] = True
    text = json.dumps(manifest, indent=2) + '\n'
    manifest_path.write_text(text, encoding='utf-8')
    (OUT / 'manifest.js').write_text('window.PAWN_STUDY = ' + text.rstrip() + ';\n', encoding='utf-8')

    provenance = {
        'style': 'pawn-study',
        'sourceManifest': 'docs/character/pawn-study/manifest.json',
        'runtimeIntegrated': True,
        'defaultVersion': 'per-entry pointer',
        'atlasLayout': manifest['atlasLayout'],
        'directions': directions,
        'player': f"/combat/arpg/player/pawn/{versions_by_id['player']}/atlas.png",
        'species': {
            entry['id']: f"/combat/mob-pool/{entry['race']}/{entry['id']}/{versions_by_id[entry['id']]}/atlas.png"
            for entry in manifest['entries'] if entry['id'] != 'player' and versions_by_id.get(entry['id'])
        },
        'variants': {
            entry['id']: f"/combat/mob-pool/{entry['race']}/{entry['variantOf']}/variants/{entry['id'].split('--', 1)[1]}/{versions_by_id[entry['id']]}/atlas.png"
            for entry in manifest['variants'] if versions_by_id.get(entry['id'])
        },
    }
    (public / 'combat/arpg/provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    player_manifest_path = ROOT / 'archive/art-reference/players/production.json'
    if player_manifest_path.exists():
        player_manifest = json.loads(player_manifest_path.read_text(encoding='utf-8'))
        player_manifest.update({
            'status': 'runtime-default',
            'scope': 'Pawn body with separate weapon and shield equipment layers; each identity follows its default version pointer.',
            'identityReference': 'docs/character/pawn-study/atlases/player.png',
            'bodyReference': 'docs/character/pawn-study/sheets/player.png',
            'runtimeFrame': {
                'width': 256, 'height': 256, 'foot': {'x': anchor_x, 'y': anchor_y},
                'padding': 'Opaque bounds are trimmed per view; the root anchor stays fixed.',
            },
            'bodyFacing': directions,
            'runtimeManifest': 'game/src/ui/combat/arena/mob-pool.generated.json',
            'runtimeImageRoot': 'game/public/combat/arpg/player/pawn/',
            'previewUrl': 'http://localhost:5173/__showcase?sample=combat-field&sprite-preview=pawn&player-weapon=one-handed%20sword&player-offhand=shield',
            'approval': 'User selected pawn-study as the runtime default and authorized archiving the previous sprite set.',
        })
        for key in ('actionFacing', 'framesPerActionFacing', 'singlePosePngIntake', 'keepSourcePixels',
                    'bodyAnimationCoverage', 'attackClip', 'generatedBodyMotionProfiles'):
            player_manifest.pop(key, None)
        player_manifest['notes'] = [
            'The runtime uses one static body image per cardinal facing for idle, walk, attack, hit and death.',
            'Combat motion remains whole-body presentation; the pawn sheets contain no authored limb animation.',
            'Weapons and shields remain independent runtime layers. Grip positions are authored fallbacks and still need scene calibration.',
            'The pawn body does not change collision, stats, cooldowns or hit timing.',
            'Two-handed stances visually stow the equipped shield; existing equipment rules remain authoritative.',
        ]
        player_manifest_path.write_text(json.dumps(player_manifest, indent=2) + '\n', encoding='utf-8')
    print(f"Integrated {len(integrated)} pawn identities through their default version pointers")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'variants-prepare', 'collect', 'collect-variants', 'check', 'build', 'integrate'])
    parser.add_argument('--only', nargs='+', help='identity IDs to install when command is integrate')
    args = parser.parse_args()
    if args.command == 'integrate':
        integrate(args.only)
    else:
        {'prepare': prepare, 'variants-prepare': variants_prepare, 'collect': collect,
         'collect-variants': collect_variants, 'check': check, 'build': build}[args.command]()
