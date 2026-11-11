"""Pack camera exports without trimming/recentring; verify every cell before writing."""
from pathlib import Path
import argparse
import hashlib
import json

from PIL import Image, ImageDraw

TOPIC = Path(__file__).resolve().parents[1]
OUTPUT = TOPIC / 'outputs' / 'animated'
TARGETS = json.loads((TOPIC / 'sources/components.json').read_text(encoding='utf-8'))
CAMERAS = json.loads((TOPIC / 'sources/cameras.json').read_text(encoding='utf-8'))
COLUMNS = 6
POSTER = 9


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pack(frames):
    side = frames[0].width
    sheet = Image.new('RGBA', (side*COLUMNS, side*((len(frames)+COLUMNS-1)//COLUMNS)))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index % COLUMNS*side, index//COLUMNS*side))
    return sheet


def self_test():
    frames = [Image.new('RGBA', (8,8), (index*9,index*3,index*5,index*7)) for index in range(24)]
    sheet = pack(frames)
    for index, frame in enumerate(frames):
        x,y=index % COLUMNS*8,index//COLUMNS*8
        assert sheet.crop((x,y,x+8,y+8)).tobytes()==frame.tobytes(), 'Packing changed frame pixels/alpha'
    assert sheet.size==(48,32)
    assert len({c['id'] for c in TARGETS['components']})==33
    assert len({d['id'] for d in CAMERAS['directions']})==8
    assert {c['elevationDeg'] for c in CAMERAS['presets']}=={33,45}
    print('PASS packing: 24 exact RGBA cells; 33 targets; eight headings; 33/45-degree presets')


def build(component):
    folder=OUTPUT/component['id']
    render=json.loads((folder/'render.json').read_text(encoding='utf-8'))
    source=TOPIC/render['source']
    assert render['sourceSha256']==digest(source), f'Stale render source: {component["id"]}'
    assert render['component']==component, f'Stale component declaration: {component["id"]}'
    count=render['frameCount'];side=render['frameSize']
    assert count==24 and side==256
    qa=[];presets=[];posters=[]
    for camera in CAMERAS['presets']:
        recorded=next(c for c in render['cameras'] if c['id']==camera['id'])
        assert all(recorded.get(key)==value for key,value in camera.items()), f'Stale camera export: {camera["id"]}'
        anchor=recorded['anchor']
        assert all(0<value<1 for value in anchor), f'Root outside frame: {anchor}'
        sources={}
        for direction in CAMERAS['directions']:
            directory=folder/camera['id']/direction['id']
            frames=[];active=[];hashes=[];bounds=[]
            for index in range(1,count+1):
                path=directory/f'{index:03}.png'
                with Image.open(path) as image:
                    assert image.mode=='RGBA' and image.size==(side,side), str(path)
                    frame=image.copy()
                alpha=frame.getchannel('A')
                assert alpha.getextrema()[0]==0, f'No transparent background: {path}'
                box=alpha.point(lambda a:255 if a>=8 else 0).getbbox()
                if box:
                    margin=min(box[0],box[1],side-box[2],side-box[3])
                    assert margin>=12, f'Clipped/unsafe cell: {path.relative_to(TOPIC)}, margin={margin}, bounds={box}'
                    bounds.append(box)
                    if 5<=index<=18:active.append(index)
                if 5<=index<=18:
                    assert box is not None, f'Invisible active frame: {path}'
                hashes.append(hashlib.sha256(frame.tobytes()).hexdigest());frames.append(frame)
            assert len(active)==14
            atlas=pack(frames);atlas.save(directory/'atlas.png',compress_level=9)
            sources[direction['id']]=f'{camera["id"]}/{direction["id"]}/atlas.png'
            qa.append(dict(camera=camera['id'],direction=direction['id'],frames=count,activeFrames=len(active),
                           uniqueFrames=len(set(hashes)),minimumMarginPx=min(min(b[0],b[1],side-b[2],side-b[3]) for b in bounds),
                           anchor=anchor,atlasSha256=digest(directory/'atlas.png')))
            assert len(set(hashes))>=10, f'Static animation: {directory}'
            posters.append((f'{camera["id"]} / {direction["id"]}',frames[POSTER]))
        presets.append(dict(**camera,anchor=anchor,sources=sources))
    meta=dict(componentId=component['id'],source=render['source'],sourceSha256=render['sourceSha256'],units='metres',
              frame=dict(width=side,height=side,count=count,columns=COLUMNS,rows=4),fps=component['fps'],
              frameDurationUs=render['frameDurationUs'],durationSec=count/component['fps'],posterFrame=POSTER,
              phases=render['phases'],interrupt=render['interrupt'],directional=dict(presets=presets))
    if 'attachment' in render:meta['attachment']=render['attachment']
    (folder/'meta.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    contact=Image.new('RGB',(side*4,(side+26)*4),'#17222f');draw=ImageDraw.Draw(contact)
    for index,(label,poster) in enumerate(posters):
        x=index%4*side;y=index//4*(side+26)
        contact.paste(poster,(x,y+26),poster);draw.text((x+8,y+7),label,fill='#d5ebf9')
    contact.save(folder/'contact-sheet.png',compress_level=9)
    report=dict(component=component['id'],status='mechanical-pass',humanApproval='pending',sourceSha256=render['sourceSha256'],
                frameCount=count,cameraCount=2,directionCount=8,checks=qa)
    (folder/'qa.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'PASS {component["id"]}: 384 RGBA frames, 16 atlases, fixed camera roots, active frames, margins, contact sheet',flush=True)
    return meta


def gallery():
    available=[]
    for component in TARGETS['components']:
        path=OUTPUT/component['id']/'meta.json'
        if path.exists():available.append(dict(target=component,meta=json.loads(path.read_text(encoding='utf-8'))))
    data=json.dumps(available).replace('</','<\\/')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<title>Procedural VFX source review</title><style>
body{margin:24px;background:#0d1722;color:#e6eff5;font:16px/1.5 system-ui}header{max-width:1000px}button,select{font:inherit;padding:7px;background:#203245;color:inherit;border:1px solid #6c91ac;border-radius:4px}label{margin-right:16px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:24px}article{padding:16px;background:#172535;border:1px solid #3c5369;border-radius:8px}canvas{width:100%;aspect-ratio:1;background:repeating-conic-gradient(#1a2c3a 0% 25%,#243a4a 0% 50%) 0/32px 32px}a{color:#8ed8ff}small{display:block;color:#b4cbdc}.controls{display:flex;flex-wrap:wrap;gap:12px}h1{font-size:26px}h2{font-size:19px}
</style><header><h1>Procedural VFX source review</h1><p>Editable 3D sources, shared timelines and fixed world roots. Human visual approval pending. This offline atlas viewer does not render the game field.</p><div class="controls"><label>Camera <select id="camera"><option value="arena">Arena: 33 degrees</option><option value="raised">Raised: 45 degrees</option></select></label><label>World heading <select id="direction"></select></label><button id="play">Pause</button><label>Frame <input id="frame" type="range" min="0" max="23" value="9"></label><label><input type="checkbox" id="roots" checked>Show root</label></div><p><a href="../../sources/README.md">Sources and reproduction</a></p></header><main id="cards"></main><script>
const assets=ASSET_DATA, direction=document.querySelector('#direction'),camera=document.querySelector('#camera'),slider=document.querySelector('#frame');
for(const id of Object.keys(assets[0]?.meta.directional.presets[0].sources||{}))direction.add(new Option(id,id));
let playing=true,start=performance.now(),frozen=9;const cards=[];
for(const item of assets){const card=document.createElement('article'),id=item.target.id;card.innerHTML=`<h2>${id}</h2><canvas width="256" height="256" aria-label="${id} animated atlas"></canvas><small>${item.meta.frame.count} frames · ${item.meta.fps} fps · world metres</small><p><a href="${id}/contact-sheet.png">Contact sheet</a> · <a href="${id}/qa.json">Measured QA</a> · <a href="${id}/meta.json">Metadata</a> · <a href="../../${item.meta.source}">Editable scene</a></p>`;document.querySelector('#cards').append(card);cards.push({item,canvas:card.querySelector('canvas'),images:new Map()});}
document.querySelector('#play').onclick=e=>{playing=!playing;e.target.textContent=playing?'Pause':'Play';start=performance.now();};
slider.oninput=()=>{playing=false;frozen=+slider.value;document.querySelector('#play').textContent='Play';};
function paint(now){for(const {item,canvas,images} of cards){const m=item.meta,p=m.directional.presets.find(x=>x.id===camera.value),src=`${item.target.id}/${p.sources[direction.value]}`;let image=images.get(src);if(!image){image=new Image();image.src=src;images.set(src,image);}const index=playing?Math.floor((now-start)/1000*m.fps)%m.frame.count:frozen,ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);if(image.complete&&image.naturalWidth)ctx.drawImage(image,index%6*256,Math.floor(index/6)*256,256,256,0,0,256,256);if(document.querySelector('#roots').checked){const [x,y]=p.anchor.map(v=>v*256);ctx.strokeStyle='#ff6289';ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();}}requestAnimationFrame(paint);}requestAnimationFrame(paint);
</script></html>'''.replace('ASSET_DATA',data)
    (OUTPUT/'index.html').write_text(html,encoding='utf-8')
    (OUTPUT/'catalog.json').write_text(json.dumps(available,indent=2)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--component',nargs='+',choices=[c['id'] for c in TARGETS['components']])
    parser.add_argument('--self-test',action='store_true')
    options=parser.parse_args()
    self_test()
    if options.self_test:return
    for component in TARGETS['components']:
        if options.component and component['id'] not in options.component:continue
        build(component)
    gallery()


if __name__=='__main__':main()
