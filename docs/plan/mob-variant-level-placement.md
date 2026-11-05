# Mob Variant Level and Placement Migration Plan

Status: ready for implementation. This plan replaces the current hard 10-level zone bands with explicit fixed-level placements for every mob. It is an RO-style layout: neighbouring tiers may coexist, the strength of the local pool rises over the world, and every board cell remains an authored design rather than a random seed.

Do not start this migration while the art restructure or unrelated content-performance work is still uncommitted in the same tree. The prerequisite is a clean, committed baseline for the files this plan touches.

## 1 Decisions already made

| Topic | Decision |
|---|---|
| World structure | Keep the 18 Zones and their narrative order. Zones stop being hard level brackets; they are the progression flow and UI "recommended level" hint only. |
| Level ownership | `mob.variants` owns the fixed integer level. `species.zone_levels` is removed after migration. Boss and Unique tables own their fixed levels too. |
| Identity | Every normal/Elite placement row receives a stable global ID. IDs are lowercase `<species>.z<zone>.<slug>`. IDs never change even if the display name or art changes. |
| Display names | Names may be shared by rows in the same lineage when the rows are intentionally separate placements. The ID is the lookup and validation key; the UI may print `Name · Lv n`. |
| Same-name split | An existing 20-level Variant may be split into multiple fixed-level placements instead of inventing a new art asset for every row. |
| Placement count | Author exactly the 314 current `species × subzone` placements. A species appearing in more than one subzone of the same zone receives one placement per subzone. Do not add a row for a species in a zone where none exists today unless the design document is revised in the same change. |
| Boss / Unique | Author the existing 18 Boss placements and 36 Unique placements with fixed levels. Do not stretch the highest Variant to cover later zones. |
| Hard band | Delete the rule "a level must fit the zone range". Replace it with the gap, focus, weight and progression checks below. |
| XP/Damage | Keep the existing `mobHpAt` and `mobPsAt` formulas. Level is the input; do not add a separate difficulty multiplier. |
| Artwork | No image generation is part of this plan. New placements may use the Species visual family; a specific art override may be added later. A missing override uses the existing fallback. |
| Determinism | No randomized name or level assignment at runtime. Every placement is authored in `tools/data/engine.json` and reviewed by diff. |
| UI gate | "Recommended level" is informative only. It never blocks a walk, hunt, dungeon or warp. |
| Economy | Keep the existing loot, junk, crafting and town demand model. Do not add new trade goods merely because placement IDs were split. |
| Gathering sites | Include mining, woodcutting and fishing integration in this migration. Reuse existing resource hexes, fieldwork rules and authored resources; placement levels do not set gathering yield or unlocks. |
| Validation | The migration is not complete until the new invariants, unit tests, browser tests, map checks and save compatibility checks pass. |

## 2 Current facts to preserve or intentionally change

Current data:

- 36 Species
- 18 Zones with 3 Subzones each = 54 named Subzones
- 314 authored species placements across the 54 named Subzones
- The above includes 21 rows where a species is deliberately placed in more than one subzone of the same zone; each such occurrence is one placement with its own identity and level
- 293 unique `species × zone` pairs under the legacy single-entry accounting
- 156 old Variant rows whose `levels` are bands such as `1–20`, `21–40`
- 18 named Bosses
- 36 named Uniques
- Fixed level today: `species.zone_levels[zoneId]`, resolved by `mobLevelIn()`
- Normal/Elite Variant selection today: `variantsInZone()` by zone midpoint
- Map locations use `zone`, `subzone` and species lists; they do not store level
- Gathering currently has 39 distinct resource hexes in `road.locations`: 18 `mine`, 18 `grove`, and 3 `fishing`. Fishing is authored in Zones 7, 14 and 15. These are existing locations, not 39 additional maps.
- Visibility is already keyed off Variant/Species names in parts of the UI and art registry

Intentionally change:

```text
species.zone_levels + variants.levels: [lo, hi]
        -> mob.variants[{ id, species, level, zone, subzone, role, ... }]
```

Intentionally preserve:

- Species eligibility (`species.zones`) unless a placement row declares it
- `spawns.json` layout, caps and respawn timers
- `map.json` and the map package's rendering style
- Loot's global `variant_drops` business model
- The 18 Zone names and their narrative order
- The existing visual assets

## 3 Target data contract

Extend the existing `mob` section of `tools/data/engine.json`. Do not create a second gameplay authority.

### 3.1 Normal and Elite placement rows

Replace the array-of-20-level Variants with an array of explicit placements:

```ts
interface MobPlacement {
  /** Stable global identity; lookup key for drops, UI, art, measurements. */
  id: string;
  /** Species id from `mob.species[].id`. */
  species: string;
  /** Display name. Repeats across zones are allowed; rows of one Species in the same Zone must use different display names. */
  name: string;
  /** Fixed integer combat level. */
  level: number;
  /** Named side used by the board's spawn pool: 1-based for the authored matrix. */
  zone: number;
  subzone: number;
  /** Designer's role; used for ordering and validation only. */
  role: 'grunt' | 'skirmisher' | 'line' | 'anchor' | 'visitor' | 'guardian';
  /** Relative spawn weight inside the Pool. Must be a positive integer. */
  weight: number;
  /** Variant behaviour overrides, if any. */
  damage?: MobDamageType;
  core?: MobCore;
}
```

Rules:

1. IDs use the same lowercase `<species>.z<zone>.<slug>` shape, where `<zone>` is padded to two digits.
2. `id` is unique across normal, Elite, Boss and Unique placements. No two rows of the same Species in one Zone may share a display name.
3. Every `species` and `zone` must exist.
4. `subzone` is one-based and must point at an authored Subzone of `zone`.
5. `level` is an integer from `1` through `180`.
6. `weight` is an integer from `1` through `50`.
7. `role` may not be `visitor` for a row with `weight > 3`.
8. `visitor` is legal only at the five seam edges listed in §4.3.
9. No two rows with the same `zone` and `subzone` may differ by less than 2 levels.
10. No more than two rows in one Subzone may occupy one exact level.
11. Each Subzone pool must contain at least `min(6, species count)` distinct level values.
12. Across each narrative plate, the weighted median should climb; a regression greater than two levels must be called out in the review. It is a watch, not a clamp.

### 3.2 Boss and Unique rows

