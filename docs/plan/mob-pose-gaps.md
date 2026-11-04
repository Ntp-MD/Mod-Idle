# Mob pose gaps (vs Goblin mold)

Date: 2026-11-03. Method: `python -B tools/monster-animation-v5-inventory.py --species <all 35 mobs>`
against the mold `art-reference/monsters/humanoid/goblin/animation/poses.json`
(272 slots: idle 16 + walk/attack/hit/death 64 each). Rerun the tool to refresh;
per-mob exact slot lists live in each mob's `animation/missing-poses.json`
(where present). PNG presence never means visual approval
(see `art-reference/monsters/README.md`).

## Done already

- [x] `humanoid/human`, `humanoid/kobold`, `humanoid/lizardman` (272/272)
- [x] `undead/bonehound`, `undead/revenant` (complete per own draft spec)

## Checklist — Agent A (15 mobs)

- [ ] `beast/harpy` — ขาด 212/272
- [ ] `beast/werewolf` — ขาด 220/272
- [ ] `beast/wolf` — ขาด 221/272
- [ ] `demon/demon` — ขาด 204/272
- [ ] `demon/imp` — ขาด 224/272
- [ ] `dragon/dragon` — ขาด 224/272
- [ ] `dragon/mirehydra` — ขาด 224/272
- [ ] `dragon/wyrmling` — ขาด 224/272
- [ ] `dragon/wyvern` — ขาด 224/272
- [ ] `elemental/golem` — ขาด 191/272
- [ ] `elemental/slaggolem` — ขาด 224/272
- [ ] `elemental/wisp` — ขาด 226/272
- [ ] `fish/siren` — ขาด 232/272
- [ ] `formless/ooze` — ขาด 224/272
- [ ] `formless/slime` — ขาด 232/272

## Checklist ? Agent B (16 mobs; sequential, smallest gap first)

Work only the first unchecked mob. Do not move to the next mob until its canonical pose inventory reaches 272/272; then refresh the inventory and continue in ascending missing-count order. Draft candidates do not count toward completion. Current first target: `humanoid/goblin` at 107/272, missing 165.

- [ ] `humanoid/goblin` ? ??? 165/272
- [ ] `humanoid/minotaur` ? ??? 199/272
- [ ] `insect/beetle` ? ??? 206/272
- [ ] `humanoid/ogre` ? ??? 221/272
- [ ] `humanoid/troll` ? ??? 222/272
- [ ] `humanoid/giant` ? ??? 224/272
- [ ] `humanoid/orc` ? ??? 224/272
- [ ] `insect/hornet` ? ??? 231/272
- [ ] `insect/spider` ? ??? 231/272
- [ ] `plant/dryad` ? ??? 231/272
- [ ] `plant/treant` ? ??? 231/272
- [ ] `humanoid/elf` ? ??? 232/272
- [ ] `undead/mummy` ? ??? 232/272
- [ ] `undead/skeleton` ? ??? 232/272
- [ ] `undead/vampire` ? ??? 232/272
- [ ] `undead/wraith` ? ??? 236/272 (attack south missing; rest per own draft spec)

## Agent B draft candidates (not counted as pose coverage)

A total of 87 generated PNG candidates are stored under the matching mobs' `animation/drafts/` folders, each with a `.meta.json` sidecar. An audit parsed all sidecars and confirmed that each candidate targets a currently missing slot; all images are RGBA. These remain `candidate-review`: visual identity, direction, sequence, canvas/anchor normalization and atlas QA are not approved. The checklist above remains unchecked and canonical coverage below is unchanged.

- `humanoid/elf` 6; `humanoid/giant` 6; `humanoid/goblin` 7; `humanoid/minotaur` 5
- `humanoid/ogre` 5; `humanoid/orc` 5; `humanoid/troll` 5; `insect/beetle` 4
- `insect/hornet` 6; `insect/spider` 6; `plant/dryad` 6; `plant/treant` 6
- `undead/mummy` 5; `undead/skeleton` 5; `undead/vampire` 5; `undead/wraith` 5

