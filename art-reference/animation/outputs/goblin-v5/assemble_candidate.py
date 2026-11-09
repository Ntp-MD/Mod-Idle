"""Assemble the pending Goblin v5 16-direction candidate without editing source assets.

Run from the repository root with:
    python -B art-reference/animation/outputs/goblin-v5/assemble_candidate.py

The atlas is a review artifact only. Generated poses and previews remain under
art-reference/animation/outputs/goblin-v5/ until visual review and promotion.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import time
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SPECIES_ROOT = ROOT / "archive/art-reference/monsters/humanoid/goblin/animation"
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
PREVIEW_CELL = 96
DEATH_REVIEW_CELL = 192

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

PHASES = {
    "idle": [("idle", "idle-16.png", "one neutral ready pose facing each named direction")],
    "walk": [
        ("00-stride-a", "walk-00-stride-a-16.png", "left lead-foot support; right foot trailing; spear and body counterbalance"),
        ("01-stride-b", "walk-01-stride-b-16.png", "passing pose; right foot passes under hips; root remains fixed"),
        ("02-stride-c", "walk-02-stride-c-16.png", "right lead-foot support; left foot trailing; complete half-stride"),
        ("03-stride-d", "walk-03-stride-d-16.png", "passing pose returning left foot forward; root remains fixed"),
    ],
    "attack": [
        ("00-windup", "attack-00-windup-16.png", "short spear-thrust anticipation; pelvis and shoulders draw back; feet grounded"),
        ("01-contact", "attack-01-contact-16.png", "spear extended at contact; torso leans into attack; feet grounded"),
        ("02-follow-through", "attack-02-follow-through-16.png", "committed extension follows spear tip through target space"),
        ("03-recovery", "attack-03-recovery-16.png", "withdraw spear and return balance toward neutral guard"),
    ],
    "hit": [
        ("00-flinch", "hit-00-flinch-16.png", "brief shoulder-and-head flinch backward; spear visible; feet planted"),
        ("01-recoil", "hit-01-recoil-16.png", "strong torso recoil; weight sinks slightly; feet planted"),
        ("02-recover", "hit-02-recover-16.png", "body straightens and spear returns to front guard"),
        ("03-ready", "hit-03-ready-16.png", "balanced ready silhouette returning cleanly to idle"),
    ],
    "death": [
        ("00-fall", "death-00-fall-16.png", "defeated posture tips and knees buckle; spear lowers; non-graphic"),
        ("01-collapse", "death-01-collapse-16.png", "goblin falls sideways while still holding spear; non-graphic"),
        ("02-ground", "death-02-ground-16.png", "fully grounded prone goblin and spear; compact silhouette"),
        ("03-settle", "death-03-settle-16.png", "final still side-lying on the flank; relaxed limbs; dropped spear resting separately"),
    ],
}

SHEETS = {
    "idle-16.png": {
        "sourceImageId": "exec-a9a2b439-12bc-4a74-837c-54bc3d90c1c5.png",
        "action": "idle",
        "phase": "idle",
        "promptSummary": "16-direction neutral ready stance; spear held upright in relaxed guard.",
    },
    "walk-00-stride-a-16.png": {
        "sourceImageId": "exec-79d76daf-dead-40e6-b76e-1a4250b2ca21.png",
        "action": "walk",
        "phase": "00-stride-a",
        "promptSummary": "Left lead-foot support, right foot trailing; relaxed spear guard.",
    },
    "walk-01-stride-b-16.png": {
        "sourceImageId": "exec-3d436fcc-0f11-48fc-a4b9-3a9e845767dc.png",
        "action": "walk",
        "phase": "01-stride-b",
        "promptSummary": "Passing pose; right foot passes under hips; counter-rotation; fixed root.",
    },
    "walk-02-stride-c-16.png": {
        "sourceImageId": "exec-bbaef625-7ae9-4722-a257-b00f5777e0b6.png",
        "action": "walk",
        "phase": "02-stride-c",
        "promptSummary": "Right lead-foot support, left foot trailing; spear balances the stride.",
    },
    "walk-03-stride-d-16.png": {
        "sourceImageId": "exec-796b85ba-2bdf-4f93-b3f9-95dfc23dfafd.png",
        "action": "walk",
        "phase": "03-stride-d",
        "promptSummary": "Passing pose returning left foot forward; fixed root.",
    },
    "attack-00-windup-16.png": {
        "sourceImageId": "exec-f1b29475-1c4b-4715-a24c-b10153a1120d.png",
        "action": "attack",
        "phase": "00-windup",
        "promptSummary": "Spear-thrust anticipation; pelvis and shoulders draw back; front foot grounded.",
    },
    "attack-01-contact-16.png": {
        "sourceImageId": "exec-3b68f09b-8711-4c12-b3c6-6e95d61ddb97.png",
        "action": "attack",
        "phase": "01-contact",
        "promptSummary": "Spear fully extended at contact; torso leans into attack; feet grounded.",
    },
    "attack-02-follow-through-16.png": {
        "sourceImageId": "exec-8b3c0f21-8749-4cfb-8dbc-83b9a6a6dcd7.png",
        "action": "attack",
        "phase": "02-follow-through",
        "promptSummary": "Committed spear extension follows through target space; feet remain grounded.",
    },
    "attack-03-recovery-16.png": {
        "sourceImageId": "exec-3c18c123-1165-45ff-a03c-4e00e341a7db.png",
        "action": "attack",
        "phase": "03-recovery",
        "promptSummary": "Spear withdraws as balance returns toward the neutral guard.",
    },
    "hit-00-flinch-16.png": {
        "sourceImageId": "exec-12933e90-47b8-4cc4-873e-9ef33276ac32.png",
        "action": "hit",
        "phase": "00-flinch",
        "promptSummary": "Brief shoulder-and-head flinch backward; spear visible; feet planted.",
    },
    "hit-01-recoil-16.png": {
        "sourceImageId": "exec-bf92aa5f-c0c5-4e54-bcb6-eb3eb4420a2f.png",
        "action": "hit",
        "phase": "01-recoil",
        "promptSummary": "Strong torso recoil; weight sinks slightly; feet remain planted.",
    },
    "hit-02-recover-16.png": {
        "sourceImageId": "exec-b2169962-853b-4903-ac36-903fb3377d9c.png",
        "action": "hit",
        "phase": "02-recover",
        "promptSummary": "Body straightens; spear returns to front guard.",
    },
    "hit-03-ready-16.png": {
        "sourceImageId": "exec-8c47fab0-6282-47b5-afbe-7495ee06d4b2.png",
        "action": "hit",
        "phase": "03-ready",
        "promptSummary": "Balanced ready silhouette returning cleanly to idle.",
    },
    "death-00-fall-16.png": {
        "sourceImageId": "exec-fcf91b52-f1d2-4d2b-b5f0-a644d4561564.png",
        "action": "death",
        "phase": "00-fall",
        "promptSummary": "Defeated posture tips and knees begin to buckle; spear lowers; non-graphic.",
    },
    "death-01-collapse-16.png": {
        "sourceImageId": "exec-620dd8ff-ab55-4af5-bd51-e68aae392400.png",
        "action": "death",
        "phase": "01-collapse",
        "promptSummary": "Goblin falls sideways while still holding spear; non-graphic.",
    },
    "death-02-ground-16.png": {
        "sourceImageId": "exec-8af18202-4005-4416-ac7f-07d2cb61ca0e.png",
        "action": "death",
        "phase": "02-ground",
        "promptSummary": "Fully grounded prone goblin and spear; compact silhouette.",
    },
    "death-03-settle-16.png": {
        "sourceImageId": "exec-fe00228d-6b5b-49de-81c9-5f19439aa770.png",
        "action": "death",
        "phase": "03-settle",
        "promptSummary": "Textured side-lying pose matched to Goblin idle/death02 references; cheek, shoulder, flank, and hip grounded; closed detailed face; relaxed limbs; dropped spear separate beside the legs.",
    },
}

REJECTED_SHEETS = [
    {
        "file": "death-03-settle-v1-prone.png",
        "sourceImageId": "exec-faa31c44-747e-40b9-acc3-74cdad185afb.png",
        "reason": "Visually duplicated death 02-ground as a belly-down prone pose.",
    },
    {
        "file": "death-03-settle-v2-belly-down.png",
        "sourceImageId": "exec-b50fce63-c905-432c-ba39-0dec2a6c6638.png",
        "reason": "Still read as belly-down instead of a distinct lateral side-lying settle pose.",
    },
    {
        "file": "death-03-settle-v3-belly-down.png",
        "sourceImageId": "exec-4be9eac8-ed92-4d69-9399-676686387669.png",
        "reason": "Improved spear separation but torso still read as belly-down rather than lateral.",
    },
    {
        "file": "death-03-settle-v4-lateral-style-mismatch.png",
        "sourceImageId": "exec-79f8faea-49e9-4c50-98b3-871efe54da56.png",
        "reason": "Clear lateral silhouette, but face and clothing lost the texture/detail of the Goblin source and neighboring death phases.",
    },
]

PROMPT_CONTRACT = {
    "useCase": "stylized-concept",
    "assetType": "candidate source contact sheet for ModWorld Goblin animation",
    "inputImages": [
        {"path": "archive/art-reference/monsters/humanoid/goblin/spear-goblin/source/reference.png", "role": "Goblin identity, proportions, palette, and spear reference"},
        {"path": "art-reference/animation/outputs/goblin-v5/frames/idle/south/south.png", "role": "approved-style direction sample for detailed Goblin face, palette, and pixel shading"},
        {"path": "art-reference/animation/outputs/goblin-v5/frames/death/south/02-ground.png", "role": "neighboring death phase for sequence continuity and outfit detail"},
    ],
    "subject": "small stocky green goblin, huge pointed ears, bald head, orange eyes, brown leather scraps/tunic, belt, ragged trousers and boots, one short spear with stone/iron point",
    "weaponContract": "spear is carried in the anatomical right hand except in death 03-settle, where it is dropped separately beside the body",
    "style": "crisp hand-crafted pixel art, chunky readable clusters, muted olive-green and brown palette, transparent hard edges",
    "sheet": {"columns": 4, "rows": 4, "width": 1024, "height": 1536, "cellWidth": 256, "cellHeight": 384},
    "sourceCellAnchor": {"x": 128, "y": 288, "meaning": "goblin center and foot/root line; provisional source prompt target"},
    "constraints": [
        "one complete goblin in each cell; no pose spills between cells",
        "distinct facing per direction; keep camera fixed; do not mirror a view to fabricate another direction",
        "no grid lines, captions, labels, background, floor, cast shadow, glow, UI, watermark, or extra characters",
        "no antialiasing or motion streaks",
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


def save_png_with_retry(image: Image.Image, path: Path) -> None:
    for attempt in range(4):
        try:
            image.save(path, format="PNG")
            return
        except OSError as error:
            if error.errno != 22 or attempt == 3:
                raise
            time.sleep(0.25 * (attempt + 1))


def confidence_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    threshold = alpha.point(lambda value: 255 if value >= CONFIDENCE_THRESHOLD else 0)
    bbox = threshold.getbbox()
    if bbox is None:
        raise ValueError("Generated source cell has no pixels above the alpha confidence threshold")
    return bbox


def action_frame_entries(poses: dict, action: str) -> dict[str, dict]:
    entries = {}
    for item in poses["actions"][action]["frames"]:
        entries.setdefault(item["direction"], {})[item["file"]] = item
    return entries


def existing_pose_path(action: str, direction: str, filename: str) -> Path:
    if action == "idle":
        return SPECIES_ROOT / "poses/idle" / filename
    return SPECIES_ROOT / "poses" / action / direction / filename


def existing_meta_path(png_path: Path) -> Path:
    return png_path.with_name(png_path.stem + ".meta.json")


def get_approved_phase_targets(poses: dict) -> dict[tuple[str, str], float]:
    heights: dict[tuple[str, str], list[int]] = defaultdict(list)
    for action in ("idle", "walk", "attack", "hit", "death"):
        entries = action_frame_entries(poses, action)
        for direction, by_file in entries.items():
            for filename in by_file:
                path = existing_pose_path(action, direction, filename)
                metadata_path = existing_meta_path(path)
                if not path.is_file() or not metadata_path.is_file():
                    continue
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                if metadata.get("status") != "approved-source-pose":
                    continue
                image = Image.open(path).convert("RGBA")
                if image.size != (FRAME_SIZE, FRAME_SIZE):
                    continue
                bbox = confidence_bbox(image)
                phase = "idle" if action == "idle" else Path(filename).stem
                heights[(action, phase)].append(bbox[3] - bbox[1])

    targets = {key: float(median(values)) for key, values in heights.items() if values}
    expected_keys = {
        (action, phase)
        for action, phases in PHASES.items()
        for phase, _, _ in phases
    }
    missing = sorted(expected_keys - targets.keys())
    if missing:
        raise ValueError(f"No approved source frame measurements for phase(s): {missing}")
    return targets


def prepare_sheet_sidecars(poses: dict) -> list[dict]:
    direction_data = poses["directions"]
    if [item["name"] for item in direction_data] != DIRECTIONS:
        raise ValueError("The v5 direction order differs from the expected 16-direction contact-sheet map")
    sidecar_index = []
    for filename, info in SHEETS.items():
        image_path = SHEET_DIR / filename
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        with Image.open(image_path) as image:
            if image.size != SHEET_SIZE:
                raise ValueError(f"{filename}: expected {SHEET_SIZE}, got {image.size}")
            mode = image.mode
        item = {
            "status": "candidate-source-review-required",
            "speciesId": "goblin",
            "generator": "built-in image_gen",
            "sourceImageId": info["sourceImageId"],
            "file": f"source/v5-contact-sheets/{filename}",
            "sha256": sha256(image_path),
            "action": info["action"],
            "phase": info["phase"],
            "phasePrompt": info["promptSummary"],
            "promptContract": PROMPT_CONTRACT,
            "transparentBackgroundRequested": True,
            "sourceCanvas": {"width": SHEET_SIZE[0], "height": SHEET_SIZE[1], "mode": mode},
            "cellCanvas": {"width": SOURCE_CELL_SIZE[0], "height": SOURCE_CELL_SIZE[1]},
            "layout": {"columns": 4, "rows": 4, "cellOrder": "row-major"},
            "directionOrder": DIRECTIONS,
            "targetFrameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
            "targetAnchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "inherited Goblin 8-direction anchor; 16-direction alignment remains unreviewed"},
            "qa": {"identity": False, "facing": False, "pose": False, "alphaEdges": False, "anchor": False, "atlas": False, "runtimePromotion": False},
        }
        write_json(image_path.with_suffix(".meta.json"), item)
        sidecar_index.append(item)
    return sidecar_index


def prepare_rejected_sheet_records() -> list[dict]:
    rejected_dir = OUT / "source/rejected"
    records = []
    for item in REJECTED_SHEETS:
        image_path = rejected_dir / item["file"]
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        with Image.open(image_path) as image:
            if image.size != SHEET_SIZE:
                raise ValueError(f"Rejected sheet {item['file']} has unexpected dimensions {image.size}")
            mode = image.mode
        record = {
            "status": "rejected-source-not-for-atlas",
            "speciesId": "goblin",
            "generator": "built-in image_gen",
            "sourceImageId": item["sourceImageId"],
            "file": f"source/rejected/{item['file']}",
            "sha256": sha256(image_path),
            "action": "death",
            "phase": "03-settle",
            "rejectionReason": item["reason"],
            "sourceCanvas": {"width": SHEET_SIZE[0], "height": SHEET_SIZE[1], "mode": mode},
            "qa": {"identity": False, "facing": False, "pose": False, "alphaEdges": False, "anchor": False, "atlas": False},
        }
        write_json(image_path.with_suffix(".meta.json"), record)
        records.append(record)
    return records


def make_candidate_frame(
    sheet_path: Path,
    direction_index: int,
    target_height: float,
) -> tuple[Image.Image, dict]:
    with Image.open(sheet_path) as sheet_image:
        sheet = sheet_image.convert("RGBA")
    if sheet.size != SHEET_SIZE:
        raise ValueError(f"{sheet_path.name}: expected {SHEET_SIZE}, got {sheet.size}")
    row, column = divmod(direction_index, 4)
    source_box = (
        column * SOURCE_CELL_SIZE[0],
        row * SOURCE_CELL_SIZE[1],
        (column + 1) * SOURCE_CELL_SIZE[0],
        (row + 1) * SOURCE_CELL_SIZE[1],
    )
    cell = sheet.crop(source_box)
    bbox = confidence_bbox(cell)
    alpha = cell.getchannel("A")
    hard_mask = alpha.point(lambda value: 255 if value >= CONFIDENCE_THRESHOLD else 0)
    recovered_mask = hard_mask.filter(ImageFilter.MaxFilter(SOFT_EDGE_RECOVERY_RADIUS * 2 + 1))
    cleaned_alpha = ImageChops.multiply(alpha, recovered_mask)
    cell.putalpha(cleaned_alpha)

    source_height = bbox[3] - bbox[1]
    scale = target_height / source_height
    if not 0.35 <= scale <= 1.35:
        raise ValueError(f"Unexpected scale {scale:.4f} for {sheet_path.name} cell {direction_index}")

    # Inverse affine maps source root (128, bbox-bottom) exactly to atlas root (192, 288).
    inverse = (
        1.0 / scale,
        0,
        SOURCE_ANCHOR_X - ANCHOR[0] / scale,
        0,
        1.0 / scale,
        bbox[3] - ANCHOR[1] / scale,
    )
    frame = cell.transform(
        (FRAME_SIZE, FRAME_SIZE),
        Image.Transform.AFFINE,
        inverse,
        resample=Image.Resampling.NEAREST,
        fillcolor=(0, 0, 0, 0),
    )
    source_data = {
        "row": row,
        "column": column,
        "box": list(source_box),
        "confidenceBoundsInCell": list(bbox),
        "sourceVisualFootBaselineY": bbox[3],
        "targetVisualFootBaselineY": ANCHOR[1],
        "sourceConfidenceBoundsHeight": source_height,
        "targetReferenceMedianHeight": target_height,
        "uniformScale": round(scale, 6),
    }
    return frame, source_data


def write_previews(atlas: Image.Image) -> None:
    preview = atlas.resize((16 * PREVIEW_CELL, 17 * PREVIEW_CELL), Image.Resampling.NEAREST)
    preview.save(ATLAS_DIR / "animation-v5-color-preview.png")
    neutral = Image.new("RGBA", preview.size, (40, 44, 54, 255))
    neutral.alpha_composite(preview)
    neutral.convert("RGB").save(ATLAS_DIR / "animation-v5-color-preview-neutral.png")
    silhouette = Image.new("RGBA", preview.size, (16, 18, 22, 255))
    preview_alpha = preview.getchannel("A")
    opaque = Image.new("RGBA", preview.size, (235, 238, 224, 255))
    silhouette.alpha_composite(Image.composite(opaque, Image.new("RGBA", preview.size, (0, 0, 0, 0)), preview_alpha))
    silhouette.save(ATLAS_DIR / "animation-v5-silhouette-preview.png")
    death_rows = Image.new("RGBA", (16 * DEATH_REVIEW_CELL, 2 * DEATH_REVIEW_CELL), (0, 0, 0, 0))
    for review_row, atlas_row in enumerate((15, 16)):
        for column in range(16):
            source = atlas.crop((column * FRAME_SIZE, atlas_row * FRAME_SIZE, (column + 1) * FRAME_SIZE, (atlas_row + 1) * FRAME_SIZE))
            sample = source.resize((DEATH_REVIEW_CELL, DEATH_REVIEW_CELL), Image.Resampling.NEAREST)
            death_rows.paste(sample, (column * DEATH_REVIEW_CELL, review_row * DEATH_REVIEW_CELL))
    death_rows_background = Image.new("RGBA", death_rows.size, (40, 44, 54, 255))
    death_rows_background.alpha_composite(death_rows)
    death_rows_background.convert("RGB").save(ATLAS_DIR / "animation-v5-death-rows-review.png")


def main() -> None:
    for directory in (SHEET_DIR, FRAME_DIR, ATLAS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    poses = json.loads(POSES_JSON.read_text(encoding="utf-8"))
    sheet_sidecars = prepare_sheet_sidecars(poses)
    rejected_sheet_records = prepare_rejected_sheet_records()
    phase_targets = get_approved_phase_targets(poses)
    entry_maps = {action: action_frame_entries(poses, action) for action in PHASES}

    source_inventory = {
        "expectedPosePaths": 272,
        "presentPngPathsBeforeCandidate": 107,
        "approvedSourcePoseFramesUsable": 40,
        "candidateReviewPngPathsExcluded": 67,
        "candidateReviewExclusionReason": "Sampled PNGs are 1254x1254 full contact sheets, not 384x384 pose frames.",
        "scannerNote": "The inventory script counts source-tree PNG paths, not frame geometry or visual approval. Candidate work remains outside the source tree.",
    }

    atlas = Image.new("RGBA", (16 * FRAME_SIZE, 17 * FRAME_SIZE), (0, 0, 0, 0))
    frame_manifest = []
    source_counts = Counter()
    row_manifest = []
    atlas_row = 0

    for action in ("idle", "walk", "attack", "hit", "death"):
        for phase, sheet_name, phase_description in PHASES[action]:
            sheet = SHEET_DIR / sheet_name
            row_entries = []
            for direction_index, direction in enumerate(DIRECTIONS):
                phase_filename = next(iter(entry_maps[action][direction])) if action == "idle" else f"{phase}.png"
                entry = entry_maps[action][direction].get(phase_filename)
                if entry is None:
                    raise ValueError(f"Missing template frame map: {action}/{direction}/{phase_filename}")
                original = existing_pose_path(action, direction, entry["file"])
                original_meta = existing_meta_path(original)
                original_info = json.loads(original_meta.read_text(encoding="utf-8")) if original_meta.is_file() else {}
                frame_relative = Path(action) / direction / entry["file"]
                frame_path = FRAME_DIR / frame_relative
                metadata_path = frame_path.with_name(frame_path.stem + ".meta.json")
                frame_path.parent.mkdir(parents=True, exist_ok=True)

                if original.is_file() and original_info.get("status") == "approved-source-pose":
                    with Image.open(original) as source_frame:
                        if source_frame.size != (FRAME_SIZE, FRAME_SIZE):
                            raise ValueError(f"Approved source pose has incorrect dimensions: {original}")
                        source_frame.convert("RGBA").save(frame_path)
                    frame_metadata = {
                        "status": "preserved-approved-source-pose",
                        "speciesId": "goblin",
                        "action": action,
                        "direction": direction,
                        "pose": phase,
                        "source": original.relative_to(ROOT).as_posix(),
                        "sourceMetadata": original_meta.relative_to(ROOT).as_posix(),
                        "sourcePixelsModified": False,
                        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
                        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "copied from approved Goblin animation metadata"},
                        "qa": {"sourcePoseApproved": True, "sixteenDirectionAtlas": False, "visualReview": False, "runtimePromotion": False},
                    }
                    source_kind = "preserved-approved-source-pose"
                    source_counts["preservedApprovedSourceFrames"] += 1
                else:
                    candidate, source_cell = make_candidate_frame(sheet, direction_index, phase_targets[(action, phase)])
                    save_png_with_retry(candidate, frame_path)
                    sheet_meta = json.loads(sheet.with_suffix(".meta.json").read_text(encoding="utf-8"))
                    frame_metadata = {
                        "status": "imagegen-candidate-review-required",
                        "speciesId": "goblin",
                        "action": action,
                        "direction": direction,
                        "pose": phase,
                        "generator": "built-in image_gen",
                        "source": f"source/v5-contact-sheets/{sheet_name}",
                        "sourceImageId": sheet_meta["sourceImageId"],
                        "sourceCell": source_cell,
                        "sourcePixelsModified": True,
                        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
                        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "inherited 8-direction Goblin anchor; visual measurement pending"},
                        "processing": {
                            "method": "alpha-confidence-crop-scale-anchor-v1",
                            "confidenceThreshold": CONFIDENCE_THRESHOLD,
                            "softEdgeRecoveryRadius": SOFT_EDGE_RECOVERY_RADIUS,
                            "scaleReference": "median alpha-bound height of approved Goblin source poses for this action/phase",
                            "uniformScale": source_cell["uniformScale"],
                        },
                        "qa": {"identity": False, "facing": False, "pose": False, "alphaEdges": False, "anchor": False, "atlas": False, "runtimePromotion": False},
                    }
                    source_kind = "generated-candidate"
                    source_counts["generatedCandidateFrames"] += 1

                write_json(metadata_path, frame_metadata)
                with Image.open(frame_path) as final_frame:
                    if final_frame.size != (FRAME_SIZE, FRAME_SIZE):
                        raise ValueError(f"Composed frame is not 384x384: {frame_path}")
                    if final_frame.getchannel("A").getbbox() is None:
                        raise ValueError(f"Composed frame is fully transparent: {frame_path}")
                    atlas.paste(final_frame.convert("RGBA"), (direction_index * FRAME_SIZE, atlas_row * FRAME_SIZE))
                row_entry = {
                    "column": direction_index,
                    "direction": direction,
                    "sourceKind": source_kind,
                    "frame": f"frames/{frame_relative.as_posix()}",
                    "metadata": f"frames/{metadata_path.relative_to(FRAME_DIR).as_posix()}",
                }
                row_entries.append(row_entry)
                frame_manifest.append({"row": atlas_row, **row_entry, "action": action, "pose": phase})

            row_manifest.append({"row": atlas_row, "action": action, "pose": phase, "description": phase_description, "directions": row_entries})
            atlas_row += 1

    if atlas_row != 17:
        raise ValueError(f"Expected 17 atlas rows, got {atlas_row}")
    if source_counts["preservedApprovedSourceFrames"] != 40 or source_counts["generatedCandidateFrames"] != 232:
        raise ValueError(f"Expected 40 preserved + 232 generated frames, got {dict(source_counts)}")

    atlas_path = ATLAS_DIR / "animation-v5-candidate.png"
    atlas.save(atlas_path)
    write_previews(atlas)
    atlas_metadata = {
        "status": "candidate-review-required",
        "speciesId": "goblin",
        "race": "humanoid",
        "version": "v5",
        "generator": "built-in image_gen for candidate cells; existing approved Goblin 8-direction source poses preserved where available",
        "file": "animation-v5-candidate.png",
        "sourceCanvas": {"width": atlas.width, "height": atlas.height, "mode": "RGBA"},
        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1], "provenance": "inherited approved Goblin anchor; 16-direction measurement and visual approval pending"},
        "layout": {"columns": 16, "rows": 17, "frameCount": 272, "cellOrder": "row-major"},
        "directions": poses["directions"],
        "actionRowOrder": ["idle", "walk", "attack", "hit", "death"],
        "framesPerDirection": {"idle": 1, "walk": 4, "attack": 4, "hit": 4, "death": 4},
        "rowOrder": [f"{row['row']}: {row['action']} {row['pose']}" for row in row_manifest],
        "sourceCounts": dict(source_counts),
        "sourceInventory": source_inventory,
        "sourceSheets": [
            {
                "file": item["file"],
                "sourceImageId": item["sourceImageId"],
                "action": item["action"],
                "phase": item["phase"],
                "metadata": str(Path(item["file"]).with_suffix(".meta.json")).replace("\\", "/"),
            }
            for item in sheet_sidecars
        ],
        "rejectedSourceSheets": rejected_sheet_records,
        "rows": row_manifest,
        "qa": {
            "identity": False,
            "sixteenDirections": False,
            "posePhases": False,
            "alphaEdges": False,
            "rootAnchor": False,
            "atlas": False,
            "visualReview": False,
            "runtimePromotion": False,
        },
        "previewFiles": ["animation-v5-color-preview.png", "animation-v5-color-preview-neutral.png", "animation-v5-silhouette-preview.png", "animation-v5-death-rows-review.png"],
        "notes": [
            "This is a pending review candidate only; do not use at runtime.",
            "Forty 384x384 approved-source Goblin poses are preserved unchanged. The other 232 cells were generated from the 17 active 16-direction sheets. Four earlier death 03-settle sheets remain under source/rejected/ and are excluded.",
            "The inventory scanner reported 107 PNG paths. Sixty-seven candidate-review PNGs are full 1254x1254 contact sheets, not individual 384x384 poses, and are excluded from this atlas.",
            "Generated source cells were alpha-confidence trimmed, uniformly scaled to the matching approved action/phase median alpha-bound height, and aligned provisionally to (192,288). All generated-cell and atlas QA remains false.",
        ],
    }
    write_json(ATLAS_DIR / "animation-v5-candidate.json", atlas_metadata)

    readme = """# Goblin v5 16-direction candidate

