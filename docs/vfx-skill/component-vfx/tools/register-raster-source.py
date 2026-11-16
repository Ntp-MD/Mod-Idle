"""Adopt one generated 2D target into the existing named raster shelf."""
from pathlib import Path
import argparse
import hashlib
import html
import importlib.util
import json
import re
import shutil

from PIL import Image, ImageDraw, ImageFont

TOPIC=Path(__file__).resolve().parents[1]
ROOT=TOPIC.parents[2]
OUT=TOPIC/'outputs'
INVENTORY=ROOT/'tools/data/vfx-components.json'


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def refresh_gallery(manifest,inventory):
    path=OUT/'index.html';page=path.read_text(encoding='utf-8')
    marker='<h2>Raw sources and masters</h2><div class="grid">'
    start=page.index(marker)+len(marker)
    match=re.search(r'</div>\s*<h2>',page[start:])
    if not match:raise ValueError('Existing master grid boundary is missing')
    cards=[]
    for row in manifest['masters']:
        name=html.escape(row['shape'])
        label=html.escape(row['family'])+(' · raster addition' if row.get('authoringKind')=='raster-still' else '')
        cards.append(f'<article data-shape="{name}"><h3>{name}</h3><div class="ingredients"><a href="{row["rawFile"]}"><img src="{row["rawFile"]}" alt="{name} raw" loading="lazy">Raw</a><a href="{row["file"]}"><img src="{row["file"]}" alt="{name} master" loading="lazy">Master</a></div><p>{label}</p><a href="{row["qaFile"]}">Measured QA</a></article>')
    page=page[:start]+'\n'+'\n'.join(cards)+'\n'+page[start+match.start():]
    page=re.sub(r'\d+ reusable shapes, \d+ families,',f'{len(cards)} reusable shapes, {len(inventory["families"])} families,',page,count=1)
    if '<link rel="icon"' not in page:page=page.replace('<title>','<link rel="icon" href="impact-burst.png"><title>',1)
    path.write_text(page,encoding='utf-8')


def checkpoint(shape,manifest):
    path=OUT/'qa/raster-expansion.json';report=json.loads(path.read_text(encoding='utf-8'))
    for name,digest in report['originalFiles'].items():
        assert sha(OUT/name)==digest, f'Original raster asset changed: {name}'
    done=[row['shape'] for row in manifest['masters'] if row['shape'] in report['expectedAdditions']]
    report.update(selectedAdditions=done,currentCount=len(manifest['masters']),
                  status='source-complete' if len(done)==33 else 'in-progress',originalHashesPreserved=True)
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')