For the active first target, `humanoid/goblin` has 7 draft candidates matching missing slots. All 7 fail the compose source check for semi-transparent pixels; the walk stride-a and stride-d candidates also touch the canvas edge. None is promoted, so Goblin remains 107/272. Built-in image generation returned `HTTP 429 usage_limit_reached` during the next pass, so further candidate generation is currently blocked. Do not promote a draft until art-owner visual review and required normalization/QA pass.

## Missing detail per mob

Format: `<action> <missing-count>: <direction> <missing-frames>`.
(`undead/bonehound` and `undead/revenant` are complete per their own
draft spec; the mold comparison does not apply to them.
`humanoid/human, kobold, lizardman` are complete and omitted.)

## beast/harpy: missing 212/272
  walk 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south-south-east 4; south-east 4; east-south-east 4; east 2; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west 2; west-south-west 4; south-west 4; south-south-west 4
  hit 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## beast/werewolf: missing 220/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## beast/wolf: missing 221/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 53: south 1; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## demon/demon: missing 204/272
  walk 48: south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 52: south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## demon/imp: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## dragon/dragon: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## dragon/mirehydra: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## dragon/wyrmling: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## dragon/wyvern: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## elemental/golem: missing 191/272
  walk 45: south-south-east 1; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 44: east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 51: south-south-east 3; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 51: south-south-east 3; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## elemental/slaggolem: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## elemental/wisp: missing 226/272
  idle 2: west-north-west.png, west-south-west.png
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## fish/siren: missing 232/272
  idle 8: south-south-east.png, east-south-east.png, east-north-east.png, north-north-east.png, north-north-west.png, west-north-west.png, west-south-west.png, south-south-west.png
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## formless/ooze: missing 224/272
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## formless/slime: missing 232/272
  idle 8: south-south-east.png, east-south-east.png, east-north-east.png, north-north-east.png, north-north-west.png, west-north-west.png, west-south-west.png, south-south-west.png
  walk 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  attack 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  hit 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
  death 56: south 4; south-south-east 4; south-east 4; east-south-east 4; east-north-east 4; north-east 4; north-north-east 4; north 4; north-north-west 4; north-west 4; west-north-west 4; west-south-west 4; south-west 4; south-south-west 4
## humanoid/elf: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/giant: missing 224/272

  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/goblin: missing 165/272
  walk 4: south-south-west 4
  attack 49: east-north-east 4; east-south-east 4; north 1; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/human: missing 0/272
## humanoid/kobold: missing 0/272
## humanoid/lizardman: missing 0/272
## humanoid/minotaur: missing 199/272
  walk 44: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 49: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-east 4; south-south-east 1; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 53: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 1; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 53: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 1; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/ogre: missing 221/272
  walk 53: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 1; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/orc: missing 224/272
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## humanoid/troll: missing 222/272
  walk 54: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 2; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## insect/beetle: missing 206/272
  walk 50: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-east 4; south-south-east 2; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 52: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 52: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 52: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## insect/hornet: missing 231/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 55: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 3; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## insect/spider: missing 231/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 55: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 3; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## plant/dryad: missing 231/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 55: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 3; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## plant/treant: missing 231/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 55: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 3; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/bonehound: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/mummy: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/revenant: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/skeleton: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/vampire: missing 232/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
## undead/wraith: missing 236/272
  idle 8: east-north-east.png, east-south-east.png, north-north-east.png, north-north-west.png, south-south-east.png, south-south-west.png, west-north-west.png, west-south-west.png
  walk 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  attack 60: east 2; east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west 2; west-north-west 4; west-south-west 4
  hit 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4
  death 56: east-north-east 4; east-south-east 4; north 4; north-east 4; north-north-east 4; north-north-west 4; north-west 4; south 4; south-east 4; south-south-east 4; south-south-west 4; south-west 4; west-north-west 4; west-south-west 4


## Complete (272/272)

- `humanoid/human`, `humanoid/kobold`, `humanoid/lizardman`

