"""Create or refresh each skill's flat recipe from named library masters.

Existing recipes retain their metadata and receive updated named PNGs. New recipes
use masters in outputs/generation-prompts.json, with phases/timing chosen by mode:

  bolt        projectile core + impact-burst
  volley      fan of projectile cores + impact-burst
  strike      impact-burst + mark-sigil (+ fragment-debris)
  melee       slash-sweep + impact-burst (+ fragment-debris)
  nova-melee  slash-sweep + ground-edge + impact-burst + fragment-debris
  nova-magic  ground-fill/shockwave/ground-spiral base + edge/mist/burst
  cone        cone-stream + impact-burst
  line        ribbon-beam + crack-strip + impact-burst
  line-ground crack-strip/wave-crest base + stone-spike/fragment/mist
  sigil       stone-spike/forked-bolt + impact-burst (+ fragment-debris)
  ray         ribbon-beam channel + impact-burst
  channel     slash-sweep channel + ground-edge + mote
  field       fragment-debris rain + ground-fill + ground-edge + cloud-mist
  rain        projectile core rain + impact-burst
  ward        ward-shell/shield-dome + ground-edge + mote
  curse       mark-sigil/bind-strand + cloud-mist (+ tether-strand)
  heal        mote + ground-edge

Run from the repository root: python docs/vfx-skill/component-vfx/tools/compose-vfx-all.py
"""

import json
import shutil
from pathlib import Path

