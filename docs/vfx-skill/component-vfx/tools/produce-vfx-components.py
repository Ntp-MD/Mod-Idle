from pathlib import Path
import hashlib
import io
import json
import shutil
import sys
from PIL import Image

ROOT = Path.cwd()
SOURCES = ROOT / 'docs/vfx-skill/component-vfx/outputs/library-v1'
POOL = ROOT / 'game/public/fx/skill-pool'
DATA = ROOT / 'tools/data/vfx-components.json'
COMPONENTS = json.loads(DATA.read_text(encoding='utf-8'))
SKILLS = {s['id']: s for s in json.loads((ROOT / 'tools/data/skills.json').read_text(encoding='utf-8'))['skills']}
VERSIONS = {'attack.firestorm':'v4','attack.fireball':'v3','attack.cinder_nova':'v2','attack.void_ray':'v2','attack.cleave':'v3','attack.fissure':'v2','attack.blizzard':'v7','heal.heal':'v2','buff.flame_guard':'v2','curse.jinx':'v2'}


def version_dir(skill, version):
    row = SKILLS[skill]
    group = 'attack-' + ('phy' if row['element'] == 'physical' else row['element']) if row['type'] == 'attack' else row['type']
    return POOL / group / skill.replace('.', '-').replace('_', '-') / version


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def produce():
    rows = json.loads((SOURCES / 'generation-prompts.json').read_text(encoding='utf-8'))['masters']
    for row in rows:
        family = row['family']
        raw = SOURCES / row['rawFile']
        source = Path(row['sourceOutput'])
        if not raw.exists():
            shutil.copy2(source, raw)
        assert raw.read_bytes() == source.read_bytes(), family
        image = Image.open(raw)
        assert image.mode == 'RGBA' and image.width == image.height, family
        assert image.getchannel('A').getextrema()[0] == 0, f'Opaque background: {family}'
        # D11: preserve the whole square source and its alpha, adding a transparent border.
        resized = image.resize((818, 818), Image.Resampling.LANCZOS)
        master = Image.new('RGBA', (1024, 1024))
        master.paste(resized, (103, 103))
        box = master.getchannel('A').getbbox()
        assert box and min(box[0], box[1], 1024-box[2], 1024-box[3]) >= 32, family
        owner = COMPONENTS['families'][family]['ownerSkill']
        folder = version_dir(owner, VERSIONS[owner])
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / (family + '.png')
        buffer = io.BytesIO()
        master.save(buffer, format='PNG')
        if path.exists():
            assert path.read_bytes() == buffer.getvalue(), f'Existing artwork differs: {path}'
        else:
            path.write_bytes(buffer.getvalue())
        print(f'{family}: RGBA 1024x1024 alpha={box}, source preserved')


def verify():
    count = 0
    for family, item in COMPONENTS['families'].items():
        path = version_dir(item['ownerSkill'], VERSIONS[item['ownerSkill']]) / (family + '.png')
        image = Image.open(path)
        assert image.mode == 'RGBA' and image.size == (1024,1024), family
        box = image.getchannel('A').getbbox()
        assert box and min(box[0],box[1],1024-box[2],1024-box[3]) >= 32, family
        count += 1
    before = json.loads((ROOT / 'docs/vfx-skill/component-vfx/evidence/manifests/vfx-defaults-before.json').read_text(encoding='utf-8'))['defaults']
    for name,digest in before.items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
    print(f'PASS: {count} transparent registered masters; all {len(before)} default pointers unchanged.')


if __name__ == '__main__':
    {'produce':produce,'verify':verify}[sys.argv[1]]()
