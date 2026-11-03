#!/usr/bin/env python3
"""Compose single-pose monster frames into a padded runtime atlas.

Permanent intake path: generate ONE pose per PNG, then let this tool own the
grid. A model that never draws a grid cannot bleed frames into each other;
gutters then come from code, not from model obedience.

    python -B tools/monster-animation-compose.py --frames-dir <dir> --meta-base <meta.json> --out-dir <variant-dir>

The frames directory holds 000.png .. 039.png (row-major: idle, walk, attack,
hit, death x south, south-east, east, north-east, north, north-west, west,
south-west, unless --map overrides). The base metadata carries the identity
fields (speciesId, variantId, name, levels, identityRef, styleRef, anchor);
this tool fills in only geometry and writes status draft-review. Nothing is
written unless every frame passes; the composed draft is then checked with
monster-animation-qa.py and a QA failure also exits nonzero.

Layout defaults (columns, rows, cell, padding) match the production contract
in art-reference/monsters/production-roster.json; override them only for tests.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ACTIONS = ["idle", "walk", "attack", "hit", "death"]
DEFAULT_DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
NON_UPRIGHT_ACTIONS = {"death"}
MIN_COMPONENT_PIXELS = 16
MAX_DOWNSCALE = 4


def load_qa() -> Any:
    spec = importlib.util.spec_from_file_location(
        "monster_animation_compose_qa", ROOT / "tools" / "monster-animation-qa.py")
    if spec is None or spec.loader is None:
        raise ValueError("cannot load monster animation QA")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def fail(message: str) -> int:
    print(json.dumps({"status": "FAIL", "reason": message}))
    return 1


def read_base(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "FAIL", "reason": f"cannot read meta base: {error}"}))
        return None
    if not isinstance(value, dict):
        print(json.dumps({"status": "FAIL", "reason": "meta base root must be an object"}))
        return None
    return value


def default_frame_map() -> list[dict[str, Any]]:
    return [
        {"index": action_index * 8 + direction_index, "action": action, "direction": direction}
        for action_index, action in enumerate(DEFAULT_ACTIONS)
        for direction_index, direction in enumerate(DEFAULT_DIRECTIONS)
    ]


def read_frame_map(path: Path | None, frame_count: int) -> list[dict[str, Any]] | None:
    if path is None:
        return default_frame_map()
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "FAIL", "reason": f"cannot read frame map: {error}"}))
        return None
    entries = value.get("frames") if isinstance(value, dict) else value
    if not isinstance(entries, list) or len(entries) != frame_count:
        print(json.dumps({"status": "FAIL", "reason": f"frame map must list {frame_count} frames"}))
        return None
    cleaned = []
    for entry in entries:
        if not isinstance(entry, dict):
            print(json.dumps({"status": "FAIL", "reason": "frame map entries must be objects"}))
            return None
        cleaned.append({"index": entry.get("index"), "action": entry.get("action"), "direction": entry.get("direction")})
    indices = sorted(entry["index"] for entry in cleaned)
    if indices != list(range(frame_count)) or any(not isinstance(entry["action"], str) or not isinstance(entry["direction"], str) for entry in cleaned):
        print(json.dumps({"status": "FAIL", "reason": "frame map must cover every cell index once with an action and a direction"}))
        return None
    return cleaned


def hard_alpha_only(image: Image.Image) -> bool:
    histogram = image.getchannel("A").histogram()
    return sum(histogram[1:255]) == 0


def single_component(qa: Any, image: Image.Image) -> tuple[tuple[int, int, int, int] | None, str | None]:
    width, height = image.size
    mask = image.getchannel("A").point(lambda value: 1 if value else 0).tobytes()
    big = [component for component in qa.opaque_components(mask, width, height) if component[1] >= MIN_COMPONENT_PIXELS]
    if not big:
        return None, "frame has no opaque pose"
    if len(big) > 1:
        return None, f"frame holds {len(big)} separate poses; generate exactly one pose per PNG"
    bounds = big[0][0]
    return (bounds.x, bounds.y, bounds.width, bounds.height), None


def check_source(path: Path, qa: Any) -> tuple[Image.Image, tuple[int, int, int, int]] | str:
    try:
        image = Image.open(path).convert("RGBA")
    except (OSError, ValueError) as error:
        return f"cannot open {path.name}: {error}"
    width, height = image.size
    border = Image.new("L", (width, height), 0)
    border.paste(image.getchannel("A").crop((0, 0, width, 1)), (0, 0))
    border.paste(image.getchannel("A").crop((0, height - 1, width, height)), (0, height - 1))
    border.paste(image.getchannel("A").crop((0, 0, 1, height)), (0, 0))
    border.paste(image.getchannel("A").crop((width - 1, 0, width, height)), (width - 1, 0))
    if border.getbbox() is not None:
        return f"{path.name}: art touches the source image edge; keep the pose clear of every edge"
    if not hard_alpha_only(image):
        return f"{path.name}: semi-transparent pixels found; hard alpha only"
    bounds, problem = single_component(qa, image)
    if problem is not None:
        return f"{path.name}: {problem}"
    assert bounds is not None
    return image, bounds


def compose(args: argparse.Namespace, qa: Any) -> int:
    columns, rows = args.columns, args.rows
    cell, padding = args.cell, args.padding
    frame_count = columns * rows
    frame_map = read_frame_map(args.map, frame_count)
    if frame_map is None:
        return 1
    base = read_base(args.meta_base)
    if base is None:
        return 1
    anchor = base.get("anchor")
    if (not isinstance(anchor, dict) or type(anchor.get("x")) is not int
            or type(anchor.get("y")) is not int):
        return fail("meta base must declare an integer anchor {x, y}")
    anchor_x, anchor_y = anchor["x"], anchor["y"]
    if not (0 < anchor_x < cell and padding <= anchor_y <= cell - padding):
        return fail(f"anchor ({anchor_x},{anchor_y}) leaves no {padding}px ground gutter in a {cell}px cell")

    frames_dir = args.frames_dir
    sources: list[tuple[Image.Image, tuple[int, int, int, int]]] = []
    for entry in sorted(frame_map, key=lambda item: item["index"]):
        path = frames_dir / f"{entry['index']:03d}.png"
        if not path.is_file():
            return fail(f"missing frame {path.name}")
        result = check_source(path, qa)
        if isinstance(result, str):
            return fail(result)
        sources.append(result)
    stray = sorted(path.name for path in frames_dir.glob("*.png")
                   if path.name not in {f"{entry['index']:03d}.png" for entry in frame_map})
    if stray:
        return fail(f"unexpected extra frames: {', '.join(stray[:5])}")

    heights = [image.size[1] for image, _ in sources]
    tolerance = max(4, round(0.02 * max(heights)))
    bottoms = [bounds[1] + bounds[3] for (_, bounds), entry in zip(sources, sorted(frame_map, key=lambda item: item["index"])) if entry["action"] not in NON_UPRIGHT_ACTIONS]
    if bottoms:
        median_bottom = sorted(bottoms)[len(bottoms) // 2]
        drifted = [entry["index"] for (_, bounds), entry in zip(sources, sorted(frame_map, key=lambda item: item["index"]))
                   if entry["action"] not in NON_UPRIGHT_ACTIONS and abs((bounds[1] + bounds[3]) - median_bottom) > tolerance]
        if drifted:
            return fail(f"ground line drifts on frames {drifted}; keep feet planted at one height in upright poses")

    avail_w = cell - 2 * padding
    avail_h = anchor_y - padding

    atlas = Image.new("RGBA", (columns * cell, rows * cell), (0, 0, 0, 0))
    entries = sorted(frame_map, key=lambda item: item["index"])
    source_frames = []
    frame_records = []
    scales: dict[str, int] = {}
    for entry, (image, (obx, oby, obw, obh)) in zip(entries, sources):
        index = entry["index"]
        factor = max(1, math.ceil(max(obw / avail_w, obh / avail_h)))
        if factor > MAX_DOWNSCALE:
            return fail(f"frame {index:03d}: content {obw}x{obh} needs {factor}x downscale; regenerate it smaller (max {MAX_DOWNSCALE}x)")
        if factor > 1:
            image = image.resize((image.size[0] // factor, image.size[1] // factor), Image.NEAREST)
            if not hard_alpha_only(image):
                return fail(f"frame {index:03d}: downscale introduced semi-transparent pixels")
            again = single_component(qa, image)
            if isinstance(again, str) or again[0] is None:
                return fail(f"frame {index:03d}: downscale broke the pose into pieces")
            obx, oby, obw, obh = again[0]
        bw, bh = obw, obh
        column, row = index % columns, index // columns
        offset_x = anchor_x - bw // 2
        offset_y = anchor_y - bh
        if offset_x < padding or offset_y < padding or offset_x + bw > cell - padding:
            return fail(f"frame {index:03d}: content {bw}x{bh} breaks the {padding}px gutter; regenerate it smaller")
        content = image.crop((obx, oby, obx + bw, oby + bh))
        atlas.paste(content, (column * cell + offset_x, row * cell + offset_y), content)
        x, y = column * cell + offset_x, row * cell + offset_y
        source_frames.append({"x": x, "y": y, "width": bw, "height": bh, "offsetX": offset_x, "offsetY": offset_y})
        source = {"x": x, "y": y, "width": bw, "height": bh}
        frame_records.append({"index": index, "action": entry["action"], "direction": entry["direction"],
                              "frame": 0, "source": source,
                              "frameCanvas": {"width": cell, "height": cell},
                              "anchor": {"x": anchor_x, "y": anchor_y}})
        scales[str(index)] = factor

    ordered = sorted(frame_map, key=lambda item: item["index"])
    by_action: dict[str, list[str]] = {}
    for entry in ordered:
        by_action.setdefault(entry["action"], []).append(entry["direction"])
    meta = dict(base)
    meta.update({
        "status": "draft-review",
        "atlas": "atlas/animation-draft.png",
        "sourceCanvas": {"width": atlas.size[0], "height": atlas.size[1]},
        "frameCanvas": {"width": cell, "height": cell},
        "layout": {"columns": columns, "rows": rows, "cellOrder": "row-major",
                   "sourceCellApprox": {"width": cell, "height": cell},
                   "actionRows": sorted(by_action, key=lambda action: ordered.index(next(item for item in ordered if item["action"] == action))),
                   "directions": by_action,
                   "framesPerDirection": {action: len(set(directions)) for action, directions in by_action.items()},
                   "frameCount": frame_count},
        "frames": frame_records,
        "sourceFrames": source_frames,
        "composition": {"tool": "tools/monster-animation-compose.py", "padding": padding,
                        "anchor": {"x": anchor_x, "y": anchor_y}, "scales": scales},
    })
    meta.pop("file", None)
    for stale in ("quality", "alphaProcessing", "normalization", "runtime"):
        meta.pop(stale, None)

    out_dir = args.out_dir
    if (out_dir / "meta.json").exists() or (out_dir / "atlas" / "animation-draft.png").exists():
        if not args.force:
            return fail("output already exists; pass --force to recompose")
    (out_dir / "atlas").mkdir(parents=True, exist_ok=True)
    meta_path = out_dir / "meta.json"
    image_path = out_dir / "atlas" / "animation-draft.png"
    atlas.save(image_path)
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    result = qa.audit_atlas(meta_path)
    print(json.dumps({"status": "PASS" if not result.issues else "FAIL",
                      "atlas": str(image_path), "frames": result.frame_count, "issues": result.issues}))
    return 0 if not result.issues else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--meta-base", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--map", type=Path, default=None)
    parser.add_argument("--columns", type=int, default=8)
    parser.add_argument("--rows", type=int, default=5)
    parser.add_argument("--cell", type=int, default=384)
    parser.add_argument("--padding", type=int, default=24)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    try:
        qa = load_qa()
    except ValueError as error:
        return fail(str(error))
    return compose(args, qa)


if __name__ == "__main__":
    raise SystemExit(main())
