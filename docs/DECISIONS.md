# Final Stat Calculation

## Inputs and order

1. Read level `L` and allocated points per Core stat (`str` · `agi` · `vit` · `dex` · `int` · `wis` · `lck`).
2. Sum equipped, unbroken gear + passive-tree lines as flat / percent pools (weapon-specific tree lines apply only while held). Active effects modify only their named derived stats, never Core.
3. `Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)`, then derive each stat, apply effects and weight tax, cap last.

```text
pointsAt(L) = points_per_level × (min(L, paragon_from - 1) - 1)
           + paragon_points_per_level × max(0, min(L, level_cap) - (paragon_from - 1))
statOf(points) = stat.base + points × stat.point_value
```

The reference line splits evenly (`pointsAt(L) / 7`); players use actual allocation.

## Derived stats

`C` = final Core, `F` = flat lines, `P` = percent lines, `K_*` from `engine.json`.

| Final stat | Calculation |
|---|---|
| Max HP | `(hp_base + C.vit × K_VIT_HP + hp_per_level × (L - 1) + F.hp) × (1 + P.hp / 100)` |
| HP regen | `C.vit × K_VIT_REGEN × (1 + P.hp_regen / 100) + F.hp_regen` |
| Max Mana | `(mana_base + C.int × K_INT_MP + mp_per_level × (L - 1) + F.mana) × (1 + P.mana / 100)` |
| Mana regen | `C.int × K_INT_MREGEN × (1 + P.mana_regen / 100) + F.mana_regen` |
| Max Energy Shield | `(C.wis × K_WIS_ES + F.energy_shield) × (1 + P.energy_shield / 100)`; player only |
| Energy Shield regen | `maxES × energy_shield.regen_pct / 100 × (1 + P.es_regen / 100)` |
| Physical power | `(C.str × K_STR + F.physical) × (1 + P.physical / 100) × weapon_mult × physical_power_effect` |
| Magic power | `(C.int × K_INT + F.magic) × (1 + P.magic / 100) × weapon_mult` |
| Elemental power | Per Element: flat pool + `C.int × K_ELEM` for the weapon's Element, scaled by shared and Element-specific percents |
| Accuracy | `C.dex × K_DEX_ACC × (1 + P.accuracy / 100)` |
| Evasion rating | `(C.agi × K_EVASION + F.evasion) × (1 + P.evasion / 100) + evasion_effect` |
| Evasion chance | `r = max(0, rating)`; `effective = min(r, opening_rating) × opening_share + max(0, r - opening_rating) × earned_mult`; if `effective = 0` chance is 0, else `min(caps.evasion, effective / (effective + attackerAccuracy) × 100)` |
| Armour | `(C.str × K_ARMOUR + F.armour + armour_effect_add) × armour_effect_mult × (1 + P.armour / 100)` |
| Attack speed | `weapon_aspd × (100 + (C.agi - stat.base) × K_AGI_ASPD + P.aspd + effect_add) × effect_mult × (1 - encumbrance)`; cap `100 / caps.attack_interval_sec` |
| Crit chance | `min(C.lck × K_LCK_CRIT + P.crit, K_CRIT_CAP)` |
| Crit damage | `100 + P.crit_damage + (crit_pool - crit_chance) × K_CRIT_OVERFLOW` |
| Perfect dodge | `r / (r + K_PDOGE) × 100`, `r = C.lck × K_LCK_PDOGE × (1 + P.perfect_dodge / 100)` |
| Block | `max(0, P.block)`; Shield Frame Mod + passive tree |
| Elemental resistance | `min(caps.elem_res_max, caps.elem_res + P.resistance_cap, (P.resistance + P.all_resistance) × resistance_effect_mult)` |
| Elemental alignment | `(C.dex × K_DEX_ALIGN + P.alignment + effect_add) × effect_mult` |
| Stun chance | `max(0, alignment × K_STUN_PER_ALIGN + P.stun_chance)`; uncapped — a rolling control budget limits stop time, not chance |
| Stun recovery | `min(100, max(0, C.vit × K_VIT_STUNREC))`; remaining stop `stop_sec × (1 - recovery / 100)` |
| Cooldown reduction | `min(caps.cdr, C.wis × K_WIS_CDR × (1 + P.cdr / 100))` |
| Weight capacity | `weight_base + C.str × K_STR_WEIGHT` |
| Encumbrance | `min(caps.weight_overload, max(0, (weight_used - weight_capacity) / weight_capacity))`; attack speed × `1 - encumbrance` |

Armour penetration, status resistance, attack/spell damage, bleed chance, leech, damage taken, global speed, damage conversion: summed line/effect values, with their configured cap or multiplier.

## Mob Core

