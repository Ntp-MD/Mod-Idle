"""Read sprite alpha bounds for consistent feet and scale. Run after changing map PNGs.

Requires Pillow in the tooling environment; does not alter source images.
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
public = root / 'game/public'
bounds = {}
for path in sorted((public / 'map').rglob('*.png')):
    with Image.open(path) as image:
        alpha = image.convert('RGBA').getchannel('A')
        box = alpha.point(lambda value: 255 if value > 32 else 0).getbbox()
        if box:
            left, top, right, bottom = box
            bounds['/' + path.relative_to(public).as_posix()] = [
                *image.size, left, top, right - left, bottom - top]
(root / 'game/src/ui/map-sprite-bounds.json').write_text(
    json.dumps(bounds, indent=2) + '\n', encoding='utf-8')
