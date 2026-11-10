import copy,json,shutil
from pathlib import Path

ROOT=Path.cwd()
data=json.loads((ROOT/'tools/data/vfx-components.json').read_text(encoding='utf-8'))
shapes={**data['families'],**data['variants']}
skills={r['id']:r for r in json.loads((ROOT/'tools/data/skills.json').read_text(encoding='utf-8'))['skills']}


def folder(skill,version):
 row=skills[skill];kind=row['type']
 group='attack-'+('phy' if row.get('element')=='physical' else row['element']) if kind=='attack' else kind
 return ROOT/'game/public/fx/skill-pool'/group/skill.replace('.','-').replace('_','-')/version


def ingredient(name,**changes):
 master=shapes[name]['master'];source=folder(master['skill'],master['version'])
 meta=json.loads((source/'meta.json').read_text(encoding='utf-8'))
 item=meta if meta['layerId']==master['layerId'] else next(x for x in meta['additionalLayers'] if x['layerId']==master['layerId'])
 item=copy.deepcopy(item)
 for key in ('src','id','file','additionalLayers','composition','generation'):item.pop(key,None)
 item.update(file=master['file'],opacity=1,durationSec=1.2,phases=['Impact','Field','Channel'])
 item.update(changes)
 return name,source/master['file'],item


flight={'phases':['Windup','Travel']}
impact={'phases':['Impact'],'durationSec':.6}
series={'kind':'line-series','spacingM':1.2,'staggerSec':.09}
recipes={
 'attack.fissure':('v5',[
  ingredient('crack-strip'),ingredient('stone-spike',placement=series),
  ingredient('fragment-debris',binding='area',scale=.25,placement=series),
  ingredient('cloud-mist',binding='area',opacity=.3,scale=.5,placement={'kind':'line-series','spacingM':2,'staggerSec':.12})]),
 'attack.stone_spike':('v3',[ingredient('stone-spike',**impact),ingredient('impact-burst',scale=.6,**impact),ingredient('fragment-debris',scale=.25,**impact)]),
 'attack.tidal_wave':('v3',[ingredient('wave-crest',durationSec=1.1,placement={'kind':'line-front'}),
  ingredient('cloud-mist',durationSec=1.1,opacity=.3,scale=.6,placement={'kind':'line-front'})]),
 'attack.piercing_shot':('v3',[ingredient('arrow-core',**flight),ingredient('impact-burst',scale=.55,**impact)]),
 'attack.water_ball':('v3',[ingredient('orb-core',**flight),ingredient('impact-burst',scale=.6,**impact)]),
 'attack.meteor':('v4',[ingredient('rock-core',phases=['Impact','Field'],durationSec=.9,rainDurationSec=4,rainPhase='Impact',rainIntervalSec=10,rainSizeScale=.3),
  ingredient('impact-burst',scale=1.5,**impact),ingredient('ground-residue',durationSec=4),ingredient('ground-fill',durationSec=4,opacity=.5)]),
 'attack.thunder_strike':('v3',[ingredient('forked-bolt',phases=['Impact'],durationSec=.45),ingredient('impact-burst',scale=.7,**impact)]),
 'attack.entropy_well':('v3',[ingredient('ground-spiral',durationSec=8),ingredient('cloud-mist',durationSec=8,opacity=.3),
  ingredient('mote',binding='area',durationSec=8,scale=.18,placement={'kind':'orbit','cycleSec':1.8,'radiusM':1.5})]),
 'attack.arrow_shower':('v5',[ingredient('arrow-core',**flight),ingredient('impact-burst',scale=.4,**impact)]),
 'attack.split_shot':('v2',[ingredient('arrow-core',**flight),ingredient('impact-burst',scale=.45,**impact)]),
 'attack.double_strafe':('v2',[ingredient('arrow-core',**flight),ingredient('impact-burst',scale=.5,**impact)]),
 'attack.void_orb':('v2',[ingredient('orb-core',**flight),ingredient('impact-burst',scale=.65,**impact)]),
 'attack.whirlwind':('v3',[ingredient('slash-sweep',binding='caster',orient=False,
  authoringGeometry={'shape':'circle','spanM':4,'depthM':4},placement={'kind':'spin','cycleSec':.6}),
  ingredient('ground-edge',opacity=.5),ingredient('mote',scale=.15,placement={'kind':'orbit','cycleSec':.6,'radiusM':1.5})]),
 'buff.enchant_poison':('v2',[ingredient('ribbon-beam',binding='release',durationSec=10,
  authoringGeometry={'shape':'circle','spanM':.7,'depthM':.12}),ingredient('mote',binding='release',durationSec=10,scale=.12,
  placement={'kind':'orbit','cycleSec':.7,'radiusM':.1})]),
}
for skill,(version,_) in recipes.items():assert not folder(skill,version).exists(),f'Existing version: {skill}/{version}'
manifest={}
for skill,(version,layers) in recipes.items():
 target=folder(skill,version);target.mkdir()
 accents={effect['element'] for effect in skills[skill].get('effects',[]) if effect.get('element')}
 palette=skills[skill].get('element') or (next(iter(accents)) if len(accents)==1 else 'physical')
 prepared=[]
 for name,source,item in layers:
  shutil.copy2(source,target/source.name)
  item['palette']=palette
  prepared.append(item)
 main=prepared[0];main_file=main.pop('file')
 metadata={'id':skill,'src':'/'+(target.relative_to(ROOT/'game/public')/main_file).as_posix(),**main,
  'additionalLayers':prepared[1:],'composition':'Independent component recipe: '+', '.join(x[0] for x in layers),
  'componentRecipe':{'shapes':[x[0] for x in layers],'humanReview':False}}
 (target/'meta.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
 assert all((target/x['file']).is_file() for x in prepared[1:])
 manifest[skill]={'version':version,'shapes':[x[0] for x in layers]}
 print(skill,version,palette,','.join(manifest[skill]['shapes']))
(ROOT/'docs/vfx-skill/component-vfx/evidence/manifests/vfx-extra-recipes.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('PASS: 14 self-contained component-only recipe versions created; no default pointer changed.')
