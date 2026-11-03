"""Build a review-only 16-direction Minotaur atlas from source contact sheets.

Run from the repository root with:
    python -B art-reference/animation/outputs/minotaur-v5/assemble_candidate.py

Nothing is promoted into the runtime source tree by this script.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SPECIES_ROOT = ROOT / "art-reference/monsters/humanoid/minotaur/animation"
POSES_JSON = SPECIES_ROOT / "poses.json"
SHEET_DIR = OUT / "source/v5-contact-sheets"
FRAME_DIR = OUT / "frames"
ATLAS_DIR = OUT / "atlas"

FRAME_SIZE = 384
SOURCE_CELL_SIZE = (256, 384)
SHEET_SIZE = (1024, 1536)
ANCHOR = (192, 288)
SOURCE_ANCHOR_X = 128
CONFIDENCE_THRESHOLD = 128
SOFT_EDGE_RECOVERY_RADIUS = 3

DIRECTIONS = [
    "south",
    "south-south-east",
    "south-east",
    "east-south-east",
    "east",
    "east-north-east",
    "north-east",
    "north-north-east",
    "north",
    "north-north-west",
    "north-west",
    "west-north-west",
    "west",
    "west-south-west",
    "south-west",
    "south-south-west",
]

# Runtime phase names follow minotaur/animation/poses.json. Contact sheet names
# describe the generated prompt phase and are kept in source sidecars.
PHASES = {
    "idle": [("idle", "idle-16.png", "one ready pose for each direction")],
    "walk": [
        ("00-stride-a", "walk-00-stride-a-16.png", "left hoof forward; right hoof trailing"),
        ("01-stride-b", "walk-01-stride-b-16.png", "passing pose with fixed root"),
        ("02-stride-c", "walk-02-stride-c-16.png", "right hoof forward; left hoof trailing"),
        ("03-stride-d", "walk-03-stride-d-16.png", "passing pose returning to stride A"),
    ],
    "attack": [
        ("00-windup", "attack-00-windup-16.png", "axe drawn back; knees bent and torso coiled"),
        ("01-contact", "attack-01-contact-16.png", "diagonal axe swing at contact"),
        ("02-follow-through", "attack-02-follow-through-16.png", "axe and weight follow through"),
        ("03-recovery", "attack-03-recovery-16.png", "axe lowers to guard and stance recovers"),
    ],
    "hit": [
        ("00-flinch", "hit-00-impact-16.png", "brief shoulder and chest jolt"),
        ("01-recoil", "hit-01-recoil-16.png", "torso recoils while axe remains gripped"),
        ("02-recover", "hit-02-stagger-16.png", "off-balance recovery with axe low"),
        ("03-ready", "hit-03-ready-16.png", "balanced guard returning toward idle"),
    ],
    "death": [
        ("00-fall", "death-00-stagger-16.png", "body slackens and knees begin to buckle"),
        ("01-collapse", "death-01-fall-16.png", "drops to one knee and reaches toward ground"),
        ("02-ground", "death-02-down-16.png", "compact side-fallen pose with axe beside body"),
        ("03-settle", "death-03-still-16.png", "still defeated pose with axe resting beside body"),
    ],
}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def confidence_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= CONFIDENCE_THRESHOLD else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("A contact-sheet cell has no pixels above the alpha threshold")
    return bbox


def source_path(action: str, direction: str, filename: str) -> Path:
    if action == "idle":
        return SPECIES_ROOT / "poses/idle" / filename
    return SPECIES_ROOT / "poses" / action / direction / filename


def action_entries(poses: dict, action: str) -> dict[str, dict[str, dict]]:
    result: dict[str, dict[str, dict]] = {}
    for frame in poses["actions"][action]["frames"]:
        result.setdefault(frame["direction"], {})[Path(frame["file"]).name] = frame
    return result


def read_contact_sheet(sheet_name: str, action: str) -> tuple[Image.Image, dict]:
    path = SHEET_DIR / sheet_name
    metadata_path = path.with_suffix(".meta.json")
    if not path.is_file() or not metadata_path.is_file():
        raise FileNotFoundError(f"Missing contact sheet or sidecar: {path}")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("speciesId") != "minotaur" or metadata.get("action") != action:
        raise ValueError(f"Incorrect species/action in sidecar: {metadata_path}")
    recorded_directions = metadata.get("directionOrder") or metadata.get("promptContract", {}).get("directionOrder")
    if recorded_directions != DIRECTIONS:
        raise ValueError(f"Incorrect direction order in sidecar: {metadata_path}")
    if metadata.get("sha256") != sha256(path):
        raise ValueError(f"Source image hash mismatch: {path}")
    sheet = Image.open(path).convert("RGBA")
    if sheet.size != SHEET_SIZE:
        raise ValueError(f"{sheet_name}: expected {SHEET_SIZE}; got {sheet.size}")
    return sheet, metadata


def source_cells(sheet: Image.Image) -> list[Image.Image]:
    cells = []
    for index in range(16):
        row, column = divmod(index, 4)
        box = (
            column * SOURCE_CELL_SIZE[0],
            row * SOURCE_CELL_SIZE[1],
            (column + 1) * SOURCE_CELL_SIZE[0],
            (row + 1) * SOURCE_CELL_SIZE[1],
        )
        cells.append(sheet.crop(box))
    return cells


def candidate_frame(cell: Image.Image, target_height: float) -> tuple[Image.Image, dict]:
    alpha = cell.getchannel("A")
    hard_mask = alpha.point(lambda value: 255 if value >= CONFIDENCE_THRESHOLD else 0)
    hard_bbox = hard_mask.getbbox()
    if hard_bbox is None:
        raise ValueError("Generated source cell is empty")

    recovered_mask = hard_mask.filter(ImageFilter.MaxFilter(SOFT_EDGE_RECOVERY_RADIUS * 2 + 1))
    recovered_bbox = recovered_mask.getbbox()
    cleaned_alpha = ImageChops.multiply(alpha, recovered_mask)
    cropped = cell.crop(recovered_bbox)
    cropped.putalpha(cleaned_alpha.crop(recovered_bbox))

    source_height = recovered_bbox[3] - recovered_bbox[1]
    scale = target_height / source_height
    if not 0.35 <= scale <= 1.35:
        raise ValueError(f"Unexpected uniform scale {scale:.4f} for a 16-direction contact cell")
    scaled_size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    scaled = cropped.resize(scaled_size, Image.Resampling.NEAREST)
    if scaled.width > FRAME_SIZE or scaled.height > ANCHOR[1]:
        raise ValueError(f"Scaled pose exceeds the anchored frame canvas: {scaled.size}")

    left = ANCHOR[0] - round((SOURCE_ANCHOR_X - recovered_bbox[0]) * scale)
    top = ANCHOR[1] - scaled.height
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(scaled, (left, top))
    return frame, {
        "confidenceBoundsInCell": list(hard_bbox),
        "recoveredBoundsInCell": list(recovered_bbox),
        "targetVisualFootBaselineY": ANCHOR[1],
        "targetReferenceMedianHeight": round(target_height, 3),
        "uniformScale": round(scale, 6),
    }


def make_previews(atlas: Image.Image) -> None:
    preview = atlas.resize((16 * 96, 17 * 96), Image.Resampling.NEAREST)
    preview.save(ATLAS_DIR / "animation-v5-color-preview.png")

    neutral = Image.new("RGBA", preview.size, (40, 44, 54, 255))
    neutral.alpha_composite(preview)
    neutral.convert("RGB").save(ATLAS_DIR / "animation-v5-color-preview-neutral.png")

    silhouette = Image.new("RGBA", preview.size, (16, 18, 22, 255))
    opaque = Image.new("RGBA", preview.size, (235, 238, 224, 255))
    silhouette.alpha_composite(Image.composite(opaque, Image.new("RGBA", preview.size), preview.getchannel("A")))
    silhouette.save(ATLAS_DIR / "animation-v5-silhouette-preview.png")

    death_rows = Image.new("RGBA", (16 * 192, 2 * 192), (0, 0, 0, 0))
    for review_row, atlas_row in enumerate((15, 16)):
        for column in range(16):
            frame = atlas.crop((column * FRAME_SIZE, atlas_row * FRAME_SIZE, (column + 1) * FRAME_SIZE, (atlas_row + 1) * FRAME_SIZE))
            death_rows.alpha_composite(frame.resize((192, 192), Image.Resampling.NEAREST), (column * 192, review_row * 192))
    death_bg = Image.new("RGBA", death_rows.size, (40, 44, 54, 255))
    death_bg.alpha_composite(death_rows)
    death_bg.convert("RGB").save(ATLAS_DIR / "animation-v5-death-rows-review.png")


def main() -> None:
    for directory in (FRAME_DIR, ATLAS_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    poses = json.loads(POSES_JSON.read_text(encoding="utf-8"))
    if [item["name"] for item in poses.get("directions", [])] != DIRECTIONS:
        raise ValueError("Minotaur pose directions do not match the 16-direction sheet order")
    entries = {action: action_entries(poses, action) for action in PHASES}

    sheet_info: dict[str, tuple[Image.Image, dict, list[Image.Image], float]] = {}
    for action, phases in PHASES.items():
        for phase, sheet_name, _description in phases:
            sheet, metadata = read_contact_sheet(sheet_name, action)
            cells = source_cells(sheet)
            heights = []
            for cell in cells:
                bbox = confidence_bbox(cell)
                heights.append(bbox[3] - bbox[1])
            target_height = min(float(median(heights)), float(ANCHOR[1] - 12))
            sheet_info[sheet_name] = (sheet, metadata, cells, target_height)

    atlas = Image.new("RGBA", (16 * FRAME_SIZE, 17 * FRAME_SIZE), (0, 0, 0, 0))
    rows = []
    source_counts = Counter()
    inventory = Counter()
    frame_rows = []
    atlas_row = 0

    for action, phases in PHASES.items():
        for phase, sheet_name, description in phases:
            sheet, sheet_metadata, cells, target_height = sheet_info[sheet_name]
            row_directions = []
            for direction_index, direction in enumerate(DIRECTIONS):
                by_file = entries[action].get(direction)
                if not by_file:
                    raise ValueError(f"Missing pose map for {action}/{direction}")
                if action == "idle":
                    entry = next(iter(by_file.values()))
                else:
                    filename = f"{phase}.png"
                    entry = by_file.get(filename)
                    if entry is None:
                        raise ValueError(f"Missing template phase {action}/{direction}/{filename}")

                source = source_path(action, direction, entry["file"])
                source_meta_path = source.with_name(source.stem + ".meta.json")
                source_meta = json.loads(source_meta_path.read_text(encoding="utf-8")) if source_meta_path.is_file() else {}
                out_rel = Path(action) / direction / entry["file"]
                frame_path = FRAME_DIR / out_rel
                frame_meta_path = frame_path.with_name(frame_path.stem + ".meta.json")
                frame_path.parent.mkdir(parents=True, exist_ok=True)

                if source.is_file():
                    with Image.open(source) as source_image:
                        dimensions = source_image.size
                    inventory[f"present:{dimensions[0]}x{dimensions[1]}"] += 1
                    inventory[f"status:{source_meta.get('status', 'missing-status')}"] += 1
                else:
                    inventory["missing"] += 1

                if source.is_file() and source_meta.get("status") == "approved-source-pose":
                    with Image.open(source) as source_image:
                        if source_image.size != (FRAME_SIZE, FRAME_SIZE):
                            raise ValueError(f"Approved source frame is not 384x384: {source}")
                        frame = source_image.convert("RGBA")
                    frame.save(frame_path)
                    source_kind = "preserved-approved-source-pose"
                    frame_metadata = {
                        "status": "preserved-approved-source-pose",
                        "speciesId": "minotaur",
                        "action": action,
                        "direction": direction,
                        "pose": phase,
                        "source": source.relative_to(ROOT).as_posix(),
                        "sourceMetadata": source_meta_path.relative_to(ROOT).as_posix(),
                        "sourcePixelsModified": False,
                        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
                        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "preserved from approved Minotaur pose metadata"},
                        "qa": {"sourcePoseApproved": True, "sixteenDirectionAtlas": False, "visualReview": False, "runtimePromotion": False},
                    }
                    source_counts["preservedApprovedSourceFrames"] += 1
                else:
                    frame, processing = candidate_frame(cells[direction_index], target_height)
                    frame.save(frame_path)
                    source_kind = "generated-candidate"
                    frame_metadata = {
                        "status": "imagegen-candidate-review-required",
                        "speciesId": "minotaur",
                        "action": action,
                        "direction": direction,
                        "pose": phase,
                        "generator": "built-in image_gen",
                        "source": f"source/v5-contact-sheets/{sheet_name}",
                        "sourceImageId": sheet_metadata["sourceImageId"],
                        "sourceCell": {"row": direction_index // 4, "column": direction_index % 4, "direction": direction},
                        "sourcePixelsModified": True,
                        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
                        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "inherited Minotaur source anchor; visual measurement pending"},
                        "processing": {
                            "method": "alpha-confidence-crop-scale-anchor-v1",
                            "confidenceThreshold": CONFIDENCE_THRESHOLD,
                            "softEdgeRecoveryRadius": SOFT_EDGE_RECOVERY_RADIUS,
                            "scaleReference": "median alpha-bound height across the matching 16-direction contact sheet",
                            **processing,
                        },
                        "qa": {"identity": False, "facing": False, "pose": False, "alphaEdges": False, "anchor": False, "atlas": False, "runtimePromotion": False},
                    }
                    source_counts["generatedCandidateFrames"] += 1

                if frame.size != (FRAME_SIZE, FRAME_SIZE) or frame.getchannel("A").getbbox() is None:
                    raise ValueError(f"Invalid or empty candidate frame: {frame_path}")
                frame_metadata["sha256"] = sha256(frame_path)
                write_json(frame_meta_path, frame_metadata)
                atlas.paste(frame, (direction_index * FRAME_SIZE, atlas_row * FRAME_SIZE))
                row_directions.append({
                    "column": direction_index,
                    "direction": direction,
                    "sourceKind": source_kind,
                    "frame": f"frames/{out_rel.as_posix()}",
                    "metadata": f"frames/{frame_meta_path.relative_to(FRAME_DIR).as_posix()}",
                })
                frame_rows.append({"row": atlas_row, "action": action, "pose": phase, **row_directions[-1]})

            rows.append({"row": atlas_row, "action": action, "pose": phase, "description": description, "directions": row_directions})
            atlas_row += 1

    if atlas_row != 17 or sum(source_counts.values()) != 272:
        raise ValueError(f"Expected 17 rows and 272 frames; got rows={atlas_row}, counts={dict(source_counts)}")

    atlas_path = ATLAS_DIR / "animation-v5-candidate.png"
    atlas.save(atlas_path)
    make_previews(atlas)

    result = {
        "status": "candidate-review-required",
        "speciesId": "minotaur",
        "race": "humanoid",
        "version": "v5",
        "generator": "built-in image_gen contact sheets; approved source poses preserved when present",
        "file": atlas_path.name,
        "sourceCanvas": {"width": atlas.width, "height": atlas.height, "mode": "RGBA"},
        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "inherited Minotaur source anchor; 16-direction measurement and visual review pending"},
        "layout": {"columns": 16, "rows": 17, "frameCount": 272, "cellOrder": "row-major"},
        "directions": poses["directions"],
        "actionRowOrder": list(PHASES),
        "framesPerDirection": {"idle": 1, "walk": 4, "attack": 4, "hit": 4, "death": 4},
        "rowOrder": [f"{row['row']}: {row['action']} {row['pose']}" for row in rows],
        "sourceCounts": dict(source_counts),
        "sourceInventory": {
            "expectedPosePaths": 272,
            "sourceTreePathCountsBeforeAssembly": dict(inventory),
            "approvedSourceFramesPreserved": source_counts["preservedApprovedSourceFrames"],
            "generatedCandidateFrames": source_counts["generatedCandidateFrames"],
            "note": "Existing Minotaur PNGs are unapproved candidate or inherited-candidate files; none qualify as approved-source-pose. They remain untouched in the source tree.",
        },
        "sourceSheets": [
            {"file": name, "sourceImageId": data[1]["sourceImageId"], "action": data[1]["action"], "phase": data[1]["phase"], "metadata": str(Path(name).with_suffix(".meta.json")).replace("\\", "/")}
            for name, data in sheet_info.items()
        ],
        "rows": rows,
        "qa": {"identity": False, "sixteenDirections": False, "posePhases": False, "alphaEdges": False, "rootAnchor": False, "atlas": False, "visualReview": False, "runtimePromotion": False},
        "previewFiles": ["animation-v5-color-preview.png", "animation-v5-color-preview-neutral.png", "animation-v5-silhouette-preview.png", "animation-v5-death-rows-review.png"],
        "notes": [
            "Review-only candidate; no files were promoted into the runtime source tree.",
            "All 272 candidate atlas cells come from the 17 Minotaur 16-direction source sheets because no existing source frame has approved-source-pose status.",
            "Contact-sheet cells were alpha-confidence trimmed at 128, given a 3 px soft-edge recovery, uniformly scaled within each sheet to its median silhouette height, and aligned provisionally to anchor (192,288).",
            "All visual, direction, alpha-edge, anchor, and runtime-promotion QA flags remain false.",
        ],
    }
    write_json(ATLAS_DIR / "animation-v5-candidate.json", result)

    readme = """# Minotaur v5 16-direction candidate

This directory is review-only. Nothing here is promoted to runtime.

`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas at 6144 × 6528 px. It contains 272 cells of 384 × 384 px: one idle row and four rows each for walk, attack, hit, and death. Directions run left to right in the order recorded in the candidate manifest.

The current source tree has 73 PNG paths, but those are unapproved candidates: 36 are 384 × 384 pose images and 37 are 1254 × 1254 contact sheets. No source frame has `approved-source-pose` status, so the candidate atlas uses all 272 cells from the 17 contact sheets. The source tree remains unchanged.

Contact-sheet cells are trimmed at alpha confidence 128 with a 3 px soft-edge recovery and aligned provisionally to anchor (192,288). The atlas and each generated frame retain false visual/alpha/anchor/runtime QA flags pending review.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")

    with Image.open(atlas_path) as check:
        if check.size != (16 * FRAME_SIZE, 17 * FRAME_SIZE):
            raise ValueError(f"Unexpected atlas size: {check.size}")
    print(json.dumps({"atlas": atlas_path.as_posix(), "size": atlas.size, "frames": dict(source_counts), "sourceInventory": dict(inventory), "qa": result["qa"]}, indent=2))


if __name__ == "__main__":
    main()
