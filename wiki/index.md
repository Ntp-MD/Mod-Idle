# ModWorld — index

**text-based RPG idle, fantasy theme** (D13)

An idle game in the Melvor mould that adds weapon/attribute depth using ideas from PoE, PoE 2 and Diablo — with **no graphics at all**.

- Date: 2026-10-01
- Status: **not started** — scope and spec are still unstable. This wiki is a record of arguing the idea through, not a design contract.
- ⚠️ Every number here comes from a **reduced model whose magnitudes were set by hand**. The scripts that produced them were deleted, so every figure is `measured-but-unverifiable`: citable, not re-checkable.

---

## What this game is

**หัวใจ:** สิ่งที่ดูเหมือนระบบเดียวจริง ๆ คือ **สองระบบที่ต้องทำพร้อมกัน** — ฝั่ง item กับฝั่ง monster/content · คนที่ล้มโปรเจคแบบนี้คือคนที่ทำฝั่งแรกเสร็จแล้วพบว่าฝั่งหลังไม่มี

→ [10-design/pillars-vision.md](10-design/pillars-vision.md)

### The chain the whole project rests on

If any link is missing, the idea collapses back to BI/Slot — strictly worse than Melvor:

```
small proc weight (<=1/3 of avg hit)
  => only +-9-12% variance per encounter
  => item valuation can be closed-form (no Monte Carlo)
  => contextual score for whole stash x all zones = 0.96s, not 27s
  => per-zone/build valuation becomes viable on mobile
  => monster tags actually change decisions
  => loot is genuinely *different*, not just *more*
```

---

## Where the project actually is

**10 open questions, none answered.** That is the state of the project.

| Order | Question | Blocks |
|---|---|---|
| 1 | **O10** what the player does in 60 seconds | everything — if the game passes every technical gate and still fails gate 5, nothing helps |
| 2 | **O9** render fidelity | the whole UI spec · can reverse D13 |
| 3 | **O8** are resist / ailment immunity in scope | how many layers exist, which is O4's input |
| 4 | **O4** how many dimensions in phase 1 | supplies the number O1 needs |
| 5 | **O1** 4 axes or 3 | gate 4 (`AXIS-LAYER`) |
| 6–9 | O5 · O6 · O2 · O3 | O3 is undecidable until the zone count is fixed |

→ full text with kill criteria: [10-design/game-design-document.md](10-design/game-design-document.md)

---

## Scope & gate

**First slice:** combat sim + valuation, but it must include a multi-target engine because that is a precondition for the pack layer.

1. >=3 archetypes are #1 in different zones, nobody exceeds 30%
2. worst-pick loss sits between -30% and -50% (not -95%)
3. full-stash valuation matrix <1s on real hardware
4. every core stat axis has >=2 answering layers (`AXIS-LAYER`)
5. **7 consecutive days with at least one moment per day where you hesitate over which loadout to use — no hesitation means the depth is fake**

**Cut first if the gate fails:** ailment + immunity → pack combat → high crafting tiers

**The solo risk:** the core hypothesis has zero external validation. The cheap path is **prototype as a Melvor mod first** — first-party modding, patchable at runtime, Creator Toolkit in-game, and *"nobody will be banned for cheating. This is a single player game"*

Warning sign: *"Astrology was reworked in V1.1 and no longer has random modifiers"* → the dev team already killed another RNG system.

---

## ⚠️ Two kinds of content in this wiki — do not confuse them

| | |
|---|---|
| **wiki pages** | decided enough to reference · cite these |
| **[10-design/proposals.md](10-design/proposals.md)** | **ideas still being argued · do NOT cite** |

