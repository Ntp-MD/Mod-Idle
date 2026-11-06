# Mob pose completion

**Goal:** all 36 species reach 136/136 canonical source slots: eight directions (south, south-east, east, north-east, north, north-west, west and south-west), with one idle frame and four frames each for walk, attack, hit and death per direction.

Refresh counts and exact missing target slots with `python -B tools/monster-animation-v5-inventory.py`. The 11 `animation/missing-poses.json` trackers (at `<species>/<species>/animation/`) were refreshed 2026-11-05 to the 8-direction target; re-refresh them with the inventory whenever slots change.

Canonical pose PNGs count toward coverage; draft files do not. `candidate-review` frames count toward 136/136 but are not approved. Slot coverage, visual approval and atlas promotion are separate. Existing extra 16-direction poses and frames are grandfathered history — do not extend or complete them; they are not required for the target.

## Priority 1 - Every mob reaches 136/136

Work on one species at a time, starting with the smallest current gap. Finish that species at 136/136 and refresh the inventory before moving to the next. `plant/dryad` is complete; choose each next target from a fresh inventory. The dated snapshot below is historical.

Claim table (one species per agent — write your name + date before starting, tick `[x]` and refresh the inventory when done):

| Done | Species | Missing | Claimed by |
| ---- | ------- | ------- | ---------- |
| [x] | `plant/dryad` | 0 |  |
| [x] | `beast/harpy` | 0 | `/root/harpy` — 2026-11-05 |
| [x] | `beast/werewolf` | 0 | `/root/werewolf` — 2026-11-05 |
| [x] | `beast/wolf` | 0 | `/root/wolf` — 2026-11-05 |
| [x] | `plant/treant` | 0 | 
| [x] | `demon/imp` | 0 | 
| [x] | `dragon/dragon` | 0 | 
| [x] | `dragon/mirehydra` | 0 | `/root/mirehydra` — 2026-11-05 |
| [x] | `dragon/wyrmling` | 0 | `/root/wyrmling` — 2026-11-05 |
| [x] | `dragon/wyvern` | 0 | `/root/wyvern` — 2026-11-05 |
| [x] | `fish/siren` | 0 | `/root/siren` — 2026-11-05 |
| [x] | `humanoid/elf` | 0 |  |
| [x] | `humanoid/giant` | 0 |  |
| [x] | `humanoid/orc` | 0 |  |
| [x] | `undead/bonehound` | 0 | `/root/bonehound` — 2026-11-05 |
| [x] | `undead/mummy` | 0 | `/root/mummy` — 2026-11-05 |
| [x] | `undead/revenant` | 0 | `/root/revenant` — 2026-11-05 |

Inventory snapshot 2026-11-05 (after the assigned species completed): Dryad, Treant, Dragon and Imp are 136/136; 56 Treant, 65 Dragon and 93 Imp slots are provisional duplicate candidates requiring regeneration. Harpy 107/136, Werewolf 96/136, Wolf 93/136, Mirehydra 100/136, Wyrmling 73/136, Wyvern 124/136, Siren 128/136, Bonehound 112/136, Mummy and Revenant 40/136. The remaining 26 species have all 136 target slots present. Run the inventory for current details.

## Variant atlas status (163 variants, snapshot 2026-11-05)

156/163 variants have a draft atlas + `meta.json` and pass `tools/monster-animation-qa.py` (163/163 pass). Per-variant truth lives in its own `meta.json` on disk; the QA-pass list lives in `game/src/ui/dev/arena-art/arena-art-mob-drafts-qa-pass.ts` — do not copy rows here, update those owners instead.

Exceptions (every unlisted variant = draft atlas + QA pass):

- clips-only, no draft atlas, out of draft QA (7): `demon/imp/little-demon`, `elemental/wisp/eclipse-wisp`, `humanoid/goblin/spear-goblin`, `insect/spider/pixiblop-spider`, `undead/skeleton/original-bone`, `undead/skeleton/sword-shield`, `undead/wraith/crypt-wraith`
- `integrated`, runtime pool export exists (5): `insect/beetle/borer-beetle`, `insect/beetle/carapace-beetle`, `insect/beetle/dust-beetle`, `insect/beetle/hollow-beetle`, `insect/beetle/ironshell-beetle`
- draft atlas plus legacy clips (2): `beast/wolf/shadow-wolf`, `elemental/golem/stone-golem` (legacy manifest: `clips-meta.json`)

## Priority 2 - Review follow-up (parked until Priority 1 completes)

Sequencing rule: finish 136/136 coverage first, visual beauty review later. Do not mix aesthetic judgments into coverage work, and do not start this pass until every species reaches 136/136. Review candidates before approval or atlas promotion. Existing notes about extra directions remain applicable to those assets. First-pass atlas beauty grades are tracked in [mob-pose-beauty-review.md](mob-pose-beauty-review.md); size stability checks are tracked in [mob-pose-size-review.md](mob-pose-size-review.md).