ROOT = Path.cwd()
POOL = ROOT / 'game/public/fx/skill-pool'
SOURCES = ROOT / 'docs/vfx-skill/component-vfx/outputs'
DATA = ROOT / 'tools/data/vfx-components.json'
SKILLS = {s['id']: s for s in json.loads((ROOT / 'tools/data/skills.json').read_text(encoding='utf-8'))['skills']}
COMPONENTS = json.loads(DATA.read_text(encoding='utf-8'))
FAMILIES = {**COMPONENTS['families'], **COMPONENTS['variants']}
MASTERS = {row['shape']: row for row in json.loads((SOURCES / 'generation-prompts.json').read_text(encoding='utf-8'))['masters']}
DONE = {'attack.thunder_storm', 'attack.meteor', 'attack.blizzard'}
GAPS = {
    # fire
    'attack.fireball': ('bolt', ['projectile-core', 'impact-burst']),
    'attack.firestorm': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.cinder_nova': ('nova-magic', ['ground-fill', 'ground-edge', 'mote', 'ground-residue']),
    'attack.ignite': ('strike', ['impact-burst', 'mark-sigil']),
    # cold
    'attack.ice_lance': ('bolt', ['arrow-core', 'impact-burst']),
    'attack.frostbite': ('strike', ['impact-burst', 'mark-sigil']),
    'attack.glacial_spike': ('bolt', ['arrow-core', 'impact-burst']),
    'attack.frost_nova': ('nova-magic', ['shockwave-ring', 'ground-edge', 'mote']),
    'attack.water_ball': ('bolt', ['orb-core', 'impact-burst']),
    'attack.tidal_wave': ('line-ground', ['wave-crest', 'cloud-mist']),
    # lightning
    'attack.spark': ('bolt', ['projectile-core', 'impact-burst']),
    'attack.chain_lightning': ('sigil', ['forked-bolt', 'impact-burst']),
    'attack.thunder_strike': ('sigil', ['forked-bolt', 'impact-burst']),
    'attack.overload': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.unravel': ('bolt', ['orb-core', 'impact-burst']),
    # poison
    'attack.poison_bolt': ('bolt', ['orb-core', 'impact-burst']),
    'attack.acid_arrow': ('bolt', ['arrow-core', 'impact-burst']),
    'attack.poison_cloud': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist']),
    'attack.hemotoxin': ('bolt', ['orb-core', 'impact-burst']),
    'attack.contagion': ('bolt', ['orb-core', 'impact-burst', 'cloud-mist']),
    'attack.venom_coffin': ('bolt', ['orb-core', 'impact-burst', 'mark-sigil']),
    # chaos
    'attack.chaos_bolt': ('bolt', ['orb-core', 'impact-burst']),
    'attack.void_blast': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.chaos_wave': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.void_ray': ('ray', ['ribbon-beam', 'impact-burst']),
    'attack.void_orb': ('volley', ['orb-core', 'impact-burst']),
    'attack.entropy_well': ('nova-magic', ['ground-spiral', 'vortex', 'cloud-mist', 'mote']),
    # earth
    'attack.sand_storm': ('field', ['fragment-debris', 'ground-fill', 'ground-edge', 'cloud-mist']),
    'attack.earth_splitter': ('strike', ['mark-sigil', 'impact-burst', 'fragment-debris']),
    'attack.earth_shock': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.shatter': ('nova-magic', ['ground-fill', 'ground-edge', 'cloud-mist', 'impact-burst']),
    'attack.aftershock': ('nova-magic', ['ground-fill', 'ground-edge', 'impact-burst', 'fragment-debris']),
    'attack.stone_spike': ('sigil', ['stone-spike', 'impact-burst', 'fragment-debris']),
    'attack.fissure': ('line-ground', ['crack-strip', 'stone-spike', 'fragment-debris', 'cloud-mist']),
    # physical
    'attack.backstab': ('melee', ['slash-sweep', 'impact-burst', 'fragment-debris']),
    'attack.impale': ('line', ['ribbon-beam', 'crack-strip', 'impact-burst']),
    'attack.skull_crack': ('melee', ['slash-sweep', 'impact-burst', 'fragment-debris']),
    'attack.ground_slam': ('nova-melee', ['slash-sweep', 'ground-edge', 'impact-burst', 'fragment-debris']),
    'attack.cleave': ('cone', ['cone-stream', 'impact-burst']),
    'attack.elemental_break': ('melee', ['slash-sweep', 'impact-burst', 'fragment-debris']),
    'attack.whirlwind': ('channel', ['slash-sweep', 'ground-edge', 'mote']),
    'attack.shield_bash': ('melee', ['slash-sweep', 'impact-burst']),
    'attack.puncture': ('melee', ['slash-sweep', 'impact-burst']),
    'attack.reap': ('nova-melee', ['slash-sweep', 'ground-edge', 'impact-burst', 'fragment-debris']),
    'attack.piercing_shot': ('volley', ['crescent-wave', 'impact-burst']),
    'attack.arrow_shower': ('rain', ['arrow-core', 'impact-burst']),
    'attack.headshot': ('bolt', ['arrow-core', 'impact-burst']),
    'attack.split_shot': ('volley', ['arrow-core', 'impact-burst']),
    'attack.double_strafe': ('volley', ['arrow-core', 'impact-burst']),
    'attack.double_strike': ('melee', ['slash-sweep', 'impact-burst']),
    # buff
    'buff.warcry': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.berserker': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.iron_will': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.holy_veil': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.ghost_dance': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.earth_wall': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.magia_drive': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.energy_absorb': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'buff.flame_guard': ('ward', ['shield-dome', 'ward-shell', 'mote']),
    'buff.enchant_poison': ('ward', ['ribbon-beam', 'mote']),
    # curse
    'curse.weaken': ('curse', ['mark-sigil', 'cloud-mist']),
    'curse.blinding_mark': ('curse', ['mark-sigil', 'cloud-mist']),
    'curse.expose': ('curse', ['mark-sigil', 'cloud-mist']),
    'curse.cripple': ('curse', ['mark-sigil', 'cloud-mist']),
    'curse.jinx': ('curse', ['mark-sigil', 'cloud-mist', 'tether-strand']),
    'curse.venom_bind': ('curse', ['bind-strand', 'mark-sigil']),
    # heal
    'heal.heal': ('heal', ['mote', 'ground-edge']),
    'heal.greater_heal': ('heal', ['mote', 'ground-edge']),
    'heal.cleanse': ('heal', ['mote', 'ground-edge']),
    # aura
    'aura.wraith_of_fury': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.clarity': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.haste': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.vitality': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.herald_of_ash': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.herald_of_frost': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.herald_of_lightning': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.ember_conversion': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.rime_conversion': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.storm_conversion': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.cast_on_crit': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.cast_on_damage_taken': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.rimbo_form': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.elemental_fury': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.trinity_form': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.grace': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.iron_guard': ('ward', ['ward-shell', 'ground-edge', 'mote']),
    'aura.energy_guard': ('ward', ['ward-shell', 'ground-edge', 'mote']),
}

