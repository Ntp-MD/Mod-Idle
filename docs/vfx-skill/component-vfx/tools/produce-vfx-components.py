"""Normalize or verify the named VFX masters in the single outputs shelf."""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
SOURCES = ROOT / 'docs/vfx-skill/component-vfx/outputs'


def asset_path(name):
    path = (SOURCES / name).resolve()
    if not path.is_relative_to(SOURCES.resolve()):
        raise ValueError(f'Asset must stay inside outputs: {name}')
    return path


def masters():
    rows = json.loads((SOURCES / 'generation-prompts.json').read_text(encoding='utf-8'))['masters']
    names = [row['shape'] for row in rows]
    inventory = json.loads((ROOT / 'tools/data/vfx-components.json').read_text(encoding='utf-8'))
    assert len(names) == len(set(names)), 'Duplicate component name'
    assert set(names) == set(inventory['families']) | set(inventory['variants']), 'Inventory differs from source shelf'
    for row in rows:
        assert row['file'] == row['shape'] + '.png', row['shape']
        assert row['rawFile'] == 'raw/' + row['file'], row['shape']
        assert row['qaFile'] == 'qa/' + row['shape'] + '.json', row['shape']
        for key in ('file', 'rawFile', 'qaFile'):
            asset_path(row[key])
    return rows


def selected(shapes=None):
    rows = masters()
    if not shapes:
        return rows
    unknown = set(shapes) - {row['shape'] for row in rows}
    if unknown:
        raise ValueError(f'Unknown named components: {sorted(unknown)}')
    return [row for row in rows if row['shape'] in shapes]


def produce(shapes=None):
    for row in selected(shapes):
        raw = asset_path(row['rawFile'])
        with Image.open(raw) as image:
            assert image.mode == 'RGBA' and image.getchannel('A').getextrema()[0] == 0, raw
            native_size = list(image.size)
            fitted = image.copy()
        fitted.thumbnail((818, 818), Image.Resampling.LANCZOS)
        master = Image.new('RGBA', (1024, 1024))
        master.paste(fitted, ((1024 - fitted.width) // 2, (1024 - fitted.height) // 2))
        path = asset_path(row['file'])
        master.save(path)
        qa_path = asset_path(row['qaFile'])
        qa = json.loads(qa_path.read_text(encoding='utf-8')) if qa_path.exists() else {}
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if qa.get('masterSha256') != digest:
            qa['humanReview'] = False
        qa.update(shape=row['shape'], family=row['family'], file=row['file'], rawFile=row['rawFile'],
                  nativeSize=native_size, canvas=list(master.size), alphaBounds=master.getchannel('A').getbbox(),
                  sourceSha256=hashlib.sha256(raw.read_bytes()).hexdigest(), masterSha256=digest)
        qa_path.parent.mkdir(exist_ok=True)
        qa_path.write_text(json.dumps(qa, indent=2) + '\n', encoding='utf-8')
    verify(shapes)


def verify(shapes=None):
    rows = selected(shapes)
    assert not list(SOURCES.glob('library-v*')), 'Numbered output folders are retired'
    for row in rows:
        path, raw = asset_path(row['file']), asset_path(row['rawFile'])
        qa = json.loads(asset_path(row['qaFile']).read_text(encoding='utf-8'))
        with Image.open(path) as image:
            assert image.mode == 'RGBA' and image.size == (1024, 1024), path
            box = image.getchannel('A').getbbox()
            assert box and min(box[0], box[1], 1024 - box[2], 1024 - box[3]) >= 103, path
            assert list(box) == qa['alphaBounds'], path
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == qa['sourceSha256'], raw
        assert hashlib.sha256(path.read_bytes()).hexdigest() == qa['masterSha256'], path
    print(f'PASS: {len(rows)} named RGBA masters; raw hashes, master hashes and alpha padding verified.')


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('produce', 'verify'):
        raise SystemExit('Usage: produce-vfx-components.py produce|verify [shape ...]')
    {'produce':produce,'verify':verify}[sys.argv[1]](sys.argv[2:] or None)