Add scalar fixed levels and stable IDs:

```ts
interface MobBossPlacement extends MobBoss {
  id: string;
  level: number;
  weight?: number;  // may be omitted; bosses are not field loot spawns
}

interface MobUniquePlacement extends MobUnique {
  id: string;
  level: number;
  weight: number;   // required positive integer
}
```

Rules:

1. Boss level is fixed and does not inherit `zone.levels[1]`.
2. Unique level is fixed, integer and not inferred from the next tier.
3. Every Boss and Unique appears in the same Zone's spawn table or a dedicated summon; no hidden arithmetic fallback.
4. Every Boss and Unique gets a drop row, even if it pays only stones.
5. IDs use the same lowercase `<species>.z<zone>.<slug>` shape.

### 3.3 Variant drops

Change `mob.variant_drops` to be looked up by placement `id`, not display `name`.

```ts
interface VariantDrop {
  item: string;
  rarity: 'common' | 'uncommon' | 'rare';
  lean: 'gear' | 'herb' | 'junk' | 'none';
}
```

Compatibility:

- Keep the existing 156 rows and their `item`/drop data where an old Variant is split into more than one placement.
- Sibling placements created from one old row reuse the same `item` entry; they do not need new trade goods or art.
- `variant_drops` keys change from legacy names to new IDs in the same commit.
- If an old row cannot be mapped, the migration must fail before writing the new file. It must not silently pick a fallback drop.

## 4 Level layout

### 4.1 Soft narrative anchors

Use these anchor medians only as a composition guide. They are not hard limits and must not be implemented as a clamp.

| Zone | Name | Guide median |
|---:|---|---:|
| 1 | Eastgate | 8 |
| 2 | Highspire | 18 |
| 3 | Wolf Cross | 27 |
| 4 | Greyfen | 37 |
| 5 | Saltmarrow | 47 |
| 6 | The Pale Spire | 57 |
| 7 | Blackwater Reach | 68 |
| 8 | Bonegate | 78 |
| 9 | Frosthold | 88 |
| 10 | Vermolch | 98 |
| 11 | Duskmoor | 108 |
| 12 | Nettlecrag | 118 |
| 13 | Emberhold | 128 |
| 14 | Millbrook | 138 |
| 15 | Wyrmback | 149 |
| 16 | Ashfall | 159 |
| 17 | Ironrow | 169 |
| 18 | Thornwake | 178 |

The matrix may place readings anywhere from level 1 to 180. A local floor can be completed with low-level stock; a peak can stretch past the next Zone. The guide is a review smell, not a validator.

### 4.2 Per-Subzone composition

Each named Subzone needs all of the following:

1. **Backbone**: the rows the player normally expects in this place. Use `weight` 18–40.
2. **Boundary rows**: levels lower than the Zone median, to make the world readable. Use weight 10–22.
3. **Apex rows**: one or two levels plainly above the local median, either high-end or a miniboss. Use weight 2–10.
4. **Visitor rows**: at most one or two from the adjacent tier at explicitly named seams. Use weight 1–3.

No placement block may be assigned by a formula. The author chooses the number and records the reason in the pull request summary (appearance role, geography or encounty concept). A script may check but never choose.

### 4.3 Allowed seam overlap

Only these eight seams may carry `visitor` rows:

```text
3 ↔ 4
6 ↔ 7
9 ↔ 10
12 ↔ 13
15 ↔ 16
```

Within a selected seam:

- a single signature placement may be up to two levels beyond the local Zone's guide median
- exactly one or two `visitor` rows may appear in the upstream or downstream Subzone, never the whole pool
- visitor weight never exceeds 3
- no visitor appears in the default Dungeon or Boss encounter unless explicitly authored
- the mismatch must be legible in the encounter UI or log; it must not be a silent surprise

Do not extend these exceptions to every zone. An unrestricted free-for-all ruins progression even with 18 handcrafted stages.

### 4.4 Gap rule

For each Subzone, collect the distinct authored levels:

```text
sortedLevels = unique(rows.map(r => r.level)).sort(ascending)
for each adjacent pair:
  if next - previous < 2: FAIL
```

Duplicate levels:

- at most two rows may share one level
- if there are exactly two, they must have distinct Species and distinct IDs
- a third duplicate is FAIL

This rule catches both "every cap is the same number" design and runs of one-level differences. It is the single hard spacing invariant for the matrix.

### 4.5 Population distribution watch

These are watches, not numeric gates:

- each Subzone's average level rises across the three Subzones inside a zone (Fringe < Heart < Core is only the authoring order, not an obligation)
- at least 20% of rows in a Zone are below its guide median, at least 50% are below or near it, and no more than 5% are more than eight levels above the next Zone median
- no more than two rows in a pool are "outlier" rows at any one time

A deliberately strange distribution must be documented in the PR description so the owner can inspect it without reconstructing the rationale from a diff.

## 4-bis Fixed placement matrix and balance budget

The following matrix is the authoritative source for the migration. It is designer-authored by zone and subzone rather than generated from a formula. The implementer copies `species`, `level`, `weight` and `role` into the target row and creates the placement ID according to §3. Do not change an individual level without documenting the reason and re-running the §4.4 gap check.

`P` is a design aid derived from the species `power_base`, not a new gameplay stat: A≥1.06, B=.99–1.05, C=.93–.98, D≤.92.

### 4-bis.1 Balance of strength

1. **HP/PS:** Do not change `mobHpAt` or `mobPsAt`; do not add a replacement damage multiplier. The species `power_base` and the placement fixed level are the complete strength calculation.
2. **Group budget:** In every Subzone, `sum(weight × power_base) / sum(weight)` must remain between 0.93 and 1.08. If a pool violates that budget, adjust weights or placement mix, not the engine formulas.
3. **A-value cap:** Every species in power band A may have at most `weight=6`. B may not exceed 35, C or D may not exceed 40. A bodies are pace-setters, never the backbone.
4. **Threat shape:** D is low-pressure guard stock, C is backbone, B is standard pressure, A is rhythm-breaking power and intentionally constrained by weight.
5. **Weight vs strength:** A low weight is a frequency choice only; it does not nerf the body or hide it from the pool.
6. **Boss/Unique:** Boss and Unique use the same `power_base` as their species and receive no disguised second stat block.

