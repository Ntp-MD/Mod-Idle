#!/usr/bin/env python3
"""Check draft monster animation atlases and the production mob registry.

Run from the repository root to check every draft-review species and named variant:

    python tools/monster-animation-qa.py

Or check selected metadata files:

    python tools/monster-animation-qa.py --metadata art-reference/monsters/humanoid/orc/raider-orc/meta.json

Check the mob images and metadata actually loaded by the production registry:

    python tools/monster-animation-qa.py --runtime

The checker reads the actual PNG canvas, the declared 8 x 5 layout, and every per-frame
source bound. It does not alter the atlas or metadata. Pillow is already used by the map
art tools in this repository.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
MONSTER_ROOT = ROOT / "art-reference" / "monsters"
ROSTER_PATH = MONSTER_ROOT / "production-roster.json"
MOB_SKILLS_PATH = ROOT / "tools/data/mob-skills.json"
SPECIES_MIN_BOTTOM_PADDING = 10
VARIANT_MIN_CELL_PADDING = 24
RUNTIME_ALPHA_THRESHOLD = 200
MIN_COMPONENT_PIXELS = 16
RUNTIME_REGISTRY = ROOT / "game/src/ui/combat/arena/arena-art-pixel-v2.ts"
FRAME_COUNT = 40


@dataclass(frozen=True)
class FrameBounds:
    x: int
    y: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height


@dataclass
class AtlasResult:
    metadata: Path
    image: Path | None
    frame_count: int
    issues: list[str]
    clearances: list[tuple[int, int]]
    runtime: bool = False
    silhouette: list[tuple[int, int, int, int]] = field(default_factory=list)
    cell_source: str = "roster"
    root_line: list[tuple[int, int]] = field(default_factory=list)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def expected_layout() -> tuple[int, int]:
    """Use the production roster's declared atlas grid for older metadata without layout."""
    try:
        roster = read_json(ROSTER_PATH)
        layout = roster["productionContract"]["layout"]
        return int(layout["columns"]), int(layout["rows"])
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return 8, 5


def expected_runtime_cell() -> tuple[int, int]:
    """Read the runtime cell size from the same production contract as the art."""
    roster = read_json(ROSTER_PATH)
    cell = roster["productionContract"]["layout"]["runtimeFrameCanvas"]
    width, height = cell.get("width"), cell.get("height")
    if type(width) is not int or type(height) is not int or width <= 0 or height <= 0:
        raise ValueError("production runtimeFrameCanvas must contain positive integer dimensions")
    return width, height


def runtime_cell_for(metadata: dict[str, Any]) -> tuple[int, int, str]:
    """Roster contract first; per-atlas frameCanvas fallback when the roster is absent.

    The fallback keeps geometry, crop, spill and scale checks running instead of
    failing every atlas on an unreadable contract. Cross-atlas uniformity is only
    enforced when the roster contract reads.
    """
    try:
        width, height = expected_runtime_cell()
        return width, height, "roster"
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        cell = metadata.get("frameCanvas")
        if isinstance(cell, dict):
            width, height = cell.get("width"), cell.get("height")
            if type(width) is int and type(height) is int and width > 0 and height > 0:
                return width, height, "atlas-fallback"
        raise ValueError("no roster contract and no valid per-atlas frameCanvas")


def resolve_image(metadata_path: Path, metadata: dict[str, Any]) -> Path | None:
    declared = metadata.get("file")
    if declared:
        candidate = (metadata_path.parent / str(declared)).resolve()
        return candidate if candidate.is_file() else None

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


def parse_frame_bounds(metadata: dict[str, Any], issues: list[str]) -> list[FrameBounds]:
    source_frames = metadata.get("sourceFrames")
    if not isinstance(source_frames, list) or len(source_frames) != FRAME_COUNT:
        found = len(source_frames) if isinstance(source_frames, list) else "missing"
        issues.append(f"metadata must contain {FRAME_COUNT} sourceFrames entries (found {found})")
        return []

    frames: list[FrameBounds] = []
    for index, frame in enumerate(source_frames):
        if not isinstance(frame, dict):
            issues.append(f"frame {index:02d}: sourceFrames entry must be an object")
            continue
        values = [frame.get(key) for key in ("x", "y", "width", "height")]
        if any(type(value) is not int for value in values):
            issues.append(f"frame {index:02d}: source bounds need integer x, y, width, and height")
            continue
        x, y, width, height = values
        if x < 0 or y < 0 or width <= 0 or height <= 0:
            issues.append(f"frame {index:02d}: source bounds must be positive and inside the atlas")
            continue
        frames.append(FrameBounds(x, y, width, height))
    return frames