## Complete per own draft spec only (reduced contract, not the full mold)

- `undead/bonehound` 40/40, `undead/revenant` 40/40 (`status=draft-review`)
- `undead/wraith` 36/40 — attack has east/west only, south missing

## Incomplete (present/272, idle/walk/attack/hit/death)

- `humanoid/goblin` (mold itself): 107 — 16/16, 60/64, 15/64, 8/64, 8/64
- `elemental/golem`: 81 — 16/16, 19/64, 20/64, 13/64, 13/64
- `humanoid/minotaur`: 73 — 16/16, 20/64, 15/64, 11/64, 11/64
- `insect/beetle`: 66 — 16/16, 14/64, 12/64, 12/64, 12/64 (`missing-poses.json`: 206)
- `demon/demon`: 68 — 16/16, 16/64, 12/64, 12/64, 12/64
- `beast/wolf`: 51 — 16/16, 8/64, 11/64, 8/64, 8/64
- `beast/werewolf`: 52 — 16/16, 8/64, 12/64, 8/64, 8/64
- `dragon/dragon`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `dragon/mirehydra`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `dragon/wyrmling`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `dragon/wyvern`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `humanoid/giant`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `humanoid/ogre`: 51 — 16/16, 11/64, 8/64, 8/64, 8/64
- `humanoid/orc`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `humanoid/troll`: 50 — 16/16, 10/64, 8/64, 8/64, 8/64
- `beast/harpy`: 60 — 16/16, 12/64, 8/64, 12/64, 12/64
- `demon/imp`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `insect/hornet`, `insect/spider`, `plant/dryad`, `plant/treant`: 41 —
  8/16, 8/64, 9/64, 8/64, 8/64 (`missing-poses.json`: 231 each)
- 40 each — 8/16, 8/64, 8/64, 8/64, 8/64:
  `fish/siren`, `formless/slime`, `humanoid/elf`, `undead/mummy`,
  `undead/skeleton`, `undead/vampire`

- `elemental/slaggolem`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64
- `elemental/wisp`: 46 — 14/16, 8/64, 8/64, 8/64, 8/64
- `formless/ooze`: 48 — 16/16, 8/64, 8/64, 8/64, 8/64

Pattern: the 40-group covers only east/west (+south for some actions) with 8
idle directions. Baking new poses is art-owner work; never fabricate a pose
by compositing pixels (`art-reference/monsters/README.md`).

## Variant level coverage (156 variants total)

Source: each `variants/*/meta.json` (`levels: [lo, hi]`, `status`).
Standard pattern is 5 variants per mob covering 1-20 / 21-40 / 41-60 /
61-80 / 81-100. Status is `draft-review` everywhere except
`insect/beetle` (all 5 `integrated`).

Mobs with a single variant (partial band only):

- `beast/harpy`: harpy-screecher 11-20
- `dragon/mirehydra`: mire-hydra-broodling 91-100
- `dragon/wyrmling`: wyrmling-scaler 81-100
- `elemental/slaggolem`: slag-golem-crusher 81-100
- `undead/bonehound`: bone-hound-gnawer 71-80
- `undead/revenant`: frost-revenant-warden 81-90

Mobs with no variant in each band:

- 1-20 (5 missing): `dragon/mirehydra`, `dragon/wyrmling`,
  `elemental/slaggolem`, `undead/bonehound`, `undead/revenant`
- 21-40 (6 missing): `beast/harpy`, `dragon/mirehydra`, `dragon/wyrmling`,
  `elemental/slaggolem`, `undead/bonehound`, `undead/revenant`
- 41-60 (6 missing): same six as 21-40
- 61-80 (5 missing): `beast/harpy`, `dragon/mirehydra`, `dragon/wyrmling`,
  `elemental/slaggolem`, `undead/revenant` (`bonehound` covers 71-80)
- 81-100 (2 missing): `beast/harpy`, `undead/bonehound` (`revenant` covers
  81-90, `mirehydra` 91-100 only)