### Zone 1 — Eastgate · Windmill Meadow

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 4 | 32 | D |
| human | skirmisher | 6 | 26 | C |
| beetle | skirmisher | 2 | 28 | C |
| wolf | skirmisher | 8 | 24 | C |
| skeleton | line | 11 | 35 | B |
| mummy | guardian | 13 | 14 | B |
| vampire | line | 17 | 8 | B |
| demon | anchor | 22 | 10 | B |
| troll | guardian | 26 | 7 | B |
| golem | anchor | 30 | 6 | A |
| giant | guardian | 35 | 4 | B |

### Zone 1 — Eastgate · Old Orchard Outskirts

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| wolf | line | 14 | 18 | C |
| lizardman | line | 10 | 28 | C |
| slime | grunt | 12 | 35 | D |
| elf | line | 21 | 16 | C |
| werewolf | line | 19 | 22 | B |
| dryad | guardian | 25 | 6 | A |
| treant | guardian | 29 | 12 | B |
| dragon | anchor | 34 | 4 | A |

### Zone 1 — Eastgate · Broken Banner Camp

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 1 | 35 | D |
| spider | skirmisher | 7 | 28 | C |
| minotaur | guardian | 9 | 20 | B |
| orc | line | 16 | 18 | B |
| ogre | anchor | 24 | 6 | B |

### Zone 2 — Highspire · Mountain Slopes

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 15 | 30 | D |
| human | grunt | 18 | 24 | C |
| lizardman | line | 20 | 28 | C |
| spider | line | 24 | 20 | C |
| elf | line | 27 | 17 | C |
| werewolf | line | 30 | 16 | B |
| treant | guardian | 33 | 9 | B |
| dragon | anchor | 37 | 5 | A |
| wisp | guardian | 41 | 4 | C |
| harpy | skirmisher | 44 | 4 | C |

### Zone 2 — Highspire · Cliff Holds

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 21 | 32 | D |
| wolf | line | 25 | 25 | C |
| orc | line | 28 | 24 | B |
| ogre | guardian | 31 | 15 | B |
| minotaur | guardian | 34 | 12 | B |
| dryad | guardian | 38 | 6 | A |
| giant | guardian | 41 | 6 | B |
| troll | guardian | 45 | 7 | B |
| golem | anchor | 49 | 4 | A |

### Zone 2 — Highspire · Dragon Peak

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| skeleton | line | 26 | 24 | B |
| slime | grunt | 30 | 26 | D |
| mummy | guardian | 34 | 14 | B |
| vampire | line | 38 | 10 | B |
| demon | anchor | 41 | 9 | B |
| imp | skirmisher | 44 | 6 | D |
| wyvern | anchor | 49 | 4 | B |

### Zone 3 — Wolf Cross · Murky Swamp

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 22 | 32 | D |
| slime | grunt | 24 | 35 | D |
| kobold | grunt | 26 | 25 | D |
| lizardman | line | 28 | 22 | C |
| orc | line | 30 | 20 | B |
| ogre | guardian | 33 | 14 | B |
| minotaur | guardian | 35 | 11 | B |
| giant | anchor | 39 | 6 | B |
| hornet | skirmisher | 41 | 8 | D |
| ooze | guardian | 44 | 4 | C |

### Zone 3 — Wolf Cross · Mud Flats

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| spider | skirmisher | 27 | 26 | C |
| skeleton | line | 29 | 22 | B |
| mummy | guardian | 32 | 13 | B |
| vampire | line | 34 | 17 | B |
| demon | anchor | 38 | 9 | B |
| dryad | guardian | 42 | 6 | A |
| troll | anchor | 46 | 6 | B |

### Zone 3 — Wolf Cross · Poison Fen

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| human | grunt | 33 | 20 | C |
| wolf | line | 36 | 23 | C |
| dragon | anchor | 42 | 6 | A |
| elf | line | 44 | 17 | C |
| werewolf | line | 47 | 15 | B |
| golem | anchor | 50 | 6 | A |
| treant | anchor | 53 | 4 | B |

### Zone 4 — Greyfen · Dune Sea

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 32 | 26 | D |
| goblin | grunt | 34 | 30 | D |
| skeleton | line | 36 | 25 | B |
| wolf | line | 38 | 22 | C |
| mummy | guardian | 41 | 15 | B |
| vampire | line | 44 | 12 | B |
| demon | anchor | 47 | 9 | B |
| troll | guardian | 50 | 8 | B |
| treant | guardian | 55 | 6 | B |
| giant | anchor | 58 | 4 | B |
| beetle | guardian | 61 | 2 | C |

### Zone 4 — Greyfen · Sunken Tombs

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| human | grunt | 39 | 18 | C |
| slime | grunt | 43 | 25 | D |
| dragon | anchor | 51 | 4 | A |
| elf | line | 54 | 17 | C |
| werewolf | line | 57 | 14 | B |
| dryad | guardian | 60 | 6 | A |
| golem | anchor | 63 | 6 | A |
| siren | anchor | 67 | 3 | A |

### Zone 4 — Greyfen · Scorch Mesa

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| lizardman | line | 45 | 25 | C |
| spider | skirmisher | 48 | 22 | C |
| orc | line | 52 | 18 | B |
| ogre | guardian | 56 | 12 | B |
| minotaur | guardian | 59 | 8 | B |

### Zone 5 — Saltmarrow · Outer Court

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 44 | 24 | D |
| skeleton | line | 49 | 24 | B |
| human | grunt | 51 | 18 | C |
| spider | line | 53 | 20 | C |
| dragon | anchor | 60 | 5 | A |
| elf | line | 63 | 16 | C |
| werewolf | line | 66 | 12 | B |
| golem | anchor | 69 | 5 | A |

### Zone 5 — Saltmarrow · Burial Gallery

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| lizardman | grunt | 45 | 22 | C |
| wolf | grunt | 48 | 22 | C |
| orc | line | 58 | 20 | B |
| ogre | guardian | 61 | 14 | B |
| minotaur | guardian | 64 | 11 | B |
| dryad | guardian | 68 | 6 | A |
| treant | guardian | 71 | 7 | B |
| giant | guardian | 73 | 6 | B |
| troll | anchor | 76 | 6 | B |
| wraith | anchor | 80 | 4 | B |

