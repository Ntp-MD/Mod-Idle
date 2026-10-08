# Todo

import AGENTS.md

The **single work file**: only what is _not built yet_, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

## A — waiting on the owner

- **Elite stone figure**: `mob.elite.note` says an Elite "Drops 2 Reroll tier stones"; `loot.elite_tier_stones` is
  0.05 and that is what `tierStonesPerHr` pays. One of the two is wrong — the wiki prints the number the engine
  uses. Ruling needed: fix the note, or raise the rate.

## B — mine

- **Mob damage = its own Base + a Core Stat bonus** (owner ruling 2026-10-08, option B). Today
  `mob_PS(L) = typical_gear_DPS(L) ÷ K.mob_damage_divisor` is the same for every species in a zone
  (`engine/index.ts:210,258`), and species Str/Int feed nothing — the vector only reaches Armour (str),
  Accuracy/Evasion/Alignment (dex), Resistance (vit), Dodge (agi), Crit (lck); **int and wis are read by
  nobody**. Owner also ruled the stat lines read as the archetype (Orc = Str/Vit), which the vectors
  already do. Shape decided, not yet built:
  - data: `mob.species[].power_base` (one per species) + `K.K_MOB_PS_STAT` (the per-point bonus) +
    `mob.power_note`; the stat the bonus reads follows the species' own `damage` tag — physical → Str,
    magic → Int, mixed → both halves, the same split `mob.damage_split` already spends.
  - engine: `speciesPowerOf(sp)` and a zone mean that divides it out, mirroring `zoneBodyFactor`
    (`engine/index.ts:126-140`) — **the zone's average mob must stay the published curve**, so no zone
    edge, the timeline, the ladder or the survival cage moves. Then `mobRoster` (`:685`), `spawnAt`
    (`:759`) and the client spawn (`game/src/sim/game.ts:238`, which recomputes Elite/Boss `ps` itself)
    all read the species term.
  - gates: `tools/check.ts` X37 (`:616`) and the per-level print (`:1707,1714`) state PS as the curve
    alone — they must state the species term and the zone mean. `tools/survival.ts` uses the zone curve
    and should stay green untouched.
  - wiki: the mob sheet's Offensive column prints `base + stat`, and the legend row says what reads it.
- **Read the client panels after the Legacy → Sub rename.** `game/src/ui/CraftBoard.svelte` (the line tag
  and the two refusal strings) and `game/src/ui/ItemDetail.svelte` (the `sub` colour class) moved on
  wording only and the suites are green, but nobody has looked at the panel on the running client —
  opening it was interrupted. Read-only check at the dev server the owner keeps up.

## C — housekeeping

- **`game/check-out.txt` still spells the retired word.** A tracked capture of an old check run, skipped by
  the rename sweep on purpose; it is stale either way and only regenerates from `tools/check.ts`.
- **The mob sheet has no gate of its own.** Every figure is `mobRoster()`, `mobEvasion()`,
  `mobResByElementOf()` and `dropChance()` printed, so a wrong cell is a data or engine bug — but nothing
  asserts the sheet, and the wiki stays a view.

_Post-release, deliberately not tracked: the wiki view (reads `tools/data/*.json` + `engine/`)._
