# Mob animation template folder

Copy-ready skeleton for one species (or one named variant). Copy this folder,
find-replace the 4 tokens, generate the poses, then compose and QA:

```powershell
Copy-Item -Recurse art-reference/monsters/_shared/template/* art-reference/monsters/<race>/<species>/
```

New species land under their canonical race (`<race>/<species>/`, race from `tools/data/engine.json` `mob.species`); named variants under `<race>/<species>/variants/<variant-id>/`. Later candidates ship as `v1/`, `v2/` versions per `art-reference/monsters/README.md`.

Tokens: `<species-id>`, `<Species Name>`, `<silhouette one-liner>`, `<weapon-id>`.

## Fill order

1. `reference.png` + `reference.meta.json` first; every pose must match them.
2. Pick ONE attack kind: copy `poses/attack-close/` or `poses/attack-far/` to
   `poses/attack/` and delete the other. Kind follows the species line
   (front -> close, stand-off -> far) unless a recorded override exists.
3. `skill/` holds the two worked examples only. Per kit entry WITH a cast block,
   copy the matching example to `skill/<action-slug>/`; kit entries without a
   cast block get no folder.
4. Generate one `<slot>.png` beside each `<slot>.prompt.txt`; record each
   `<slot>.meta.json` (footAnchor measured; far `01-release` also declares
   releaseSocket). Shipped set per species: 1 reference + 40 pose cells.
5. Check mold completeness any time (machine-reads the mold contract):
   `python tools/monster-animation-qa.py --mold <species-dir> --species <id>`
   (or `--kit <skill-id>...` for variants). Then compose with
   `tools/monster-animation-compose.py` (`--frames-dir` + `--map` if names
   differ), then `tools/monster-animation-qa.py --metadata <meta>`.
   Promote `atlas/animation-draft.png` to `atlas/animation.png` only on approval.

## Never add here

- No separate weapon/shield PNGs, no grip/socket art files (baked only).
- No hand-written `sourceFrames` bounds (compose fills geometry).
- No version folders inside the template; versions (`v1/`, `v2/`) are created
  when a real species set ships, per `art-reference/monsters/README.md`.
