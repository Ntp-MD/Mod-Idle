# Stone list

Every craft stone is a purse item, and one stone buys one press. Each press is its own stone with its
own name, so no name hides a second press behind it. The stone's name lives in `STONE_NAME`
(`engine/craft.ts`); the press it buys is named in `PRESS_NAME` beside it. Drop sources live in
`engine.json` under `loot` — `quality_stone_sources`, `repair_stone_sources`, `corrupt_stone_sources`,
`replace_stone_sources`, `imprint_stone_sources`, `polish_stone_sources`, `reforge_stone_sources`,
`rebirth_stone_sources` — plus the flat `elite_*` / `boss_*` keys, and press costs live in
`engine.json` `craft`. Nothing here repeats a figure: prose names the key, the engine reads the value.

The names below are the new lines. Two names the owner has already kept unchanged: **Rebirth** and
the **Imprint** family. Landing the renames in the client is a data edit — `STONE_NAME` and the
grouping that hid a second press — and it waits on the owner's word; this file is the list the
rename is read from.

## The family stones

Nineteen stones, one purse key per press. "Unbound line" is a line the piece drew at drop or a
an Add stone filled; the Frame Mod and the Bound pair are never in reach except where the
row says so.

| Stone | Press · purse key | What it does | Cost | Where it comes from |
|---|---|---|---|---|
| Reroll Value Stone | Reroll value on a line · `reroll_value` | Re-rolls one Unbound line's value inside its own Tier, never below that slot's floor | `craft.reroll_value_stones_per_use` | A dissolved piece (bag filter) · the potion bench (`potions.craft`) |
| Random Reroll Value Stone | Reroll value on a random line · `reroll_value` | Same re-roll, but the stone picks the line | `craft.reroll_value_stones_per_use` | As Reroll Value Stone |
| Refine Line Stone | Refine a line · `tier` | Climbs one line's value inside its own Tier | `craft.refine_stones_per_use` | Elite `loot.elite_tier_stones` · Boss `loot.boss_tier_stones` · Alchemy milestone `salvage.alchemy.outputs_per_tier_stone` · delivery wants and the task board |
| Reroll Tier Stone | Roll a tier on a line · `tier` | Re-rolls one line's Tier | `craft.roll_stones_per_use` | As Refine Line Stone |
| Reroll Mod Stone | Roll a new Mod on a line · `tier` | New Mod identity on one line, rolled the way a drop rolls one | `craft.roll_stones_per_use` | As Refine Line Stone |
| Whole Reroll Mod Stone | Roll a new Mod on the piece · `tier` | That roll on every Unbound line at once; the price counts the lines | `craft.roll_stones_per_use` a line | As Refine Line Stone |
| Ascend Stone | Ascend the piece · `add` + `tier` | Steps the whole piece up one grade | one Add stone + `craft.ascend_tier_stones` | The two stones it spends |
| Add Mod Stone | Add a Mod on the piece · `add` | Fills one more Unbound line up to `item_level.mods_added_cap`, the Mod drawn the way a drop draws it | `item_level.add_stones_per_fill` ladder | Elite `loot.elite_add_stone_chance` · Boss `loot.boss_add_stones` |
| Add Chosen Mod Stone | Add a chosen Mod on the piece · `add` | The same fill, but you name the Mod — same price, no gamble | `item_level.add_stones_per_fill` ladder | As Add Mod Stone |
| Remove Mod Stone | Remove a Mod on a random line · `remove` | Takes one Unbound line out; the piece's line count drops | `craft.remove_stones_per_use` | A Boss hunt reward, as `town.json` writes it |
| Remove Chosen Mod Stone | Remove a Mod on a line · `remove` | The same removal on the line you name | `craft.remove_stones_per_use` | As Remove Mod Stone |
| Replace Mod Stone | Replace a Mod on a line · `replace` | The named line leaves; the incoming Mod comes from the piece's own pool with its Tier re-rolled — the identity stops being a gamble, the Tier stays one | `craft.replace_stones_per_use` a line | `loot.replace_stone_sources` |
| Random Replace Mod Stone | Replace a Mod on a random line · `replace` | The same swap, the stone picks the line | `craft.replace_stones_per_use` a line | As Replace Mod Stone |
| Replace All Mods Stone | Replace a Mod on the piece · `replace` | That swap across every Unbound line in one press | `craft.replace_stones_per_use` a line | As Replace Mod Stone |
| Upgrade Stone | Upgrade a step · `quality` | One step up the +1..+15 ladder | `craft.upgrade_costs` ladder | `loot.quality_stone_sources` (plain kill `monster_quality_chance` · Elite `elite_quality_chance` · Boss `boss_quality_stones`) |
| Repair Stone | Repair the piece · `repair` | Revives a broken piece at its pre-break level and refills the protection it was born with | `craft.repair_stones` | `loot.repair_stone_sources` |
| Corrupt Stone | Corrupt the piece · `corrupt` | One roll on the Corrupt table (nothing · reroll values inside the current Tiers · +1 Mod · remove one non-bound Mod · reroll the Element · Gear Mod +2 · one Item quality step down). One use per piece, then the piece takes no stone | one stone a gamble | `loot.corrupt_stone_sources` — Boss only, the rarest stone |
| Polish Stone | Polish the piece · `polish` | Re-rolls every line's value, Frame Mod and Bound pair included, inside each line's own Tier, never below the slot's floor. Removes no line, moves no identity, Tier or Element. The only stone that reaches the three lines that are part of the piece | `craft.polish_stones_per_use` | `loot.polish_stone_sources` |
| Reforge Stone | Reforge the piece · `reforge` | Re-draws the piece's Tier from the published drop weights, then every value inside it, the Frame Mod on its shared budget. It can climb every line together or drag them down; identity, Element, line count and the Add charge untouched | `craft.reforge_stones_per_use` | `loot.reforge_stone_sources` — Boss only, repeatable |
| Rebirth Stone | Rebirth the Unbound lines · `rebirth` | Re-draws every Unbound line's Mod identity in one press, including any line an Add stone filled, each from the piece's own pool. Frame Mod and Bound pair keep their identity, the line count never moves, no Add charge spent | `craft.rebirth_stones_per_use` | `loot.rebirth_stone_sources` — Boss only |