### Zone 5 — Saltmarrow · Inner Sanctum

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 47 | 30 | D |
| slime | grunt | 52 | 25 | D |
| mummy | guardian | 65 | 10 | B |
| vampire | guardian | 70 | 9 | B |
| demon | anchor | 74 | 6 | B |
| imp | skirmisher | 78 | 3 | D |

### Zone 6 — The Pale Spire · Outer Colonnade

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 52 | 26 | D |
| human | grunt | 54 | 20 | C |
| lizardman | line | 57 | 23 | C |
| slime | grunt | 59 | 28 | D |
| orc | line | 62 | 18 | B |
| ogre | guardian | 65 | 13 | B |
| minotaur | guardian | 68 | 11 | B |
| treant | guardian | 72 | 7 | B |
| hornet | skirmisher | 75 | 4 | D |

### Zone 6 — The Pale Spire · Hall of Wardens

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 55 | 29 | D |
| spider | line | 60 | 21 | C |
| mummy | guardian | 66 | 12 | B |
| vampire | line | 69 | 14 | B |
| demon | anchor | 73 | 9 | B |
| dryad | anchor | 77 | 6 | A |
| giant | guardian | 80 | 5 | B |
| wraith | anchor | 84 | 3 | B |

### Zone 6 — The Pale Spire · Sanctum Depths

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| skeleton | line | 61 | 22 | B |
| wolf | line | 67 | 22 | C |
| dragon | anchor | 76 | 6 | A |
| elf | line | 79 | 15 | C |
| werewolf | line | 82 | 13 | B |
| troll | guardian | 88 | 8 | B |
| golem | anchor | 90 | 6 | A |
| imp | skirmisher | 94 | 2 | D |

### Zone 7 — Blackwater Reach · Drowned Stair

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| slime | grunt | 58 | 30 | D |
| skeleton | line | 61 | 23 | B |
| dragon | anchor | 72 | 6 | A |
| elf | line | 75 | 17 | C |
| werewolf | guardian | 78 | 12 | B |
| dryad | guardian | 84 | 6 | A |
| troll | guardian | 88 | 6 | B |
| siren | anchor | 96 | 3 | A |

### Zone 7 — Blackwater Reach · Silt Deeps

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 62 | 28 | D |
| lizardman | grunt | 65 | 23 | C |
| goblin | grunt | 69 | 31 | D |
| wolf | line | 72 | 21 | C |
| mummy | guardian | 76 | 13 | B |
| vampire | line | 80 | 16 | B |
| demon | anchor | 83 | 8 | B |
| giant | guardian | 87 | 5 | B |
| golem | guardian | 89 | 4 | A |
| treant | anchor | 94 | 3 | B |

### Zone 7 — Blackwater Reach · Flooded Abyss

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| human | grunt | 66 | 20 | C |
| spider | line | 73 | 22 | C |
| orc | line | 78 | 16 | B |
| ogre | guardian | 81 | 12 | B |
| minotaur | guardian | 85 | 8 | B |

### Zone 8 — Bonegate · Tunnels

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| human | grunt | 78 | 18 | C |
| wolf | line | 80 | 22 | C |
| orc | line | 84 | 17 | B |
| ogre | guardian | 87 | 14 | B |
| minotaur | guardian | 89 | 11 | B |
| dryad | guardian | 93 | 6 | A |
| golem | anchor | 97 | 6 | A |
| treant | anchor | 101 | 5 | B |
| giant | guardian | 106 | 4 | B |
| wraith | anchor | 110 | 2 | B |
| bonehound | anchor | 115 | 1 | C |

### Zone 8 — Bonegate · Deep Warrens

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 72 | 29 | D |
| goblin | grunt | 75 | 31 | D |
| skeleton | line | 83 | 22 | B |
| spider | skirmisher | 86 | 21 | C |
| dragon | anchor | 92 | 5 | A |
| elf | line | 95 | 14 | C |
| werewolf | line | 99 | 12 | B |
| troll | guardian | 103 | 7 | B |

### Zone 8 — Bonegate · Sunken Vault

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| lizardman | grunt | 79 | 21 | C |
| slime | grunt | 85 | 25 | D |
| mummy | guardian | 90 | 12 | B |
| vampire | line | 93 | 14 | B |
| demon | anchor | 98 | 7 | B |

### Zone 9 — Frosthold · Ash Fields

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| lizardman | grunt | 82 | 17 | C |
| spider | skirmisher | 85 | 22 | C |
| mummy | guardian | 88 | 12 | B |
| vampire | line | 91 | 15 | B |
| demon | anchor | 94 | 9 | B |
| dryad | anchor | 98 | 6 | A |
| treant | guardian | 101 | 6 | B |
| wraith | anchor | 104 | 4 | B |
| revenant | anchor | 109 | 2 | B |

### Zone 9 — Frosthold · Slag Pit

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 74 | 27 | D |
| skeleton | line | 77 | 23 | B |
| human | grunt | 80 | 19 | C |
| slime | grunt | 85 | 26 | D |
| orc | line | 89 | 16 | B |
| ogre | guardian | 93 | 11 | B |
| minotaur | guardian | 96 | 9 | B |
| golem | anchor | 99 | 6 | A |

### Zone 9 — Frosthold · Caldera

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 79 | 28 | D |
| wolf | line | 84 | 20 | C |
| dragon | anchor | 100 | 5 | A |
| elf | line | 103 | 14 | C |
| werewolf | line | 107 | 12 | B |
| giant | guardian | 111 | 7 | B |
| troll | guardian | 114 | 5 | B |
| wyvern | anchor | 119 | 3 | B |

### Zone 10 — Vermolch · Snowfield

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| kobold | grunt | 86 | 28 | D |
| human | grunt | 89 | 20 | C |
| lizardman | line | 92 | 20 | C |
| wolf | line | 96 | 22 | C |
| mummy | guardian | 99 | 12 | B |
| vampire | line | 102 | 15 | B |
| demon | anchor | 106 | 9 | B |
| treant | guardian | 110 | 8 | B |
| troll | guardian | 114 | 6 | B |
| golem | guardian | 118 | 5 | A |
| ooze | anchor | 122 | 2 | C |
| mirehydra | anchor | 128 | 1 | B |

