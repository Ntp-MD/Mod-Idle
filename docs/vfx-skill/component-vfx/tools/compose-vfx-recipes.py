import copy
import importlib.util
import json
from pathlib import Path
import shutil

spec=importlib.util.spec_from_file_location('production',Path('docs/vfx-skill/component-vfx/tools/produce-vfx-components.py'))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
RECIPES={
 'attack.firestorm':('v3','v5',['ground-fill','vortex','mote']),
 'attack.fireball':('v2','v4',['projectile-core','ribbon-beam','impact-burst']),
 'attack.cinder_nova':('v1','v3',['ground-fill','ground-edge','mote','ground-residue']),
 'attack.blizzard':('v6','v8',['cloud-mist','fragment-debris','ground-edge']),
 'attack.cleave':('v2','v4',['slash-sweep','ground-edge','impact-burst']),
 'attack.fissure':('v1','v3',['ground-fill','column-eruption','fragment-debris']),
 'attack.chain_lightning':('v1','v2',['ribbon-beam','impact-burst']),
 'attack.void_ray':('v1','v3',['ribbon-beam','impact-burst']),
 'heal.heal':('v1','v3',['mote','ground-edge']),
 'buff.flame_guard':('v1','v3',['ward-shell','mote']),
 'curse.jinx':('v1','v3',['mark-sigil','cloud-mist']),
 'aura.grace':('v1','v2',['ground-edge','mote']),
}


def component(family):
    item=p.COMPONENTS['families'][family]
    folder=p.version_dir(item['ownerSkill'],p.VERSIONS[item['ownerSkill']])
    meta=json.loads((folder/'meta.json').read_text(encoding='utf-8'))
    layer=meta if meta['layerId']==family else next(row for row in meta['additionalLayers'] if row['layerId']==family)
    fields=copy.deepcopy(layer)
    for key in ('id','src','additionalLayers','composition','generation','file'): fields.pop(key,None)
    fields['file']=family+'.png'
    fields.pop('durationSec',None)
    return folder/(family+'.png'),fields


for skill,(_,new,_) in RECIPES.items():
    assert not p.version_dir(skill,new).exists(), f'Recipe version already exists: {skill}/{new}'

for skill,(old,new,families) in RECIPES.items():
    source=p.version_dir(skill,old);target=p.version_dir(skill,new)
    target.mkdir()
    for path in source.iterdir():
        if path.is_file() and path.name not in ('meta.json','qa.json'):
            shutil.copy2(path,target/path.name)
    meta=json.loads((source/'meta.json').read_text(encoding='utf-8'))
    main=Path(meta['src']).name
    assert (target/main).exists(),skill
    meta['src']='/'+(target.relative_to(p.ROOT/'game/public')/main).as_posix()
    meta['layerId']='animated-base'
    palette=p.SKILLS[skill].get('element') or 'physical'
    meta['palette']=palette if p.SKILLS[skill]['type']=='attack' else 'physical'
    for i,layer in enumerate(meta.get('additionalLayers',[])):
        layer['layerId']=layer.get('layerId',f'animated-extra-{i}')
        layer['palette']=palette
    meta.setdefault('additionalLayers',[])
    for family in families:
        png,layer=component(family)
        shutil.copy2(png,target/png.name)
        layer['palette']=palette
        layer['phases']=['Impact','Field','Channel']
        layer['opacity']=.65 if family.startswith('ground-') else .8
        if family=='mote':
            layer['scale']=.18
            if p.SKILLS[skill]['type']=='attack': layer['binding']='area'
        if family=='fragment-debris': layer['scale']=.24
        if family in ('impact-burst','slash-sweep'):
            layer['phases']=['Impact'];layer['durationSec']=.6
        if family=='ground-residue':
            layer['delaySec']=.3;layer['durationSec']=.9
        if skill=='attack.fireball' and family in ('projectile-core','ribbon-beam'):
            layer['phases']=['Travel']
            layer['authoringGeometry']={'shape':'single','delivery':'projectile'}
            layer['orient']=True
            layer['scale']=.7 if family=='ribbon-beam' else 1
        if family=='fragment-debris' and skill=='attack.blizzard':
            layer.update(rainDurationSec=meta['rainDurationSec'],rainPhase='Field',rainIntervalSec=.14,rainSizeScale=.2)
        meta['additionalLayers'].append(layer)
    meta['composition']='Component recipe: animated base + '+', '.join(families)
    meta['componentRecipe']={'baseVersion':old,'families':families,'humanReview':False}
    p.save_json(target/'meta.json',meta)
    assert all((target/row['file']).is_file() for row in meta['additionalLayers']),skill
    print(skill,new,'self-contained:',','.join(families))

Path('docs/vfx-skill/component-vfx/evidence/manifests/vfx-recipes.json').write_text(json.dumps(RECIPES,indent=2)+'\n',encoding='utf-8')