TUNING = {
    'impact-burst': {'opacity': 0.9, 'scale': 1.1, 'durationSec': 0.6},
    'slash-sweep': {'opacity': 0.9, 'durationSec': 0.6},
    'fragment-debris': {'opacity': 0.8, 'scale': 0.24, 'durationSec': 0.6},
    'cloud-mist': {'opacity': 0.5},
    'mark-sigil': {'opacity': 0.85},
    'mote': {'opacity': 0.9, 'scale': 0.18},
    'ward-shell': {'opacity': 0.85},
    'shield-dome': {'opacity': 0.45, 'durationSec': 1.6},
    'crack-strip': {'opacity': 0.7},
    'cone-stream': {'opacity': 0.9, 'durationSec': 0.6},
}
SPECIAL_PLACEMENT = {
    'tether-strand': {'kind': 'tether'},
    'vortex': {'kind': 'spin', 'cycleSec': 2.4},
    'shockwave-ring': {'kind': 'expand', 'fromScale': 0.25},
}


def slug(skill):
    return skill.replace('.', '-').replace('_', '-')


def group(row):
    return 'attack-' + ('phy' if row['element'] == 'physical' else row['element']) if row['type'] == 'attack' else row['type']


def folder(root, skill):
    return root / group(SKILLS[skill]) / slug(skill)


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def component(family):
    source = MASTERS[family]
    layer = source['layer']
    fields = {k: v for k, v in json.loads(json.dumps(layer)).items()
              if k not in ('id', 'src', 'additionalLayers', 'composition', 'generation', 'file', 'version',
                           'durationSec', 'delaySec', 'opacity', 'scale')}
    png = SOURCES / source['file']
    assert png.is_file(), png
    return png, fields


def palette_of(row):
    return row.get('element') or 'physical'


def duration_sec(row, fallback=4):
    for token in str(row.get('duration') or '').replace('sec', '').split():
        try:
            return float(token)
        except ValueError:
            continue
    return fallback