### Zone 10 — Vermolch · Glacier Shelf

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 90 | 29 | D |
| slime | grunt | 94 | 26 | D |
| dragon | anchor | 104 | 5 | A |
| elf | line | 109 | 17 | C |
| werewolf | line | 112 | 15 | B |
| dryad | guardian | 115 | 6 | A |
| giant | guardian | 121 | 4 | B |

### Zone 10 — Vermolch · Rime Hollow

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| skeleton | line | 97 | 23 | B |
| spider | skirmisher | 100 | 21 | C |
| orc | line | 108 | 17 | B |
| ogre | guardian | 113 | 11 | B |
| minotaur | guardian | 117 | 9 | B |
| hornet | skirmisher | 121 | 2 | D |

### Zone 11 — Duskmoor · Blight Field

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | guardian | 112 | 10 | B |
| werewolf | line | 116 | 18 | B |
| beetle | skirmisher | 120 | 3 | C |

### Zone 11 — Duskmoor · Howling Waste

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| skeleton | line | 104 | 24 | B |
| werewolf | line | 108 | 24 | B |

### Zone 11 — Duskmoor · Rift Scar

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| vampire | line | 111 | 17 | B |
| werewolf | line | 115 | 13 | B |
| wisp | anchor | 120 | 4 | C |

### Zone 12 — Nettlecrag · Bone Stair

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | guardian | 126 | 8 | B |
| golem | guardian | 132 | 5 | A |
| wraith | anchor | 139 | 2 | B |

### Zone 12 — Nettlecrag · Molten Deeps

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | anchor | 123 | 9 | B |
| slime | line | 127 | 18 | D |
| beetle | skirmisher | 131 | 2 | C |

### Zone 12 — Nettlecrag · Throne Abyss

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| golem | guardian | 134 | 6 | A |
| slime | line | 140 | 18 | D |
| ooze | anchor | 146 | 2 | C |

### Zone 13 — Emberhold · Fallen Gate

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | anchor | 128 | 9 | B |
| human | grunt | 132 | 16 | C |
| slaggolem | anchor | 141 | 2 | A |

### Zone 13 — Emberhold · Market Ruins

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | anchor | 124 | 8 | B |
| skeleton | line | 129 | 18 | B |
| imp | skirmisher | 132 | 10 | D |
| slaggolem | anchor | 138 | 3 | A |

### Zone 13 — Emberhold · Noble Quarter

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| demon | guardian | 121 | 11 | B |
| vampire | guardian | 144 | 6 | B |

### Zone 14 — Millbrook · Fog Thicket

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| goblin | grunt | 131 | 23 | D |
| werewolf | line | 136 | 18 | B |
| siren | anchor | 145 | 3 | A |

### Zone 14 — Millbrook · Dark Grove

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| spider | line | 127 | 20 | C |
| werewolf | line | 137 | 21 | B |
| hornet | skirmisher | 143 | 5 | D |

### Zone 14 — Millbrook · Spider Hollow

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| werewolf | line | 134 | 18 | B |
| wolf | line | 146 | 22 | C |

### Zone 15 — Wyrmback · Tideflats

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| lizardman | line | 138 | 21 | C |
| spider | line | 143 | 18 | C |
| siren | anchor | 151 | 4 | A |
| wyrmling | anchor | 155 | 2 | B |

### Zone 15 — Wyrmback · Salt Cliffs

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| ogre | guardian | 134 | 12 | B |
| slime | grunt | 141 | 22 | D |
| wyvern | anchor | 149 | 4 | B |
| wyrmling | anchor | 153 | 2 | B |

### Zone 15 — Wyrmback · Sunken Reef

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| ogre | guardian | 131 | 12 | B |
| spider | skirmisher | 139 | 20 | C |
| siren | anchor | 147 | 5 | A |

### Zone 16 — Ashfall · Glimmer Grove

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| dryad | anchor | 151 | 6 | A |
| elf | line | 156 | 18 | C |
| wraith | anchor | 164 | 3 | B |

### Zone 16 — Ashfall · Elder Rootway

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| elf | line | 147 | 20 | C |
| werewolf | line | 157 | 18 | B |
| wyvern | anchor | 164 | 4 | B |

### Zone 16 — Ashfall · Moonlit Glade

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| treant | guardian | 153 | 8 | B |
| werewolf | line | 159 | 16 | B |
| wisp | anchor | 168 | 3 | C |

### Zone 17 — Ironrow · Stormbreak Grove

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| dryad | anchor | 154 | 6 | A |
| treant | guardian | 160 | 6 | B |
| wraith | anchor | 168 | 3 | B |

### Zone 17 — Ironrow · Charged Rootway

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| dryad | line | 149 | 6 | A |
| werewolf | line | 163 | 18 | B |

### Zone 17 — Ironrow · Thunder Glade

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| elf | line | 155 | 17 | C |
| treant | guardian | 164 | 7 | B |
| siren | anchor | 173 | 4 | A |
| wisp | anchor | 179 | 2 | C |

### Zone 18 — Thornwake · Frozen Fen

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| dragon | anchor | 162 | 4 | A |
| troll | guardian | 172 | 5 | B |

### Zone 18 — Thornwake · Icebreak Shelf

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| dragon | anchor | 171 | 6 | A |
| wolf | line | 179 | 12 | C |

### Zone 18 — Thornwake · Rime Bog

| Species | Role | Lv | Weight | P |
|---|---|---:|---:|:---:|
| giant | guardian | 165 | 7 | B |
| troll | guardian | 175 | 5 | B |
| ooze | anchor | 180 | 2 | C |

### 4-bis.2 Bosses and Unique placements

Levels below are fixed; no new zone or interpolation may be invented. Bosses are not normal rolls; Uniques still go through the existing spawn chance only.

**Namespaced display names:** Every named Boss and Unique receives a system-wide unique display name, with targeted name adjustments (e.g. adding `Wild` or `Tyrant`) to avoid reference collisions. The tables below already use unique names.

#### Boss 18 ตัว

