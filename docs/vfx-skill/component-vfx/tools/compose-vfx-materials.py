"""Package library-v4 native sources and compose active-only material studies.

Run from repo root after generation-prompts.json has its selected source paths.
Existing versions and default pointers are never overwritten.
"""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
from PIL import Image

ROOT = Path.cwd()
SOURCE = ROOT / 'docs/vfx-skill/component-vfx/outputs/library-v4'
DATA = ROOT / 'tools/data/vfx-components.json'
spec = importlib.util.spec_from_file_location('previous', Path(__file__).with_name('compose-vfx-all.py'))
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)

# Shape, owning family, registration, world dimensions. Material identity lives in
# the silhouette; palettes remain the renderer's responsibility.
SHAPES = {
 'flame-tongue': ('column-eruption', 'world', 1.5, 2.8),
 'ice-shard-cluster': ('column-eruption', 'world', 1.8, 2.5),
 'water-impact-crown': ('impact-burst', 'body', 1, 1),
 'dust-impact-plume': ('cloud-mist', 'world', 3, 1.5),
 'molten-projectile': ('projectile-core', 'body', 1, 1),
 'ember-ground-cracks': ('ground-residue', 'footprint', 1, 1),
 'ice-lance': ('projectile-core', 'body', 1, 1),
 'frost-fracture': ('ground-residue', 'footprint', 1, 1),
 'water-jet': ('ribbon-beam', 'world', 4, 1),
 'lightning-arc': ('ribbon-beam', 'world', 4, .5),
 'electric-contact': ('impact-burst', 'body', 1, 1),
 'poison-droplet': ('projectile-core', 'body', 1, 1),
 'toxic-vapor': ('cloud-mist', 'world', 4, 2),
 'acid-splash': ('impact-burst', 'body', 1, 1),
 'rock-shrapnel': ('fragment-debris', 'body', 1, 1),
 'sand-vortex': ('vortex', 'world', 2.5, 4),
 'void-rift': ('column-eruption', 'world', 1.4, 3),
 'gravitic-lens': ('ground-fill', 'footprint', 1, 1),
 'blade-thrust': ('slash-sweep', 'body', 1, 1),
 'heavy-cleave': ('slash-sweep', 'world', 3, 2),
 'blood-contact': ('impact-burst', 'body', 1, 1),
 'healing-wisps': ('mote', 'body', 1, 1),
 'root-entangle': ('mark-sigil', 'body', 1, 1),
 'barrier-facets': ('ward-shell', 'body', 1, 1),
}