- Race > Species > Variant. A Race is one broad fantasy category in `mob.races`; a Species (Goblin, Orc, Golem) belongs to one Race and owns gameplay data. Race membership alone grants no mechanic.
- The Race registry is closed for now: Humanoid, Beast, Undead, Demon, Dragon, Insect, Plant, Fish, Formless, Elemental, Celestial. An Empty Race is allowed but none is empty today — Celestial opened with Archon, Fish with Siren. Goblin and Orc are Humanoid Species; Golem belongs to Elemental, Wraith to Undead. A Species is fielded where its `zones` say it lives, and every zone it lists must show it on at least one subzone side (`mob.zones[].subzones[].species`); the wider `habitat` is what it may move into later without a roster rewrite.
- There is no target count for Races, Species per Race, Variants per Species, field forms, uniques or Species junk alternatives. Existing content counts are not quotas.
- Sizes are per Species; normal Variants need Small or Medium; Large is the solo Elite body.
- Subzones are independent pools; their union covers the zone cast.
- Ladder length is a content choice, never a gate: a Species may author any number of Variants. The shipped ladders run five deep (`[1-20] [21-40] [41-60] [61-80] [81-100]`, two zones per rung). Each Variant authors its own integer Core, inclusive level band and drop identity; bands cannot overlap. A zone midpoint uses its covering Variant, or carries forward the closest earlier one when the ladder has a gap; before the first band it uses that first Variant. A ladder change deletes the junk item of every Variant it removes; the schema is not public yet (`SCHEMA_VERSION` 14), so no migration carries an old stack forward — until release, local saves are simply rewritten by playing, and a save-format change is on the release checklist.
- Variant names are authored freely: a name should read as a creature, which no check can prove. The ladder is not name-pattern gated, so a form that already names its Species (Wyrmling, Wolfman, Ash Imp) carries no extra suffix.
- A Species may author any subset of common/uncommon/rare junk alternatives. Variant rarity and lean remain Variant-owned; names connect the Species' material/culture with the Variant's role.
- Field forms are optional labels and may be sparse. A missing label reuses the latest earlier form; when none exists, the Species name is used. Variant Core remains the live combat Core.
- Levels 101–180 reuse the latest Variant and field label, with no equipment or passive tree.
- Elite = rank over the selected Variant (same name/junk, Large body, Elite mults). Clock Boss = fixed zone profile. Species may have zero or more wild Uniques: zone-top level, Elite stones, ×30 XP, crown junk.
- `humanoid` is no longer a gameplay/drop switch. Potion eligibility is the explicit per-Species `potion_source`; Race membership does not grant it.
- `map.json` is presentation-only.

```text
mobCore[k, form] = form.core[k]
```

Variant band level replaces `zone_levels` when its interval covers the zone midpoint; gaps carry the nearest earlier Variant (or the first Variant before its band), and levels above the cap use the final Variant. HP/combat use the selected Variant's authored Core with the shared engine's Species, zone, size and boss inputs.

```text
mobHP(level) = mobHpAt(level) + hp_per_level × (level - 1) + mobVit × K_VIT_HP
mobMana(level) = mana_base + mana_per_level × (level - 1) + mobInt × K_INT_MP
mobAccuracy = mobDex × K_DEX_ACC × accuracy_mult
```

Elite HP multiplies `mobHP` by `mob.elite.hp`; Boss and wild-unique HP use their profile's Vit.

Zone Element summaries describe spawn data; zones impose no Element themes and filter no Species. Keep rosters broad. One-handed axe size multipliers stay neutral at 1.0.

## Combat order

One hit runs perfect dodge → Evasion → block → Armour → resistance → damage taken → ES → HP.

- `sizeMultOf` is one multiplier on the physical share, applied after mitigation; skill presses carry it, magic-damage presses are exempt.
- Crit runs one pool; chance is capped; only overflow past the cap buys crit damage.
- `capAspd` binds last — after the Agi term, the aspd band, buffs and the weight tax; the cap is a minimum interval.
- `mobArmourCut` / `mobResCut` / `armourPenCut` clamp to `[0,1]`; over-penetration is wasted; the res cut reads the correct Element.
- Evasion runs opening/earned split, opposed roll, then the cap.
- `elem_res` ceiling is 75; the tree raises toward 90, clamped absolute however stacked. The published `hitVs` anchor and the build's own value must be named apart.
- Damage and burn spend ES first; poison and bleed reach HP directly; shield overflow lands on HP once; ES absorb is not a second shield.

## Drops & economy

Every faucet and sink lives in `tools/data/`, measured in expectations. Every payout calls the engine function, never a copied formula or literal price. `loot.ttk_per_mob_sec` is the reference time-to-kill the roster computes (`eng.REFERENCE.ttk`), so the cage re-publishes it with `--sync` — it is never hand-typed, and a Species added or retired moves it. `mob_PS(L)` is the zone's **average** mob by construction: each Species' power reads over that same zone mean (`eng.speciesPsMult`), so the mean is 1 for every zone whatever the roster holds and no zone edge, timeline or survival number moves when a Species is added, retired or re-tuned. That identity is a consequence of the model, so no gate re-checks it.

- `leanReweight` redistributes mass across gear/herb/junk; total expected drops/kill is unchanged.
- Junk rarity buys frequency, not income: chance × sell is flat.
- No band lets a player loop a sink back into a faucet.

## Saves & offline

- Round-trip save → load → save produces no semantic drift; a reload mid-fight grants no double credit.
- Offline `catchUp` equals the same span ticked online except the documented AFK exceptions.
- Migration loads older saves, reinterprets only where allowed, loses nothing; unknown versions are rejected, never silently corrupted.
- Orphan toggles/buffs/auras are cleaned without touching legitimate skills and without a schema change.

## RNG stream

Every gameplay draw comes from the seeded stream (`newGame(seed)` persists seed and `rngState`; the tick draws through it).

- Draw order inside a tick is frozen; adding, removing or reordering one draw moves every later draw.
- A save restores the stream: reload resumes the sequence, offline `catchUp` reproduces the span.
- Cosmetic rolls may change; loot, stones, junk and status application are pinned.
