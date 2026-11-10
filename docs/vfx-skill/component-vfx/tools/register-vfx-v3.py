from pathlib import Path
import json,shutil,hashlib

root=Path.cwd()
source=root/'docs/vfx-skill/component-vfx/outputs/library-v3'
rows={r['shape']:r for r in json.loads((source/'generation-prompts.json').read_text())['masters']}
specs={
 'cone-stream':dict(skill='attack.venom_spray',version='v3',family='cloud-mist',sizePolicy='footprint',projection='ground',orient=True,geometry={'shape':'cone'}),
 'wall-segment':dict(skill='attack.fissure',version='v6',family='column-eruption',sizePolicy='world',binding='area',placement={'kind':'line-series','spacingM':1,'staggerSec':0},geometry={'shape':'circle','spanM':1.2,'depthM':2},anchorY=.9),
 'tether-strand':dict(skill='curse.jinx',version='v4',family='ribbon-beam',sizePolicy='world',placement={'kind':'tether'},geometry={'shape':'line','widthM':.15}),
 'shockwave-ring':dict(skill='attack.frost_nova',version='v2',family='ground-edge',sizePolicy='footprint',projection='ground',placement={'kind':'expand','fromScale':.1},geometry={'shape':'circle'},durationSec=.8),
 'crescent-wave':dict(skill='attack.piercing_shot',version='v4',family='projectile-core',sizePolicy='body',orient=True,geometry={'shape':'single','delivery':'projectile'}),
 'shield-dome':dict(skill='buff.flame_guard',version='v4',family='ward-shell',sizePolicy='world',binding='area',geometry={'shape':'circle','spanM':2.8,'depthM':1.8},anchorY=.9,opacity=.55),
 'bind-strand':dict(skill='curse.venom_bind',version='v2',family='mark-sigil',sizePolicy='body',binding='target',geometry={'shape':'single'}),
}
skills={s['id']:s for s in json.loads((root/'tools/data/skills.json').read_text())['skills']}
data_path=root/'tools/data/vfx-components.json'
data=json.loads(data_path.read_text())
for shape,spec in specs.items():
 skill=skills[spec['skill']]
 group='attack-'+('phy' if skill['element']=='physical' else skill['element']) if skill['type']=='attack' else skill['type']
 folder=root/'game/public/fx/skill-pool'/group/spec['skill'].replace('.','-').replace('_','-')/spec['version']
 assert not folder.exists(),f'Version already exists: {folder}'
 assert shape not in data['variants'],f'Inventory already contains {shape}'
for shape,spec in specs.items():
 skill=skills[spec['skill']]
 group='attack-'+('phy' if skill['element']=='physical' else skill['element']) if skill['type']=='attack' else skill['type']
 folder=root/'game/public/fx/skill-pool'/group/spec['skill'].replace('.','-').replace('_','-')/spec['version']
 folder.mkdir()
 file=shape+'.png'
 shutil.copy2(source/rows[shape]['file'],folder/file)
 qa=json.loads((source/(Path(rows[shape]['file']).stem+'-qa.json')).read_text())
 assert hashlib.sha256((folder/file).read_bytes()).hexdigest()==qa['masterSha256']
 qa.update(file=file,runtimeRegistered=True,verifiedRuntimePalettes=0)
 (folder/'qa.json').write_text(json.dumps(qa,indent=2)+'\n')
 meta=dict(id=spec['skill'],src='/'+(folder.relative_to(root/'game/public')/file).as_posix(),layerId=shape,
  columns=1,rows=1,imageWidth=1024,imageHeight=1024,cellWidth=1024,cellHeight=1024,frameMs=80,
  contentWidthRatio=.8,contentHeightRatio=.8,anchorX=.5,anchorY=spec.get('anchorY',.5),
  palette='physical',durationSec=spec.get('durationSec',1.2),opacity=spec.get('opacity',1),
  authoringGeometry=spec['geometry'],composition='Reusable component master: '+shape,
  generation={'tool':'imagegen','source':'docs/vfx-skill/component-vfx/outputs/library-v3/generation-prompts.json'})
 for key in ['sizePolicy','projection','orient','binding','placement']:
  if key in spec: meta[key]=spec[key]
 meta['impactAnchorX']=meta['anchorX'];meta['impactAnchorY']=meta['anchorY']
 (folder/'meta.json').write_text(json.dumps(meta,indent=2)+'\n')
 variant={k:spec[k] for k in ['family','sizePolicy','projection','orient','binding','placement'] if k in spec}
 variant['master']=dict(skill=spec['skill'],version=spec['version'],file=file,layerId=shape,content=.8)
 data['variants'][shape]=variant
 print(shape,spec['skill'],spec['version'])
assert len(data['families'])==14 and len(data['variants'])==15
data_path.write_text(json.dumps(data,indent=2)+'\n')
print('PASS: 29 masters / 203 target palette combinations; defaults unchanged.')