# Deliberately authored per skill: primary silhouette, secondary material, tail.
# No aura rows and no replacement of the approved Thunder Storm.
RECIPES = {
 'fireball': ['molten-projectile', 'flame-tongue', 'ember-ground-cracks'],
 'firestorm': ['flame-tongue', 'ember-ground-cracks', 'dust-impact-plume'],
 'meteor': ['rock-core', 'flame-tongue', 'rock-shrapnel', 'ember-ground-cracks'],
 'cinder_nova': ['shockwave-ring', 'flame-tongue', 'ember-ground-cracks'],
 'ignite': ['flame-tongue', 'mote'],
 'ice_lance': ['ice-lance', 'frost-fracture'],
 'glacial_spike': ['ice-lance', 'ice-shard-cluster', 'fragment-debris'],
 'frostbite': ['ice-shard-cluster', 'cloud-mist'],
 'frost_nova': ['shockwave-ring', 'frost-fracture', 'fragment-debris'],
 'blizzard': ['fragment-debris', 'frost-fracture', 'cloud-mist'],
 'water_ball': ['orb-core', 'water-impact-crown', 'cloud-mist'],
 'tidal_wave': ['wave-crest', 'water-jet', 'water-impact-crown'],
 'shatter': ['ice-shard-cluster', 'fragment-debris', 'frost-fracture'],
 'spark': ['electric-contact', 'lightning-arc'],
 'chain_lightning': ['lightning-arc', 'electric-contact'],
 'thunder_strike': ['forked-bolt', 'electric-contact', 'dust-impact-plume'],
 'overload': ['electric-contact', 'shockwave-ring', 'lightning-arc'],
 'poison_bolt': ['poison-droplet', 'acid-splash'],
 'acid_arrow': ['arrow-core', 'acid-splash', 'toxic-vapor'],
 'poison_cloud': ['toxic-vapor', 'ground-residue'],
 'hemotoxin': ['poison-droplet', 'blood-contact', 'bind-strand'],
 'contagion': ['poison-droplet', 'toxic-vapor', 'acid-splash'],
 'venom_coffin': ['poison-droplet', 'root-entangle', 'toxic-vapor'],
 'chaos_bolt': ['crescent-wave', 'void-rift'],
 'void_blast': ['void-rift', 'shockwave-ring', 'gravitic-lens'],
 'chaos_wave': ['shockwave-ring', 'gravitic-lens', 'cloud-mist'],
 'void_ray': ['ribbon-beam', 'void-rift', 'electric-contact'],
 'void_orb': ['orb-core', 'gravitic-lens', 'void-rift'],
 'entropy_well': ['gravitic-lens', 'void-rift', 'mote'],
 'unravel': ['crescent-wave', 'tether-strand', 'fragment-debris'],
 'sand_storm': ['sand-vortex', 'dust-impact-plume', 'rock-shrapnel'],
 'earth_splitter': ['crack-strip', 'rock-shrapnel', 'dust-impact-plume'],
 'earth_shock': ['shockwave-ring', 'rock-shrapnel', 'dust-impact-plume'],
 'aftershock': ['crack-strip', 'shockwave-ring', 'dust-impact-plume'],
 'stone_spike': ['stone-spike', 'rock-shrapnel', 'dust-impact-plume'],
 'fissure': ['crack-strip', 'stone-spike', 'dust-impact-plume'],
 'backstab': ['blade-thrust', 'blood-contact'],
 'impale': ['blade-thrust', 'blood-contact', 'dust-impact-plume'],
 'skull_crack': ['impact-burst', 'rock-shrapnel'],
 'ground_slam': ['crack-strip', 'shockwave-ring', 'rock-shrapnel', 'dust-impact-plume'],
 'cleave': ['heavy-cleave', 'blood-contact'],
 'elemental_break': ['heavy-cleave', 'barrier-facets', 'electric-contact'],
 'whirlwind': ['heavy-cleave', 'dust-impact-plume'],
 'shield_bash': ['barrier-facets', 'impact-burst'],
 'puncture': ['blade-thrust', 'blood-contact', 'mote'],
 'reap': ['heavy-cleave', 'blood-contact', 'cloud-mist'],
 'piercing_shot': ['arrow-core', 'blade-thrust', 'impact-burst'],
 'arrow_shower': ['arrow-core', 'dust-impact-plume'],
 'headshot': ['arrow-core', 'blood-contact'],
 'split_shot': ['arrow-core', 'impact-burst'],
 'double_strafe': ['arrow-core', 'blade-thrust'],
 'double_strike': ['slash-sweep', 'blade-thrust', 'blood-contact'],
 'buff.warcry': ['shockwave-ring', 'dust-impact-plume'],
 'buff.berserker': ['flame-tongue', 'healing-wisps'],
 'buff.iron_will': ['barrier-facets', 'rock-shrapnel'],
 'buff.holy_veil': ['shield-dome', 'healing-wisps'],
 'buff.ghost_dance': ['healing-wisps', 'cloud-mist'],
 'buff.earth_wall': ['wall-segment', 'dust-impact-plume'],
 'buff.magia_drive': ['healing-wisps', 'electric-contact'],
 'buff.energy_absorb': ['gravitic-lens', 'healing-wisps'],
 'buff.flame_guard': ['shield-dome', 'flame-tongue'],
 'buff.enchant_poison': ['poison-droplet', 'toxic-vapor'],
 'curse.weaken': ['healing-wisps', 'cloud-mist'],
 'curse.blinding_mark': ['toxic-vapor', 'mark-sigil'],
 'curse.expose': ['barrier-facets', 'mark-sigil'],
 'curse.cripple': ['root-entangle', 'dust-impact-plume'],
 'curse.jinx': ['tether-strand', 'void-rift'],
 'curse.venom_bind': ['root-entangle', 'acid-splash'],
 'heal.heal': ['healing-wisps', 'mote'],
 'heal.greater_heal': ['healing-wisps', 'column-eruption', 'ground-edge'],
 'heal.cleanse': ['shockwave-ring', 'water-impact-crown', 'healing-wisps'],
}
RECIPES = {(k if '.' in k else 'attack.' + k): v for k, v in RECIPES.items()}


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def material(name):
    if name not in SHAPES:
        return previous.component(name)
    family, policy, width, height = SHAPES[name]
    ground = policy == 'footprint'
    foot = family in ('column-eruption', 'vortex', 'cloud-mist', 'mark-sigil')
    anchor_y = .82 if foot and not ground else .5
    layer = dict(layerId=name, columns=1, rows=1, imageWidth=1024, imageHeight=1024,
                 cellWidth=1024, cellHeight=1024, frameMs=80, contentWidthRatio=.8,
                 contentHeightRatio=.8, anchorX=.5, anchorY=anchor_y,
                 impactAnchorX=.5, impactAnchorY=anchor_y, sizePolicy=policy,
                 binding='area' if ground else 'contact',
                 authoringGeometry={'shape': 'circle' if ground else 'single'})
    if ground:
        layer['projection'] = 'ground'
    if policy == 'world':
        layer['authoringGeometry'] = dict(shape='circle', spanM=width, depthM=height)
    return SOURCE / (name + '.png'), layer


