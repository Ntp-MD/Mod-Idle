from pathlib import Path
import hashlib,json,shutil
from PIL import Image

ROOT=Path.cwd()
SOURCES=ROOT/'docs/vfx-skill/component-vfx/outputs/library-v2'
specs=json.loads((ROOT/'docs/vfx-skill/component-vfx/evidence/manifests/vfx-expanded-spec.json').read_text(encoding='utf-8'))
data_path=ROOT/'tools/data/vfx-components.json'
data=json.loads(data_path.read_text(encoding='utf-8'))
skills={r['id']:r for r in json.loads((ROOT/'tools/data/skills.json').read_text(encoding='utf-8'))['skills']}
rows=json.loads((SOURCES/'generation-prompts.json').read_text(encoding='utf-8'))['masters']
assert len(rows)==8
data.setdefault('variants',{})
for row in rows:
 name=row['shape'];spec=specs[name];skill=skills[spec['skill']]
 raw=SOURCES/row['rawFile']
 if not raw.exists():shutil.copy2(row['sourceOutput'],raw)
 assert raw.read_bytes()==Path(row['sourceOutput']).read_bytes()
 image=Image.open(raw)
 assert image.mode=='RGBA' and image.width==image.height and image.getchannel('A').getextrema()[0]==0,name
 master=Image.new('RGBA',(1024,1024));master.paste(image.resize((818,818),Image.Resampling.LANCZOS),(103,103))
 box=master.getchannel('A').getbbox()
 assert box and min(box[0],box[1],1024-box[2],1024-box[3])>=32,name
 group='attack-'+('phy' if skill.get('element')=='physical' else skill['element'])
 folder=ROOT/'game/public/fx/skill-pool'/group/spec['skill'].replace('.','-').replace('_','-')/spec['version']
 assert not folder.exists(),folder
 folder.mkdir()
 master.save(folder/(name+'.png'))
 metadata={'id':spec['skill'],'src':'/'+(folder.relative_to(ROOT/'game/public')/(name+'.png')).as_posix(),
  'layerId':name,'columns':1,'rows':1,'imageWidth':1024,'imageHeight':1024,'cellWidth':1024,'cellHeight':1024,
  'frameMs':80,'contentWidthRatio':.8,'contentHeightRatio':.8,'anchorX':.5,'anchorY':.5,
  'palette':'physical','durationSec':1.2,'sizePolicy':spec['sizePolicy'],'composition':'Reusable shape variant: '+name,
  'generation':{'tool':'imagegen','source':'docs/vfx-skill/component-vfx/outputs/library-v2/generation-prompts.json'}}
 if spec.get('projection'):metadata['projection']=spec['projection']
 if spec.get('binding'):metadata['binding']=spec['binding']
 geometry={'shape':'line' if name=='crack-strip' else 'circle'}
 if spec['sizePolicy']=='body':geometry={'shape':'single','delivery':'projectile'};metadata['orient']=True
 if spec['sizePolicy']=='world':
  span,depth={'stone-spike':(1.2,2.2),'wave-crest':(3,2),'forked-bolt':(.8,3)}[name]
  geometry.update(spanM=span,depthM=depth)
  metadata['anchorY']=.85 if name!='wave-crest' else .8
  metadata['orient']=name=='wave-crest'
 metadata['impactAnchorX']=metadata['anchorX'];metadata['impactAnchorY']=metadata['anchorY']
 metadata['authoringGeometry']=geometry
 qa={'shape':name,'family':spec['family'],'palette':'neutral','canvas':[1024,1024],
     'alphaBounds':list(box),'contentRatio':.8,'source':'imagegen','humanReview':False,
     'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest()}
 for filename,value in [('meta.json',metadata),('qa.json',qa)]:
  (folder/filename).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
 variant={k:spec[k] for k in ('family','projection','sizePolicy','binding') if k in spec}
 variant['master']={'skill':spec['skill'],'version':spec['version'],'file':name+'.png','layerId':name,'content':.8}
 data['variants'][name]=variant
 print(name,'RGBA 1024x1024',box,spec['skill'],spec['version'])
assert len(data['families'])==14 and len(data['variants'])==8 and len(data['palettes'])==7
data_path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print('PASS: 22 source shapes x 7 shared palettes = 154 options; 8 new native originals retained.')
