# Monster art references

Canonical reference set: one copy of each pixel, no version folders.
Never the game asset shelf — runtime reads `game/public` atlases plus
game-side manifests (see `tools/monster-animation-qa.py:runtime_atlases`).

## Layout

```text
art-reference/monsters/
  README.md
  <species>/<mob>/
    reference.png, reference.meta.json   (absent for a few mobs; do not fabricate)
    animation/
      meta.json            packed runtime atlas manifest (visual-approved)
      poses.json           pose mold spec (actions/directions/frames)
      poses/               canonical source frames, one <slot>.png + .meta.json each
      atlas/animation.png  final packed atlas
      source/              repack inputs (base*, detail-*, *preview*)
      drafts/              surviving draft atlases/specs only; never runtime
      preview-runtime.png  stray preview (beetle); never runtime
      progress.json / missing-poses.json  bake status trackers
    variants/<name>/       per-variant atlas + meta.json; read by
                           monster-animation-{normalize,qa}.py — do not restructure
```

## Rules

- Lowercase-hyphen names. New iterations replace in place; git history
  owns the old versions — never `v1/`, `v2/` side folders.
- `poses.json` of `humanoid/goblin` is the mold contract checked by
  `tools/monster-animation-v5-inventory.py`.
- Drafts stay under `drafts/`. Baking new poses is art-owner work;
  never fake a pose by compositing pixels here.
