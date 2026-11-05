# Monster art references

Canonical reference set: one copy of each pixel, no version folders.
Never the game asset shelf — runtime reads `game/public` atlases plus
game-side manifests (see `tools/monster-animation-qa.py:runtime_atlases`).

## Layout

```text
art-reference/monsters/
  README.md
  <race>/<species>/                  flat: one dir per variant, no variants/ layer
    <species>/                     base variant (self-named): canonical species art
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
    <variant>/                     named variant (e.g. alpha-werewolf); read by
                                   monster-animation-{normalize,qa}.py — do not restructure
      meta.json            draft atlas manifest (draft-review)
      atlas/               draft atlas (animation-draft.png)
      clips/ + source/     legacy extracted clip pack (schemaVersion 1 user-reference)
      clips-meta.json      legacy clip manifest where the draft meta.json already
                           occupies meta.json (shadow-wolf, stone-golem only)
```

## Rules

- Lowercase-hyphen names. New iterations replace in place; git history
  owns the old versions — never `v1/`, `v2/` side folders.
- `poses.json` of `humanoid/goblin/goblin` is the full source mold checked by
  `tools/monster-animation-v5-inventory.py`; the active coverage target is in
  `docs/plan/mob-pose-gaps.md`. Extra 16-direction poses in `poses/` are
  grandfathered history — do not extend them, do not complete partial sets,
  and do not start 16-direction sets for new species. The standard is 8
  directions (see `art-reference/animation/README.md`).
- Drafts stay under `drafts/`. Baking new poses is art-owner work;
  never fake a pose by compositing pixels here.