| Zone | Boss | Species | Level |
|---:|---|---|---:|
| 1 | Goblin King | goblin | 12 |
| 2 | Warlord Orc | orc | 24 |
| 3 | Elder Troll | troll | 37 |
| 4 | Mummy Lord | mummy | 49 |
| 5 | Bone Colossus | skeleton | 62 |
| 6 | Paladin | human | 76 |
| 7 | Colossus | golem | 89 |
| 8 | Hoarder Kobold | kobold | 103 |
| 9 | Ogre King | ogre | 117 |
| 10 | Wolf King | wolf | 129 |
| 11 | Archdemon | demon | 142 |
| 12 | Slime King | slime | 149 |
| 13 | Ancient Vampire | vampire | 158 |
| 14 | Broodmother | spider | 165 |
| 15 | Lizardman Chief | lizardman | 171 |
| 16 | Treant Elder | treant | 176 |
| 17 | Elven Archmage | elf | 178 |
| 18 | Ancient Dragon | dragon | 180 |

#### Wild Unique 36 ตัว

| Zone | Unique | Species | Level |
|---:|---|---|---:|
| 1 | Beetle Patriarch | beetle | 16 |
| 1 | Goblin King, Wild | goblin | 19 |
| 1 | Minotaur King | minotaur | 22 |
| 2 | Harpy Skyqueen | harpy | 28 |
| 2 | Storm Giant | giant | 33 |
| 3 | Warlord Orc, Wild | orc | 39 |
| 3 | Elder Troll, Wild | troll | 43 |
| 4 | Mummy Lord, Wild | mummy | 51 |
| 5 | Bone Colossus, Wild | skeleton | 64 |
| 6 | Paladin, Wild | human | 75 |
| 7 | Siren Queen | siren | 95 |
| 7 | Colossus, Wild | golem | 105 |
| 8 | Hoarder Kobold, Wild | kobold | 109 |
| 8 | Bone Hound Bonekeeper | bonehound | 114 |
| 9 | Frost Revenant King | revenant | 117 |
| 9 | Ogre King, Wild | ogre | 124 |
| 10 | Wolf King, Wild | wolf | 133 |
| 10 | Mire Hydra Tyrant | mirehydra | 130 |
| 11 | Wisp Choir | wisp | 143 |
| 11 | Werewolf Lord | werewolf | 140 |
| 11 | Archdemon, Wild | demon | 151 |
| 12 | Slime King, Wild | slime | 148 |
| 12 | Ooze Titan | ooze | 153 |
| 13 | Imp Baron | imp | 159 |
| 13 | Slag Golem Forgeheart | slaggolem | 162 |
| 13 | Ancient Vampire, Wild | vampire | 166 |
| 14 | Hornet Matron | hornet | 169 |
| 14 | Broodmother, Wild | spider | 172 |
| 15 | Lizardman Chief, Wild | lizardman | 157 |
| 15 | Wyrmling Progenitor | wyrmling | 163 |
| 15 | Wyvern Matriarch | wyvern | 168 |
| 16 | Ancient Dryad | dryad | 176 |
| 16 | Treant Elder, Wild | treant | 179 |
| 17 | Wraith Sovereign | wraith | 171 |
| 17 | Elven Archmage, Wild | elf | 178 |
| 18 | Ancient Dragon, Wild | dragon | 180 |

The Unique table assigns one zone per row: a Unique may inhabit only the zone shown; if that species also has normal placements there, the Unique remains a rare special spawn with the existing `unique_chance`, not a free pool member.

## 5 Implementation sequence

### P0 — Freeze the input and create a review artefact

1. Ensure the tree is committed or the art restructure is separated from this migration.
2. Record `git rev-parse --short HEAD` in the migration PR description.
3. Run the baseline battery:

```text
npm run verify
npm --prefix game run check
npm --prefix game run test -- tests/app/exploration.test.ts tests/sim/mob-terrain-drops.test.ts
```

4. Export the existing 314 placements to a review artefact before editing anything:

```text
temp/mob-placement-source.jsonl
```

Each line carries:

```ts
{ species, zones, zone_levels, old_variant_names, boss?, unique? }
```

The artefact is for review. It never gets committed and never becomes a second data source.

### P1 — Verify the committed placement matrix

1. Confirm §4-bis has exactly 314 normal/Elite rows, 18 Boss rows and 36 Unique rows.
2. For every Subzone, verify its species list matches the current eligible species placement list; do not add or remove placement rows while following this plan.
3. For every Subzone, verify the ascending distinct levels differ by at least 2 and no level appears more than twice.
4. For every Subzone, verify `sum(weight × power_base) / sum(weight)` is between 0.93 and 1.08. Adjust weights only when this watch fails; do not change formulas.
5. Verify every A-tier species has `weight ≤ 6`; every B-tier body has `weight ≤ 35`; C/D cannot exceed 40.
6. Verify the matrix was intentionally kept in narrative order, not alphabetized and not generated by a formula.

Expected committed matrix:

```text
314 normal/Elite rows
 18 Boss rows
 36 Unique rows
368 total identity rows
```

### P2 — Migrate the data model

1. Replace `mob.variants` and `mob.species[].zone_levels` in `tools/data/engine.json` with `mob.variants` rows carrying scalar `level`, `zone`, `subzone`, `role`, and `weight`.
2. Keep `mob.species[].zones`; it is eligibility, not level math.
3. Delete the 20-level `levels` field from all Variant rows and from `MobVariant` in `engine/types.ts`.
4. Point every `species`, `subzone`, `variant_drops` and art reference to the new IDs.
5. Make `catalog.ts` check that every placement row resolves to one species, one zone, one Subzone, and one drop row.
6. Keep `mob.forms` only if it can be proven that no UI or wiki still consumes it. Otherwise remove it in the same commit. Do not leave a third, competing naming channel.

### P3 — Engine lookup migration

Change the engine functions that own Variant selection:

| Current | New |
|---|---|
| `mobLevelIn(sp, zone)` reads `zone_levels` | `placement.level` is direct input |
| `variantsOf()` reads species ladder | fact lookup by `species + zone + subzone` or direct pool reference |
| `variantsInZone()` midpoint selection | return the placement pool for the zone, with weights |
| `spawnAt()` computes lv from species | read fixed placement, or accept explicit `placementId` |
| `winTarget()` / boss level | read `boss.level` directly |
| boss/unique override in `game.ts` | remove the zone maximum override |

`spawnAt` retains its HP/PS/XP formulas; only the `lv` source changes. No call site may calculate a level from `zone.levels` ever again.

### P4 — Spawning and map integration

