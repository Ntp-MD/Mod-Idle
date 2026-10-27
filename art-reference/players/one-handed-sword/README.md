# Player set: one-handed-sword (staging)

First player set laid out per the mold (`art-reference/monsters/_shared/mob-animation-template.json`),
staged from finished `equipment-v1` files. Status: **unbaked-staging** — not game art, never consumed by runtime.

## What is mold-conformant here

- `poses/idle/` — 8 directions (filenames match the mold).
- `poses/attack/` — east/west × windup/contact/follow-through/recovery, close kind.
- `poses/skill/shield-bash/` — east/west baked contact poses (the only baked pixels in this set).

## What is NOT conformant yet (art-owner work)

- Poses are clean bodies; the sword/shield are NOT baked in. Baking = re-generating
  each pose with the weapon in hand. Do NOT fake it by compositing pixels here.
- `poses/walk|hit|death/` are absent: finished files live in `_staging/body-walk|hit|death/`
  under legacy names and short counts (walk 2/dir, hit/death 1/dir vs mold 4/dir).
  They must be re-posed to the mold's 4-phase names.
- `reference.png` shows empty hands; the set reference must be re-generated holding the sword.
- Some idle slots lack `.prompt.txt` (copied as-is from equipment-v1).

## `_staging/`

Pre-bake source only: `weapons/` (one-handed-sword views), `shield/` views,
legacy `body-walk|hit|death/`. Never a runtime layer. Delete nothing in
`equipment-v1/` — it remains the archive.
