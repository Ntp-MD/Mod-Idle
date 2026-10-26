#!/usr/bin/env python3
"""Restore monster atlases from their original generated PNGs.

The old 256-cell atlases may already have lost pixels at their frame bounds.
This tool starts from generation.sourceOutputs, isolates the forty main poses
from raw alpha, restores nearby fragments, grounds each action row by its
median pose bottom, and stages 384 x 384 review/runtime cells.

Run from the repository root. Without --write it stages and audits the result;
--write replaces the selected art and runtime pairs transactionally.
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
import statistics
import sys
import tempfile
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
MONSTER_ROOT = ROOT / "art-reference/monsters"
ROSTER_PATH = MONSTER_ROOT / "production-roster.json"
RUNTIME_REGISTRY = ROOT / "game/src/ui/combat/arena/arena-art-pixel-v2.ts"
CELL = 384
PADDING = 24
EDGE_RADIUS = 3
COMPONENT_THRESHOLD = 128
MIN_POSE_AREA = 1000
MIN_FRAGMENT_AREA = 16
MAX_FRAGMENT_GAP = 64
COLUMNS = 8
ROWS = 5
FRAMES = COLUMNS * ROWS
ANCHOR = {"x": 192, "y": 288}
METHOD = "raw-connected-pose-repack-384-v1"


def load_qa() -> Any:
    spec = importlib.util.spec_from_file_location("monster_animation_raw_qa", ROOT / "tools/monster-animation-qa.py")
    if spec is None or spec.loader is None:
        raise ValueError("cannot load monster animation QA")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def metadata_source_path(metadata: dict[str, Any], generated_root: Path, by_name: dict[str, list[Path]]) -> Path:
    outputs = (metadata.get("generation") or {}).get("sourceOutputs")
    if not isinstance(outputs, list) or not outputs or any(not isinstance(name, str) for name in outputs):
        raise ValueError("metadata must identify its original generation.sourceOutputs image")
    resolved = []
    for output in outputs:
        name = Path(output).name
        candidates = by_name.get(name, [])
        if len(candidates) > 1:
            raise ValueError(f"raw source {name!r} resolved to {len(candidates)} files under {generated_root}")
        if candidates:
            resolved.append(candidates[0])
    if not resolved:
        raise ValueError(f"none of the generation.sourceOutputs images exist under {generated_root}")
    # sourceOutputs are chronological; when a retry exists the last available
    # output is the final authored source, as in the Juggernaut Orc atlas.
    return resolved[-1]


def component_center(component: Any, area: int, runs: list[tuple[int, int, int]]) -> tuple[float, float]:
    center_x = sum((left + right - 1) * (right - left) / 2 for left, right, _ in runs) / area
    center_y = sum(y * (right - left) for left, right, y in runs) / area
    return center_x, center_y


def cell_for_center(center_x: float, center_y: float, width: int, height: int) -> int:
    column = min(COLUMNS - 1, max(0, int(center_x * COLUMNS / width)))
    row = min(ROWS - 1, max(0, int(center_y * ROWS / height)))
    return row * COLUMNS + column


def distance_between(first: Any, second: Any) -> float:
    dx = max(0, first.x - second.right, second.x - first.right)
    dy = max(0, first.y - second.bottom, second.y - first.bottom)
    return math.hypot(dx, dy)


def make_component_runs_mask(size: tuple[int, int], components: list[Any]) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for component in components:
        for left, right, y in component["runs"]:
            draw.line((left, y, right - 1, y), fill=255)
    return mask


def component_mask_bounds(components: list[Any], width: int, height: int, padding: int) -> tuple[int, int, int, int]:
    return (
        max(0, min(component["bounds"].x for component in components) - padding),
        max(0, min(component["bounds"].y for component in components) - padding),
        min(width, max(component["bounds"].right for component in components) + padding),
        min(height, max(component["bounds"].bottom for component in components) + padding),
    )


def make_local_component_mask(bounds: tuple[int, int, int, int], components: list[Any]) -> Image.Image:
    left, top, right, bottom = bounds
    mask = Image.new("L", (right - left, bottom - top), 0)
    draw = ImageDraw.Draw(mask)
    for component in components:
        for x0, x1, y in component["runs"]:
            draw.line((x0 - left, y - top, x1 - left - 1, y - top), fill=255)
    return mask


def assign_pose_components(source: Image.Image, qa: Any) -> tuple[list[list[Any]], list[int], int]:
    width, height = source.size
    binary_alpha = source.getchannel("A").point(lambda value: 1 if value >= COMPONENT_THRESHOLD else 0)
    components = []
    for bounds, area, runs in qa.opaque_components(binary_alpha.tobytes(), width, height):
        center_x, center_y = component_center(bounds, area, runs)
        components.append({
            "bounds": bounds,
            "area": area,
            "runs": runs,
            "centerX": center_x,
            "centerY": center_y,
            "cell": cell_for_center(center_x, center_y, width, height),
        })

    large = [component for component in components if component["area"] >= MIN_POSE_AREA]
    if len(large) < FRAMES:
        raise ValueError(f"only {len(large)} primary pose components found; expected at least {FRAMES}")
    primary = sorted(large, key=lambda component: component["area"], reverse=True)[:FRAMES]
    groups: list[list[Any] | None] = [None] * FRAMES
    for component in primary:
        index = component["cell"]
        if groups[index] is not None:
            groups = [None] * FRAMES
            break
        groups[index] = [component]

    if any(group is None for group in groups):
        # Some atlases place a full row below the nominal grid seam. The raw
        # bottoms form five clear action bands even when centroids do not.
        ordered = sorted(primary, key=lambda component: component["bounds"].bottom)
        groups = [None] * FRAMES
        for row in range(ROWS):
            row_components = sorted(ordered[row * COLUMNS:(row + 1) * COLUMNS], key=lambda component: component["centerX"])
            if len(row_components) != COLUMNS:
                raise ValueError("raw pose components do not separate into five rows of eight")
            for column, component in enumerate(row_components):
                groups[row * COLUMNS + column] = [component]
    if any(group is None for group in groups):
        raise ValueError("could not assign exactly one primary pose to every frame")

    for component in components:
        if component in primary or component["area"] < MIN_FRAGMENT_AREA:
            continue
        # A detached flash, bubble, weapon end, or ground fragment belongs to
        # the closest main pose. High-area extras in a unique authored cell
        # stay with that cell; this keeps effects such as muzzle flashes.
        target = component["cell"]
        if component["area"] >= MIN_POSE_AREA and len(groups[target] or []) == 1:
            groups[target].append(component)
            continue
        nearest_index = min(
            range(FRAMES),
            key=lambda index: (
                distance_between(component["bounds"], groups[index][0]["bounds"]),
                (component["centerX"] - groups[index][0]["centerX"]) ** 2
                + (component["centerY"] - groups[index][0]["centerY"]) ** 2,
            ),
        )
        if distance_between(component["bounds"], groups[nearest_index][0]["bounds"]) <= MAX_FRAGMENT_GAP:
            groups[nearest_index].append(component)

    finalized = [group or [] for group in groups]
    if any(not group for group in finalized):
        raise ValueError("a frame has no primary pose after component assignment")
    row_bottoms = [
        round(statistics.median(
            finalized[row * COLUMNS + column][0]["bounds"].bottom
            for column in range(COLUMNS)
        ))
        for row in range(ROWS)
    ]
    return finalized, row_bottoms, len(components)


def fit_scale(poses: list[tuple[Image.Image, int, int, int]]) -> float:
    scale = 1.0
    for pose, column, row, row_bottom in poses:
        box = pose.getchannel("A").getbbox()
        if box is None:
            continue
        raw_cell_center = (column + 0.5) * pose.info["rawWidth"] / COLUMNS
        left = box[0] + pose.info["sourceLeft"] - raw_cell_center
        right = box[2] + pose.info["sourceLeft"] - raw_cell_center
        top = box[1] + pose.info["sourceTop"] - row_bottom
        bottom = box[3] + pose.info["sourceTop"] - row_bottom
        if left < 0:
            scale = min(scale, (ANCHOR["x"] - PADDING) / -left)
        if right > 0:
            scale = min(scale, (CELL - PADDING - ANCHOR["x"]) / right)
        if top < 0:
            scale = min(scale, (ANCHOR["y"] - PADDING) / -top)
        if bottom > 0:
            scale = min(scale, (CELL - PADDING - ANCHOR["y"]) / bottom)
    return max(0.01, min(1.0, scale))


def recover_image(metadata: dict[str, Any], source_path: Path, qa: Any) -> tuple[Image.Image, list[dict[str, int]], dict[str, Any]]:
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    source_width, source_height = source.size
    source_alpha = source.getchannel("A")
    groups, row_bottoms, component_count = assign_pose_components(source, qa)
    all_components = [component for group in groups for component in group]
    high_union = make_component_runs_mask(source.size, all_components)

    poses: list[tuple[Image.Image, int, int, int]] = []
    for index, group in enumerate(groups):
        column, row = index % COLUMNS, index // COLUMNS
        mask_bounds = component_mask_bounds(group, source_width, source_height, EDGE_RADIUS)
        high_mask = make_local_component_mask(mask_bounds, group)
        expanded_mask = high_mask.filter(ImageFilter.MaxFilter(EDGE_RADIUS * 2 + 1))
        union_crop = high_union.crop(mask_bounds)
        low_alpha = ImageChops.subtract(expanded_mask, union_crop)
        keep = ImageChops.lighter(high_mask, low_alpha)
        final_alpha = ImageChops.multiply(source_alpha.crop(mask_bounds), keep)
        box = final_alpha.getbbox()
        if box is None:
            raise ValueError(f"frame {index:02d} lost all alpha while recovering source components")
        pose = source.crop(mask_bounds).crop(box)
        pose.putalpha(final_alpha.crop(box))
        pose.info.update({
            "sourceLeft": mask_bounds[0] + box[0],
            "sourceTop": mask_bounds[1] + box[1],
            "rawWidth": source_width,
        })
        poses.append((pose, column, row, row_bottoms[row]))

    scale = fit_scale(poses)
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * ROWS), (0, 0, 0, 0))
    source_frames: list[dict[str, int]] = []
    clearances: list[int] = []
    for index, (pose, column, row, row_bottom) in enumerate(poses):
        source_left = pose.info["sourceLeft"]
        source_top = pose.info["sourceTop"]
        raw_cell_center = (column + 0.5) * source_width / COLUMNS
        offset_x = round(ANCHOR["x"] + scale * (source_left - raw_cell_center))
        offset_y = round(ANCHOR["y"] + scale * (source_top - row_bottom))
        size = (max(1, round(pose.width * scale)), max(1, round(pose.height * scale)))
        transformed = pose if scale == 1 else pose.resize(size, Image.Resampling.NEAREST)
        if (offset_x < PADDING or offset_y < PADDING
                or offset_x + size[0] > CELL - PADDING or offset_y + size[1] > CELL - PADDING):
            raise ValueError(f"frame {index:02d} complete pose cannot fit in its padded 384 x 384 cell")
        cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        cell.alpha_composite(transformed, (offset_x, offset_y))
        cell_x, cell_y = column * CELL, row * CELL
        atlas.alpha_composite(cell, (cell_x, cell_y))
        box = cell.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"frame {index:02d} became empty in the output atlas")
        x0, y0, x1, y1 = box
        guard = 1
        source_frames.append({
            "x": cell_x + x0 - guard,
            "y": cell_y + y0 - guard,
            "width": x1 - x0 + 2 * guard,
            "height": y1 - y0 + 2 * guard,
            "offsetX": x0 - guard,
            "offsetY": y0 - guard,
        })
        clearances.append(min(x0, y0, CELL - x1, CELL - y1))

    normalization = {
        "method": METHOD,
        "sourceCanvas": {"width": source_width, "height": source_height},
        "sourceImageSha256": digest(source_path),
        "sourceAlphaThreshold": COMPONENT_THRESHOLD,
        "edgeAlphaRecoveryRadius": EDGE_RADIUS,
        "minimumCellPadding": PADDING,
        "primaryPoses": FRAMES,
        "sourceComponents": component_count,
        "rowMedianBottoms": row_bottoms,
        "uniformScale": round(scale, 8),
    }
    if min(clearances) < PADDING:
        raise ValueError(f"staged art leaves only {min(clearances)} px of cell padding")
    return atlas, source_frames, normalization


def updated_metadata(metadata: dict[str, Any], source_frames: list[dict[str, int]],
                     normalization: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(metadata)
    result["sourceCanvas"] = {"width": CELL * COLUMNS, "height": CELL * ROWS}
    result["frameCanvas"] = {"width": CELL, "height": CELL}
    result["anchor"] = ANCHOR.copy()
    result["sourceFrames"] = source_frames
    result.setdefault("layout", {}).update({
        "columns": COLUMNS,
        "rows": ROWS,
        "frameCount": FRAMES,
        "cellOrder": "row-major",
        "sourceCellApprox": {"width": CELL, "height": CELL},
    })
    for index, frame in enumerate(result.get("frames", [])):
        if index >= FRAMES:
            break
        frame["source"] = {key: source_frames[index][key] for key in ("x", "y", "width", "height")}
        frame["frameCanvas"] = {"width": CELL, "height": CELL}
        frame["anchor"] = ANCHOR.copy()
    result["normalization"] = normalization
    result["alphaProcessing"] = {
        "threshold": COMPONENT_THRESHOLD,
        "method": "raw-component-ownership-with-original-alpha-preserved",
        "edgeRecoveryRadius": EDGE_RADIUS,
        "rawGeneratorOutputPreserved": True,
    }
    if "quality" in result:
        result["quality"]["nativePixelArtApproved"] = result.get("status") == "visual-approved"
        result["quality"]["notes"] = [
            note for note in result["quality"].get("notes", [])
            if "256 x 256 review cells" not in note and "sourceFrames" not in note
        ]
        result["quality"]["notes"].append(
            "Recovered complete pose components from the original generated atlas into padded 384 x 384 cells; visual review status is unchanged."
        )
    return result


def stage_one(metadata_path: Path, image_path: Path, raw_path: Path, stage_root: Path,
              qa: Any, *, runtime_image_path: Path | None = None,
              runtime_metadata_path: Path | None = None) -> dict[str, Any]:
    metadata = qa.read_json(metadata_path)
    atlas, frames, normalization = recover_image(metadata, raw_path, qa)
    stage_image = stage_root / image_path.relative_to(ROOT)
    stage_metadata = stage_root / metadata_path.relative_to(ROOT)
    stage_image.parent.mkdir(parents=True, exist_ok=True)
    stage_metadata.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(stage_image, format="PNG")
    updated = updated_metadata(metadata, frames, normalization)
    write_json(stage_metadata, updated)
    issues = qa.audit_atlas(stage_metadata).issues
    if issues:
        raise ValueError(f"{relative(metadata_path)} staged QA failed: {issues[:8]}")
    result = {
        "metadata": metadata_path,
        "image": image_path,
        "stagedMetadata": stage_metadata,
        "stagedImage": stage_image,
        "replacements": [(stage_metadata, metadata_path), (stage_image, image_path)],
        "runtimePair": None,
        "normalization": normalization,
    }
    if runtime_image_path is not None and runtime_metadata_path is not None:
        runtime_metadata = qa.read_json(runtime_metadata_path)
        runtime_updated = updated_metadata(runtime_metadata, frames, normalization)
        stage_runtime_metadata = stage_root / runtime_metadata_path.relative_to(ROOT)
        stage_runtime_image = stage_root / runtime_image_path.relative_to(ROOT)
        stage_runtime_metadata.parent.mkdir(parents=True, exist_ok=True)
        stage_runtime_image.parent.mkdir(parents=True, exist_ok=True)
        write_json(stage_runtime_metadata, runtime_updated)
        shutil.copy2(stage_image, stage_runtime_image)
        runtime_issues = qa.audit_atlas(stage_runtime_metadata, runtime_image=stage_runtime_image).issues
        if runtime_issues:
            raise ValueError(f"{relative(runtime_metadata_path)} staged runtime QA failed: {runtime_issues[:8]}")
        result["runtimePair"] = (stage_runtime_metadata, runtime_metadata_path, stage_runtime_image, runtime_image_path)
        result["replacements"].extend([
            (stage_runtime_metadata, runtime_metadata_path),
            (stage_runtime_image, runtime_image_path),
        ])
    return result


def commit(results: list[dict[str, Any]], temporary: Path, fingerprints: dict[Path, str],
           qa: Any, pairs: list[tuple[Path, Path | None]]) -> None:
    replacements = [pair for result in results for pair in result["replacements"]]
    for _, destination in replacements:
        if digest(destination) != fingerprints[destination]:
            raise ValueError(f"source changed while staging: {relative(destination)}")
    backups: dict[Path, Path] = {}
    for _, destination in replacements:
        backup = temporary / "originals" / destination.relative_to(ROOT)
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, backup)
        backups[destination] = backup
    replaced: list[Path] = []
    try:
        for staged, destination in replacements:
            pending = temporary / "pending-replacement"
            shutil.copy2(staged, pending)
            os.replace(pending, destination)
            replaced.append(destination)
        failures = [
            (relative(metadata), qa.audit_atlas(metadata, runtime_image=image).issues if image else qa.audit_atlas(metadata).issues)
            for metadata, image in pairs
        ]
        failures = [(path, issues) for path, issues in failures if issues]
        if failures:
            raise ValueError(f"post-write atlas QA failed: {failures[:4]}")
    except (OSError, ValueError, KeyboardInterrupt) as error:
        rollback_errors = []
        for destination in reversed(replaced):
            try:
                shutil.copy2(backups[destination], destination)
            except OSError as rollback_error:
                rollback_errors.append(f"{destination}: {rollback_error}")
        raise ValueError(f"transaction rolled back after {error}; rollback errors: {rollback_errors}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="replace all staged review and runtime atlases after QA")
    parser.add_argument("--runtime-only", action="store_true", help="stage only atlases loaded by the runtime registry")
    parser.add_argument("--source-dir", type=Path, default=Path.home() / ".codex/generated_images",
                        help="Codex generated-images directory")
    args = parser.parse_args()
    generated_root = args.source_dir.resolve()
    if not generated_root.is_dir():
        print(f"generated-images directory not found: {generated_root}", file=sys.stderr)
        return 1
    qa = load_qa()
    raw_by_name: dict[str, list[Path]] = {}
    for path in generated_root.glob("**/*.png"):
        raw_by_name.setdefault(path.name, []).append(path.resolve())

    runtime_pairs, errors = qa.runtime_atlases()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    runtime_by_species = {
        metadata.stem.rsplit("-animation-", 1)[0]: (metadata, image)
        for metadata, image in runtime_pairs
    }
    roster = qa.read_json(ROSTER_PATH)
    species = roster["productionAnimationBatch"]["species"]
    supplemental_species = roster["productionContract"].get("runtimeSupplementalSpecies", [])
    runtime_species = list(dict.fromkeys([*species, *supplemental_species]))
    variant_metadata = sorted(MONSTER_ROOT.glob("*/variants/*/meta.json"))
    selected_variants = [] if args.runtime_only else variant_metadata
    requests = [(path, None, None) for path in selected_variants]
    production_metadata = []
    for species_id in runtime_species:
        metadata_path = MONSTER_ROOT / species_id / "animation/meta.json"
        pair = runtime_by_species.get(species_id)
        if not metadata_path.is_file() or pair is None:
            print(f"production art pair missing for {species_id}", file=sys.stderr)
            return 1
        production_metadata.append(metadata_path)
        requests.append((metadata_path, pair[0], pair[1]))

    fingerprints: dict[Path, str] = {}
    temporary = Path(tempfile.mkdtemp(prefix="mod-idle-monster-raw-restore-"))
    stage_root = temporary / "staged"
    results = []
    try:
        for index, (metadata_path, runtime_metadata_path, runtime_image_path) in enumerate(requests, start=1):
            metadata = qa.read_json(metadata_path)
            raw_path = metadata_source_path(metadata, generated_root, raw_by_name)
            image_path = qa.resolve_image(metadata_path, metadata)
            if image_path is None:
                raise ValueError(f"{relative(metadata_path)} has no atlas PNG")
            targets = [metadata_path, image_path]
            if runtime_metadata_path is not None and runtime_image_path is not None:
                targets.extend([runtime_metadata_path, runtime_image_path])
            for target in targets:
                fingerprints[target] = digest(target)
            result = stage_one(metadata_path, image_path, raw_path, stage_root, qa,
                               runtime_image_path=runtime_image_path,
                               runtime_metadata_path=runtime_metadata_path)
            result["rawSource"] = raw_path
            results.append(result)
            if index % 10 == 0 or index == len(requests):
                print(f"Staged {index}/{len(requests)}: {relative(metadata_path)}", flush=True)

        if args.write:
            pairs: list[tuple[Path, Path | None]] = [(result["metadata"], None) for result in results]
            for result in results:
                if result["runtimePair"]:
                    _, runtime_metadata_path, _, runtime_image_path = result["runtimePair"]
                    pairs.append((runtime_metadata_path, runtime_image_path))
            commit(results, temporary, fingerprints, qa, pairs)
        scales = [result["normalization"]["uniformScale"] for result in results]
        recovered = {
            "write": args.write,
            "atlases": len(results),
            "variants": len(selected_variants),
            "productionSpecies": len(species),
            "supplementalRuntimeSpecies": supplemental_species,
            "runtimeAtlases": len(production_metadata),
            "canvas": f"{CELL}x{CELL}",
            "minimumScale": min(scales),
            "rawSources": len({result["rawSource"] for result in results}),
            "stagingDirectory": str(temporary),
        }
        print(json.dumps(recovered, indent=2))
        if not args.write:
            # Keep the staged candidate atlases for review; the caller removes
            # this task-specific directory after inspection.
            return 0
        return 0
    except KeyboardInterrupt:
        print("raw atlas restoration interrupted before completion", file=sys.stderr)
        shutil.rmtree(temporary, ignore_errors=True)
        return 130
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"raw atlas restoration failed: {error}", file=sys.stderr)
        shutil.rmtree(temporary, ignore_errors=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