1. `spawnMob()` receives the pool for the current named Subzone, or the zone pool when no standing cell is set.
2. The Subzone pool is filtered to `placement.zone === zone && placement.subzone === index`.
3. Spawns are weighted by `spawnWeight`, never by alphabetical position.
4. Boss and Unique spawns are excluded from normal pool resolution; they are invoked by their own owners.
5. Map clicks and travel UI display the selected pool identities, or UI-level "Recommended Lv" once loaded. Map data stays presentation-only and does not duplicate placement rows.
6. `road.locations` continue to own coordinates and POI references; no level values are added there.

### P4a — Mining, woodcutting and fishing integration

Reuse the existing owners: [engine/fieldwork.ts](../../engine/fieldwork.ts), [sim/world/fieldwork.ts](../../game/src/sim/world/fieldwork.ts), `tools/data/engine.json` (`road.locations` and `fieldwork`), and the current fieldwork/map controls. Do not create a second resource-placement table or a new gathering system.

| Activity | World site | Runtime action | Skill track | Existing locations |
|---|---|---|---|---:|
| Mining | `mine` | `mine` | `mining` | 18 |
| Woodcutting | `grove` | `grove` | `woodcutting` | 18 |
| Fishing | `fishing` | `fish` | `fishing` | 3 |

The counts are the current inventory, not hard-coded future limits. This migration preserves their IDs, coordinates and resource rules. It requires zero additional hexes. Additional fishing locations require an explicitly authored fishing source and a location; adding fishing to all 18 Zones would add 15 sites and is a separate content change, not an implicit part of this migration.

Implementation requirements:

1. Every resource site keeps its canonical Zone owner and remains reachable through the current road APIs. Map selection and travel retain the correct site/action mapping from the table above.
2. Preserve `Cell.site` and `road.locations.index` as site identity. Neither is a placement Subzone number. Runtime `Cell.sub` is zero-based; authored `placement.subzone` is one-based. Convert once at the named-Subzone lookup boundary. A resource site with `Cell.sub === null` uses P4's Zone pool for any encounter path that currently uses local field placements; do not invent a Subzone from the mine/grove/fishing site index.
3. Existing camp/field encounters resolve through their current owners. When they select local mobs, bind the selected placement ID and use its fixed level. Preserve avoid/defend/engage policy, warnings, timers and encounter probability. Do not make every gathering cycle spawn a mob.
4. Gathering availability still comes from `fieldActionProblem()`. Existing fights, nests, travel, dungeon and other activity restrictions keep their current behavior. Starting or continuing a forbidden action grants no resources or XP. Do not add a player-level gate based on the Zone recommendation or nearby mob level.
5. Keep gathering resources, rare/regional drops, yield, interval, skill XP, mastery and capacity behavior with the existing `fieldwork` data and engine. Sibling mob placement IDs do not create new ore, timber, fish or trade goods, and a higher placement level does not multiply gathering yield.
6. Fishing is allowed only when the site's Zone has a `fieldwork.regional_sources[zone].food` accepted by `fieldwork.fishing.foods`. Preserve the existing sources: river fish in Zones 7 and 14, shellfish in Zone 15. A fishing-looking hex alone does not create a source.
7. Keep species-based body/material rewards bound to canonical Species IDs after the placement-ID migration. Existing shared material/food stores and recipe inputs continue to resolve; display names are not resource lookup keys.
8. Resource UI shows the correct activity, authored output and refusal reason. Any local danger/level read uses the selected placement pool at runtime and remains informational. Do not copy level values into map/site data or change the map's visual style.

Extend the existing tests instead of adding another runner:

- [fieldwork.test.ts](../../game/tests/app/fieldwork.test.ts): mine and grove routes still start the correct action; early ticks pay nothing; a completed interval pays once; rejected/full-capacity actions grant no unearned resources or XP; leaving the site or entering a fight follows existing cancellation behavior.
- [life-skills.test.ts](../../game/tests/app/life-skills.test.ts): each authored fishing site resolves an allowed food and credits the correct skill/mastery; a non-fishing Zone is refused without mutation; a same-Zone Camp does not change the authored yield.
- [camp-encounters.test.ts](../../game/tests/sim/camp-encounters.test.ts): local mobs resolve new placement IDs/levels; policies remain intact; one encounter produces no duplicate kill/drop credit or gathering payment.
- Existing map/exploration tests: all declared resource sites have valid Zone owners and reachable coordinates, and site indices cannot be mistaken for one-based Subzone indices.

For resource-throughput measurements, use a fixed seed and the current gathering owner. Report completed cycles, actual material/food and skill/mastery XP gains, actual elapsed simulation time, capacity refusals and interruptions. Compare uninterrupted gathering separately from encounter-interrupted gathering; extra danger may reduce completed work without changing yield per completed cycle. These figures are watches, not invented balance thresholds.

### P5 — UI, wiki, drops and art

1. Update `TravelCard.svelte` to read `placement.level` for each row; print `Name · Lv n`, not legacy band text.
2. Update `wiki/pages.ts` and `hud.ts` to use IDs and scalar levels.
3. Update the art key derivation to use `placement.id`. Existing art may be shared by sibling placements with an explicit species fallback.
4. Update `Drop rates` pages to show the selected placement level and the ID used by `variant_drops`.
5. Ensure every old name that was reused is still resolvable for save compatibility; unknown persisted names are tolerated on load and rebound to `legacy.junk` where impossible. There is no silent rename of a save's existing junk items.

### P6 — Save compatibility

1. Trace all persisted fields keyed by variant name.
2. If none are found in the current load path, do not add a save version bump merely for aesthetics.
3. If one is found, add one migration:
   - old name + migrated sibling id -> new id
   - unknown old name -> preserve raw string, mark it `legacy.junk` rather than guessing
4. Add a save round-trip test with simulated legacy junk from the previous release.
5. Do not migrate active encounters; the client never persists a selected placement mid-combat.

### P7 — Gates and tests

Add these invariants to `tools/check.ts`, not as a side tool:

| Gate | Requirement |
|---|---|
| X82 | placement IDs and species/zone references resolve |
| X83 | scalar level is an integer 1–180 |
| X84 | sorted Levels inside every Subzone differ by at least 2; at most 2 duplicate levels |
| X85 | every Subzone has at least `min(6, species count)` distinct levels and at most two outliers above its guide median |
| X86 | every placement resolves to one drop row and every Boss/Unique resolves to one art or fallback path |
| X87 | zone guide monotonicity: the weighted median rises by at least 2 per published plate boundary, no hard bracket is enforced |
| X88 | named placements used by the map resolve in `road.locations` |

