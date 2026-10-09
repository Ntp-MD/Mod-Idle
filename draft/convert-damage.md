# Mix Auto Attack Via Conversion — Idea And Method Draft

Status: built (owner ruling). The aura rows are `skills.json` `aura.ember_conversion` · `aura.rime_conversion` · `aura.storm_conversion` (reserve tier `mid`), the engine is `convertDamageOf` (`engine/index.ts`), the reader is `game/src/sim/player.ts` (`conversion`) spent by `combat.ts` `playerSwing` and the physical-basis branch of `skills.ts` `castOnce`, and the gates are `game/tests/element.test.ts` plus `tools/lib/roster.ts` S19 (Cap reachable). Numbers stay in `tools/data/*.json`; this note names keys, never values. The open points below took their first listed default and stay veto-able.

## What Is Already True

- One swing already mixes: `dmg_per_hit = phys + magic + elem x align/100` (`game/src/sim/combat.ts` `playerSwing`).
- `phys` reads `Str` through `K_STR`, `magic` reads `Int` through `K_INT`, `elem` reads `Int` through `K_ELEM` plus `elemental_power` Mod lines (`game/src/sim/player.ts` `buildCharacter`, `engine/index.ts` `physOf` / `magicOf`).
- Only a line that carries an Element feeds its own Element pool (`player.ts` `elemByElement`); the weapon Element enables Weak and the Element counter path.
- Mitigation is split: the non-Element half meets Armour through the PoE ratio, the Element half meets Elemental resistance (`engine/index.ts` `mitigateMobHit`).
- Crit scales the physical half only; magic and the five Elements never crit (glossary attack layers).
- A magic weapon has no swing, it has a bolt worth the attack ladder floor (`engine/index.ts` `basicAttackOf`).

So a mix build today pays three Core stats (`Str` + `Int` + `Dex` for Alignment) and both mitigations. It works, but it is additive only: there is no path that moves already-priced Physical power into an Element.

## Idea: PoE-Style Conversion, Adapted

PoE shape: a percent of one damage path is taken as another path before mitigation. The converted share meets the destination mitigation only, never both, and total conversion never exceeds the whole hit.

Adapted shape for this game:

- Convert a percent of the finished physical share into one named Element, on the swing only.
- Order: hit roll, then mob dodge, then crit sizing on the physical half, then conversion, then Weak plus Element counter on the converted share, then split mitigation (Armour on what stayed physical, Elemental resistance on what converted).
- The converted share keeps its physical origin for crit only; it meets resistance, never Armour, after conversion. No double dipping: one share, one mitigation.
- Conversion Cap is the whole hit: summed conversion never exceeds one hundred percent. Overflow is wasted, never a multiplier.
- Destination is fire, cold, or lightning only — the herald family (`aura.herald_of_ash`, `aura.herald_of_frost`, `aura.herald_of_lightning`). Poison is excluded because its DoT stacks decay slowly and survive a weapon swap; chaos is excluded because mark carries leech and its counter row answers everything alike, so converting into either buys an engine, not routing. No free Element is invented: the aura names the Element it converts into.

Consequence before implementation: a Physical power build can answer an Armour wall (high `Str` species) through Elemental resistance instead of stacking a second power stat, without becoming a caster. What is new is routing, not raw power.

## Why Not A New System

- D1: routing shifts which mitigation answers the hit, so time-to-kill moves against high-Armour species. The zone mean must stay the published `mob_HP` curve; conversion is priced as routing inside that curve, never power beside it.
- D2: conversion must not ride Mastery. Mastery lightens the weapon and lifts that weapon skills only; it carries no per-weapon damage.
- D11: conversion is a Mod choice, never a correct allocation. Flat and percent stay a real trade across Item level, Item quality, and Tier.

## Method (When Built)

1. Data, one row per Element: new `aura.*` conversion rows for fire, cold, and lightning, each on a `reserve` tier from `skills.json` `reserve_tiers` and carrying an effect with `subject` self plus the destination `element` — the Herald precedent (`skills.json` `aura.herald_of_ash` writes `elemental_power` with an `element` the same way). No new data file, no loot or Base pool change. The effect stat joins `EFFECT_STATS` in `engine/skills.ts` (the `tools/lib/roster.ts` S14 reader gate), and its value is printed in the row `effect` sentence (S11). The reservation cost is the price: total reserved mana may not reach the whole pool, so conversion competes with the Heralds and every other aura.
2. Engine, one function plus one sheet reader: `convertDamageOf(nonElement, elemPools, pctByElement)` in `engine/index.ts` beside `mitigateMobHit` (pure function over the passed hit, caps the summed percent, returns both halves), and a reader in `game/src/sim/player.ts` `buildCharacter` that folds the aura effect out of the same fold the Herald flat bonus already reads (`player.ts:239-244`) into a per-Element conversion field. `aggregateEffects` already keys an Element line as `stat:element` (`engine/skills.ts:228`), so the fold itself does not change.
3. Client, two call sites, same function: `game/src/sim/combat.ts` `playerSwing` and the physical-basis branch of `castOnce` in `game/src/sim/skills.ts`, both reading the sheet field. A magic-basis press never converts.
4. Size ladder unchanged: `applySizeMult` keeps reading the physical share that stayed physical; the converted share is Element damage after conversion.
5. Status unchanged: the weapon Element status proc still reads the destination Element; DoT budget (`status.dot_cap`) still binds burn plus poison.
6. Gate before change: extend the cage that asserts swing math so a converted swing equals an unconverted swing against a zero-mitigation target, and is weaker-or-equal against a target that resists the destination Element. A rule that must hold belongs in a cage.
7. Verify: `node tools/verify.ts` green, single cage first while fixing.

## Open Points For The PoE Pass

- Source decided (veto-able): aura row, not a weapon Mod line — it reuses the effect fold, the reservation tradeoff, and the herald family, and touches no loot or Base pool. The Mod-line alternative is rejected.
- One row per Element, or one row with a chosen Element. One row per Element matches the three Heralds.
- Stacking: opening two conversion auras sums toward the whole-hit Cap; the reservation budget is what stops running all three with Heralds on top.
- Interaction with the bolt rule: a magic weapon swing stays a bolt; conversion applies to physical-basis swings and attack presses only.
- Reachability: every Cap touched must state which build reaches it.
