#!/usr/bin/env python3
"""Repack recoverable monster animation frames into padded 384 x 384 cells.

The current draft atlases can be flattened without gutters. This tool uses their
authored sourceFrames to recover each complete pose, verifies that opaque pixels
belong to exactly one crop, then repacks the poses into a regular 8 x 5 atlas.
Ambiguous or incomplete crops are reported as regeneration-required and left
untouched. It keeps every result in draft-review status.

Run from the repository root:

    python -B tools/monster-animation-normalize.py
    python -B tools/monster-animation-normalize.py --write
    python -B tools/monster-animation-normalize.py --metadata art-reference/monsters/humanoid/goblin/variants/shaman-goblin/meta.json --write
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
MONSTER_ROOT = ROOT / "art-reference" / "monsters"
COLUMNS = 8
ROWS = 5
FRAME_COUNT = COLUMNS * ROWS
CELL_SIZE = 384
MIN_PADDING = 24
MAX_CONTENT = CELL_SIZE - MIN_PADDING * 2
MIN_UNIFORM_SCALE = 0.85
QA_SCRIPT = Path(__file__).with_name("monster-animation-qa.py")


@dataclass
class NormalizeResult:
    metadata: Path
    disposition: str
    reasons: list[str] = field(default_factory=list)
    scale: float = 1.0
    qa_issues: list[str] = field(default_factory=list)
    staged_metadata: Path | None = None
    staged_image: Path | None = None


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("metadata root must be an object")
    return value


def resolve_image(metadata_path: Path, metadata: dict[str, Any]) -> Path | None:
    declared = metadata.get("file")
    if declared:
        candidate = (metadata_path.parent / str(declared)).resolve()
        if candidate.is_file():
            return candidate
    for relative in (
        "atlas/animation-draft.png",
        "atlas/animation.png",
        "animation-draft.png",
        "animation.png",
    ):
        candidate = metadata_path.parent / relative
        if candidate.is_file():
            return candidate.resolve()
    return None


def load_qa_module():
    spec = importlib.util.spec_from_file_location("monster_animation_qa", QA_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load QA checker: {QA_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def discover_metadata() -> list[Path]:
    return sorted({*MONSTER_ROOT.glob("*/*/variants/*/meta.json"),
                   *MONSTER_ROOT.glob("*/*/variants/*/v*/meta.json")})


def source_bounds(metadata: dict[str, Any]) -> list[tuple[int, int, int, int, int, int]]:
    frames = metadata.get("sourceFrames")
    if not isinstance(frames, list) or len(frames) != FRAME_COUNT:
        raise ValueError(f"metadata must contain {FRAME_COUNT} sourceFrames entries")
    bounds: list[tuple[int, int, int, int, int, int]] = []
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict):
            raise ValueError(f"frame {index:02d}: sourceFrames entry must be an object")
        values = [frame.get(key) for key in ("x", "y", "width", "height", "offsetX", "offsetY")]
        if any(type(value) is not int for value in values):
            raise ValueError(f"frame {index:02d}: source and runtime bounds must be integers")
        x, y, width, height, offset_x, offset_y = values
        if x < 0 or y < 0 or width <= 0 or height <= 0:
            raise ValueError(f"frame {index:02d}: source bounds must be positive")
        bounds.append((x, y, width, height, offset_x, offset_y))
    return bounds


def repair_tiny_orphans(
    alpha: Image.Image,
    frames: list[tuple[int, int, int, int, int, int]],
) -> tuple[list[tuple[int, int, int, int, int, int]] | None, int, int, list[str]]:
    """Assign tiny connected spill to one crop; discard only isolated alpha dust."""
    width, height = alpha.size
    cover = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(cover)
    reasons: list[str] = []
    rects: list[tuple[int, int, int, int]] = []
    for index, (x, y, frame_width, frame_height, _, _) in enumerate(frames):
        right, bottom = x + frame_width, y + frame_height
        if right > width or bottom > height:
            reasons.append(f"frame {index:02d}: source crop exceeds the atlas")
            continue
        rects.append((x, y, right, bottom))
        draw.rectangle((x, y, right - 1, bottom - 1), fill=255)

    if len(rects) != FRAME_COUNT:
        return None, 0, 0, reasons

    uncovered_mask = ImageChops.multiply(alpha, ImageChops.invert(cover))
    uncovered_pixels = [index for index, value in enumerate(uncovered_mask.tobytes()) if value > 0]
    recovered = 0
    discarded = 0
    if uncovered_pixels:
        if len(uncovered_pixels) > 4:
            reasons.append(f"{len(uncovered_pixels)} opaque pixels fall outside all sourceFrames crops (bbox {uncovered_mask.getbbox()})")
            return None, 0, 0, reasons
        expanded_rects = list(rects)
        pending = {pixel: (pixel % width, pixel // width) for pixel in uncovered_pixels}
        assignments: dict[int, int] = {}
        ambiguous: list[int] = []
        discarded_pixels: set[int] = set()
        changed = True
        while pending and changed:
            changed = False
            for pixel, (x, y) in list(pending.items()):
                candidates: set[int] = set()
                has_opaque_neighbor = False
                has_pending_neighbor = False
                for yy in range(max(0, y - 1), min(height, y + 2)):
                    for xx in range(max(0, x - 1), min(width, x + 2)):
                        if xx == x and yy == y:
                            continue
                        neighbor = yy * width + xx
                        if alpha.getpixel((xx, yy)) == 0:
                            continue
                        has_opaque_neighbor = True
                        if neighbor in assignments:
                            candidates.add(assignments[neighbor])
                            continue
                        if neighbor in pending:
                            has_pending_neighbor = True
                            continue
                        for frame_index, (x0, y0, x1, y1) in enumerate(rects):
                            if x0 <= xx < x1 and y0 <= yy < y1:
                                candidates.add(frame_index)
                if len(candidates) == 1:
                    assignments[pixel] = next(iter(candidates))
                    del pending[pixel]
                    changed = True
                elif len(candidates) > 1:
                    ambiguous.append(pixel)
                    del pending[pixel]
                    changed = True
                elif not has_opaque_neighbor and not has_pending_neighbor:
                    # The prompt forbids detached effects/background specks, so
                    # isolated 1–4px components are safe alpha-dust cleanup.
                    discarded += 1
                    discarded_pixels.add(pixel)
                    del pending[pixel]
                    changed = True
        if pending or ambiguous:
            pixel = next(iter(pending or {p: None for p in ambiguous}))
            x, y = pixel % width, pixel // width
            reasons.append(f"orphan alpha pixel ({x},{y}) is attached ambiguously or has no frame owner")
            return None, recovered, discarded, reasons

        for pixel, frame_index in assignments.items():
            x, y = pixel % width, pixel // width
            x0, y0, x1, y1 = expanded_rects[frame_index]
            expanded_rects[frame_index] = (min(x0, x), min(y0, y), max(x1, x + 1), max(y1, y + 1))
            recovered += 1
        rects = expanded_rects
        cover = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(cover)
        for x0, y0, x1, y1 in rects:
            draw.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
        uncovered = ImageChops.multiply(alpha, ImageChops.invert(cover)).getbbox()
        if uncovered is not None:
            remaining_data = ImageChops.multiply(alpha, ImageChops.invert(cover)).tobytes()
            remaining_pixels = {index for index, value in enumerate(remaining_data) if value > 0}
            if remaining_pixels - discarded_pixels:
                reasons.append(f"opaque pixels remain outside sourceFrames crops after speck recovery (bbox {uncovered})")
                return None, recovered, discarded, reasons

    overlapping_pairs = 0
    for index, (x0, y0, x1, y1) in enumerate(rects):
        for other in range(index + 1, len(rects)):
            ox0, oy0, ox1, oy1 = rects[other]
            ix0, iy0, ix1, iy1 = max(x0, ox0), max(y0, oy0), min(x1, ox1), min(y1, oy1)
            if ix0 < ix1 and iy0 < iy1 and alpha.crop((ix0, iy0, ix1, iy1)).getbbox() is not None:
                overlapping_pairs += 1
    if overlapping_pairs:
        reasons.append(f"opaque pixels occur in overlapping sourceFrames crops ({overlapping_pairs} pairs)")
    if reasons:
        return None, recovered, discarded, reasons

    updated = [
        (rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1], *frames[index][4:])
        for index, rect in enumerate(rects)
    ]
    return updated, recovered, discarded, reasons


def normalize_one(metadata_path: Path, stage_root: Path, qa: Any) -> NormalizeResult:
    metadata_path = metadata_path.resolve()
    try:
        metadata = read_json(metadata_path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return NormalizeResult(metadata_path, "error", [f"cannot read metadata: {error}"])
    if metadata.get("status") != "draft-review":
        return NormalizeResult(metadata_path, "skipped", [f"status is {metadata.get('status')!r}, not 'draft-review'"])
    image_path = resolve_image(metadata_path, metadata)
    if image_path is None:
        return NormalizeResult(metadata_path, "error", ["no animation atlas PNG was found"])

    layout = metadata.get("layout") or {}
    if (layout.get("columns", COLUMNS), layout.get("rows", ROWS)) != (COLUMNS, ROWS):
        return NormalizeResult(metadata_path, "error", [f"layout must be {COLUMNS} x {ROWS}"])
    frame_canvas = metadata.get("frameCanvas") or {}
    if (frame_canvas.get("width"), frame_canvas.get("height")) != (CELL_SIZE, CELL_SIZE):
        return NormalizeResult(metadata_path, "error", [f"frameCanvas must be {CELL_SIZE} x {CELL_SIZE}"])
    try:
        frames = source_bounds(metadata)
        with Image.open(image_path) as opened:
            source = opened.convert("RGBA")
    except (OSError, ValueError) as error:
        return NormalizeResult(metadata_path, "error", [f"cannot read source atlas: {error}"])

    source_canvas = metadata.get("sourceCanvas") or {}
    if (source_canvas.get("width"), source_canvas.get("height")) != source.size:
        return NormalizeResult(metadata_path, "error", [f"sourceCanvas differs from PNG dimensions {source.size}"])

    alpha_settings = metadata.get("alphaProcessing") or {}
    threshold = alpha_settings.get("threshold", 200)
    if type(threshold) is not int or not 0 <= threshold <= 255:
        threshold = 200
    alpha = source.getchannel("A").point(lambda value: 255 if value >= threshold else 0)
    hard_source = source.copy()
    hard_source.putalpha(alpha)

    frames, recovered_orphans, discarded_specks, ownership_reasons = repair_tiny_orphans(alpha, frames)
    if frames is None:
        return NormalizeResult(metadata_path, "needs-regeneration", ownership_reasons)

    contents: list[dict[str, Any]] = []
    for index, (x, y, width, height, offset_x, offset_y) in enumerate(frames):
        crop = hard_source.crop((x, y, x + width, y + height))
        box = crop.getchannel("A").getbbox()
        if box is None:
            return NormalizeResult(metadata_path, "needs-regeneration", [f"frame {index:02d}: source crop is empty after alpha normalization"])
        trimmed = crop.crop(box)
        contents.append({
            "image": trimmed,
            "x": offset_x + box[0],
            "y": offset_y + box[1],
            "width": trimmed.width,
            "height": trimmed.height,
        })

    # Atlas art must remain complete when fitted to one runtime cell. Frames over
    # the native cell size need an art revision rather than a silent global shrink.
    oversize = [
        (index, item["width"], item["height"])
        for index, item in enumerate(contents)
        if item["width"] > CELL_SIZE or item["height"] > CELL_SIZE
    ]
    if oversize:
        details = ", ".join(f"{index:02d}:{width}x{height}" for index, width, height in oversize)
        return NormalizeResult(metadata_path, "needs-regeneration", [f"frames exceed the runtime cell and require art revision ({details})"])

    anchor = metadata.get("anchor") or {}
    anchor_x, anchor_y = anchor.get("x"), anchor.get("y")
    if type(anchor_x) is not int or type(anchor_y) is not int:
        return NormalizeResult(metadata_path, "error", ["anchor must contain integer x and y"])

    left = min(item["x"] for item in contents)
    top = min(item["y"] for item in contents)
    right = max(item["x"] + item["width"] for item in contents)
    bottom = max(item["y"] + item["height"] for item in contents)
    scale = min(1.0, MAX_CONTENT / max(1, right - left), MAX_CONTENT / max(1, bottom - top))
    if scale < MIN_UNIFORM_SCALE:
        return NormalizeResult(metadata_path, "needs-regeneration", [f"uniform scale {scale:.3f} would materially change sprite size"])

    scaled_left = anchor_x + scale * (left - anchor_x)
    scaled_right = anchor_x + scale * (right - anchor_x)
    dx = MIN_PADDING - scaled_left if scaled_left < MIN_PADDING else CELL_SIZE - MIN_PADDING - scaled_right if scaled_right > CELL_SIZE - MIN_PADDING else 0.0
    scaled_top = anchor_y + scale * (top - anchor_y)
    scaled_bottom = anchor_y + scale * (bottom - anchor_y)
    dy = CELL_SIZE - MIN_PADDING - scaled_bottom if scaled_bottom > CELL_SIZE - MIN_PADDING else MIN_PADDING - scaled_top if scaled_top < MIN_PADDING else 0.0

    new_anchor_x = round(anchor_x + dx)
    new_anchor_y = round(anchor_y + dy)
    output = Image.new("RGBA", (COLUMNS * CELL_SIZE, ROWS * CELL_SIZE), (0, 0, 0, 0))
    normalized_frames: list[dict[str, int]] = []
    for index, item in enumerate(contents):
        width = max(1, round(item["width"] * scale))
        height = max(1, round(item["height"] * scale))
        offset_x = round(anchor_x + scale * (item["x"] - anchor_x) + dx)
        offset_y = round(anchor_y + scale * (item["y"] - anchor_y) + dy)
        if offset_x < MIN_PADDING or offset_y < MIN_PADDING or offset_x + width > CELL_SIZE - MIN_PADDING or offset_y + height > CELL_SIZE - MIN_PADDING:
            output.close()
            return NormalizeResult(metadata_path, "needs-regeneration", [f"frame {index:02d}: cannot place complete pose with required padding"])
        resized = item["image"] if scale == 1.0 else item["image"].resize((width, height), Image.Resampling.NEAREST)
        column, row = index % COLUMNS, index // COLUMNS
        output.alpha_composite(resized, (column * CELL_SIZE + offset_x, row * CELL_SIZE + offset_y))
        normalized_frames.append({
            "x": column * CELL_SIZE + offset_x,
            "y": row * CELL_SIZE + offset_y,
            "width": width,
            "height": height,
            "offsetX": offset_x,
            "offsetY": offset_y,
        })

    staged_dir = stage_root / metadata_path.parent.relative_to(MONSTER_ROOT)
    staged_dir.mkdir(parents=True, exist_ok=True)
    staged_meta = staged_dir / metadata_path.name
    image_rel = str(metadata.get("file", "atlas/animation-draft.png"))
    staged_image = staged_dir / image_rel
    staged_image.parent.mkdir(parents=True, exist_ok=True)
    output.save(staged_image, format="PNG", optimize=True)

    normalized = json.loads(json.dumps(metadata))
    normalized["sourceCanvas"] = {"width": COLUMNS * CELL_SIZE, "height": ROWS * CELL_SIZE}
    normalized["sourceFrames"] = normalized_frames
    normalized["anchor"] = {"x": new_anchor_x, "y": new_anchor_y}
    layout = normalized.setdefault("layout", {})
    layout.update({"columns": COLUMNS, "rows": ROWS, "frameCount": FRAME_COUNT, "cellOrder": "row-major"})
    layout["sourceCellApprox"] = {"width": CELL_SIZE, "height": CELL_SIZE}
    for index, frame in enumerate(normalized.get("frames", [])):
        if index >= FRAME_COUNT:
            break
        frame["source"] = {key: normalized_frames[index][key] for key in ("x", "y", "width", "height")}
        frame["frameCanvas"] = {"width": CELL_SIZE, "height": CELL_SIZE}
        frame["anchor"] = {"x": new_anchor_x, "y": new_anchor_y}
    normalized["normalization"] = {
        "method": "sourceFrames-repack-v2",
        "sourceCanvas": source_canvas,
        "uniformScale": round(scale, 6),
        "translation": {"x": round(dx, 3), "y": round(dy, 3)},
        "recoveredIsolatedAlphaPixels": recovered_orphans,
        "discardedIsolatedAlphaDust": discarded_specks,
        "status": "draft-review",
    }
    quality = normalized.setdefault("quality", {})
    quality["nativePixelArtApproved"] = False
    notes = quality.setdefault("notes", [])
    note = "Repacked from uniquely assigned sourceFrames into 384 x 384 review cells with at least 24 px clear padding on each edge; visual review remains pending."
    if note not in notes:
        notes.append(note)
    staged_meta.write_text(json.dumps(normalized, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    result = qa.audit_atlas(staged_meta)
    if result.issues:
        return NormalizeResult(metadata_path, "qa-fail", [], scale, result.issues, staged_meta, staged_image)
    disposition = "repacked" if scale == 1.0 and dx == 0 and dy == 0 else "repacked-and-normalized"
    return NormalizeResult(metadata_path, disposition, [], scale, [], staged_meta, staged_image)


def commit_results(results: list[NormalizeResult], temp_root: Path) -> tuple[int, list[str]]:
    ready = [result for result in results if result.disposition in {"repacked", "repacked-and-normalized"}]
    backup_root = temp_root / "backup"
    staged_root = temp_root / "staged"
    replacements: list[tuple[Path, Path, Path]] = []
    for result in ready:
        assert result.staged_metadata and result.staged_image
        original_metadata = result.metadata
        original_image = resolve_image(original_metadata, read_json(original_metadata))
        if original_image is None:
            return 0, [f"{original_metadata}: original atlas disappeared before commit"]
        try:
            image_rel = Path(read_json(result.staged_metadata).get("file", "atlas/animation-draft.png"))
            staged_image = result.staged_metadata.parent / image_rel
        except (OSError, json.JSONDecodeError, TypeError) as error:
            return 0, [f"{result.metadata}: cannot read staged file mapping: {error}"]
        if not staged_image.is_file():
            return 0, [f"{result.metadata}: staged atlas is missing"]
        relative_dir = original_metadata.parent.relative_to(ROOT)
        backup_dir = backup_root / relative_dir
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original_metadata, backup_dir / original_metadata.name)
        shutil.copy2(original_image, backup_dir / original_image.name)
        replacements.append((staged_image, original_image, backup_dir / original_image.name))
        replacements.append((result.staged_metadata, original_metadata, backup_dir / original_metadata.name))

    committed: list[tuple[Path, Path]] = []
    try:
        for staged, destination, backup in replacements:
            os.replace(staged, destination)
            committed.append((destination, backup))
    except OSError as error:
        rollback_errors: list[str] = []
        for destination, backup in reversed(committed):
            try:
                shutil.copy2(backup, destination)
            except OSError as rollback_error:
                rollback_errors.append(f"{destination}: {rollback_error}")
        details = [f"commit failed: {error}"] + [f"rollback failed: {item}" for item in rollback_errors]
        return 0, details
    return len(ready), []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", nargs="+", type=Path, help="variant metadata paths; defaults to all draft-review variants")
    parser.add_argument("--write", action="store_true", help="replace recoverable draft atlases and metadata in place")
    parser.add_argument("--json", action="store_true", help="emit a machine-readable result")
    args = parser.parse_args(argv)

    if args.metadata:
        metadata_paths = [path if path.is_absolute() else ROOT / path for path in args.metadata]
    else:
        metadata_paths = discover_metadata()

    qa = load_qa_module()
    with tempfile.TemporaryDirectory(prefix="mod-idle-monster-normalize-") as temporary:
        temp_root = Path(temporary)
        stage_root = temp_root / "staged"
        results = [normalize_one(path, stage_root, qa) for path in metadata_paths]
        committed = 0
        commit_errors: list[str] = []
        if args.write:
            committed, commit_errors = commit_results(results, temp_root)

        summary: dict[str, Any] = {
            "schemaVersion": 1,
            "write": args.write,
            "variants": len(results),
            "summary": {},
            "committed": committed,
            "commitErrors": commit_errors,
            "results": [
                {
                    "metadata": result.metadata.resolve().relative_to(ROOT).as_posix(),
                    "disposition": result.disposition,
                    "scale": round(result.scale, 6),
                    "reasons": result.reasons,
                    "qaIssues": result.qa_issues,
                }
                for result in results
            ],
        }
        for result in results:
            summary["summary"][result.disposition] = summary["summary"].get(result.disposition, 0) + 1
        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            print(f"Monster variant normalization: {summary['variants']} selected; write={args.write}; committed={committed}")
            for disposition, count in sorted(summary["summary"].items()):
                print(f"  {disposition}: {count}")
            for result in results:
                if result.disposition not in {"repacked", "repacked-and-normalized"}:
                    print(f"{result.disposition.upper()} {result.metadata.resolve().relative_to(ROOT).as_posix()}")
                    for issue in result.reasons[:8] + result.qa_issues[:8]:
                        print(f"  - {issue}")
            for error in commit_errors:
                print(f"COMMIT ERROR {error}")

        failures = sum(result.disposition not in {"repacked", "repacked-and-normalized", "skipped"} for result in results)
        return 1 if failures or commit_errors else 0


if __name__ == "__main__":
    sys.exit(main())