def finish(manifest):
    report_path=OUT/'qa/raster-expansion.json';report=json.loads(report_path.read_text(encoding='utf-8'))
    lookup={row['shape']:row for row in manifest['masters']}
    rows=[lookup[name] for name in report['expectedAdditions']]
    assert len({sha(OUT/row['rawFile']) for row in rows})==len(rows), 'Duplicate generated raster source'
    decoded=set()
    for row in rows:
        with Image.open(OUT/row['rawFile']) as image:
            decoded.add(hashlib.sha256(str(image.size).encode()+image.tobytes()).hexdigest())
    assert len(decoded)==len(rows), 'Generated raster sources repeat the same decoded pixels'
    margins=[]
    for row in rows:
        with Image.open(OUT/row['file']) as image:
            left,top,right,bottom=image.getchannel('A').getbbox()
            margins.append(min(left,top,image.width-right,image.height-bottom))
    assert min(margins)>=103
    tile=240;height=268;header=76
    sheet=Image.new('RGB',(tile*6,header+height*((len(rows)+5)//6)),'#101923')
    draw=ImageDraw.Draw(sheet);font=ImageFont.load_default(size=16)
    draw.text((18,12),'2D raster additions: 33 named ingredients',font=ImageFont.load_default(size=24),fill='#e2edf5')
    draw.text((18,45),'Transparent PNG sources / mechanical QA passed / human visual review pending',font=font,fill='#adc2d4')
    for index,row in enumerate(rows):
        x=index%6*tile;y=header+index//6*height
        draw.rounded_rectangle((x+5,y+5,x+tile-5,y+height-5),radius=7,fill='#1c2b39')
        with Image.open(OUT/row['file']) as image:
            preview=image.copy();preview.thumbnail((214,214),Image.Resampling.LANCZOS)
            sheet.paste(preview,(x+(tile-preview.width)//2,y+12),preview)
        draw.text((x+12,y+239),row['shape'],font=font,fill='#deebf6')
    sheet.save(OUT/'qa/raster-roster.png')
    gallery=OUT/'index.html';page=gallery.read_text(encoding='utf-8')
    if 'href="qa/raster-roster.png"' not in page:
        page=page.replace('<label for="filter">','<p><a href="qa/raster-roster.png">33 new raster ingredients: contact sheet</a> · Filter “raster addition” to inspect their raw/master pairs.</p><label for="filter">',1)
    gallery.write_text(page,encoding='utf-8')
    guide=OUT/'README.md';text=guide.read_text(encoding='utf-8')
    text=re.sub(r'One shared shelf: \d+ named shapes',f'One shared shelf: {len(manifest["masters"])} named shapes',text,count=1)
    if '[raster contact sheet](qa/raster-roster.png)' not in text:
        text=text.replace('## Update policy','The 33 current additions are summarized in the [raster contact sheet](qa/raster-roster.png) and [expansion QA](qa/raster-expansion.json). Their human visual review remains pending.\n\n## Update policy',1)
    guide.write_text(text,encoding='utf-8')
    guide=TOPIC/'README.md';text=guide.read_text(encoding='utf-8')
    start=text.index('| Shape | Family | Placement / size | Master |')
    end=text.index('## Palette selection',start)
    table=['| Shape | Family | Placement / size | Master |','| --- | --- | --- | --- |']
    for row in manifest['masters']:
        layer=row['layer'];projection='ground' if layer.get('projection')=='ground' else 'billboard'
        table.append(f'| `{row["shape"]}` | `{row["family"]}` | {projection} / {layer.get("sizePolicy","body")} | [PNG](outputs/{row["file"]}) |')
    guide.write_text(text[:start]+'\n'.join(table)+'\n\n'+text[end:],encoding='utf-8')
    report.update(sourceHashesDistinct=True,decodedSourcesDistinct=True,minimumPaddingPx=min(margins),contactSheet='qa/raster-roster.png',
                  authoring='2d-raster-still',runtimeAdoption='not-performed')
    report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('shape');parser.add_argument('source',type=Path)
    args=parser.parse_args()
    manifest_path=OUT/'generation-prompts.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    row=next((row for row in manifest.get('pendingMasters',[]) if row['shape']==args.shape),None)
    if row is None:raise ValueError(f'Not an unbuilt raster target: {args.shape}')
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',args.shape), 'Unsafe component name'
    assert row['file']==args.shape+'.png' and row['rawFile']=='raw/'+row['file']
    assert row['qaFile']=='qa/'+args.shape+'.json'
    inventory=json.loads(INVENTORY.read_text(encoding='utf-8'))
    assert row['family'] in inventory['families']
    assert args.shape not in inventory['variants'] and args.shape not in inventory['families']
    with Image.open(args.source) as image:
        assert image.mode=='RGBA', 'Generator output must have a genuine alpha channel'
        alpha=image.getchannel('A');box=alpha.point(lambda value:255 if value>=8 else 0).getbbox()
        assert box and alpha.getextrema()[0]==0, 'Missing visible effect or transparent background'
        # Near-invisible alpha-1 generator specks are retained, not treated as clipped paint.
        assert min(box[0],box[1],image.width-box[2],image.height-box[3])>=2, 'Visible raw silhouette touches the source edge'
        corners=[alpha.getpixel(point) for point in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]]
        assert max(corners)<=1, 'Visible background alpha at a raw-image corner'
        visible_bounds=list(box)
    row['sourceOutput']=str(args.source.resolve())
    destination=OUT/row['rawFile']
    assert not destination.exists(), 'A named raw already exists; review it instead of overwriting it'
    shutil.copy2(args.source,destination)
    manifest['pendingMasters'].remove(row);manifest['masters'].append(row)
    layer=row['layer']
    inventory['variants'][args.shape]={
        'family':row['family'],**{key:layer[key] for key in ('projection','sizePolicy','binding','orient') if key in layer},
        'master':{'skill':row['reviewSkill'],'file':row['file'],'layerId':args.shape,'content':.8}}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    INVENTORY.write_text(json.dumps(inventory,indent=2)+'\n',encoding='utf-8')
    spec=importlib.util.spec_from_file_location('vfx_normalizer',Path(__file__).with_name('produce-vfx-components.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.produce([args.shape])
    qa_path=OUT/row['qaFile'];qa=json.loads(qa_path.read_text(encoding='utf-8'))
    qa.update(rawVisibleAlphaBounds=visible_bounds,rawCornerAlpha=corners,rawPreserved=True)
    qa_path.write_text(json.dumps(qa,indent=2)+'\n',encoding='utf-8')
    refresh_gallery(manifest,inventory);checkpoint(args.shape,manifest)
    if not manifest['pendingMasters']:
        module.verify();finish(manifest)
    print(f'REGISTERED {args.shape}: named raw/master/QA; raster roster {len(manifest["masters"])}; pending {len(manifest["pendingMasters"])}')


if __name__=='__main__':main()
