"""Focused tests for monster-animation-qa.py; run with python tools/test-monster-animation-qa.py."""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).with_name("monster-animation-qa.py")
SPEC = importlib.util.spec_from_file_location("monster_animation_qa", SCRIPT)
assert SPEC and SPEC.loader
qa = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = qa
SPEC.loader.exec_module(qa)


class AtlasQATests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="monster-animation-qa-")
        self.directory = Path(self.temp.name)
        self.metadata_path = self.directory / "meta.json"
        self.image_path = self.directory / "atlas.png"
        self.image = Image.new("RGBA", (800, 1000), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.metadata = {
            "status": "draft-review",
            "variantId": "test-variant",
            "file": "atlas.png",
            "sourceCanvas": {"width": 800, "height": 1000},
            "layout": {"columns": 8, "rows": 5, "frameCount": 40},
            "sourceFrames": [],
        }
        # Unequal crop widths prove each sourceFrames rectangle is used independently.
        for index in range(40):
            column, row = index % 8, index // 8
            x0, y0 = column * 100, row * 200
            width = 8 + index % 3
            x = x0 + 24 + (index % 2)
            y = y0 + 24
            y_end = y0 + 200 - 24
            self.draw.rectangle((x, y, x + width - 1, y_end - 1), fill=(255, 255, 255, 255))
            self.metadata["sourceFrames"].append({
                "x": x,
                "y": y,
                "width": width,
                "height": y_end - y,
                "offsetX": 0,
                "offsetY": 0,
            })
        self.save()

    def tearDown(self) -> None:
        self.image.close()
        self.temp.cleanup()

    def save(self) -> None:
        self.image.save(self.image_path)
        self.metadata_path.write_text(json.dumps(self.metadata), encoding="utf-8")

    def test_clean_atlas_uses_frame_specific_bounds_and_accepts_24_pixel_padding(self) -> None:
        result = qa.audit_atlas(self.metadata_path)
        self.assertEqual(result.issues, [])
        self.assertEqual(result.frame_count, 40)
        self.assertEqual(result.clearances, [(index, 24) for index in range(40)])

    def test_extra_bottom_clearance_is_reported_but_does_not_fail(self) -> None:
        self.draw.rectangle((0, 0, 99, 199), fill=(0, 0, 0, 0))
        self.draw.rectangle((24, 24, 31, 171), fill=(255, 255, 255, 255))
        self.metadata["sourceFrames"][0].update({"x": 24, "y": 24, "width": 8, "height": 148})
        self.save()

        result = qa.audit_atlas(self.metadata_path)
        self.assertEqual(result.issues, [])
        self.assertEqual(result.clearances[0], (0, 28))

    def test_edge_contact_and_connected_component_crossing_cells_fail(self) -> None:
        # Join frame 0 and frame 1 across their shared vertical cell edge.
        self.draw.rectangle((90, 24, 99, 175), fill=(255, 255, 255, 255))
        self.draw.rectangle((100, 24, 109, 175), fill=(255, 255, 255, 255))
        self.metadata["sourceFrames"][0].update({"x": 90, "y": 24, "width": 10, "height": 152})
        self.metadata["sourceFrames"][1].update({"x": 100, "y": 24, "width": 10, "height": 152})
        self.save()

        result = qa.audit_atlas(self.metadata_path)
        self.assertTrue(any("touches the right cell edge" in issue for issue in result.issues))
        self.assertTrue(any("touches the left cell edge" in issue for issue in result.issues))
        self.assertTrue(any("connected opaque alpha spans cells 00 and 01" in issue for issue in result.issues))

    def test_insufficient_bottom_clearance_fails(self) -> None:
        self.draw.rectangle((24, 176, 31, 176), fill=(255, 255, 255, 255))
        self.metadata["sourceFrames"][0].update({"x": 24, "y": 24, "width": 8, "height": 153})
        self.save()

        result = qa.audit_atlas(self.metadata_path)
        self.assertTrue(any("bottom clearance is 23 px" in issue for issue in result.issues))

    def test_insufficient_side_clearance_fails(self) -> None:
        self.draw.rectangle((0, 0, 99, 199), fill=(0, 0, 0, 0))
        self.draw.rectangle((12, 24, 19, 175), fill=(255, 255, 255, 255))
        self.metadata["sourceFrames"][0].update({"x": 12, "y": 24, "width": 8, "height": 152})
        self.save()

        result = qa.audit_atlas(self.metadata_path)
        self.assertTrue(any("left clearance is 12 px" in issue for issue in result.issues))

    def test_alpha_outside_its_metadata_crop_fails(self) -> None:
        self.draw.point((45, 60), fill=(255, 255, 255, 255))
        self.save()

        result = qa.audit_atlas(self.metadata_path)
        self.assertTrue(any("falls outside its sourceFrames crop" in issue for issue in result.issues))

    def test_json_mode_emits_explicit_pass_state(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = qa.main(["--json", "--metadata", str(self.metadata_path)])

        result = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(result["schemaVersion"], 1)
        self.assertTrue(result["atlases"][0]["passed"])
        self.assertEqual(result["atlases"][0]["frameCount"], 40)
        self.assertEqual(result["atlases"][0]["bottomClearance"][0], {"frame": 0, "pixels": 24})


class RuntimeAtlasQATests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="monster-animation-runtime-qa-")
        self.directory = Path(self.temp.name)
        self.metadata_path = self.directory / "runtime.json"
        self.image_path = self.directory / "runtime.png"
        self.image = Image.new("RGBA", (3072, 1920))
        self.draw = ImageDraw.Draw(self.image)
        self.metadata = {
            # Production files do not need draft-review status to be checked.
            "status": "visual-approved",
            "sourceCanvas": {"width": 3072, "height": 1920},
            "frameCanvas": {"width": 384, "height": 384},
            "anchor": {"x": 192, "y": 288},
            "sourceFrames": [],
        }
        for index in range(40):
            x0, y0 = index % 8 * 384, index // 8 * 384
            self.draw.rectangle((x0 + 160, y0 + 100, x0 + 223, y0 + 235), fill=(255, 255, 255, 255))
            self.metadata["sourceFrames"].append({
                "x": x0 + 159, "y": y0 + 99, "width": 66, "height": 138,
                "offsetX": 159, "offsetY": 99,
            })
        self.save()

    def tearDown(self) -> None:
        self.image.close()
        self.temp.cleanup()

    def save(self) -> None:
        self.image.save(self.image_path)
        self.metadata_path.write_text(json.dumps(self.metadata), encoding="utf-8")

    def audit(self):
        return qa.audit_atlas(self.metadata_path, runtime_image=self.image_path)

    def test_padded_complete_production_poses_pass_without_draft_status(self) -> None:
        result = self.audit()
        self.assertEqual(result.issues, [])
        self.assertTrue(result.runtime)
        self.assertEqual(qa.json_result(result)["minimumCellPadding"], 24)

    def test_goblin_style_spear_continues_beyond_the_source_crop(self) -> None:
        # The production Goblin defect: a connected weapon remains within its runtime
        # cell, but the source crop silently removes its end.
        self.draw.rectangle((128, 120, 220, 127), fill=(255, 255, 255, 255))
        self.save()
        self.assertTrue(any("frame 00: source crop truncates a connected pose" in issue
                            for issue in self.audit().issues))

    def test_crop_containing_a_neighbour_pose_is_rejected(self) -> None:
        self.metadata["sourceFrames"][0]["width"] = 386
        self.save()
        self.assertTrue(any("frame 00: source crop contains opaque pixels from frame 01's pose" in issue
                            for issue in self.audit().issues))

    def test_tight_crop_with_no_transparent_guard_is_rejected(self) -> None:
        self.metadata["sourceFrames"][0].update({"x": 160, "y": 100, "width": 64, "height": 136})
        self.save()
        self.assertTrue(any("frame 00: source crop needs at least 1 transparent pixel" in issue
                            for issue in self.audit().issues))

    def test_runtime_crop_that_would_be_clamped_is_rejected(self) -> None:
        self.metadata["sourceFrames"][0]["offsetX"] = 330
        self.save()
        self.assertTrue(any("frame 00: source crop escapes the 384 x 384 runtime cell" in issue
                            for issue in self.audit().issues))

    def test_runtime_requires_24_pixels_of_padding_on_each_side(self) -> None:
        self.draw.rectangle((159, 120, 361, 127), fill=(255, 255, 255, 255))
        self.metadata["sourceFrames"][0]["width"] = 140
        self.save()
        self.assertTrue(any("frame 00: right clearance is 22 px" in issue
                            for issue in self.audit().issues))

    def test_soft_alpha_does_not_join_two_opaque_poses(self) -> None:
        self.draw.rectangle((159, 120, 352, 127), fill=(255, 255, 255, 199))
        self.save()
        self.assertEqual(self.audit().issues, [])

    def test_registry_discovery_resolves_actual_png_and_json_and_omits_hero(self) -> None:
        registry = self.directory / "arena-art-pixel-v2.ts"
        registry.write_text("""
import hero from './hero.json';
import goblin from './goblin.json';
export const pixelArenaArt = {
  hero: pilotArt('/combat/arpg/pixel-v2/player.png', hero, 240),
  species: { goblin: pilotArt('/combat/arpg/pixel-v2/goblin.png', goblin, 224) },
};
""", encoding="utf-8")
        pairs, errors = qa.runtime_atlases(registry)
        self.assertEqual(errors, [])
        self.assertEqual(pairs, [((self.directory / "goblin.json").resolve(),
                                 (qa.ROOT / "game/public/combat/arpg/pixel-v2/goblin.png").resolve())])

    def test_runtime_cli_checks_registry_pairs(self) -> None:
        output = io.StringIO()
        with patch.object(qa, "runtime_atlases", return_value=([(self.metadata_path, self.image_path)], [])):
            with redirect_stdout(output):
                exit_code = qa.main(["--runtime", "--json"])
        result = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(len(result["atlases"]), 1)
        self.assertTrue(result["atlases"][0]["runtime"])


if __name__ == "__main__":
    unittest.main()