## The Imprint family — one stone per Mod

`imprint_<modId>` (`engine/craft.ts` `imprintStoneFor`) — the purse reads it as *Imprint — <Mod
name>*. Press: *Imprint a Mod on a line* — names one Unbound line and rewrites it as that Mod,
Tier and value rolled fresh the way a drop rolls them. It never touches the Frame Mod or the Bound
pair, spends no Add charge, changes no line count. Cost `craft.imprint_stones_per_use`. An Elite
pays one random Imprint stone on `loot.imprint_stone_sources.elite_imprint_chance`; a Boss pays
`boss_imprint_stones`.

One stone per Mod in `mods.json`:

| Purse key | Mod |
|---|---|
| `imprint_accuracy` | Accuracy % |
| `imprint_attack_speed` | Attack speed % |
| `imprint_critical_chance` | Critical chance % |
| `imprint_critical_damage` | Critical damage % |
| `imprint_magic_power` | Magic power % |
| `imprint_attack_damage_pct` | Attack damage % |
| `imprint_spell_damage_pct` | Spell damage % |
| `imprint_magic_power_flat` | Magic power flat |
| `imprint_physical_power` | Physical power % |
| `imprint_physical_power_flat` | Physical power flat |
| `imprint_armour_flat` | Armour flat |
| `imprint_armour_pct` | Armour % |
| `imprint_cooldown_reduction` | Cooldown reduction % |
| `imprint_energy_shield_flat` | Energy Shield flat |
| `imprint_evasion_flat` | Evasion flat |
| `imprint_evasion_pct` | Evasion % |
| `imprint_life_regen_flat` | Life Regeneration flat |
| `imprint_life_regen_pct` | Life Regeneration % |
| `imprint_mana_regen_flat` | Mana Regeneration flat |
| `imprint_mana_regen_pct` | Mana Regeneration % |
| `imprint_max_energy_shield_pct` | Max Energy Shield % |
| `imprint_energy_shield_regen` | Energy Shield Regeneration % |
| `imprint_max_hp` | Max HP % |
| `imprint_max_hp_flat` | Max HP flat |
| `imprint_max_mana` | Max Mana % |
| `imprint_max_mana_flat` | Max Mana flat |
| `imprint_perfect_dodge_pct` | Perfect dodge % |
| `imprint_status_resistance_pct` | Status Alignment resistance % |
| `imprint_stat_mod_flat` | Stat Mod flat |
| `imprint_all_stat_flat` | All stats flat |
| `imprint_all_resistance_pct` | All Resistance % |
| `imprint_elemental_resistance_cap_pct` | Elemental resistance Cap % |
| `imprint_elemental_alignment` | Elemental alignment % |
| `imprint_elemental_power` | Elemental power % |
| `imprint_elemental_power_flat` | Elemental power flat |
| `imprint_elemental_resistance` | Elemental resistance % |
| `imprint_bleed_chance` | Chance to bleed % |
| `imprint_stun_chance` | Chance to stun % |
| `imprint_block_chance` | Block chance % |
| `imprint_armour_pen` | Armour penetration % |

## The reach every stone obeys

- No stone removes or rewrites the Frame Mod (line 1) or the Bound pair (lines 2-3); only **Polish Stone** re-rolls their values.
- No stone changes a piece's Element except **Corrupt Stone**.
- A corrupted piece accepts no further stone of any kind.
- The purse holds one key per press — nineteen family stones plus one key per Mod, and the Imprint
  count is the Mod count in `mods.json`, read from the data, never typed.
