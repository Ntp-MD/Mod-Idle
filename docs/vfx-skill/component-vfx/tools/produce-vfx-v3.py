from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root = Path.cwd()
folder = root / 'docs/vfx-skill/component-vfx/outputs/library-v3'
manifest = json.loads((folder / 'generation-prompts.json').read_text(encoding='utf-8'))
records = []
for row in manifest['masters']:
    if 'sourceOutput' not in row:
        continue
    source = Path(row['sourceOutput'])
    raw = folder / row['rawFile']
    if not raw.exists():
        shutil.copy2(source, raw)
    assert raw.read_bytes() == source.read_bytes(), row['shape']
    image = Image.open(raw)
    assert image.mode == 'RGBA' and image.width == image.height, row['shape']
    assert image.getchannel('A').getextrema()[0] == 0, row['shape']
    # D11: resample the complete source uniformly, preserving its original alpha.
    master = Image.new('RGBA', (1024, 1024))
    master.paste(image.resize((818, 818), Image.Resampling.LANCZOS), (103, 103))
    target = folder / row['file']
    if not target.exists():
        master.save(target)
    loaded = Image.open(target)
    assert loaded.mode == 'RGBA' and loaded.size == (1024, 1024)
    assert loaded.tobytes() == master.tobytes(), row['shape']
    box = loaded.getchannel('A').getbbox()
    assert box and min(box[0], box[1], 1024-box[2], 1024-box[3]) >= 103, row['shape']
    pixels = [p for p in loaded.get_flattened_data() if p[3] >= 16]
    spreads = [max(p[:3])-min(p[:3]) for p in pixels]
    record = dict(shape=row['shape'], file=row['file'], rawFile=row['rawFile'],
        nativeSize=list(image.size), canvas=[1024,1024], alphaBounds=list(box),
        alphaExtrema=list(loaded.getchannel('A').getextrema()),
        visibleRgbSpreadMax=max(spreads), visibleRgbSpreadMean=round(sum(spreads)/len(spreads),6),
        grayscaleAuthority='AtlasFrame feColorMatrix saturate=0 before palette transfer',
        contentRatio=0.8, sourceSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
        masterSha256=hashlib.sha256(target.read_bytes()).hexdigest(),
        humanReview=False, runtimeRegistered=False, verifiedRuntimePalettes=0)
    (folder / (target.stem+'-qa.json')).write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    records.append(record)
    print(row['shape'], 'RGBA 1024x1024', box, 'RGB spread mean', record['visibleRgbSpreadMean'])
print('PASS:',len(records),'native originals, padded masters and measured QA; runtime not promoted.')