The proposals page is now nearly empty — the hand system, eleven weapons, ten affix kinds, accessory slots and rarity have all moved into 04-items. One loose end remains (the zone table's missing window-kind column).

---

## Structure — 60 pages, 17 filled

`[x]` has content · `[~]` has content but has never been measured · `[ ]` empty because it has not been designed

### 00 Getting started
| | page | |
|---|---|---|
| [ ] | `overview.md` | what the game is, genre, platform |
| [ ] | `beginner-guide.md` | |
| [~] | [`controls-ui.md`](00-getting-started/controls-ui.md) | every screen in text form · waits on O9/O10 |
| [ ] | `glossary.md` | |

### 01 World
| | page | |
|---|---|---|
| [ ] | `lore/` | **nothing exists** · D13 locked "fantasy" with no timeline or myth |
| [~] | [`regions/zones-and-monsters.md`](01-world/regions/zones-and-monsters.md) | 10 zones · 31 monsters · **never measured** |
| [ ] | `locations/` `factions/` `races-species/` | |

### 02 Characters
| | page | |
|---|---|---|
| [ ] | `playable/` | **no classes, only a passive tree, and the tree is undesigned** · waits on O1 |
| [ ] | `companions/` `npcs/` `bosses/` | bosses have names but no mechanics |

### 03 Gameplay
| | page | |
|---|---|---|
| [~] | [`combat/damage-pipeline.md`](03-gameplay/combat/damage-pipeline.md) | 16 steps · **2 steps missing** (`eva-pen`, `crit`) |
| [ ] | `core-loop.md` | **waits on O10** |
| [~] | [`stats-attributes/core-stats.md`](03-gameplay/stats-attributes/core-stats.md) | 4 axes · **waits on O1** |
| [~] | `leveling-progression/` | inside zones (unlock on kph) · not split out yet |
| [~] | [`economy/economy.md`](03-gameplay/economy/economy.md) | **zero evidence** · every item is `prov` |
| [ ] | `classes-jobs/` `skills-abilities/` `crafting-gathering/` `party-multiplayer/` `mini-games/` | |

### 04 Items
| | page | |
|---|---|---|
| [~] | [`items-and-slots.md`](04-items/items-and-slots.md) | 5 item types · additive budget counted in slots · no auto-equip |
| [~] | [`weapons/weapons.md`](04-items/weapons/weapons.md) | **eleven** weapons · hand rules · dual wield |
| [~] | [`affixes.md`](04-items/affixes.md) | **ten** kinds, bound to a position · four open problems |
| [~] | [`accessories/accessories.md`](04-items/accessories/accessories.md) | six slots · shield · not matched to layers yet |
| [~] | [`rarity-system.md`](04-items/rarity-system.md) | **unresolved** · was rarity=line count, now common/rare/epic/unique |
| [ ] | `armor/` `consumables/` `materials/` `key-items/` `sets-equipment-bonus/` `accessories/` | |

### 05 Bestiary
| | page | |
|---|---|---|
| [~] | `monsters/` | inside zones (31) |
| [ ] | `bosses/` `elites-world-events/` | |

### 06 Quests & story
| | page | |
|---|---|---|
| [ ] | everything | quests, story, events, achievements, endings — **untouched** |

### 07 Systems
| | page | |
|---|---|---|
| [ ] | everything | dialogue, reputation, housing, mounts, gacha, pvp, guilds — **untouched** |
| [ ] | ~~`gacha-monetization.md`~~ | **cut** · D9, no revenue |
| [ ] | ~~`pvp-ranking.md`~~ `guilds-social.md` | single player |

### 08 Guides
| | page | |
|---|---|---|
| [ ] | everything | builds, farming, boss strategies, speedrun, tips |

### 09 Reference
| | page | |
|---|---|---|
| [ ] | everything | **no drop table exists at all** — this is the quietest gap in the project |

### 10 Design (dev-facing)
| | page | |
|---|---|---|
| [~] | [`pillars-vision.md`](10-design/pillars-vision.md) | why the idea has a chance |
| [~] | [`game-design-document.md`](10-design/game-design-document.md) | D1-15 · R1-4 · **O1-O10 buried at the bottom** |
| [~] | [`balance-notes.md`](10-design/balance-notes.md) | designed as formulas · **blocked on 4 things** |
| [~] | [`narrative-bible.md`](10-design/narrative-bible.md) | combat log lines · the thing that makes text feel like an RPG |
| [~] | [`proposals.md`](10-design/proposals.md) | ⚠️ **undecided ideas · do not cite** |
| [~] | [`systems-specs/design-rules.md`](10-design/systems-specs/design-rules.md) | 36 rules |
| [~] | [`systems-specs/content-dimensions.md`](10-design/systems-specs/content-dimensions.md) | 9 layers |
| [ ] | `art-direction/` | **none** — D13 removed art, but font and colour are still undecided |
| [ ] | `audio-direction.md` | |

### 11 Technical (dev-facing)
| | page | |
|---|---|---|
| [~] | `data-schema/` | entity shapes exist inside damage-pipeline |
| [ ] | `architecture.md` `save-system.md` `modding-api.md` `build-release.md` | |

### 12 Meta
| | page | |
|---|---|---|
| [ ] | everything | changelog, known issues, roadmap, faq, credits |

---

## What is missing, honestly

**60 pages · 17 filled · 43 empty**

| Section | State |
|---|---|
| **10-design** | nearly complete · the strongest section |
| 03-gameplay · 04-items | structure exists, but **not one number has been measured** |
| 01-world | 10 zones, **no lore** |
| **02-characters** | **entirely empty** — no classes and no tree, so the player character does not exist in the wiki |
| **06 · 07 · 08** | **entirely empty** — quests, social, guides untouched |
| **09-reference** | **entirely empty** — not a single drop table |
| 11 · 12 | empty |

An empty folder here is a **question, not a plan**. If that is too much noise, read only the thirteen pages that have content.

**Every time something is edited:** anything still undecided belongs in [proposals.md](10-design/proposals.md), not in a wiki page — otherwise the wiki starts claiming that ideas nobody has agreed on are decided.