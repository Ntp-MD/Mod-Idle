"""Build the Vampire v5 review candidate without modifying source/runtime assets."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
CONFIG = json.loads((OUT / "candidate-config.json").read_text(encoding="utf-8"))
FRAME_DIR = OUT / "frames"
SHEET_DIR = OUT / "source/v5-contact-sheets"
ATLAS_DIR = OUT / "atlas"
FRAME = 384
SOURCE_CELL = (256, 384)
SHEET_SIZE = (1024, 1536)
SOURCE_ANCHOR = 128
ANCHOR = (192, 288)
THRESHOLD = 128
EDGE_RADIUS = 3


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def frame_path(action: str, direction: str, phase: str) -> Path:
    filename = "idle.png" if action == "idle" else f"{phase}.png"
    return FRAME_DIR / action / direction / filename


def phase_targets() -> dict[tuple[str, str], float]:
    heights: dict[tuple[str, str], list[int]] = {}
    for action, phases in CONFIG["phases"].items():
        for phase in phases:
            key = (action, phase)
            for direction in CONFIG["directions"]:
                png = frame_path(action, direction, phase)
                sidecar = png.with_name(png.stem + ".meta.json")
                if not png.is_file() or not sidecar.is_file():
                    continue
                meta = json.loads(sidecar.read_text(encoding="utf-8"))
                if meta.get("status") != "preserved-approved-source-pose":
                    continue
                image = Image.open(png).convert("RGBA")
                if image.size != (FRAME, FRAME):
                    raise ValueError(f"approved source frame has bad dimensions: {png}")
                mask = image.getchannel("A").point(lambda v: 255 if v >= THRESHOLD else 0)
                bbox = mask.getbbox()
                if bbox is None:
                    raise ValueError(f"approved source frame has empty alpha bounds: {png}")
                heights.setdefault(key, []).append(bbox[3] - bbox[1])
    missing = [(a, p) for a, phases in CONFIG["phases"].items() for p in phases if not heights.get((a, p))]
    if missing:
        raise ValueError(f"No approved source scale reference for phases: {missing}")
    return {key: float(median(values)) for key, values in heights.items()}


def make_frame(sheet: Path, direction_index: int, target_height: float) -> tuple[Image.Image, dict]:
    image = Image.open(sheet).convert("RGBA")
    if image.size != SHEET_SIZE:
        raise ValueError(f"{sheet.name}: expected {SHEET_SIZE}, got {image.size}")
    row, col = divmod(direction_index, 4)
    box = (col * SOURCE_CELL[0], row * SOURCE_CELL[1], (col + 1) * SOURCE_CELL[0], (row + 1) * SOURCE_CELL[1])
    cell = image.crop(box)
    alpha = cell.getchannel("A")
    hard = alpha.point(lambda v: 255 if v >= THRESHOLD else 0)
    bbox = hard.getbbox()
    if bbox is None:
        raise ValueError(f"{sheet.name} cell {direction_index} has no alpha >= {THRESHOLD}")
    recovered = hard.filter(ImageFilter.MaxFilter(EDGE_RADIUS * 2 + 1))
    cell.putalpha(ImageChops.multiply(alpha, recovered))
    source_height = bbox[3] - bbox[1]
    scale = target_height / source_height
    if not 0.35 <= scale <= 1.35:
        raise ValueError(f"unexpected scale {scale:.4f} in {sheet.name} cell {direction_index}")
    inverse = (1 / scale, 0, SOURCE_ANCHOR - ANCHOR[0] / scale, 0, 1 / scale, bbox[3] - ANCHOR[1] / scale)
    frame = cell.transform((FRAME, FRAME), Image.Transform.AFFINE, inverse, resample=Image.Resampling.NEAREST, fillcolor=(0, 0, 0, 0))
    record = {
        "row": row,
        "column": col,
        "box": list(box),
        "confidenceBoundsInCell": list(bbox),
        "sourceConfidenceBoundsHeight": source_height,
        "targetReferenceMedianHeight": target_height,
        "uniformScale": round(scale, 6),
    }
    return frame, record


def save_previews(atlas: Image.Image) -> list[str]:
    cell = 96
    preview = atlas.resize((16 * cell, 17 * cell), Image.Resampling.NEAREST)
    color_path = ATLAS_DIR / "animation-v5-color-preview.png"
    preview.save(color_path)
    neutral = Image.new("RGBA", preview.size, (40, 44, 54, 255))
    neutral.alpha_composite(preview)
    neutral.convert("RGB").save(ATLAS_DIR / "animation-v5-color-preview-neutral.png")
    silhouette = Image.new("RGBA", preview.size, (16, 18, 22, 255))
    white = Image.new("RGBA", preview.size, (235, 238, 224, 255))
    white.putalpha(preview.getchannel("A"))
    silhouette.alpha_composite(white)
    silhouette.save(ATLAS_DIR / "animation-v5-silhouette-preview.png")
    death = Image.new("RGBA", (16 * 192, 2 * 192), (40, 44, 54, 255))
    for rr, atlas_row in enumerate((15, 16)):
        for cc in range(16):
            source = atlas.crop((cc * FRAME, atlas_row * FRAME, (cc + 1) * FRAME, (atlas_row + 1) * FRAME))
            death.alpha_composite(source.resize((192, 192), Image.Resampling.NEAREST), (cc * 192, rr * 192))
    death.convert("RGB").save(ATLAS_DIR / "animation-v5-death-rows-review.png")
    return [p.name for p in (color_path, ATLAS_DIR / "animation-v5-color-preview-neutral.png", ATLAS_DIR / "animation-v5-silhouette-preview.png", ATLAS_DIR / "animation-v5-death-rows-review.png")]


def main() -> None:
    directions = CONFIG["directions"]
    phases = CONFIG["phases"]
    targets = phase_targets()
    atlas = Image.new("RGBA", (16 * FRAME, 17 * FRAME), (0, 0, 0, 0))
    counts: Counter[str] = Counter()
    rows = []
    frame_records = []
    atlas_row = 0

    for action in ("idle", "walk", "attack", "hit", "death"):
        for phase in phases[action]:
            sheet_name = "idle-16.png" if action == "idle" else f"{action}-{phase}-16.png"
            sheet_path = SHEET_DIR / sheet_name
            sheet_meta_path = sheet_path.with_suffix(".meta.json")
            if not sheet_path.is_file() or not sheet_meta_path.is_file():
                raise FileNotFoundError(f"missing raw sheet or sidecar: {sheet_path}")
            sheet_meta = json.loads(sheet_meta_path.read_text(encoding="utf-8"))
            row_frames = []
            for col, direction in enumerate(directions):
                dest = frame_path(action, direction, phase)
                sidecar = dest.with_name(dest.stem + ".meta.json")
                source_info = json.loads(sidecar.read_text(encoding="utf-8")) if sidecar.is_file() else {}
                if source_info.get("status") == "preserved-approved-source-pose":
                    image = Image.open(dest).convert("RGBA")
                    if image.size != (FRAME, FRAME):
                        raise ValueError(f"preserved source frame has bad dimensions: {dest}")
                    source_kind = "preserved-approved-source-pose"
                    counts[source_kind] += 1
                else:
                    image, source_cell = make_frame(sheet_path, col, targets[(action, phase)])
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    image.save(dest)
                    frame_meta = {
                        "status": "imagegen-candidate-review-required",
                        "speciesId": CONFIG["speciesId"],
                        "action": action,
                        "direction": direction,
                        "pose": phase,
                        "generator": "built-in image_gen",
                        "source": f"source/v5-contact-sheets/{sheet_name}",
                        "sourceImageId": sheet_meta["sourceImageId"],
                        "sourceCell": source_cell,
                        "sourcePixelsModified": True,
                        "frameCanvas": {"width": FRAME, "height": FRAME},
                        "anchor": {**CONFIG["anchor"], "visualMeasurementPending": True},
                        "processing": {"method": "alpha-confidence-crop-scale-anchor-v1", "confidenceThreshold": THRESHOLD, "softEdgeRecoveryRadius": EDGE_RADIUS, "uniformScale": source_cell["uniformScale"], "scaleReference": "median alpha-bound height of preserved approved source frames for this action/phase"},
                        "qa": {"identity": False, "facing": False, "pose": False, "alphaEdges": False, "anchor": False, "atlas": False, "runtimePromotion": False},
                    }
                    write_json(sidecar, frame_meta)
                    source_kind = "generated-candidate"
                    counts[source_kind] += 1
                if image.getchannel("A").getbbox() is None:
                    raise ValueError(f"empty output frame: {dest}")
                atlas.paste(image, (col * FRAME, atlas_row * FRAME))
                record = {"row": atlas_row, "column": col, "action": action, "phase": phase, "direction": direction, "sourceKind": source_kind, "file": dest.relative_to(OUT).as_posix()}
                row_frames.append(record)
                frame_records.append(record)
            rows.append({"row": atlas_row, "action": action, "phase": phase, "frames": row_frames})
            atlas_row += 1

    if atlas_row != 17 or len(frame_records) != 272:
        raise ValueError(f"expected 17 rows/272 frames, got {atlas_row}/{len(frame_records)}")
    if counts["preserved-approved-source-pose"] != 40 or counts["generated-candidate"] != 232:
        raise ValueError(f"expected 40 preserved + 232 generated, got {dict(counts)}")
    atlas_path = ATLAS_DIR / "animation-v5-candidate.png"
    atlas.save(atlas_path)
    preview_files = save_previews(atlas)
    audit = json.loads((OUT / "source-audit.json").read_text(encoding="utf-8"))
    source_sheets = []
    for action in ("idle", "walk", "attack", "hit", "death"):
        for phase in phases[action]:
            filename = "idle-16.png" if action == "idle" else f"{action}-{phase}-16.png"
            sidecar = json.loads((SHEET_DIR / filename).with_suffix(".meta.json").read_text(encoding="utf-8"))
            source_sheets.append({"file": sidecar["file"], "sourceImageId": sidecar["sourceImageId"], "action": action, "phase": phase, "sha256": sidecar["sha256"], "alphaAudit": sidecar.get("alphaAudit")})
    metadata = {
        "status": "candidate-review-required",
        "speciesId": CONFIG["speciesId"],
        "race": CONFIG["race"],
        "version": "v5",
        "generator": "built-in image_gen for candidate frames; preserved 40 approved atlas poses",
        "file": "animation-v5-candidate.png",
        "sourceCanvas": {"width": atlas.width, "height": atlas.height, "mode": "RGBA"},
        "frameCanvas": {"width": FRAME, "height": FRAME},
        "anchor": CONFIG["anchor"],
        "layout": {"columns": 16, "rows": 17, "frameCount": 272, "cellOrder": "row-major"},
        "directions": directions,
        "actionRowOrder": ["idle", "walk", "attack", "hit", "death"],
        "framesPerDirection": {action: len(phases[action]) for action in ("idle", "walk", "attack", "hit", "death")},
        "sourceInventory": audit["inventory"],
        "sourceCounts": dict(counts),
        "sourceAtlas": {"file": CONFIG["sourceAtlas"], "status": CONFIG["sourceAtlasStatus"], "sha256": CONFIG["sourceAtlasSha256"]},
        "sourceSheets": source_sheets,
        "rows": rows,
        "frames": frame_records,
        "qa": {"identity": False, "sixteenDirections": False, "posePhases": False, "alphaEdges": False, "rootAnchor": False, "atlas": False, "visualReview": False, "runtimePromotion": False},
        "previewFiles": preview_files,
        "notes": ["Review candidate only; no runtime promotion.", "The 40 source frames were extracted from the visual-approved 8x5 atlas at exact 384x384 cell bounds and preserved without pixel edits.", "The original 128x128 reference metadata has no measured root or verified baked-weapon id; source atlas anchor (192,288) is used provisionally.", "Generated sheets use threshold-128 alpha extraction with a 3px soft-edge recovery. Alpha edges, identity, facing, action continuity, anchors, and the full atlas remain unapproved."],
    }
    write_json(ATLAS_DIR / "animation-v5-candidate.json", metadata)
    inventory_present = audit["inventory"].get("presentPosePaths", audit["inventory"].get("presentPosePngs", 0))
    readme = f"""# {CONFIG['speciesId'].title()} v5 16-direction candidate\n\nStatus: review required. Nothing in this folder is approved for runtime.\n\n`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas (6144×6528), with 272 cells of 384×384 pixels. It preserves 40 approved cells from the existing 8×5 source atlas and fills the other 232 cells from 17 generated 4×4 direction sheets.\n\nThe inventory scanner reports {inventory_present}/272 individual `poses/` PNGs. The existing animation atlas is separately marked visual-approved and has 40 exact 384×384 cells; those are preserved unchanged. Draft sheets were excluded.\n\nAll generated art remains under this output folder. Identity, facing, pose timing, alpha edges, anchor, atlas, visual review, and runtime promotion flags are false. See `atlas/animation-v5-candidate.json`, `source-audit.json`, and the color/silhouette/death previews for provenance and review.\n"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print(json.dumps({"speciesId": CONFIG["speciesId"], "atlas": atlas_path.relative_to(ROOT).as_posix(), "dimensions": list(atlas.size), "frames": len(frame_records), "sourceCounts": dict(counts), "rawSheets": len(source_sheets), "output": OUT.relative_to(ROOT).as_posix()}, indent=2))


if __name__ == "__main__":
    main()