This directory is review-only. Nothing here is promoted to runtime.

`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas at 6144 × 6528 px. It contains 272 cells of 384 × 384 px: one idle row and four rows each for walk, attack, hit, and death. Directions run left to right in the order recorded in the JSON manifest.

The atlas preserves 40 384x384 poses from the approved Goblin 8-direction atlas and supplies 232 new candidate poses from the 17 active 4x4 source sheets. Four rejected death 03-settle attempts remain in `source/rejected/`; they are excluded. The source-tree inventory still reports 107/272 PNG paths. Of those, 67 files marked `candidate-review` are actually 1254x1254 contact sheets, not frame crops, so they were excluded from this atlas. The inventory tool counts paths, not dimensions or visual approval.

Generated sheets and extracted frames are in `source/v5-contact-sheets/` and `frames/`. Each has JSON provenance with its source image ID, action/phase, contact-sheet cell order, reference inputs, prompt contract, and processing measurements. `assemble_candidate.py` rebuilds the candidate artifacts without changing the species source tree.

The generated frames were trimmed using alpha confidence threshold 128 with a 3 px soft-edge recovery, scaled to the median alpha-bound height measured from approved Goblin source poses of the same action/phase, and aligned provisionally to anchor (192, 288). These are structural processing choices, not visual approval.

`atlas/animation-v5-death-rows-review.png` places death 02-ground and 03-settle side by side across all 16 directions. `atlas/animation-v5-color-preview-neutral.png` composites the color preview over a neutral background so alpha remnants are easier to spot.

All atlas QA flags are false. Identity, exact facing, spear hand, action continuity, alpha edges, 16-direction root placement, and the actual atlas still need visual review. The built-in 8 × 5 production QA does not validate this 16 × 17 layout. Use the color and silhouette previews for review, then verify the final candidate at native cell scale before any promotion.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")

    print(json.dumps({
        "status": "candidate-review-required",
        "atlas": str(atlas_path.relative_to(ROOT)).replace("\\", "/"),
        "dimensions": list(atlas.size),
        "rows": atlas_row,
        "columns": 16,
        "frames": len(frame_manifest),
        "sourceCounts": dict(source_counts),
        "rawSheets": len(sheet_sidecars),
        "output": str(OUT.relative_to(ROOT)).replace("\\", "/"),
    }, indent=2))


if __name__ == "__main__":
    main()