Replace the old containment assertion in:

```text
game/tests/app/exploration.test.ts
```

with:

- placement IDs all resolve
- level gaps of at least 2 per Subzone
- no duplicate identity
- normal and Elite placements share the authored placement level
- spawn uses placement level without reading zone guide
- visitor rows fall only in the five approved seam pairs

Update:

```text
game/tests/sim/mob-terrain-drops.test.ts
game/tests/sim/arena?  if any placement fixture exists
```

Add coverage probes for:

- a newly added placement of an existing family appears in the pool automatically
- removing a placement from a Subzone removes it from spawn generation for that side only
- one wrong weight or gap source turns the relevant gate red
- a boss in the wrong Zone is rejected by the checker
- mine/grove/fishing sites retain their action/resource owner after placement migration; an invalid fishing source and a site-index/Subzone-index mix-up turn the relevant test red

### P8 — Pilot first two zones and second plate

Do the matrix in this exact order:

1. Zone 1 Eastgate
2. Zone 4 Greyfen
3. Zone 7 Blackwater Reach
4. Zone 13 Emberhold
5. Zone 18 Thornwake
6. Zones 2–3
7. Zones 5–6
8. Zones 8–12
9. Zones 14–17

Use one commit per phase or, if files are interdependent, one commit per plate (`Dawnreach`, `Riftward`, `Elderwake`). Do not commit half a Zone with unresolved validation errors.

After each pilot zone:

```text
npm run verify
npm --prefix game run check
npm --prefix game run test -- tests/app/exploration.test.ts tests/sim/mob-terrain-drops.test.ts tests/app/fieldwork.test.ts tests/app/life-skills.test.ts tests/sim/camp-encounters.test.ts
```

After all 18 Zones:

```text
npm run verify
npm run map:check
npm run wiki
npm run typecheck
npm --prefix game run check
npm --prefix game run test
```

### P9 — Measurement and sign-off

Do not tune numerical data by assumption. Measure and compare:

```text
node tools/measure-gameplay.mjs --mode controlled --preset smoke
```

and inspect for each Zone:

- median level of the pool
- weighted level median
- low-tier share and high-tier share
- stationary movement/combat time to kill
- damage and XP bars in the live test
- player death incidence
- completed mining/woodcutting/fishing cycles, resource and skill/mastery gains, and encounter interruption time, following P4a's separate uninterrupted/interrupted protocol

Any zone that feels flat must be adjusted by **one or two placements at a time**, then remeasured. Do not change `mobHpAt`, `mobPsAt`, `xpPerKill` or item curves to compensate.

### P10 — Closeout

1. Delete `species.zone_levels` and the old `MobVariant.levels` declarations.
2. Delete `mobLevelIn` if no callers remain. `git grep zone_levels` must return only removed migration references, if any.
3. Update cross references in wiki text and comments. Do not keep documentation that claims a level is tied to `zone.levels`.
4. Run `npm run map:check` after the final data edit.
5. Remove this plan according to `docs/plan/README.md` after all gates and measurements are green.

## 6 Non-goals

This migration does not:

- create new art assets
- add new bosses, Uniques, species or elements
- change HP/PS/XP curves
- change items, loot or economy
- add save slots
- alter spawn caps or respawn rates
- add ambiguities that would require a human decision in the live implementation
- change the world map's visual style or coordinates

## 7 Required change log on every PR

Each migration PR must state:

- commit and zone purpose
- rows created, split, retired or visitor-labelled
- weight profile of the three Subzone pools
- how the gap score was inspected
- which tests and validation steps passed or failed
- any deliberate outlier, visible as a named row with a reason

A PR that says "adjusted levels" is not reviewable. A PR that can open one Zone diff and see every choice is.

## 8 Acceptance matrix

| ID | Must be true |
|---|---|
| LMP-01 | All 368 identity placements (314 normal/Elite, 18 Boss, 36 Unique) have one stable ID and one integer level |
| LMP-02 | Normal/Elite spawn output reads placement levels; no `zone.levels` enforcement remains |
| LMP-03 | Distinct levels in each Subzone differ by at least 2; at most 2 may share one level |
| LMP-04 | Each Subzone exposes at least `min(6, species count)` distinct levels |
| LMP-05 | Visitor rows appear only in the five seams and carry weight no more than 3 |
| LMP-06 | Boss and Unique levels survive round-trip inspection and spawn correctly without overrides |
| LMP-07 | Drop migration maps every placement once; none falls back silently |
| LMP-08 | Map and location files remain level-free; no duplicated placement data is created there |
| LMP-09 | All validation gates and focused tests pass; no existing gameplay number changes |
| LMP-10 | The world still reads as progression: Zone 1 is beginner-focused and Zone 18 is the apex of the ten-level spine; exceptions are visible and rare |
| LMP-11 | Wiki and travel UI show the selected placement's level |
| LMP-12 | The plan itself is deleted after all gates pass, per `docs/plan/README.md` |
| LMP-13 | Existing mine/grove/fishing sites keep their IDs, coordinates and canonical resource/action owners; no placement level becomes a gathering unlock or yield formula |
| LMP-14 | Gathering, fishing, camp-encounter and site-index/Subzone-index regression checks pass; every fishing site resolves an authored allowed food |

## 9 Rollback and risk handling

- Backup the whole `tools/data/engine.json` in the launch commit; no other backup is needed.
- If a migration check fails after the first commit, fix the issue; do not partially revert the 368-row matrix to insert a band check again.
- If an entire Zone cannot be completed without a new formula, stop and mark the zone out with its reason. Do not silently massage all level values to pass a rule that was removed.
- Keep the untouched source snapshot outside the commit for review only.
- The art family is not a rollback path; do not roll back because an identity lacks its own image.

## 10 Ownership

One agent/owner executes this migration from start to finish in the order in §5. No second agent may edit the same Zone or its spawn rows in parallel.

Art generation, separate content auditing and the existing content-performance work may run after the data and gates here are accepted, but they must read the new IDs rather than write before the migration lands.

