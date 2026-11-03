#!/usr/bin/env python3
"""Read-only pose source inventory. PNG presence never means visual approval.

    python -B tools/monster-animation-v5-inventory.py --species goblin
    python -B tools/monster-animation-v5-inventory.py --species goblin --image-metrics

The Goblin poses manifest owns expected directions/action phases. Metrics measure
source alpha at two thresholds without changing pixels or deciding acceptance.
"""

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent / "art-reference/monsters"
TEMPLATE = ROOT / "humanoid/goblin/animation/poses.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def pose_path(action, frame):
    parts = (action, frame["file"]) if action == "idle" else (action, frame["direction"], frame["file"])
    if any(Path(part).name != part or part in ("", ".", "..") for part in parts):
        raise ValueError(f"invalid pose path components: {parts}")
    return Path("poses", *parts)


def image_metrics(path):
    from PIL import Image

    with Image.open(path) as source:
        image = source.convert("RGBA")
        alpha = image.getchannel("A")
        histogram = alpha.histogram()
        bounds = {}
        for threshold in (0, 200):
            box = alpha.point(lambda value: 255 if value > threshold else 0).getbbox()
            bounds[str(threshold)] = None if box is None else {
                "bbox": list(box),
                "clearance": [box[0], box[1], image.width - box[2], image.height - box[3]],
            }
        return {"canvas": list(image.size), "sourceMode": source.mode,
                "softAlphaPixels": sum(histogram[1:255]), "boundsByAlphaThreshold": bounds}


def inventory(species, template, metrics):
    version = species / "animation"
    expected = {pose_path(action, frame): action for action, data in template["actions"].items()
                for frame in data["frames"]}
    present = {path.relative_to(version) for path in (version / "poses").rglob("*.png")}
    issues = []
    metadata = version / "poses.json"
    try:
        own = read_json(metadata)
        if own.get("directions") != template["directions"]:
            issues.append("directions differ from Goblin poses contract")
        if set(own.get("actions", {})) != set(template["actions"]):
            issues.append("action set differs from Goblin poses contract")
        for action, data in template["actions"].items():
            own_frames = own.get("actions", {}).get(action, {}).get("frames", [])
            if {pose_path(action, frame) for frame in own_frames} != {
                    path for path, name in expected.items() if name == action}:
                issues.append(f"{action} frame paths differ from Goblin poses contract")
    except (OSError, ValueError, KeyError, TypeError) as error:
        issues.append(f"metadata unavailable/invalid: {error}")
    missing_sidecars = []
    measurements = {}
    for relative in sorted(present & expected.keys()):
        for suffix in (".meta.json",):
            sidecar = relative.with_suffix(suffix)
            if not (version / sidecar).is_file():
                missing_sidecars.append(sidecar.as_posix())
        if metrics:
            try:
                measurements[relative.as_posix()] = image_metrics(version / relative)
            except (OSError, ValueError) as error:
                measurements[relative.as_posix()] = {"error": str(error)}
    result = {"species": species.name, "race": species.parent.name,
              "metadataIssues": issues, "expected": len(expected),
              "presentExpected": len(present & expected.keys()),
              "byAction": {action: {"expected": data["poseCount"],
                                     "present": sum(path in present for path, name in expected.items() if name == action)}
                           for action, data in template["actions"].items()},
              "missing": [path.as_posix() for path in sorted(expected.keys() - present)],
              "unexpected": [path.as_posix() for path in sorted(present - expected.keys())],
              "missingSidecars": missing_sidecars}
    if metrics:
        result["sourceImageMetrics"] = measurements
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--species", action="append", help="species folder name; repeat to select several")
    parser.add_argument("--image-metrics", action="store_true", help="read PNG alpha and canvas measurements")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    template = read_json(TEMPLATE)
    if args.self_test:
        paths = [pose_path(action, frame) for action, data in template["actions"].items() for frame in data["frames"]]
        assert len(paths) == len(set(paths)) == 272
        assert pose_path("idle", {"file": "south.png"}) == Path("poses/idle/south.png")
        assert pose_path("walk", {"direction": "south", "file": "00-stride-a.png"}) == Path("poses/walk/south/00-stride-a.png")
        print("poses path contract: PASS")
        return
    species = sorted(path for race in ROOT.iterdir() if race.is_dir() and not race.name.startswith("_")
                     for path in race.iterdir() if path.is_dir() and (not args.species or path.name in args.species))
    if args.species and set(args.species) - {path.name for path in species}:
        parser.error("unknown species: " + ", ".join(sorted(set(args.species) - {path.name for path in species})))
    print(json.dumps({"acceptance": "not-assessed; inventory and measurements only",
                      "template": str(TEMPLATE.relative_to(ROOT)),
                      "species": [inventory(path, template, args.image_metrics) for path in species]}, indent=2))


if __name__ == "__main__":
    main()
