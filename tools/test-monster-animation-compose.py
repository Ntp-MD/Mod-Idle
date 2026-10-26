"""Focused tests for monster-animation-compose.py; run with python tools/test-monster-animation-compose.py."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).with_name("monster-animation-compose.py")
SPEC = importlib.util.spec_from_file_location("monster_animation_compose", SCRIPT)
assert SPEC and SPEC.loader
compose = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = compose
SPEC.loader.exec_module(compose)


def draw_frame(path: Path, size: int, boxes: list[tuple[int, int, int, int]], alpha: int = 255) -> None:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for box in boxes:
        draw.rectangle(box, fill=(200, 120, 60, alpha))
    image.save(path)


def base_meta(anchor_x: int, anchor_y: int, variant: bool = False) -> dict:
    meta = {
        "speciesId": "test-beetle",
        "name": "Test Variant",
        "levels": [1, 60],
        "identityRef": "test/base.png",
        "styleRef": "test/reference.png",
        "anchor": {"x": anchor_x, "y": anchor_y},
        "alignment": "ground-contact",
        "generator": "test",
        "generation": {},
    }
    if variant:
        meta["variantId"] = "test-variant"
    return meta


class ComposeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="monster-animation-compose-")
        self.root = Path(self.temp.name)
        self.frames = self.root / "frames"
        self.frames.mkdir()
        self.out = self.root / "variant"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_set(self, size: int, bottom: int, width: int = 24, height: int = 20,
                  death_bottom: int | None = None) -> None:
        for index in range(40):
            action = compose.DEFAULT_ACTIONS[index // 8]
            foot = death_bottom if (action == "death" and death_bottom is not None) else bottom
            left = (size - width) // 2
            draw_frame(self.frames / f"{index:03d}.png", size,
                       [(left, foot - height, left + width - 1, foot - 1)])

    def write_base(self, anchor_x: int, anchor_y: int, variant: bool = False) -> Path:
        path = self.root / "base.json"
        path.write_text(json.dumps(base_meta(anchor_x, anchor_y, variant)), encoding="utf-8")
        return path

    def run_compose(self, *extra: str, cell: int = 64, padding: int = 8,
                    anchor: tuple[int, int] = (32, 48), variant: bool = False) -> int:
        base = self.write_base(*anchor, variant=variant)
        with redirect_stdout(StringIO()):
            return compose.main(["--frames-dir", str(self.frames), "--meta-base", str(base),
                                 "--out-dir", str(self.out), "--cell", str(cell),
                                 "--padding", str(padding), *extra])

    def test_happy_path_keeps_gutters(self) -> None:
        self.write_set(64, 50)
        self.assertEqual(self.run_compose(), 0)
        meta = json.loads((self.out / "meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["status"], "draft-review")
        self.assertEqual(len(meta["sourceFrames"]), 40)
        self.assertEqual(meta["frameCount"] if "frameCount" in meta else meta["layout"]["frameCount"], 40)
        first = meta["sourceFrames"][0]
        self.assertEqual((first["offsetX"], first["offsetY"]), (20, 28))
        atlas = Image.open(self.out / "atlas" / "animation-draft.png")
        self.assertEqual(atlas.size, (512, 320))

    def test_two_poses_rejected(self) -> None:
        self.write_set(64, 50)
        draw_frame(self.frames / "003.png", 64, [(10, 10, 18, 18), (40, 40, 48, 48)])
        self.assertEqual(self.run_compose(), 1)
        self.assertFalse((self.out / "meta.json").exists())

    def test_edge_touch_rejected(self) -> None:
        self.write_set(64, 50)
        draw_frame(self.frames / "005.png", 64, [(0, 20, 23, 39)])
        self.assertEqual(self.run_compose(), 1)
        self.assertFalse((self.out / "meta.json").exists())

    def test_semi_transparent_rejected(self) -> None:
        self.write_set(64, 50)
        draw_frame(self.frames / "007.png", 64, [(20, 30, 43, 49)], alpha=128)
        self.assertEqual(self.run_compose(), 1)

    def test_oversize_rejected(self) -> None:
        for index in range(40):
            draw_frame(self.frames / f"{index:03d}.png", 256, [(28, 28, 227, 227)])
        self.assertEqual(self.run_compose(), 1)

    def test_missing_frame_rejected(self) -> None:
        self.write_set(64, 50)
        (self.frames / "011.png").unlink()
        self.assertEqual(self.run_compose(), 1)

    def test_stray_file_rejected(self) -> None:
        self.write_set(64, 50)
        draw_frame(self.frames / "extra.png", 64, [(20, 30, 43, 49)])
        self.assertEqual(self.run_compose(), 1)

    def test_ground_drift_rejected(self) -> None:
        self.write_set(64, 50)
        draw_frame(self.frames / "002.png", 64, [(20, 20, 43, 39)])
        self.assertEqual(self.run_compose(), 1)

    def test_integer_downscale_keeps_hard_alpha(self) -> None:
        for index in range(40):
            draw_frame(self.frames / f"{index:03d}.png", 128, [(24, 40, 103, 119)])
        self.assertEqual(self.run_compose(), 0)
        meta = json.loads((self.out / "meta.json").read_text(encoding="utf-8"))
        self.assertTrue(all(scale == 2 for scale in meta["composition"]["scales"].values()))
        atlas = Image.open(self.out / "atlas" / "animation-draft.png")
        histogram = atlas.getchannel("A").histogram()
        self.assertEqual(sum(histogram[1:255]), 0)

    def test_refuses_to_overwrite_without_force(self) -> None:
        self.write_set(64, 50)
        self.assertEqual(self.run_compose(), 0)
        self.assertEqual(self.run_compose(), 1)
        base = self.write_base(32, 48)
        with redirect_stdout(StringIO()):
            self.assertEqual(compose.main(["--frames-dir", str(self.frames), "--meta-base", str(base),
                                           "--out-dir", str(self.out), "--cell", "64",
                                           "--padding", "8", "--force"]), 0)

    def test_full_size_output_passes_monster_qa(self) -> None:
        qa = compose.load_qa()
        self.write_set(384, 280, width=120, height=100, death_bottom=300)
        self.assertEqual(self.run_compose(cell=384, padding=24, anchor=(192, 288), variant=True), 0)
        result = qa.audit_atlas(self.out / "meta.json")
        self.assertEqual(result.issues, [])


if __name__ == "__main__":
    unittest.main()
