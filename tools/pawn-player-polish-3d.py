"""Procedurally render the player pawn as an 8-direction 3D-polish sprite set.

Style: smooth shaded colony-sim pawn (hooded lathe body + head sphere) with a
directional key light, specular, rim light, ambient occlusion and a soft ground
shadow. No pixel-art contour; gradients carry the form.

Outputs (review candidate only, nothing in game/ is touched):
  docs/character/pawn-study/generation/eight-direction/pawn-player-polish-3d.png
  docs/character/pawn-study/generation/eight-direction/pawn-player-polish-3d.meta.json
  docs/character/pawn-study/previews/player-polish-3d-preview.png
  docs/character/pawn-study/previews/player-polish-3d-compare.png   (v2 vs new)

Run from repo root:  python tools/pawn-player-polish-3d.py
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'docs/character/pawn-study'
GEN = STUDY / 'generation/eight-direction'
PREVIEWS = STUDY / 'previews'

DIRECTIONS = ['south', 'south-east', 'east', 'north-east',
              'north', 'north-west', 'west', 'south-west']
YAW = {  # radians, 0 = facing camera (+z)
    'south': 0.0, 'south-east': math.pi / 4, 'east': math.pi / 2,
    'north-east': 3 * math.pi / 4, 'north': math.pi,
    'north-west': -3 * math.pi / 4, 'west': -math.pi / 2, 'south-west': -math.pi / 4,
}

FRAME = 256
GROUND_Y = 224
CX = 128

# Character proportions (character-space units, y up from ground)
BODY_R = 56.0            # cloak radius at the hem
CLOAK_H = 100.0          # cloak hem (0) to shoulder line
HEAD_R = 38.0
HEAD_CY = 112.0          # head sphere center height (lower half nests in the collar)

# Palette (base albedo, shaded by N.L) — matches the runtime v2 player identity
CLOAK = (86, 118, 168)      # blue cloak
HOOD = (232, 220, 196)      # cream hood
FACE = (238, 198, 168)      # skin
TRIM = (122, 92, 64)        # brown hem/tunic trim

LIGHT = (-0.42, 0.78, 0.46)          # key light direction (toward surface)
_ln = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _ln for c in LIGHT)
LIGHT_VIEW = (LIGHT[0], LIGHT[2])     # for rim test


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def shade(base, ndl, ndv, rim):
    """Soft 3D shading: ambient + diffuse + specular + rim, cool shadows."""
    diff = clamp(ndl, 0.0, 1.0)
    amb = 0.42
    lit = amb + 0.62 * diff
    spec = 0.30 * max(0.0, ndl) ** 24 * ndv
    r = base[0] * lit + 255 * spec
    g = base[1] * lit + 255 * spec
    b = base[2] * lit + 255 * spec
    if rim > 0:
        # warm rim from behind-left
        r += 70 * rim
        g += 46 * rim
        b += 22 * rim
    # cool the shadows slightly
    shadow = clamp(1.0 - lit, 0.0, 1.0)
    b += 10 * shadow
    return (clamp(int(r), 0, 255), clamp(int(g), 0, 255), clamp(int(b), 0, 255), 255)


def blend_over(dst, base, ndl, a):
    """Composite a shaded base color over an existing pixel by factor a."""
    sr, sg, sb, _ = shade(base, ndl, 1.0, 0.0)
    dr, dg, db, da = dst
    return (int(dr + (sr - dr) * a), int(dg + (sg - dg) * a),
            int(db + (sb - db) * a), da)


def render_direction(yaw, with_shadow=True):
    """Render one facing; returns RGBA 256x256 with ground anchor (128,224)."""
    img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    px = img.load()

    def to_screen(x, y, z):
        return (CX + x, GROUND_Y - y - z)

    # soft ground shadow
    if with_shadow:
        sw = int(BODY_R * 1.5)
        sh = int(BODY_R * 0.52)
        shadow = Image.new('RGBA', (sw * 2, sh * 2), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse((0, 0, sw * 2 - 1, sh * 2 - 1), fill=(20, 16, 30, 120))
        shadow = shadow.filter(ImageFilter.GaussianBlur(6))
        img.alpha_composite(shadow, (CX - sw, GROUND_Y - sh))

    # ---- hooded pawn: one continuous cloak-to-hood lathe, face on the crown front ----
    c, s = math.cos(yaw), math.sin(yaw)

    def lathe_fill(y_top, radius_fn, base_fn, ny_fn):
        for sy in range(GROUND_Y + 1):
            y = GROUND_Y - sy
            if y < 0 or y > y_top:
                continue
            t = y / y_top
            r = radius_fn(t)
            if r <= 0.5:
                continue
            ny = ny_fn(t)
            base = base_fn(t)
            for sx in range(max(0, int(CX - r)), min(FRAME, int(CX + r) + 1)):
                x = sx - CX
                dx = x / r
                if abs(dx) > 1.0:
                    continue
                dz = math.sqrt(1.0 - dx * dx)
                nx, nz = dx, dz
                nvx = nx * c - nz * s
                nvz = nx * s + nz * c
                nl = math.sqrt(nvx * nvx + ny * ny + nvz * nvz)
                ndl = (nvx * LIGHT[0] + ny * LIGHT[1] + nvz * LIGHT[2]) / nl
                ndv = clamp(nvz, 0.0, 1.0)
                back = clamp(-LIGHT_VIEW[0] * nvx - LIGHT_VIEW[1] * nvz, 0.0, 1.0)
                rim = back ** 3 * (1.0 - ndv)
                px[sx, sy] = shade(base, ndl, ndv, rim * 0.9)

    # cloak: gentle hem -> rounded shoulders -> tall dome hood crown
    lathe_fill(
        CLOAK_H,
        lambda t: BODY_R
        * (1.0 + 0.12 * (1.0 - min(t / 0.30, 1.0)) ** 2)          # soft hem flare
        * (1.0 - 0.30 * max(0.0, (t - 0.55) / 0.45) ** 1.6)       # shoulder taper
        * math.sqrt(max(0.0, 1.0 - max(0.0, (t - 0.70) / 0.30) ** 2)),  # dome crown
        lambda t: TRIM if t < 0.05 else (HOOD if t > 0.52 else CLOAK),  # cream hood over the crown
        lambda t: 0.30 + 0.62 * max(0.0, (t - 0.5) / 0.5),
    )

    # ---- face: oval on the front of the hood crown, slides with yaw, hides at north ----
    facing = c                                     # +1 south .. 0 side .. -1 north
    if facing > -0.15:
        face_rx, face_ry = HEAD_R * 0.46, HEAD_R * 0.40
        crown_r = BODY_R * math.sqrt(1.0 - ((0.5 - 0.62) / 0.38) ** 2) * 0.98
        fcx = CX + crown_r * 0.34 * s              # front slides with sin(yaw)
        fcy = GROUND_Y - (CLOAK_H * 0.50)          # lower front of the crown
        squash = clamp(0.30 + 0.70 * facing, 0.30, 1.0)
        for sx in range(max(0, int(fcx - face_rx)), min(FRAME, int(fcx + face_rx) + 1)):
            for sy in range(max(0, int(fcy - face_ry)), min(FRAME, int(fcy + face_ry) + 1)):
                ex = (sx - fcx) / (face_rx * squash)
                ey = (sy - fcy) / face_ry
                d = ex * ex + ey * ey
                if d > 1.0:
                    continue
                nx, ny2 = ex * squash, ey
                nz = math.sqrt(max(0.0, 1.0 - nx * nx - ny2 * ny2))
                nvz = nx * s + nz * c
                a = clamp(nvz / 0.35, 0.0, 1.0) * (1.0 - d) ** 0.5
                if a <= 0.0:
                    continue
                nl = math.sqrt(nx * nx + ny2 * ny2 + nz * nz)
                ndl = (nx * LIGHT[0] + ny2 * LIGHT[1] + nz * LIGHT[2]) / nl
                dst = px[sx, sy]
                if dst[3] == 0:
                    px[sx, sy] = shade(FACE, ndl, 1.0, 0.0)
                else:
                    px[sx, sy] = blend_over(dst, FACE, ndl, a)

    return img


def main():
    GEN.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)

    frames = {d: render_direction(YAW[d]) for d in DIRECTIONS}
    folder = STUDY / 'frames/player-polish-3d'
    folder.mkdir(parents=True, exist_ok=True)

    atlas = Image.new('RGBA', (4 * FRAME, 2 * FRAME), (0, 0, 0, 0))
    for i, d in enumerate(DIRECTIONS):
        f = frames[d]
        f.save(folder / f'{d}.png')
        atlas.alpha_composite(f, (i % 4 * FRAME, i // 4 * FRAME))
    out_png = GEN / 'pawn-player-polish-3d.png'
    atlas.save(out_png)

    meta = {
        'schemaVersion': 1,
        'status': 'review-candidate',
        'pawnId': 'player',
        'name': 'Player (polish 3D)',
        'generator': 'tools/pawn-player-polish-3d.py (Pillow procedural, no API key)',
        'style': 'smooth 3D-shaded colony pawn: directional key light, specular, rim light, ambient occlusion, soft ground shadow',
        'directions': DIRECTIONS,
        'atlasLayout': '4x2 row-major: south, south-east, east, north-east, north, north-west, west, south-west',
        'actualImage': {'width': atlas.width, 'height': atlas.height,
                        'cellWidth': FRAME, 'cellHeight': FRAME, 'alpha': 'transparent'},
        'anchor': {'x': 128, 'y': 224},
        'animationKind': 'static-8-view',
        'note': 'Review candidate only; game/ not modified. Install via build-study/integrate after sign-off.',
    }
    (GEN / 'pawn-player-polish-3d.meta.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')

    # review preview on light neutral background
    bg = Image.new('RGBA', atlas.size, (241, 238, 231, 255))
    bg.alpha_composite(atlas)
    bg.convert('RGB').save(PREVIEWS / 'player-polish-3d-preview.png')

    # side-by-side compare with current runtime v2
    v2_path = ROOT / 'game/public/combat/arpg/player/pawn/v2/atlas.png'
    if v2_path.exists():
        v2 = Image.open(v2_path).convert('RGBA')
        board = Image.new('RGBA', (atlas.width, atlas.height * 2 + 8), (255, 255, 255, 255))
        bv = Image.new('RGBA', v2.size, (241, 238, 231, 255))
        bv.alpha_composite(v2)
        board.alpha_composite(bv, (0, 0))
        bn = Image.new('RGBA', atlas.size, (241, 238, 231, 255))
        bn.alpha_composite(atlas)
        board.alpha_composite(bn, (0, atlas.height + 8))
        board.convert('RGB').save(PREVIEWS / 'player-polish-3d-compare.png')

    print(f'wrote {out_png}')
    print(f'preview {PREVIEWS / "player-polish-3d-preview.png"}')


if __name__ == '__main__':
    main()