def cell_edges(size: int, count: int) -> list[int]:
    """Partition the actual canvas without assuming that its cells divide evenly."""
    return [(index * size) // count for index in range(count + 1)]


def adjacent_cell_spills(alpha: bytes, width: int, height: int, x_edges: list[int], y_edges: list[int]) -> set[tuple[int, int, str]]:
    """Find 8-connected opaque pixels that cross from one atlas cell into another."""
    spills: set[tuple[int, int, str]] = set()
    columns = len(x_edges) - 1
    rows = len(y_edges) - 1

    def opaque(x: int, y: int) -> bool:
        return 0 <= x < width and 0 <= y < height and alpha[y * width + x] > 0

    # A connected path can only move to another cell by crossing one of these seams.
    for column in range(1, columns):
        seam = x_edges[column]
        for y in range(height):
            if not opaque(seam - 1, y):
                continue
            for other_y in range(max(0, y - 1), min(height, y + 2)):
                if opaque(seam, other_y):
                    left_row = min(rows - 1, max(0, next((i for i in range(rows) if y < y_edges[i + 1]), rows - 1)))
                    right_row = min(rows - 1, max(0, next((i for i in range(rows) if other_y < y_edges[i + 1]), rows - 1)))
                    left = left_row * columns + column - 1
                    right = right_row * columns + column
                    spills.add((min(left, right), max(left, right), "vertical"))

    for row in range(1, rows):
        seam = y_edges[row]
        for x in range(width):
            if not opaque(x, seam - 1):
                continue
            for other_x in range(max(0, x - 1), min(width, x + 2)):
                if opaque(other_x, seam):
                    left_column = min(columns - 1, max(0, next((i for i in range(columns) if x < x_edges[i + 1]), columns - 1)))
                    right_column = min(columns - 1, max(0, next((i for i in range(columns) if other_x < x_edges[i + 1]), columns - 1)))
                    upper = (row - 1) * columns + left_column
                    lower = row * columns + right_column
                    spills.add((min(upper, lower), max(upper, lower), "horizontal"))
    return spills


def opaque_components(alpha: bytes, width: int, height: int) -> list[tuple[FrameBounds, int, list[tuple[int, int, int]]]]:
    """Label 8-connected runs without a dependency or a per-pixel Python object graph."""
    parents: list[int] = []
    runs: list[tuple[int, int, int, int]] = []
    previous: list[tuple[int, int, int]] = []

    def find(label: int) -> int:
        while parents[label] != label:
            parents[label] = parents[parents[label]]
            label = parents[label]
        return label

    for y in range(height):
        current: list[tuple[int, int, int]] = []
        row_start, row_end = y * width, (y + 1) * width
        position = row_start
        previous_start = 0
        while position < row_end:
            start = alpha.find(b"\x01", position, row_end)
            if start < 0:
                break
            end = alpha.find(b"\x00", start, row_end)
            if end < 0:
                end = row_end
            x0, x1 = start - row_start, end - row_start
            label = len(parents)
            parents.append(label)
            while previous_start < len(previous) and previous[previous_start][1] < x0:
                previous_start += 1
            for old_x0, old_x1, old_label in previous[previous_start:]:
                if old_x0 > x1:
                    break
                if old_x1 >= x0:
                    first, second = find(label), find(old_label)
                    if first != second:
                        parents[first] = second
            current.append((x0, x1, label))
            runs.append((x0, x1, y, label))
            position = end
        previous = current

    grouped: dict[int, list[tuple[int, int, int]]] = {}
    for x0, x1, y, label in runs:
        grouped.setdefault(find(label), []).append((x0, x1, y))
    components = []
    for component_runs in grouped.values():
        x0 = min(run[0] for run in component_runs)
        x1 = max(run[1] for run in component_runs)
        y0 = component_runs[0][2]
        y1 = component_runs[-1][2] + 1
        area = sum(right - left for left, right, _ in component_runs)
        components.append((FrameBounds(x0, y0, x1 - x0, y1 - y0), area, component_runs))
    return components


def runtime_pose_issues(alpha: bytes, width: int, height: int, frames: list[FrameBounds],
                        x_edges: list[int], y_edges: list[int]) -> list[str]:
    """Reject a cut pose, duplicate pose fragments, and ambiguous opaque crop borders."""
    issues: list[str] = []
    columns = len(x_edges) - 1
    for bounds, area, runs in opaque_components(alpha, width, height):
        if area < MIN_COMPONENT_PIXELS:
            continue
        owners: dict[int, int] = {}
        for x0, x1, y in runs:
            row = next(index for index in range(len(y_edges) - 1) if y < y_edges[index + 1])
            for column in range(columns):
                count = max(0, min(x1, x_edges[column + 1]) - max(x0, x_edges[column]))
                if count:
                    cell = row * columns + column
                    owners[cell] = owners.get(cell, 0) + count
        owner = max(owners, key=owners.get)
        for index, frame in enumerate(frames):
            if (frame.right <= bounds.x or frame.x >= bounds.right or
                    frame.bottom <= bounds.y or frame.y >= bounds.bottom):
                continue
            overlap = sum(max(0, min(x1, frame.right) - max(x0, frame.x))
                          for x0, x1, y in runs if frame.y <= y < frame.bottom)
            if not overlap:
                continue
            if overlap < area:
                issues.append(f"frame {index:02d}: source crop truncates a connected pose ({overlap}/{area} opaque pixels)")
            if owner != index:
                issues.append(f"frame {index:02d}: source crop contains opaque pixels from frame {owner:02d}'s pose")
            if overlap == area and (bounds.x <= frame.x or bounds.y <= frame.y or
                                    bounds.right >= frame.right or bounds.bottom >= frame.bottom):
                issues.append(f"frame {index:02d}: source crop needs at least 1 transparent pixel around its connected pose")
    return issues


def audit_atlas(metadata_path: Path, *, runtime_image: Path | None = None) -> AtlasResult:
    metadata_path = metadata_path.resolve()
    runtime = runtime_image is not None
    issues: list[str] = []
    try:
        metadata = read_json(metadata_path)
    except (OSError, json.JSONDecodeError) as error:
        return AtlasResult(metadata_path, runtime_image, 0, [f"cannot read metadata: {error}"], [], runtime)
    if not isinstance(metadata, dict):
        return AtlasResult(metadata_path, runtime_image, 0, ["metadata root must be a JSON object"], [], runtime)
    is_variant = metadata.get("variantId") is not None
    minimum_padding = VARIANT_MIN_CELL_PADDING if is_variant or runtime else SPECIES_MIN_BOTTOM_PADDING

    image_path = runtime_image.resolve() if runtime_image is not None else resolve_image(metadata_path, metadata)
    if image_path is None:
        declared = metadata.get("file")
        detail = f"declared image {declared!r} is missing" if declared else "no animation atlas PNG was found"
        return AtlasResult(metadata_path, None, 0, [detail], [], runtime)

    declared_columns, declared_rows = (8, 5) if runtime else expected_layout()

    layout = metadata.get("layout")
    columns, rows = declared_columns, declared_rows
    if layout is not None:
        if not isinstance(layout, dict):
            issues.append("layout must be an object")
        else:
            layout_columns, layout_rows = layout.get("columns"), layout.get("rows")
            if type(layout_columns) is not int or type(layout_rows) is not int:
                issues.append("layout must declare integer columns and rows")
            else:
                columns, rows = layout_columns, layout_rows
                if (columns, rows) != (declared_columns, declared_rows):
                    issues.append(f"layout is {columns} x {rows}; production requires {declared_columns} x {declared_rows}")
            layout_frame_count = layout.get("frameCount")
            if layout_frame_count is not None and layout_frame_count != FRAME_COUNT:
                issues.append(f"layout frameCount is {layout_frame_count}; production requires {FRAME_COUNT}")
            cell_order = layout.get("cellOrder")
            if cell_order is not None and cell_order != "row-major":
                issues.append(f"layout cellOrder is {cell_order!r}; production requires 'row-major'")
    if columns <= 0 or rows <= 0:
        return AtlasResult(metadata_path, image_path, 0, issues + ["layout dimensions must be positive"], [], runtime)

    source_canvas = metadata.get("sourceCanvas")
    if not isinstance(source_canvas, dict):
        issues.append("metadata must declare sourceCanvas width and height")

    frames = parse_frame_bounds(metadata, issues)
    cell_source = "roster"
    if runtime:
        try:
            runtime_width, runtime_height, cell_source = runtime_cell_for(metadata)
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            return AtlasResult(metadata_path, image_path, len(frames), issues + [f"cannot read runtime cell contract: {error}"], [], runtime)
        frame_canvas = metadata.get("frameCanvas")
        if cell_source == "roster" and frame_canvas != {"width": runtime_width, "height": runtime_height}:
            issues.append(f"runtime frameCanvas must be {runtime_width} x {runtime_height}")
        raw_frames = metadata.get("sourceFrames")
        for index, frame in enumerate(raw_frames if isinstance(raw_frames, list) else []):
            if not isinstance(frame, dict):
                continue
            values = [frame.get(key) for key in ("offsetX", "offsetY", "width", "height")]
            if any(type(value) is not int for value in values):
                issues.append(f"frame {index:02d}: runtime offsets and crop sizes must be integers")
                continue
            offset_x, offset_y, frame_width, frame_height = values
            if offset_x < 0 or offset_y < 0 or offset_x + frame_width > runtime_width or offset_y + frame_height > runtime_height:
                issues.append(f"frame {index:02d}: source crop escapes the {runtime_width} x {runtime_height} runtime cell")
    try:
        with Image.open(image_path) as opened:
            image = opened.convert("RGBA")
    except (OSError, ValueError) as error:
        return AtlasResult(metadata_path, image_path, len(frames), issues + [f"cannot open atlas PNG: {error}"], [], runtime)

    width, height = image.size
    packed = runtime and isinstance(metadata.get("slicing"), dict)
    if runtime and not packed:
        if (width, height) != (runtime_width * columns, runtime_height * rows):
            issues.append(f"runtime atlas must contain {columns} x {rows} cells of {runtime_width} x {runtime_height} pixels")
    if isinstance(source_canvas, dict):
        declared_width = source_canvas.get("width")
        declared_height = source_canvas.get("height")
        if (declared_width, declared_height) != (width, height):
            issues.append(f"sourceCanvas says {declared_width} x {declared_height}, PNG is {width} x {height}")

    if columns > width or rows > height:
        return AtlasResult(metadata_path, image_path, len(frames), issues + ["layout has more cells than source pixels"], [], runtime)

    x_edges = cell_edges(width, columns)
    y_edges = cell_edges(height, rows)
    alpha_channel = image.getchannel("A")
    if runtime:
        alpha_channel = alpha_channel.point(lambda value: int(value >= RUNTIME_ALPHA_THRESHOLD))
    alpha = alpha_channel.tobytes()
    clearances: list[tuple[int, int]] = []
    silhouettes: list[tuple[int, int, int, int]] = []
    root_lines: list[tuple[int, int]] = []
    signatures: dict[int, tuple[int, int, bytes]] = {}
    raw_list = metadata.get("sourceFrames")

    if frames:
        for index, frame in enumerate(frames):
            if packed:
                # Packed atlases (player v2 slicing) have no uniform grid: analyse
                # the frame's own source crop. Feet plant is read in runtime-cell
                # coordinates (offsetY + content bottom), mirroring the grid rule.
                crop = alpha_channel.crop((frame.x, frame.y, frame.right, frame.bottom))
                box = crop.getbbox()
                if box is None:
                    issues.append(f"frame {index:02d}: source crop is empty")
                    continue
                bx0, by0, bx1, by1 = box
                pose_mask = crop.crop(box)
                signatures[index] = (pose_mask.width, pose_mask.height, pose_mask.tobytes())
                opaque_area = sum(1 for value in pose_mask.tobytes() if value > 0)
                silhouettes.append((index, bx1 - bx0, by1 - by0, opaque_area))
                raw = raw_list[index] if isinstance(raw_list, list) and index < len(raw_list) \
                    and isinstance(raw_list[index], dict) else {}
                offset_y = raw.get("offsetY")
                if type(offset_y) is int:
                    root_lines.append((index, offset_y + by1))
                continue
            column = index % columns
            row = index // columns
            if row >= rows:
                issues.append(f"frame {index:02d}: sourceFrames exceeds the declared layout")
                continue
            x0, x1 = x_edges[column], x_edges[column + 1]
            y0, y1 = y_edges[row], y_edges[row + 1]
            if frame.right > width or frame.bottom > height:
                issues.append(f"frame {index:02d}: source bounds exceed the {width} x {height} PNG")
            if frame.x < x0 or frame.y < y0 or frame.right > x1 or frame.bottom > y1:
                issues.append(
                    f"frame {index:02d}: source bounds ({frame.x},{frame.y},{frame.right},{frame.bottom}) "
                    f"escape its layout cell ({x0},{y0},{x1},{y1})"
                )

            cell_alpha = alpha_channel.crop((x0, y0, x1, y1))
            box = cell_alpha.getbbox()
            if box is None:
                issues.append(f"frame {index:02d}: cell is empty")
                continue

            bx0, by0, bx1, by1 = box
            pose_mask = cell_alpha.crop(box)
            signatures[index] = (pose_mask.width, pose_mask.height, pose_mask.tobytes())
            opaque_area = sum(1 for value in pose_mask.tobytes() if value > 0)
            silhouettes.append((index, bx1 - bx0, by1 - by0, opaque_area))
            content_x0, content_y0 = x0 + bx0, y0 + by0
            content_x1, content_y1 = x0 + bx1, y0 + by1
            if is_variant or runtime:
                horizontal_clearances = (bx0, x1 - x0 - bx1)
                vertical_clearances = (by0, y1 - y0 - by1)
                for side, padding in zip(("left", "right"), horizontal_clearances):
                    if padding < minimum_padding:
                        issues.append(
                            f"frame {index:02d}: {side} clearance is {padding} px; "
                            f"requires at least {minimum_padding} px"
                        )
                for side, padding in zip(("top", "bottom"), vertical_clearances):
                    if padding < minimum_padding:
                        issues.append(
                            f"frame {index:02d}: {side} clearance is {padding} px; "
                            f"requires at least {minimum_padding} px"
                        )
            if bx0 == 0:
                issues.append(f"frame {index:02d}: opaque alpha touches the left cell edge")
            if bx1 == x1 - x0:
                issues.append(f"frame {index:02d}: opaque alpha touches the right cell edge")
            if by0 == 0:
                issues.append(f"frame {index:02d}: opaque alpha touches the top cell edge")
            if by1 == y1 - y0:
                issues.append(f"frame {index:02d}: opaque alpha touches the bottom cell edge")

            bottom_clearance = y1 - content_y1
            clearances.append((index, bottom_clearance))
            if not is_variant and not runtime and bottom_clearance < minimum_padding:
                issues.append(
                    f"frame {index:02d}: bottom clearance is {bottom_clearance} px; "
                    f"requires at least {minimum_padding} px"
                )
            if (content_x0 < frame.x or content_y0 < frame.y or
                    content_x1 > frame.right or content_y1 > frame.bottom):
                issues.append(
                    f"frame {index:02d}: opaque alpha ({content_x0},{content_y0},{content_x1},{content_y1}) "
                    f"falls outside its sourceFrames crop ({frame.x},{frame.y},{frame.right},{frame.bottom})"
                )

    seen: dict[tuple[int, int, bytes], int] = {}
    for index in sorted(signatures):
        signature = signatures[index]
        if signature in seen:
            issues.append(
                f"frame {index:02d}: opaque content duplicates frame {seen[signature]:02d} "
                f"(no real pose change)"
            )
        else:
            seen[signature] = index

    upright = [padding for frame, padding in clearances if frame < 32]
    if len(upright) >= 2 and max(upright) - min(upright) > 24:
        issues.append(
            f"upright frames drift {max(upright) - min(upright)} px across the ground line; "
            f"keep feet planted within 24 px (death poses exempt)"
        )
    packed_roots = [root for frame, root in root_lines if frame < 32]
    if len(packed_roots) >= 2 and max(packed_roots) - min(packed_roots) > 24:
        issues.append(
            f"upright frames drift {max(packed_roots) - min(packed_roots)} px across the root line; "
            f"keep feet planted within 24 px (death poses exempt)"
        )

    if not packed:
        spills = adjacent_cell_spills(alpha, width, height, x_edges, y_edges)
        for first, second, orientation in sorted(spills):
            issues.append(f"connected opaque alpha spans cells {first:02d} and {second:02d} across a {orientation} seam")

    if runtime and not packed:
        issues.extend(runtime_pose_issues(alpha, width, height, frames, x_edges, y_edges))

    return AtlasResult(metadata_path, image_path, len(frames), issues, clearances, runtime, silhouettes, cell_source, root_lines)


def runtime_atlases(registry_path: Path = RUNTIME_REGISTRY,
                    pool_path: Path | None = None) -> tuple[list[tuple[Path, Path]], list[str]]:
    """Resolve the hero import and generated species pool used by the renderer."""
    try:
        source = registry_path.read_text(encoding="utf-8-sig")
    except OSError as error:
        return [], [f"cannot read runtime art registry: {error}"]
    imports = dict(re.findall(r"import\s+(\w+)\s+from\s+['\"]([^'\"]+\.json)['\"]", source))
    selected: list[tuple[Path, Path]] = []
    errors: list[str] = []
    # Player first: the hero pilotArt owns every player clip the runtime draws.
    hero = re.search(r"\bhero\s*:\s*pilotArt\(\s*['\"](/[^'\"]+\.png)['\"]\s*,\s*(\w+)", source)
    if hero is None:
        errors.append("runtime art registry has no hero pilotArt entry")
    else:
        href, imported_name = hero.group(1), hero.group(2)
        imported_path = imports.get(imported_name)
        if imported_path is None:
            errors.append(f"runtime image {href}: metadata import {imported_name!r} was not found")
        else:
            selected.append(((registry_path.parent / imported_path).resolve(),
                             (ROOT / "game/public" / href.lstrip("/")).resolve()))
    try:
        pool = read_json(pool_path or registry_path.parent / "mob-pool.generated.json")
        entries = pool["species"]
        if not isinstance(entries, dict) or not entries:
            raise ValueError("pool has no species")
        for entry in entries.values():
            href = entry["href"]
            image_path = (ROOT / "game/public" / href.lstrip("/")).resolve()
            metadata_path = image_path.with_name("meta.json")
            selected.append((metadata_path, image_path))
    except (OSError, ValueError, KeyError, TypeError) as error:
        errors.append(f"cannot read runtime mob pool: {error}")
    return selected, errors


def draft_metadata_files() -> list[Path]:
    candidates: set[Path] = set()
    for pattern in ("*/*/*/animation/meta.json", "*/*/*/animation/v*/meta.json",
                    "*/*/*/meta.json", "*/*/*/v*/meta.json"):
        for path in MONSTER_ROOT.glob(pattern):
            if path.is_file() and "_shared" not in path.parts:
                candidates.add(path)
    return sorted(candidates)


def select_drafts() -> tuple[list[Path], list[str]]:
    selected: list[Path] = []
    errors: list[str] = []
    for path in draft_metadata_files():
        try:
            metadata = read_json(path)
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"{path.relative_to(ROOT).as_posix()}: cannot read metadata: {error}")
            continue
        if isinstance(metadata, dict) and metadata.get("status") == "draft-review":
            selected.append(path)
    return selected, errors


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def scale_drift_summary(silhouettes: list[tuple[int, int, int, int]],
                        exempt: set[int] | None = None) -> dict[str, Any] | None:
    """Median-based scale drift for upright frames; death row always exempt, report only."""
    upright = [(frame, width, height, area) for frame, width, height, area in silhouettes if frame < 32]
    if len(upright) < 2:
        return None
    exempt = exempt or set()
    def median(values: list[int]) -> float:
        ordered = sorted(values)
        middle = len(ordered) // 2
        return float(ordered[middle]) if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
    med_w, med_h = median([width for _, width, _, _ in upright]), median([height for _, _, height, _ in upright])
    med_a = median([area for _, _, _, area in upright])
    candidates: list[str] = []
    peak = 0.0
    for frame, width, height, area in upright:
        if frame in exempt:
            continue
        drift = max(abs(width - med_w) / med_w if med_w else 0,
                    abs(height - med_h) / med_h if med_h else 0)
        peak = max(peak, drift)
        if drift > 0.30 or (med_a and abs(area - med_a) / med_a > 0.50):
            candidates.append(f"{frame:02d}={width}x{height}")
    widths = [width for _, width, _, _ in upright]
    heights = [height for _, _, height, _ in upright]
    return {"medianWidth": med_w, "medianHeight": med_h, "medianArea": med_a,
            "widthRange": [min(widths), max(widths)], "heightRange": [min(heights), max(heights)],
            "peakDrift": round(peak, 3), "candidates": candidates}


