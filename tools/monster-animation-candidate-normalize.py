#!/usr/bin/env python3
"""Normalize a single generated pose to a phase-matched 384 x 384 review frame.

Example:
    python -B tools/monster-animation-candidate-normalize.py \
      --source art-reference/animation/outputs/sensenova-raw.png \
      --reference art-reference/monsters/plant/dryad/dryad/animation/poses/hit/north/00-flinch.png

The reference PNG's .meta.json supplies its anchor and review-frame contract. The
output is always a candidate under the chosen output path; this tool never edits
canonical poses or approves/promotes generated art.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parent.parent
FRAME_SIZE = 384
MIN_PADDING = 24
ALPHA_THRESHOLD = 128
WHITE_THRESHOLD = 32


def read_metadata(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"metadata root must be an object: {path}")
    return value


def relative_or_absolute(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def separate_foreground(source: Image.Image) -> tuple[Image.Image, str]:
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema() != (255, 255):
        return rgba, "source-alpha"

    rgb = rgba.convert("RGB")
    difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, "white"))
    max_difference = ImageChops.lighter(
        ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
        difference.getchannel("B"),
    )
    corners = ((0, 0), (rgb.width - 1, 0), (0, rgb.height - 1), (rgb.width - 1, rgb.height - 1))
    if sum(max_difference.getpixel(point) <= WHITE_THRESHOLD for point in corners) < 3:
        raise ValueError("opaque input has no consistent near-white background at its corners")

    # shortcut: white chroma key can remove near-white sprite details; request a unique matte color for those mobs.
    alpha = max_difference.point(lambda value: 0 if value <= 12 else value if value <= WHITE_THRESHOLD else 255)
    rgba.putalpha(alpha)
    return rgba, f"near-white chroma key (threshold {WHITE_THRESHOLD}/255)"


def opaque_bounds(alpha: Image.Image) -> tuple[int, int, int, int] | None:
    hard_alpha = alpha.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
    return hard_alpha.getbbox()


def normalize_candidate(
    source_path: Path,
    reference_path: Path,
    output_path: Path,
    force: bool = False,
    prompt: str | None = None,
    target_action: str | None = None,
    target_direction: str | None = None,
    target_phase: str | None = None,
) -> dict[str, Any]:
    source_path = source_path.resolve()
    reference_path = reference_path.resolve()
    output_path = output_path.resolve()
    if output_path in (source_path, reference_path):
        raise ValueError("output must not overwrite the source or reference image")
    if output_path.suffix.lower() != ".png":
        raise ValueError("output path must use the .png extension")
    metadata_path = reference_path.with_suffix(".meta.json")
    if not metadata_path.is_file():
        raise ValueError(f"reference metadata not found: {metadata_path}")
    output_meta_path = output_path.with_suffix(".meta.json")
    if not force and (output_path.exists() or output_meta_path.exists()):
        raise FileExistsError(f"output already exists: {output_path} (pass --force to replace)")

    reference_meta = read_metadata(metadata_path)
    frame_canvas = reference_meta.get("frameCanvas") or {}
    if (frame_canvas.get("width"), frame_canvas.get("height")) != (FRAME_SIZE, FRAME_SIZE):
        raise ValueError(f"reference must use a {FRAME_SIZE} x {FRAME_SIZE} frameCanvas")
    anchor = reference_meta.get("anchor") or {}
    anchor_x, anchor_y = anchor.get("x"), anchor.get("y")
    if type(anchor_x) is not int or type(anchor_y) is not int:
        raise ValueError("reference metadata must have integer anchor x and y")

    with Image.open(source_path) as opened:
        raw_size = opened.size
        source, background_method = separate_foreground(opened)
    with Image.open(reference_path) as opened:
        reference = opened.convert("RGBA")
    if reference.size != (FRAME_SIZE, FRAME_SIZE):
        raise ValueError(f"reference PNG is {reference.size}, expected {(FRAME_SIZE, FRAME_SIZE)}")

    source_bounds = opaque_bounds(source.getchannel("A"))
    reference_bounds = opaque_bounds(reference.getchannel("A"))
    if source_bounds is None or reference_bounds is None:
        raise ValueError("source or reference has no foreground pixels")
    sx0, sy0, sx1, sy1 = source_bounds
    rx0, ry0, rx1, ry1 = reference_bounds
    source_width, source_height = sx1 - sx0, sy1 - sy0
    reference_height = ry1 - ry0
    phase = target_phase or reference_meta.get("phase")
    if isinstance(phase, str) and phase.lower().endswith(".png"):
        phase = Path(phase).stem

    scale = reference_height / source_height
    width = max(1, round(source_width * scale))
    height = max(1, round(source_height * scale))
    center_x = anchor_x + ((rx0 + rx1) / 2 - anchor_x)
    bottom_y = anchor_y + (ry1 - anchor_y)
    x, y = round(center_x - width / 2), round(bottom_y - height)
    if x < MIN_PADDING or y < MIN_PADDING or x + width > FRAME_SIZE - MIN_PADDING or y + height > FRAME_SIZE - MIN_PADDING:
        raise ValueError("normalized foreground would violate the 24 px frame padding")

    crop = source.crop(source_bounds)
    resized = crop.resize((width, height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="PNG", optimize=True)
    output_meta = {
        "status": "candidate-review",
        "generator": "SenseNova U1.5 Lite",
        "source": relative_or_absolute(source_path),
        "reference": relative_or_absolute(reference_path),
        "prompt": prompt,
        "action": target_action or reference_meta.get("action"),
        "direction": target_direction or reference_meta.get("direction"),
        "phase": phase,
        "sourceDimensions": list(raw_size),
        "frameCanvas": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "anchor": anchor,
        "normalization": {
            "method": "foreground crop, nearest-neighbor resize to phase-matched reference height, reference-anchor placement",
            "backgroundRemoval": background_method,
            "backgroundRemovalLimit": "near-white character details sharing the matte color are removed",
            "alphaThresholdForBounds": ALPHA_THRESHOLD,
            "sourceSubjectBounds": list(source_bounds),
            "referenceSubjectBounds": list(reference_bounds),
            "normalizedSubjectHeight": height,
            "uniformScale": round(scale, 6),
            "sourcePixelsPaintedOrComposited": False,
        },
        "visualReview": {
            "sequenceAccepted": False,
            "identityAccepted": False,
            "exactAngleAccepted": False,
            "atlasReady": False,
            "note": "Normalized candidate only; visual and sequence review is pending.",
        },
        "qa": {"atlas": False, "anchor": False},
    }
    output_meta_path.write_text(json.dumps(output_meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    canvas.close()
    return output_meta


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="raw SenseNova or other generated PNG")
    parser.add_argument("--reference", type=Path, required=True, help="phase-matched 384 x 384 PNG with a .meta.json sidecar")
    parser.add_argument("--output", type=Path, help="review PNG path (defaults to <source>-normalized.png)")
    parser.add_argument("--prompt", help="generation prompt to preserve in the review sidecar")
    parser.add_argument("--target-action", help="candidate action when it differs from the calibration frame")
    parser.add_argument("--target-direction", help="candidate direction when it differs from the calibration frame")
    parser.add_argument("--target-phase", help="candidate phase when it differs from the calibration frame")
    parser.add_argument("--force", action="store_true", help="replace an existing output PNG and sidecar")
    args = parser.parse_args()
    output = args.output or args.source.with_name(f"{args.source.stem}-normalized.png")
    try:
        metadata = normalize_candidate(
            args.source, args.reference, output, args.force, args.prompt,
            args.target_action, args.target_direction, args.target_phase,
        )
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(f"{output}: {FRAME_SIZE}x{FRAME_SIZE} RGBA candidate-review")
    print(f"subject height: {metadata['normalization']['normalizedSubjectHeight']} px")
    print(f"background: {metadata['normalization']['backgroundRemoval']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
