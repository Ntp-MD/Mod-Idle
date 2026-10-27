# Art reference root

Holding area for concept images, generation sources and review-time metadata.
Never imported by the game runtime; approved art is copied into `game/` assets.

## Areas

```text
art-reference/
  map/          portable map art kit, style references, calibration snapshots
  monsters/     mob animation pipeline (README.md owns its layout)
  players/      player sets: frozen equipment-v1 archive plus baked <weapon-set>/
```

## Rules

- First-party art only. Generated files are not game-ready until approved and
  copied into game assets.
- Structural contracts: monsters mold
  (`monsters/_shared/mob-animation-template.json`), monsters `README.md`,
  players `README.md`, map kit `map/README.md`.
- Validators: `tools/monster-animation-qa.py` (geometry + mold gates),
  `tools/monster-animation-compose.py` (atlas assembly).
