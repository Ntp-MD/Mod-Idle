"""Focused tests for monster-animation-candidate-normalize.py."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).with_name("monster-animation-candidate-normalize.py")
SPEC = importlib.util.spec_from_file_location("monster_animation_candidate_normalize", SCRIPT)
assert SPEC and SPEC.loader
normalize = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = normalize
SPEC.loader.exec_module(normalize)


class CandidateNormalizeTests(unittest.TestCase):
    def test_white_key_removes_background_and_enclosed_gaps(self) -> None:
        image = Image.new("RGB", (64, 64), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((20, 10, 43, 53), fill=(40, 90, 30))
        draw.point((30, 20), fill="white")

        rgba, method = normalize.separate_foreground(image)

        self.assertEqual(rgba.getpixel((0, 0))[3], 0)
        self.assertEqual(rgba.getpixel((21, 11))[3], 255)
        self.assertEqual(rgba.getpixel((30, 20))[3], 0)
        self.assertIn("chroma key", method)

    def test_candidate_matches_reference_canvas_scale_and_anchor(self) -> None:
        with tempfile.TemporaryDirectory(prefix="monster-animation-candidate-") as temp:
            root = Path(temp)
            source_path = root / "raw.png"
            reference_path = root / "reference.png"
            output_path = root / "candidate.png"

            source = Image.new("RGB", (64, 64), "white")
            ImageDraw.Draw(source).rectangle((22, 5, 41, 54), fill=(20, 40, 60))
            source.save(source_path)
            reference = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
            ImageDraw.Draw(reference).rectangle((180, 100, 203, 279), fill=(20, 40, 60, 255))
            reference.save(reference_path)
            reference_path.with_suffix(".meta.json").write_text(json.dumps({
                "action": "hit",
                "direction": "north",
                "phase": "02-recover.png",
                "frameCanvas": {"width": 384, "height": 384},
                "anchor": {"x": 192, "y": 280},
            }), encoding="utf-8")

            metadata = normalize.normalize_candidate(
                source_path, reference_path, output_path, target_phase="03-ready"
            )

            with Image.open(output_path) as result:
                self.assertEqual(result.size, (384, 384))
                self.assertEqual(result.mode, "RGBA")
                self.assertEqual(normalize.opaque_bounds(result.getchannel("A")), (156, 100, 228, 280))
            self.assertEqual(metadata["status"], "candidate-review")
            self.assertEqual(metadata["phase"], "03-ready")
            self.assertEqual(metadata["normalization"]["normalizedSubjectHeight"], 180)
            self.assertFalse(metadata["visualReview"]["atlasReady"])

            inferred = normalize.normalize_candidate(
                source_path, reference_path, root / "inferred.png"
            )
            self.assertEqual(inferred["phase"], "02-recover")


if __name__ == "__main__":
    unittest.main()
