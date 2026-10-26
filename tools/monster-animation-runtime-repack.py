#!/usr/bin/env python3
"""Recover complete production mob poses and repack them into padded runtime cells.

The source atlas components, rather than the old (possibly truncated) rectangles,
own each pose. Run without arguments to stage and audit all registered mob atlases;
use --write to replace the production pairs transactionally. A write retains its
originals in the printed task temporary directory until live review is complete.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import sys
import tempfile
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
CELL = 384
PADDING = 24
GUARD = 1
COLUMNS = 8
ROWS = 5
FRAMES = COLUMNS * ROWS
BODY_PIXELS = 1000
METHOD = "connected-pose-runtime-repack-v1"
GEOMETRY_KEYS = ("sourceCanvas", "frameCanvas", "anchor", "sourceFrames")


def load_qa() -> Any:
    spec = importlib.util.spec_from_file_location("monster_animation_runtime_qa", ROOT / "tools/monster-animation-qa.py")
    if spec is None or spec.loader is None:
        raise ValueError("cannot load monster animation QA")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def component_cell(runs: list[tuple[int, int, int]], area: int, width: int, height: int) -> int:
    centroid_x = sum((left + right - 1) * (right - left) / 2 for left, right, _ in runs) / area
    centroid_y = sum(y * (right - left) for left, right, y in runs) / area
    return min(ROWS - 1, int(centroid_y * ROWS / height)) * COLUMNS + min(COLUMNS - 1, int(centroid_x * COLUMNS / width))


def matching_canonical(metadata: dict[str, Any], image_path: Path, qa: Any) -> tuple[Path, Path, dict[str, Any]] | None:
    species = image_path.name.split("-animation-")[0]
    candidate = ROOT / "art-reference/monsters" / species / "animation/meta.json"
    if not candidate.is_file():
        return None
    reference = qa.read_json(candidate)
    reference_image = qa.resolve_image(candidate, reference)
    if reference.get("status") != "visual-approved" or reference_image is None:
        return None
    if any(reference.get(key) != metadata.get(key) for key in GEOMETRY_KEYS):
        return None
    if digest(reference_image) != digest(image_path):
        return None
    return candidate, reference_image, reference


def updated_metadata(metadata: dict[str, Any], frames: list[dict[str, int]], anchor: dict[str, int], normalization: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(metadata)
    result["sourceCanvas"] = {"width": COLUMNS * CELL, "height": ROWS * CELL}
    result["frameCanvas"] = {"width": CELL, "height": CELL}
    result["sourceFrames"] = frames
    result["anchor"] = anchor
    result.setdefault("layout", {}).update({
        "columns": COLUMNS, "rows": ROWS, "frameCount": FRAMES,
        "cellOrder": "row-major", "sourceCellApprox": {"width": CELL, "height": CELL},
    })
    for index, frame in enumerate(result.get("frames", [])):
        if index >= FRAMES:
            break
        frame["source"] = {key: frames[index][key] for key in ("x", "y", "width", "height")}
        frame["frameCanvas"] = {"width": CELL, "height": CELL}
        frame["anchor"] = anchor.copy()
    result["normalization"] = normalization
    if "quality" in result:
        result["quality"]["sourceBoundsMethod"] = "isolated-complete-components-with-one-pixel-transparent-guard"
        result["quality"]["notes"] = [
            note.replace("The atlas PNG is unchanged; runtime frame bounds use opaque alpha components with six-pixel padding.",
                         "The runtime atlas now isolates complete poses into padded 384 x 384 cells.")
            for note in result["quality"].get("notes", [])
        ]
    return result


def recover(metadata_path: Path, image_path: Path, temporary: Path, qa: Any) -> dict[str, Any]:
    metadata = qa.read_json(metadata_path)
    original_frames = metadata.get("sourceFrames")
    if metadata.get("frameCanvas") != {"width": CELL, "height": CELL} or not isinstance(original_frames, list) or len(original_frames) != FRAMES:
        raise ValueError(f"{relative(metadata_path)}: expected forty authored 384 x 384 runtime frames")
    canonical = matching_canonical(metadata, image_path, qa)
    staged_metadata = temporary / "staged" / metadata_path.relative_to(ROOT)
    staged_image = temporary / "staged" / image_path.relative_to(ROOT)
    staged_image.parent.mkdir(parents=True, exist_ok=True)

    already_repacked = metadata.get("normalization", {}).get("method") == METHOD
    if already_repacked:
        issues = qa.audit_atlas(metadata_path, runtime_image=image_path).issues
        if issues:
            raise ValueError(f"previously repacked atlas failed QA: {issues[:4]}")
        shutil.copy2(image_path, staged_image)
        staged_metadata.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(metadata_path, staged_metadata)
        result_metadata = metadata
    else:
        with Image.open(image_path) as opened:
            source = opened.convert("RGBA")
        width, height = source.size
        alpha = source.getchannel("A").point(lambda value: int(value >= qa.RUNTIME_ALPHA_THRESHOLD))
        components = qa.opaque_components(alpha.tobytes(), width, height)
        groups: list[list[tuple[int, int, int]]] = [[] for _ in range(FRAMES)]
        bodies = [0] * FRAMES
        for _, area, runs in components:
            cell = component_cell(runs, area, width, height)
            groups[cell].extend(runs)
            if area >= BODY_PIXELS:
                bodies[cell] += 1
        if bodies != [1] * FRAMES:
            raise ValueError(f"{relative(image_path)}: expected one primary body per cell, found {bodies}")

        poses: list[tuple[Image.Image, int, int]] = []
        source_pixels = 0
        for index, runs in enumerate(groups):
            left = min(run[0] for run in runs)
            right = max(run[1] for run in runs)
            top = min(run[2] for run in runs)
            bottom = max(run[2] for run in runs) + 1
            pose = source.crop((left, top, right, bottom))
            mask = bytearray(pose.width * pose.height)
            for x0, x1, y in runs:
                start = (y - top) * pose.width + x0 - left
                mask[start:start + x1 - x0] = b"\xff" * (x1 - x0)
                source_pixels += x1 - x0
            pose.putalpha(Image.frombytes("L", pose.size, bytes(mask)))
            old = original_frames[index]
            poses.append((pose, old["offsetX"] + left - old["x"], old["offsetY"] + top - old["y"]))

        anchor_x, anchor_y = metadata["anchor"]["x"], metadata["anchor"]["y"]
        left = min(x for _, x, _ in poses)
        top = min(y for _, _, y in poses)
        right = max(x + image.width for image, x, _ in poses)
        bottom = max(y + image.height for image, _, y in poses)
        # Reserve one further pixel for independent rounding of origins and sizes.
        content_span = CELL - 2 * PADDING - 1
        scale = min(1.0, content_span / (right - left), content_span / (bottom - top))
        scaled_left = anchor_x + scale * (left - anchor_x)
        scaled_top = anchor_y + scale * (top - anchor_y)
        scaled_right = anchor_x + scale * (right - anchor_x)
        scaled_bottom = anchor_y + scale * (bottom - anchor_y)
        x_low, x_high = math.ceil(PADDING - scaled_left), math.floor(CELL - PADDING - scaled_right)
        y_low, y_high = math.ceil(PADDING - scaled_top), math.floor(CELL - PADDING - scaled_bottom)
        if x_low > x_high or y_low > y_high:
            raise ValueError(f"{relative(image_path)}: cannot fit every complete pose using one scale")
        dx, dy = max(x_low, min(0, x_high)), max(y_low, min(0, y_high))
        atlas = Image.new("RGBA", (COLUMNS * CELL, ROWS * CELL), (0, 0, 0, 0))
        frames = []
        for index, (pose, x, y) in enumerate(poses):
            size = (max(1, round(pose.width * scale)), max(1, round(pose.height * scale)))
            transformed = pose if scale == 1 else pose.resize(size, Image.Resampling.NEAREST)
            offset_x = round(anchor_x + scale * (x - anchor_x)) + dx
            offset_y = round(anchor_y + scale * (y - anchor_y)) + dy
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            # Refuse an overflow before Pillow can silently clip the recovered art.
            if offset_x < PADDING or offset_y < PADDING or offset_x + size[0] > CELL - PADDING or offset_y + size[1] > CELL - PADDING:
                raise ValueError(f"{relative(image_path)} frame {index}: transformed pose exceeds its padded cell")
            cell.paste(transformed, (offset_x, offset_y))
            box = cell.getchannel("A").getbbox()
            if box is None:
                raise ValueError(f"{relative(image_path)} frame {index}: empty transformed pose")
            x0, y0, x1, y1 = box
            cell_x, cell_y = index % COLUMNS * CELL, index // COLUMNS * CELL
            atlas.paste(cell, (cell_x, cell_y))
            frames.append({"x": cell_x + x0 - GUARD, "y": cell_y + y0 - GUARD,
                           "width": x1 - x0 + 2 * GUARD, "height": y1 - y0 + 2 * GUARD,
                           "offsetX": x0 - GUARD, "offsetY": y0 - GUARD})
        atlas.save(staged_image, format="PNG", optimize=True)
        normalization = {
            "method": METHOD, "sourceCanvas": metadata["sourceCanvas"],
            "sourceImageSha256": digest(image_path), "sourceOpaquePixels": source_pixels,
            "sourceAlphaThreshold": qa.RUNTIME_ALPHA_THRESHOLD, "minimumCellPadding": PADDING,
            "sourceCropGuard": GUARD, "primaryBodies": FRAMES, "components": len(components),
            "uniformScale": round(scale, 8), "translation": {"x": dx, "y": dy},
        }
        result_metadata = updated_metadata(metadata, frames, {"x": anchor_x + dx, "y": anchor_y + dy}, normalization)
        write_json(staged_metadata, result_metadata)

    issues = qa.audit_atlas(staged_metadata, runtime_image=staged_image).issues
    if issues:
        raise ValueError(f"{relative(image_path)} staged QA failed: {issues[:8]}")
    replacements = [(staged_image, image_path), (staged_metadata, metadata_path)]
    if canonical:
        reference_path, reference_image, reference = canonical
        canonical_staged = temporary / "staged" / reference_path.relative_to(ROOT)
        replacement_reference = updated_metadata(reference, result_metadata["sourceFrames"], result_metadata["anchor"], result_metadata["normalization"])
        write_json(canonical_staged, replacement_reference)
        canonical_issues = qa.audit_atlas(canonical_staged, runtime_image=staged_image).issues
        if canonical_issues:
            raise ValueError(f"matching canonical metadata failed QA: {canonical_issues[:4]}")
        replacements.extend([(staged_image, reference_image), (canonical_staged, reference_path)])
    return {"metadata": relative(metadata_path), "image": relative(image_path),
            "scale": result_metadata["normalization"]["uniformScale"],
            "canonical": relative(canonical[0]) if canonical else None,
            "alreadyRepacked": already_repacked, "replacements": replacements}


def commit(results: list[dict[str, Any]], temporary: Path, fingerprints: dict[Path, str], qa: Any, pairs: list[tuple[Path, Path]]) -> None:
    replacements = [pair for result in results for pair in result["replacements"]]
    for _, destination in replacements:
        if digest(destination) != fingerprints[destination]:
            raise ValueError(f"source changed during staging: {relative(destination)}")
    backups = {}
    for _, destination in replacements:
        backup = temporary / "originals" / destination.relative_to(ROOT)
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, backup)
        backups[destination] = backup
    replaced: list[Path] = []
    try:
        for staged, destination in replacements:
            # Copy first because one staged PNG also serves a matching canonical image.
            pending = temporary / "pending-replacement"
            shutil.copy2(staged, pending)
            os.replace(pending, destination)
            replaced.append(destination)
        failures = [(relative(metadata), qa.audit_atlas(metadata, runtime_image=image).issues)
                    for metadata, image in pairs]
        failures = [(path, issues) for path, issues in failures if issues]
        if failures:
            raise ValueError(f"post-commit production QA failed: {failures[:3]}")
    except (OSError, ValueError) as error:
        rollback_errors = []
        for destination in reversed(replaced):
            try:
                shutil.copy2(backups[destination], destination)
            except OSError as rollback_error:
                rollback_errors.append(f"{destination}: {rollback_error}")
        raise ValueError(f"transaction rolled back after {error}; rollback errors: {rollback_errors}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="transactionally replace all production mob pairs after every staged atlas passes QA")
    args = parser.parse_args()
    qa = load_qa()
    pairs, errors = qa.runtime_atlases()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    temporary = Path(tempfile.mkdtemp(prefix="mod-idle-runtime-crop-recovery-"))
    try:
        fingerprints = {}
        for metadata_path, image_path in pairs:
            fingerprints.update({metadata_path: digest(metadata_path), image_path: digest(image_path)})
            canonical = matching_canonical(qa.read_json(metadata_path), image_path, qa)
            if canonical:
                fingerprints.update({canonical[0]: digest(canonical[0]), canonical[1]: digest(canonical[1])})
        results = [recover(metadata, image, temporary, qa) for metadata, image in pairs]
        print(f"Staged production QA: {len(results)}/{len(pairs)} atlases pass")
        for result in results:
            print(f"{result['image']}: scale={result['scale']:.6f}; canonical={result['canonical'] or 'preserved distinct reference'}")
        if args.write:
            commit(results, temporary, fingerprints, qa, pairs)
            print(f"Committed {len(results)} production atlases; post-commit production QA: {len(results)}/{len(pairs)} pass")
            print(f"Originals and staged output retained for live review: {temporary}")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        if args.write:
            print(f"Recovery directory retained: {temporary}", file=sys.stderr)
        return 1
    finally:
        if not args.write:
            resolved = temporary.resolve()
            if resolved.parent != Path(tempfile.gettempdir()).resolve() or not resolved.name.startswith("mod-idle-runtime-crop-recovery-"):
                raise ValueError(f"refusing cleanup outside the task temporary directory: {resolved}")
            shutil.rmtree(resolved)


if __name__ == "__main__":
    sys.exit(main())