def main():
    assert not (SOURCE/'recipes.json').exists(), 'Material delivery already exists; author a new batch instead.'
    protected = list(previous.POOL.glob('**/default/version.json')) + list(
        previous.folder(previous.POOL, 'attack.thunder_storm', 'vfx-component').glob('*'))
    before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in protected if p.is_file()}
    manifest = json.loads((SOURCE / 'generation-prompts.json').read_text(encoding='utf-8'))
    assert set(SHAPES) == {r['shape'] for r in manifest['masters']}
    active = {k for k, s in previous.SKILLS.items() if not s.get('retired') and s['type'] != 'aura'}
    assert set(RECIPES) == active - {'attack.thunder_storm'}, active ^ set(RECIPES)
    for row in manifest['masters']:
        raw = SOURCE / (row['shape'] + '-raw.png')
        if not raw.exists():
            shutil.copy2(row['sourceOutput'], raw)
        image = Image.open(raw)
        assert image.mode == 'RGBA' and image.getchannel('A').getextrema()[0] == 0, raw
        master = Image.new('RGBA', (1024, 1024))
        fitted = image.copy()
        fitted.thumbnail((818, 818), Image.Resampling.LANCZOS)
        master.paste(fitted, ((1024-fitted.width)//2, (1024-fitted.height)//2))
        path = SOURCE / (row['shape'] + '.png')
        master.save(path)
        box = master.getchannel('A').getbbox()
        assert box and min(box[0], box[1], 1024-box[2], 1024-box[3]) >= 103
        write(SOURCE / (row['shape'] + '-qa.json'), dict(alphaBounds=box,
              nativeSize=image.size, canvas=master.size, humanReview=False,
              sourceSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
              masterSha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    data = json.loads(DATA.read_text(encoding='utf-8'))
    output = {}
    for skill, names in RECIPES.items():
        row = previous.SKILLS[skill]
        parent = previous.folder(previous.POOL, skill, 'v1').parent
        archived = previous.folder(previous.ARCHIVE, skill, 'v1').parent
        numbers = [int(p.name[1:]) for root in (parent, archived) if root.exists()
                   for p in root.iterdir() if p.is_dir() and p.name[1:].isdigit()]
        version = 'v' + str(max(numbers, default=0) + 1)
        target = parent / version
        target.mkdir()
        mode = previous.GAPS.get(skill, ('field', []))[0]
        if skill in ('attack.firestorm', 'attack.poison_cloud', 'attack.entropy_well'):
            mode = 'field'
        area = row.get('area') or {}
        layers = []
        for i, name in enumerate(names):
            png, layer = material(name)
            layer = copy.deepcopy(layer)
            for k in ('rainDurationSec','rainPhase','rainIntervalSec','rainSizeScale','rainRadiusRatio','rainSpreadM','placement'):
                layer.pop(k, None)
            family = SHAPES[name][0] if name in SHAPES else previous.FAMILIES[name].get('family', name)
            layer.update(layerId=name, file=png.name, palette=row.get('element') or 'physical',
                         phases=['Impact','Field'], durationSec=.45, opacity=.9, orient=False)
            ground = layer.get('projection') == 'ground'
            if ground:
                layer.update(binding='area', durationSec=1.1, opacity=.55)
            elif family in ('cloud-mist', 'mote'):
                layer.update(durationSec=1.3, opacity=.4)
            if i == 0 and mode in ('bolt', 'volley'):
                layer.update(phases=['Travel','Impact'], orient=True, binding='area', sizePolicy='body',
                             authoringGeometry={'shape':'single','delivery':'projectile'})
                layer.pop('binding', None)
                layer.pop('durationSec', None)
            if i == 0 and mode in ('field', 'rain') and name in ('fragment-debris','rock-core','arrow-core'):
                layer.update(phases=['Impact','Field'], rainDurationSec=previous.duration_sec(row),
                    rainPhase='Impact' if skill in ('attack.meteor','attack.arrow_shower') else 'Field', rainIntervalSec=.16,
                    rainSizeScale=.32, rainRadiusRatio=.9, binding='area',
                    authoringGeometry=dict(shape='circle', radiusM=area.get('radius_m',3), spanM=6, depthM=6))
                if skill == 'attack.meteor':
                    layer['rainIntervalSec']=10
                layer.pop('durationSec',None)
            if mode == 'ray':
                layer.update(phases=['Channel','Impact'], durationSec=previous.duration_sec(row), binding='area')
                if i == 0:
                    layer.update(orient=True, authoringGeometry=dict(shape='line',lengthM=area.get('length_m',8),widthM=area.get('width_m',2)))
            if mode == 'channel':
                layer.update(phases=['Channel','Impact'], durationSec=previous.duration_sec(row), binding='caster')
                if i == 0:
                    layer['placement'] = dict(kind='spin',cycleSec=.55)
            if name == 'shockwave-ring':
                layer.update(placement=dict(kind='expand',fromScale=.12),durationSec=.5)
            if name in ('gravitic-lens','sand-vortex'):
                layer.update(placement=dict(kind='spin',cycleSec=2.7),durationSec=previous.duration_sec(row),binding='area')
            if name == 'tether-strand':
                layer['placement'] = dict(kind='tether')
            if mode == 'line-ground' and name in ('stone-spike','dust-impact-plume'):
                layer.update(binding='area',placement=dict(kind='line-series',spacingM=1.5,staggerSec=.09),durationSec=.8)
            if mode == 'line-ground' and i == 0:
                layer.update(orient=True,authoringGeometry=dict(shape='line',lengthM=area.get('length_m',6),widthM=area.get('width_m',1)))
                if name == 'wave-crest':
                    layer['placement'] = dict(kind='line-front')
            if mode == 'line' and i == 0:
                layer['orient']=True
            if skill.startswith(('buff.','heal.')):
                layer['binding']='caster'
                layer['durationSec']=1.5
            if skill.startswith('curse.') and name != 'tether-strand':
                layer['binding']='target'
            if i > 0:
                layer['delaySec'] = .07 * i
            if name in ('rock-shrapnel','fragment-debris') and i > 0:
                layer.update(scale=.45,durationSec=.45)
            if name in ('blood-contact','electric-contact') and i > 0:
                layer.update(scale=.65,durationSec=.25)
            if name in ('ember-ground-cracks','frost-fracture'):
                layer.update(delaySec=.15,durationSec=1.4)
            if mode == 'field':
                layer['durationSec']=previous.duration_sec(row)
                layer['binding']='area'
            shutil.copy2(png, target / png.name)
            layers.append(layer)
        meta=layers[0].copy()
        main_file=meta.pop('file')
        meta.update(id=skill,src='/'+(target.relative_to(ROOT/'game/public')/main_file).as_posix(),
                    additionalLayers=layers[1:],composition='Material study: '+', '.join(names),
                    componentRecipe=dict(shapes=names,humanReview=False),reviewOnly=True,
                    generation=dict(tool='imagegen',source='docs/vfx-skill/component-vfx/outputs/library-v4/generation-prompts.json'))
        write(target/'meta.json',meta)
        output[skill]=dict(version=version,shapes=names)
        for layer in layers:
            name=layer['layerId']
            if name not in SHAPES or name in data['variants']:
                continue
            data['variants'][name]=dict(family=SHAPES[name][0],sizePolicy=layer['sizePolicy'],
                master=dict(skill=skill,version=version,file=layer['file'],layerId=name,content=.8))
    assert set(SHAPES) <= set(data['variants'])
    write(DATA,data)
    write(SOURCE/'recipes.json',output)
    cards=[]
    for skill, recipe in output.items():
        target=previous.folder(previous.POOL,skill,recipe['version'])
        images=''.join(f'<img src="{Path(os.path.relpath(target/(name+".png"), SOURCE)).as_posix()}" alt="{name}" loading="lazy">' for name in recipe['shapes'])
        cards.append(f'<article><h3>{skill} · {recipe["version"]}</h3><a href="../../evidence/captures/materials/{skill}.png"><img style="width:100%;height:auto" src="../../evidence/captures/materials/{skill}.png" alt="{skill} native arena capture" loading="lazy"></a><div class="ingredients">{images}</div>'
                     f'<p>{", ".join(recipe["shapes"])}</p><a href="http://localhost:5173/__showcase?sample=combat-field&amp;skill={skill}#showcase-field">Open native arena</a>'
                     f'<p>Select VFX version: {recipe["version"]}. Human review pending.</p></article>')
    masters=''.join(f'<article><h3>{name}</h3><div class="ingredients"><a href="{name}-raw.png"><img src="{name}-raw.png" alt="{name} raw" loading="lazy">Raw</a><a href="{name}.png"><img src="{name}.png" alt="{name} padded master" loading="lazy">Master</a></div></article>' for name in SHAPES)
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Material VFX studies</title>
<style>:root{color-scheme:dark}body{margin:32px;background:#10151b;color:#e2e8ee;font:15px/1.5 system-ui}a{color:#8bd9ff}h1{margin-bottom:8px}p{color:#a7b6c5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}article{background:#1a222c;border:1px solid #344353;border-radius:10px;padding:16px}h3{margin:0 0 12px;font-size:16px}.ingredients{display:flex;gap:8px}.ingredients img{width:100%;height:155px;object-fit:contain;min-width:0;background:repeating-conic-gradient(#14191f 0 25%,#222b35 0 50%) 50%/16px 16px}.ingredients>a{width:50%}.ingredients>img{flex:1;width:0}input{font:inherit;padding:10px;margin:16px 0;width:min(480px,90%)}article[hidden]{display:none}</style>
<h1>Material VFX studies · library v4</h1><p>24 new silhouettes · 71 active recipes · Thunder Storm preserved · no aura changes.</p><p>Original material studies informed by <a href="https://news.blizzard.com/en-us/article/23746639/diablo-iv-quarterly-updatedecember-2021">Blizzard's VFX breakdown</a>. Static raw and padded masters below; native arena links use the actual game renderer. These are review candidates, not approved defaults.</p><label for="filter">Filter materials or skills</label><br><input id="filter" type="search" placeholder="ice, fireball, curse…"><h2>Raw / composed masters</h2><div class="grid">'''+masters+'</div><h2>Active skill compositions</h2><div class="grid">'+''.join(cards)+'''</div><script>document.querySelector('#filter').addEventListener('input',e=>{for(const card of document.querySelectorAll('article'))card.hidden=!card.textContent.toLowerCase().includes(e.target.value.toLowerCase())})</script></html>'''
    (SOURCE/'index.html').write_text(page,encoding='utf-8')
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p,digest in before.items())
    write(SOURCE/'preserved-defaults.json', {str(p.relative_to(ROOT)): digest for p,digest in before.items()})
    print(f'PASS: {len(SHAPES)} native RGBA masters; {len(output)} active recipes; defaults and Thunder Storm untouched.')


if __name__ == '__main__':
    main()
