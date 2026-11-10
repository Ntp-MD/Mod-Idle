import importlib.util
import json
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('production', Path('docs/vfx-skill/component-vfx/tools/produce-vfx-components.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
CONFIG = {
 'ground-fill': ('circle', .5, .5, 1, 1),
 'ground-edge': ('circle', .5, .5, 1, 1),
 'ground-residue': ('circle', .5, .5, 1, 1),
 'projectile-core': ('single', .5, .5, 1, 1),
 'ribbon-beam': ('line', .5, .5, 1, 1),
 'slash-sweep': ('cone', .5, .5, 1, 1),
 'impact-burst': ('single', .5, .5, 1, 1),
 'column-eruption': ('circle', .5, .8, 1.2, 3),
 'vortex': ('circle', .5, .8, 3, 4),
 'cloud-mist': ('circle', .5, .65, 4, 2),
 'mote': ('single', .5, .5, 1, 1),
 'fragment-debris': ('single', .5, .5, 1, 1),
 'ward-shell': ('circle', .5, .5, 1, 1),
 'mark-sigil': ('circle', .5, .5, 1, 1),
}
GROUPS = {
 'attack.firestorm':['ground-fill','ground-residue','vortex'],
 'attack.fireball':['projectile-core','impact-burst'],
 'attack.cinder_nova':['ground-edge'],
 'attack.void_ray':['ribbon-beam'],
 'attack.cleave':['slash-sweep'],
 'attack.fissure':['column-eruption'],
 'attack.blizzard':['cloud-mist','fragment-debris'],
 'heal.heal':['mote'],
 'buff.flame_guard':['ward-shell'],
 'curse.jinx':['mark-sigil'],
}


def layer(family):
    definition = p.COMPONENTS['families'][family]
    shape, x, y, span, depth = CONFIG[family]
    geometry = {'shape':shape}
    if definition['sizePolicy'] == 'world' and shape == 'circle':
        geometry.update(spanM=span, depthM=depth)
    if family == 'projectile-core':
        geometry['delivery'] = 'projectile'
    result = {'layerId':family, 'columns':1, 'rows':1, 'cellWidth':1024, 'cellHeight':1024,
              'imageWidth':1024,'imageHeight':1024,'frameMs':80,'contentWidthRatio':.8,
              'contentHeightRatio':.8,'anchorX':x,'anchorY':y,'impactAnchorX':x,'impactAnchorY':y,
              'palette':'physical','opacity':1,'durationSec':1.2,'authoringGeometry':geometry}
    for key in ('projection','sizePolicy','binding','orient'):
        if key in definition: result[key] = definition[key]
    if family == 'projectile-core': result['orient'] = True
    return result


for skill,families in GROUPS.items():
    folder = p.version_dir(skill,p.VERSIONS[skill])
    for family in families:
        assert (folder / (family+'.png')).is_file(), family
    main = families[0]
    meta = {'id':skill,'src':'/'+(folder.relative_to(p.ROOT/'game/public')/(main+'.png')).as_posix(), **layer(main),
            'composition':'Neutral component master ingredients; non-default review version.',
            'generation':{'tool':'imagegen','source':'docs/vfx-skill/component-vfx/outputs/library-v1/generation-prompts.json'}}
    meta['additionalLayers'] = [{'file':family+'.png',**layer(family)} for family in families[1:]]
    p.save_json(folder/'meta.json',meta)
    measurements=[]
    for family in families:
        image=Image.open(folder/(family+'.png'))
        measurements.append({'family':family,'file':family+'.png','canvas':list(image.size),'alphaBounds':list(image.getchannel('A').getbbox()),
                             'contentRatio':.8,'anchor':[layer(family)['anchorX'],layer(family)['anchorY']],
                             'source':'imagegen','palette':'neutral','humanReview':False})
    p.save_json(folder/'qa.json',{**measurements[0], 'components':measurements})
    print(skill,p.VERSIONS[skill],','.join(families))
