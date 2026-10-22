"""Measure the ground footprint of a terrain hex tile and store it for the map generator.

Run after adding or replacing a full-hex image under game/public/map/terrain/ or landmark/:

    python tools/map-art.py /map/terrain/forest-relief-1.png

The measurement is the tile's opaque silhouette reduced to the six ground vertices of the
hex the artwork draws. Each vertex is matched against the projected-hex template, so the
stored order is the template's own and the generator's fit lands the tile on its cell.

The ground fill is the colour painted under the artwork so a clipped edge cannot leave a
gap. It is a judgement about the picture, not a measurement of it, so an existing fill is
kept; a new tile gets the median colour of the ground inside its own footprint.

Requires Pillow in the tooling environment; does not alter source images.
"""
import json
import math
import statistics
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
public = root / 'game/public'
footprint_file = root / 'game/src/ui/map-terrain-footprints.json'
template_file = root / 'art-reference/map/geometry/terrain-hex.json'


def hull(points):
    """The convex hull of a point set, counter-clockwise in image coordinates."""
    points = sorted(set(points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper = []
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def six_vertices(silhouette):
    """Reduce a hull to its six ground corners, dropping the least significant each time."""
    polygon = list(silhouette)
    while len(polygon) > 6:
        smallest = None
        for index in range(len(polygon)):
            before, at, after = polygon[index - 1], polygon[index], polygon[(index + 1) % len(polygon)]
            area = abs((at[0] - before[0]) * (after[1] - before[1]) - (at[1] - before[1]) * (after[0] - before[0])) / 2
            if smallest is None or area < smallest[0]:
                smallest = (area, index)
        polygon.pop(smallest[1])
    return polygon


def template_corners():
    """The projected hex the artwork is drawn to, as fractions of the reference canvas."""
    template = json.loads(template_file.read_text(encoding='utf-8'))
    return [(x / template['width'], y / template['height']) for x, y in template['vertices']]


def measure(asset):
    """The six ground corners of one tile, in the template's own order."""
    path = public / asset.lstrip('/')
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        width, height = rgba.size
        alpha = rgba.getchannel('A')
        mask = alpha.point(lambda value: 255 if value >= 128 else 0)
        opaque = [(x, y) for y in range(height) for x in range(width) if mask.getpixel((x, y))]
    if not opaque:
        raise SystemExit(f'{asset}: the image is fully transparent, so it has no ground footprint')
    corners = six_vertices(hull(opaque))
    if len(corners) != 6:
        raise SystemExit(f'{asset}: the silhouette has {len(corners)} corners, not six')
    reference = template_corners()
    measured = [(x / width, y / height) for x, y in corners]
    order = []
    for point in measured:
        nearest = min(range(len(reference)), key=lambda i: math.dist(point, reference[i]))
        if nearest in order:
            raise SystemExit(f'{asset}: the silhouette does not match the template hex')
        order.append(nearest)
    if sorted(order) != list(range(len(reference))):
        raise SystemExit(f'{asset}: the silhouette does not match the template hex')
    vertices = [corners[order.index(i)] for i in range(len(reference))]
    drift = max(math.dist(measured[order.index(i)], reference[i]) for i in range(len(reference)))
    return {'width': width, 'height': height, 'vertices': vertices}, drift


def ground_fill(asset, corners):
    """The median colour of the ground inside the footprint, as an opaque hex fill."""
    path = public / asset.lstrip('/')
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        width, height = rgba.size
        pixels = rgba.load()
    inside = []
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] < 128:
                continue
            if point_in_polygon((x, y), corners):
                inside.append(pixels[x, y][:3])
    if not inside:
        raise SystemExit(f'{asset}: no opaque ground inside the footprint to sample')
    channels = [statistics.median(pixel[channel] for pixel in inside) for channel in range(3)]
    return '#' + ''.join(f'{round(channel):02x}' for channel in channels)


def point_in_polygon(point, polygon):
    """Whether a point lies inside a polygon, by the crossing rule."""
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def entry_text(asset, entry):
    """One footprint entry, in the shape the repository keeps it in."""
    vertices = '[' + ','.join(f'[{x},{y}]' for x, y in entry['vertices']) + ']'
    return (f'  "{asset}": {{\n'
            f'    "width": {entry["width"]},\n'
            f'    "height": {entry["height"]},\n'
            f'    "groundFill": "{entry["groundFill"]}",\n'
            f'    "vertices": {vertices}\n'
            f'  }}')


def write_footprints(measured):
    """Replace only the entries this run measured and leave every other line of the file as it
    was, so the file keeps one format and a run never rewrites someone else's entry."""
    text = footprint_file.read_text(encoding='utf-8') if footprint_file.exists() else '{\n}\n'
    for asset, entry in measured:
        block = entry_text(asset, entry)
        marker = f'  "{asset}": {{'
        if marker in text:
            start = text.index(marker)
            end = text.index('\n  }', start) + len('\n  }')
            text = text[:start] + block + text[end:]
        else:
            # A new asset joins the file ahead of its closing brace.
            closing = text.rindex('}')
            head = text[:closing].rstrip()
            separator = ',\n' if head.endswith('}') else '\n'
            text = head + separator + block + '\n}\n'
    footprint_file.write_text(text, encoding='utf-8')


def main(argv):
    if not argv:
        raise SystemExit('usage: python tools/map-art.py <asset> [<asset> ...]\n'
                         '  <asset> is a path under game/public, e.g. /map/terrain/forest-relief-1.png')
    stored = json.loads(footprint_file.read_text(encoding='utf-8')) if footprint_file.exists() else {}
    measured = []
    for asset in argv:
        if not asset.startswith('/map/'):
            raise SystemExit(f'{asset}: an asset path starts at /map/, e.g. /map/terrain/forest-relief-1.png')
        if not (public / asset.lstrip('/')).exists():
            raise SystemExit(f'{asset}: no such file under game/public')
        entry, drift = measure(asset)
        # The fill is a choice about the picture, so a recorded one is kept and only a new
        # tile is sampled. Re-measuring never repaints the ground under the art.
        entry['groundFill'] = stored.get(asset, {}).get('groundFill') or ground_fill(asset, entry['vertices'])
        measured.append((asset, entry))
        print(f'{asset}: {entry["width"]}x{entry["height"]}, six corners, '
              f'{drift * 100:.2f}% of the canvas from the template shape, ground {entry["groundFill"]}')
    write_footprints(measured)
    total = len(json.loads(footprint_file.read_text(encoding='utf-8')))
    print(f'wrote {footprint_file.relative_to(root)} ({total} asset(s))')


if __name__ == '__main__':
    main(sys.argv[1:])