def compose(skill, mode, shapes):
    row = SKILLS[skill]
    target = folder(POOL, skill)
    if target.exists():
        existing = json.loads((target / 'meta.json').read_text(encoding='utf-8'))
        assert 'componentRecipe' in existing, f'{skill}: existing artwork is not a component recipe'
        files = [Path(existing['src']).name] + [layer['file'] for layer in existing.get('additionalLayers', [])]
        for name in files:
            assert Path(name).name == name and (SOURCES / name).is_file(), name
        for name in files:
            shutil.copy2(SOURCES / name, target / name)
        return existing['componentRecipe']['shapes']
    target.mkdir(parents=True, exist_ok=True)
    area = row.get('area') or {}
    skill_dur = duration_sec(row)
    meta = None
    for index, family in enumerate(shapes):
        png, fields = component(family)
        layer = dict(fields)
        layer['layerId'] = family
        layer['palette'] = palette_of(row)
        layer['opacity'] = TUNING.get(family, {}).get('opacity', 1)
        if 'scale' in TUNING.get(family, {}):
            layer['scale'] = TUNING[family]['scale']
        if family == 'impact-burst':
            if mode == 'nova-magic':
                layer['binding'] = 'area'
                layer['scale'] = 1.2
            else:
                layer['binding'] = 'contact'
        base = index == 0
        if mode == 'field':
            layer['phases'] = ['Field']
            if base:
                layer['sizePolicy'] = 'body'
                layer['binding'] = 'area'
                layer['authoringGeometry'] = {'shape': 'circle', 'radiusM': area.get('radius_m', 3),
                    'spanM': 2 * area.get('radius_m', 3), 'depthM': 2 * area.get('radius_m', 3),
                    'origin': area.get('origin', 'target'), 'delivery': 'ground'}
                layer['rainDurationSec'] = skill_dur
                layer['rainPhase'] = 'Field'
                layer['rainIntervalSec'] = 0.12
                layer['rainSizeScale'] = 0.3
                layer['rainRadiusRatio'] = 0.95
            else:
                layer['durationSec'] = skill_dur
        elif mode == 'rain' and base:
            layer['phases'] = ['Impact']
            layer['sizePolicy'] = 'body'
            layer['binding'] = 'area'
            layer['authoringGeometry'] = {'shape': 'circle', 'radiusM': area.get('radius_m', 3),
                'spanM': 2 * area.get('radius_m', 3), 'depthM': 2 * area.get('radius_m', 3),
                'origin': area.get('origin', 'target'), 'delivery': 'projectile'}
            layer['rainDurationSec'] = skill_dur
            layer['rainPhase'] = 'Impact'
            layer['rainIntervalSec'] = 0.12
            layer['rainSizeScale'] = 0.25
            layer['rainRadiusRatio'] = 0.95
        elif mode in ('bolt', 'volley') and base:
            layer['phases'] = ['Windup', 'Travel', 'Impact']
            layer['orient'] = True
            layer['authoringGeometry'] = {'shape': 'single', 'delivery': 'projectile'}
        elif mode == 'ray' and base:
            layer['phases'] = ['Windup', 'Channel', 'Impact']
            layer['orient'] = True
            layer['durationSec'] = skill_dur
            layer['authoringGeometry'] = {'shape': 'line', 'lengthM': area.get('length_m', 8),
                'widthM': area.get('width_m', 2), 'delivery': 'projectile'}
        elif mode == 'ray':
            # ray-channel payloads surface as Impact marks and the held beam as Channel;
            # contact sparks must cover both.
            layer['phases'] = ['Channel', 'Impact']
            layer['durationSec'] = skill_dur
        elif mode == 'channel':
            layer['phases'] = ['Channel', 'Impact']
            if base:
                layer['durationSec'] = skill_dur
            elif family in ('ground-edge', 'mote'):
                layer['durationSec'] = skill_dur
        elif mode == 'line-ground' and base:
            layer['phases'] = ['Impact']
            layer['orient'] = True
            layer['durationSec'] = 1.2
            layer['authoringGeometry'] = {'shape': 'line', 'lengthM': area.get('length_m', 6),
                'widthM': area.get('width_m', 1), 'delivery': 'ground'}
        elif mode == 'line' and base:
            layer['phases'] = ['Impact']
            layer['orient'] = True
            layer['durationSec'] = 0.8
            layer['authoringGeometry'] = {'shape': 'line', 'lengthM': area.get('length_m', 6),
                'widthM': area.get('width_m', 1), 'delivery': 'melee'}
        elif mode == 'sigil' and base:
            layer['phases'] = ['Impact']
            layer['durationSec'] = 0.8
        elif mode in ('ward', 'curse', 'heal'):
            layer['phases'] = ['Impact', 'Field']
        else:
            layer['phases'] = ['Impact']
        if family == 'stone-spike' and mode == 'line-ground':
            layer['placement'] = {'kind': 'line-series', 'spacingM': 2, 'staggerSec': 0.08}
            layer['durationSec'] = 0.8
        if family in SPECIAL_PLACEMENT:
            layer['placement'] = SPECIAL_PLACEMENT[family]
            if family == 'shockwave-ring':
                layer['durationSec'] = 0.7
            if family == 'vortex':
                layer['durationSec'] = 1.6
        for rain_key in ('rainDurationSec', 'rainPhase', 'rainIntervalSec', 'rainSizeScale', 'rainRadiusRatio', 'rainSpreadM'):
            if not (mode in ('field', 'rain') and base):
                layer.pop(rain_key, None)
        if 'durationSec' not in layer and family not in ('arrow-core', 'orb-core', 'projectile-core',
                'ribbon-beam', 'crescent-wave') and not (mode in ('field', 'rain') and base):
            layer['durationSec'] = 1.2 if family.startswith('ground-') else TUNING.get(family, {}).get('durationSec', 1.4)
        if family == 'ground-residue' and 'durationSec' in layer:
            layer['delaySec'] = 0.3
            layer['durationSec'] = 0.9
        layer['file'] = family + '.png'
        shutil.copy2(png, target / layer['file'])
        if base:
            meta = {k: v for k, v in layer.items() if k != 'file'}
            meta['src'] = f"/fx/skill-pool/{group(row)}/{slug(skill)}/{family}.png"
            meta['additionalLayers'] = []
        else:
            meta['additionalLayers'].append(layer)
    meta['composition'] = 'Independent component recipe: ' + ', '.join(shapes)
    meta['componentRecipe'] = {'mode': mode, 'shapes': shapes, 'humanReview': False}
    save_json(target / 'meta.json', meta)
    return shapes


def main():
    player = {s['id'] for s in SKILLS.values() if not s.get('retired')} - DONE
    assert player == set(GAPS), (player ^ set(GAPS))
    manifest = {}
    for skill, (mode, shapes) in GAPS.items():
        manifest[skill] = {'kind': mode, 'shapes': compose(skill, mode, shapes)}
    for skill in sorted(DONE):
        metadata = json.loads((folder(POOL, skill) / 'meta.json').read_text(encoding='utf-8'))
        manifest[skill] = {'kind': 'live' if skill == 'attack.thunder_storm' else 'manual',
                           'shapes': metadata['componentRecipe']['shapes']}
    save_json(ROOT / 'docs/vfx-skill/component-vfx/evidence/manifests/vfx-component-recipes.json', manifest)
    print(f'composed {len(GAPS)} fresh recipes, manifest {len(manifest)}')


if __name__ == '__main__':
    main()