def json_result(result: AtlasResult) -> dict[str, Any]:
    metadata: Any = None
    try:
        metadata = read_json(result.metadata)
        status = metadata.get("status") if isinstance(metadata, dict) else None
    except (OSError, json.JSONDecodeError):
        status = None
    minimum_padding = (
        VARIANT_MIN_CELL_PADDING
        if result.runtime or isinstance(metadata, dict) and metadata.get("variantId") is not None
        else SPECIES_MIN_BOTTOM_PADDING
    )
    exempt: set[int] = set()
    if isinstance(metadata, dict):
        raw_exempt = metadata.get("scaleExemptFrames")
        if isinstance(raw_exempt, list):
            exempt = {index for index in raw_exempt if type(index) is int}
    drift = scale_drift_summary(result.silhouette, exempt)
    return {
        "metadata": relative(result.metadata),
        "image": relative(result.image) if result.image else None,
        "status": status,
        "runtime": result.runtime,
        "minimumCellPadding": minimum_padding,
        "passed": not result.issues,
        "frameCount": result.frame_count,
        "issues": result.issues,
        "bottomClearance": [
            {"frame": frame, "pixels": padding} for frame, padding in result.clearances
        ],
        "silhouette": [
            {"frame": frame, "width": width, "height": height, "area": area}
            for frame, width, height, area in result.silhouette
        ],
        "cellSource": result.cell_source,
        "rootLine": [
            {"frame": frame, "cellBottom": root} for frame, root in result.root_line
        ],
        "scaleDrift": drift,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument(
        "--metadata",
        nargs="+",
        type=Path,
        help="metadata.json file(s) to check; without this, check every draft-review species and variant atlas",
    )
    selection.add_argument(
        "--runtime", action="store_true",
        help="check every player and mob PNG and metadata pair used by the runtime registry, regardless of approval status",
    )
    parser.add_argument("--json", action="store_true", help="emit a machine-readable JSON result")
    args = parser.parse_args(argv)

    discovery_errors: list[str] = []
    runtime_pairs: list[tuple[Path, Path]] = []
    if args.runtime:
        runtime_pairs, discovery_errors = runtime_atlases()
        metadata_paths = [metadata for metadata, _ in runtime_pairs]
    elif args.metadata:
        metadata_paths = [path if path.is_absolute() else ROOT / path for path in args.metadata]
    else:
        metadata_paths, discovery_errors = select_drafts()

    if not metadata_paths and not discovery_errors:
        if args.json:
            print(json.dumps({
                "schemaVersion": 1,
                "layout": {
                    "columns": 8,
                    "rows": 5,
                    "minCellPadding": SPECIES_MIN_BOTTOM_PADDING,
                    "variantMinCellPadding": VARIANT_MIN_CELL_PADDING,
                },
                "atlases": [],
                "errors": ["No runtime mob animation metadata found." if args.runtime else "No draft-review monster animation metadata found."],
            }, indent=2))
        else:
            print("No runtime mob animation metadata found." if args.runtime else "No draft-review monster animation metadata found.")
        return 1

    results = ([audit_atlas(metadata, runtime_image=image) for metadata, image in runtime_pairs]
               if args.runtime else [audit_atlas(path) for path in metadata_paths])
    if args.json:
        print(json.dumps({
            "schemaVersion": 1,
            "layout": {
                "columns": 8,
                "rows": 5,
                "minCellPadding": SPECIES_MIN_BOTTOM_PADDING,
                "variantMinCellPadding": VARIANT_MIN_CELL_PADDING,
                "runtimeMinCellPadding": VARIANT_MIN_CELL_PADDING,
                "runtimeAlphaThreshold": RUNTIME_ALPHA_THRESHOLD,
            },
            "atlases": [json_result(result) for result in results],
            "errors": discovery_errors,
        }, indent=2))
        passed = sum(not result.issues for result in results)
        failed = len(results) - passed + len(discovery_errors)
        return 1 if failed else 0

    for error in discovery_errors:
        print(f"FAIL {error}")

    for result in results:
        image = f" -> {relative(result.image)}" if result.image else ""
        label = "PASS" if not result.issues else "FAIL"
        print(f"{label} {relative(result.metadata)}{image}: {result.frame_count} source frames; {len(result.issues)} issue(s)")
        if result.runtime and result.cell_source != "roster":
            print("  note: no production roster contract; cell size falls back to the atlas frameCanvas")
        for issue in result.issues:
            print(f"  - {issue}")
        if result.clearances:
            measured = dict(result.clearances)
            try:
                metadata = read_json(result.metadata)
            except (OSError, json.JSONDecodeError):
                metadata = {}
            minimum_padding = (
                VARIANT_MIN_CELL_PADDING
                if result.runtime or isinstance(metadata, dict) and metadata.get("variantId") is not None
                else SPECIES_MIN_BOTTOM_PADDING
            )
            in_target = sum(padding >= minimum_padding for padding in measured.values())
            out_of_target = ", ".join(
                f"{frame:02d}={padding}px" for frame, padding in result.clearances
                if padding < minimum_padding
            )
            low, high = min(measured.values()), max(measured.values())
            print(f"  bottom clearance: {in_target}/{len(measured)} frames at least {minimum_padding} px; range {low}-{high} px")
            if out_of_target:
                print(f"  out-of-target frames (frame=px): {out_of_target}")
        if result.root_line:
            roots = dict(result.root_line)
            upright_roots = [root for frame, root in result.root_line if frame < 32]
            if upright_roots:
                print(f"  root line (cell coords): {min(upright_roots)}-{max(upright_roots)} px "
                      f"across {len(upright_roots)} upright frames; death rows exempt")
        if result.silhouette:
            try:
                review_meta = read_json(result.metadata)
            except (OSError, json.JSONDecodeError):
                review_meta = {}
            exempt_frames: set[int] = set()
            if isinstance(review_meta, dict) and isinstance(review_meta.get("scaleExemptFrames"), list):
                exempt_frames = {index for index in review_meta["scaleExemptFrames"] if type(index) is int}
            drift = scale_drift_summary(result.silhouette, exempt_frames)
            if drift:
                print(f"  silhouette: median {drift['medianWidth']:.0f}x{drift['medianHeight']:.0f} "
                      f"area {drift['medianArea']:.0f}; W {drift['widthRange'][0]}-{drift['widthRange'][1]} "
                      f"H {drift['heightRange'][0]}-{drift['heightRange'][1]}; peak drift {drift['peakDrift']:.0%}")
                if drift["candidates"]:
                    print(f"  scale-review candidates (upright only, death/floating/squash exempt by metadata): "
                          f"{', '.join(drift['candidates'])}")

    passed = sum(not result.issues for result in results)
    failed = len(results) - passed + len(discovery_errors)
    print(f"\n{passed}/{len(results)} atlases pass; {failed} fail.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
