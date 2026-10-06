# New Skill Roster — attack replacement + buff · aura (carried unchanged)

Status: **proposal, parked. Not in the game.** Source: `owner/new-skill.md` idea (fireball / frost bolt /
chain lightning). Numbers land in `tools/data/skills.json` only after the owner picks; nothing here is
read by the engine, the cages, or the client.

**Owner plan: the live `attack` roster is scrapped and replaced by this file. Everything else stays.**

| Type | Fate |
|---|---|
| attack (31 live rows) | **replaced** by this file (38 so far) |
| buff (7) · aura (13) | **carried unchanged** — listed in this file, not redesigned |
| curse · heal | **kept unchanged** — not touched by this swap |
| physical attack | **11 live rows carried** (the other 9 physical rows are not carried yet) |
| Flame Guard (new buff) | **proposed addition** — a new `buff` row, not an edit to any kept buff |
| Pokémon pass | **parked proposals** — see the section near the end; excluded list is inside it |

> **`buff` (7) and `aura` (13) are carried unchanged.** They are now **listed** in this file so the whole
> roster sits in one place, but each row is copied verbatim — same ids, numbers and effects as
> `tools/data/skills.json`. This file does **not** redesign, rename, re-derive or re-price a single
> `buff.*` or `aura.*` row. The only new buff here is `Flame Guard`. A real edit to a buff/aura row is a
> separate change with its own owner ask — nothing in this file should be read as one.

The **attack** rows are all `type: attack`: a damage press with a cooldown, a mana cost and an Element. No
new system, no new stat, no Cap. They reuse the live attack model exactly (`doc/skills/skill-pool-attack.md`),
so a picked row drops straight into `skills.json` and `node tools/skills.ts --write` regenerates the roster.
The `buff` and `aura` sections are separate and carried unchanged (see the callout above).

# How to read (the model these obey)

- `cd` is in seconds; the game runs it through CDR at the reference cast speed (50% CDR · 30% ladder) to
  get the effective cooldown.
- `mana` is either `N%` (charges N% of the usable pool) or `N flat` (N absolute units at skill level 1).
  An AoE press carries `(AoE ×1.5)`.
- `final_pct` is the **level-1 fraction of the basis**; the press is
  `final_pct × basis × (1 + (skill_level − 1) × 1.5%)`. `basis magic` = the caster's magic + Element ×
  Alignment/100, so a magic press cannot crit; `basis phys` can.
- `targets/hits` = targets struck / damage instances per press (what per-hit procs count).
- Element sets the status it applies: fire→burn · cold→chill · lightning→shock · poison→poison stacks ·
  chaos→mark. A simple skill relies on that proc and adds no second system.
- The final_pct values sit in the live envelope: magic singles 103-106%, physical 136-145%. They are
  proposals, not derived — the roster pass re-derives them from the same anchor the live rows use.

# The roster (38)

## Fire (6)

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Fireball | attack.fireball | magic | fire | 6 sec | 14% | magic · 104.06% | 1/1 | Single target · applies 2 burn stacks |
| Flame Bolt | attack.flame_bolt | magic | fire | 5 sec | 11% | magic · 104.06% | 1/1 | Fast cheap fire bolt · 1 burn stack |
| Firestorm | attack.firestorm | magic | fire | 13 sec | 21 flat (AoE ×1.5) | magic · 105.81% | 3/1 | AoE firestorm · 1 burn stack to all hit |
| Meteor | attack.meteor | magic | fire | 14 sec | 22 flat (AoE ×1.5) | magic · 105.81% | 3/1 | Heavy AoE slam · 2 burn stacks to all hit |
| Flame Wisp | attack.flame_wisp | magic | fire | 9 sec | 15% | magic · 104.06% | 1/1 | Single target · 3 burn stacks |
| Scorch Ray | attack.scorch | magic | fire | 7 sec | 14% | magic · 104.06% | 1/1 | Heavy single hit · 2 burn stacks |

## Cold (6)

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Frost Bolt | attack.frost_bolt | magic | cold | 5 sec | 11% | magic · 104.06% | 1/1 | Fast cold bolt · 1 chill |
| Ice Shard | attack.ice_shard | magic | cold | 6 sec | 13% | magic · 104.06% | 1/1 | Single target · 1 chill |
| Ice Lance | attack.ice_lance | magic | cold | 8 sec | 14% | magic · 103.19% | 1/2 | 2 hits at 55% each · chills the target |
| Blizzard | attack.blizzard | magic | cold | 13 sec | 20 flat (AoE ×1.5) | magic · 104.06% | 3/1 | AoE storm · chills all hit |
| Frozen Orb | attack.frozen_orb | magic | cold | 10 sec | 16 flat (AoE ×1.5) | magic · 104.06% | 3/1 | Orb that chills all it touches |
| Frostbite | attack.frostbite | magic | cold | 8 sec | 14% | magic · 104.06% | 1/1 | +25% damage if the target is already chilled |

## Lightning (6)

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Chain Lightning | attack.chain_lightning | magic | lightning | 9 sec | 16% (AoE ×1.5) | magic · 104.06% | 3/1 | Arcs to 3 targets · shocks all hit |
| Lightning Bolt | attack.lightning_bolt | magic | lightning | 5 sec | 12% | magic · 104.06% | 1/1 | Fast single bolt · 1 shock |
| Spark | attack.spark | magic | lightning | 4 sec | 9% | magic · 103.19% | 1/1 | Cheapest fastest press · 1 shock |
| Thunder Strike | attack.thunder_strike | magic | lightning | 11 sec | 18 flat | magic · 105.81% | 1/1 | Heavy single hit · shocks the target (shock carries the 1 sec interrupt) |
| Storm Call | attack.storm_call | magic | lightning | 14 sec | 22 flat (AoE ×1.5) | magic · 105.81% | 3/1 | Big AoE storm · shocks all hit |
| Static Field | attack.static_field | magic | lightning | 10 sec | 15% (AoE ×1.5) | magic · 104.06% | 3/1 | Field around self · shocks all hit |

## Poison (5)

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Poison Bolt | attack.poison_bolt | magic | poison | 6 sec | 13% | magic · 105.81% | 1/1 | Single target · 2 poison stacks |
| Venom Spray | attack.venom_spray | magic | poison | 9 sec | 16% (AoE ×1.5) | magic · 105.81% | 3/1 | Spray · 1 poison stack to all hit |
| Acid Arrow | attack.acid_arrow | magic | poison | 7 sec | 14% | magic · 105.81% | 1/1 | Single target · 3 poison stacks |
| Toxic Cloud | attack.toxic_cloud | magic | poison | 12 sec | 19 flat (AoE ×1.5) | magic · 105.81% | 3/1 | Lingering cloud · 2 poison stacks to all hit |
| Blight | attack.blight | magic | poison | 10 sec | 15 flat | magic · 105.81% | 1/1 | Heavy poison press · 4 poison stacks |

## Chaos (4)

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Chaos Bolt | attack.chaos_bolt | magic | chaos | 6 sec | 13% | magic · 103.19% | 1/1 | Single target · 1 mark stack |
| Void Blast | attack.void_blast | magic | chaos | 9 sec | 16% (AoE ×1.5) | magic · 103.19% | 3/1 | AoE blast · marks all hit |
| Nether Orb | attack.nether_orb | magic | chaos | 12 sec | 19 flat | magic · 103.19% | 1/1 | This hit pierces 100% of the target's Elemental res |
| Entropy | attack.entropy | magic | chaos | 10 sec | 15 flat | magic · 103.19% | 1/1 | Heavy press · applies 5 mark stacks |

## Physical (11) — carried from the live roster

These are lifted from the live attack set (same ids and numbers), except `Puncture`, whose feed is switched
from poison stacks to bleed. Their effects are otherwise the live ones and are the deliberate exception to
the Effect rules below.

| Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets/Hits | What it does |
|---|---|---|---|---|---|---|---|---|
| Cleave | attack.cleave | melee | physical | 6 sec | 10% (AoE ×1.5) | phys · 142.84% | 3/1 | Swing around · hits all in range |
| Elemental Break | attack.elemental_break | melee | physical | 10 sec | 18% | phys · 135.78% | 1/1 | Heavy hit + target takes +15% Element damage 8 sec |
| Whirlwind | attack.whirlwind | melee | physical | 9 sec | 15% (AoE ×1.5) | phys · 145.19% | 3/3 | Spin 3 rounds · 1 hit per target per round (per-hit procs) |
| Shield Bash | attack.shield_bash | melee | physical | 8 sec | 12% | phys · 140.48% | 1/1 | Stops the target 1 sec (a flat stop) |
| Puncture | attack.puncture | melee | physical | 7 sec | 12% | phys · 142.84% | 1/1 | Guarantees bleeding on the hit (bleed does not stack · a new hit refreshes its 5 sec) |
| Reap | attack.reap | melee | physical | 9 sec | 14 flat | phys · 140.48% | 1/1 | Leech +25% and physical power ×1.10 for 6 sec |
| Bloodletting | attack.bloodletting | melee | physical | 11 sec | 16 flat | phys · 142.84% | 1/1 | Instant heal 6% Max HP + leech +15% on the press |
| Piercing Shot | attack.piercing_shot | ranged | physical | 6 sec | 10% | phys · 145.19% | 1/1 | This hit does not roll dodge |
| Arrow Shower | attack.arrow_shower | ranged | physical | 7 sec | 13% | phys · 140.48% | 1/3 | 3 arrows at 40% each = 120% · per-hit procs fire 3 times |
| Headshot | attack.headshot | ranged | physical | 12 sec | 16% | phys · 138.13% | 1/1 | This hit +25% crit chance |
| Pierce the Veil | attack.pierce_the_veil | ranged | physical | 7 sec | 12 flat | phys · 138.13% | 1/1 | Does not roll dodge + strips target Elemental res −15% for 8 sec |

# Flame Guard (new buff — outside the attack roster)

**This is not an attack.** Flame Guard is a **buff**, so it replaces no attack row and it does **not** edit
the kept `buff` rows — it is a *new* row added to the buff family. Parked here because the owner asked for
it here; when it lands it goes beside the existing buffs, not in the attack table.

| Skill | id | Type | Element | cd | mana | Duration | What it does |
|---|---|---|---|---|---|---|---|
| Flame Guard | buff.flame_guard | buff | fire | 16 sec | 12% | 8 sec | A temporary absorb pool that soaks damage, plus damage back to the mob that hits us |

## Effect

- **Absorb = a temporary pool, not a new stat.** The buff grants an `energy_shield` **flat** pool that
  lives only while the buff is up. It depletes as it soaks hits and is gone at the end of `duration` —
  Ember Spirit's Flame Guard shape. It is the **existing** `energy_shield` stat, so no new stat is added:
  the pool sits ahead of HP and **chaos bypasses it** (the one caveat — accept it, or absorb all 5 Elements
  with a new stat; owner call).
  - **Pool size 150-350 flat** is the one number not settled: the live model has no per-level scaling for
    buff magnitudes (a buff carries a flat value), so this is either a flat **150**, a flat **350**, or it
    needs a new level-scaling lever. **Owner to pick.**
- **Retaliate = a NEW mechanic.** When a mob hits us, the buff deals damage back to it. Nothing in
  `engine/skills.ts` `EFFECT_STATS` carries this today, so before it can land it needs:
  1. a new effect stat (e.g. `retaliate_flat` — damage back on being hit) with a reader in the client and
     an entry in the skill cage's `EFFECT_STATS`;
  2. a fold into `mob_HP` (`AGENT.md` §5 · checks.md H1), because it is free damage the mob did not pay
     for.
  - It only ever hits the mob that struck us (the front slot), so it needs **no** new targeting or radius —
    the reach queue already names the target.

Until 1-2 land, only the **absorb** half is buildable; the retaliate half is a ruled design, not a
shippable row.

# Buff (7) — carried unchanged

The live buff rows, listed so the whole roster is in one place. **Not redesigned** — same ids, numbers and
effects as `tools/data/skills.json`. Only `Flame Guard` above is new.

| Skill | id | cd | mana | Duration | What it does |
|---|---|---|---|---|---|
| Warcry | buff.warcry | 15 sec | 10% | 10 sec | Physical power ×1.15 · Elemental alignment ×1.20 · Elemental resistance ×1.20 |
| Berserker | buff.berserker | 15 sec | 10% | 10 sec | Attack speed ×1.20 · leech +15% · damage taken ×1.15 |
| Iron Will | buff.iron_will | 15 sec | 10% | 10 sec | Armour ×1.20 · damage taken ×0.90 |
| Holy veil | buff.holy_veil | 20 sec | 12% | 7 sec | No Element debuff (burn · chill · shock · poison · mark) or bleed can be applied while up · casting clears the ones already on you |
| Ghost Dance | buff.ghost_dance | 15 sec | 10% | 10 sec | Perfect dodge charges: 3 at level 1, +1 every 5 levels to 7 · each charge deletes one incoming hit outright |
| Magia Drive | buff.magia_drive | 20 sec | 12% | 8 sec | Energy Shield recharges immediately and is not interrupted by hits while up |
| Energy Absorb | buff.energy_absorb | 20 sec | 12% | 3 sec | Converts 15% of every incoming hit into Energy Shield (30% at max) · that share is negated from HP either way |

# Aura (13) — carried unchanged

The live aura rows, listed for the full picture. **Not redesigned.** An aura is player-managed and
**reserves Max Mana** at its tier (cheap 8% · mid 11% · heavy 14% · extreme 25%); total reserved mana may
not reach 100% of the pool.

| Aura | id | Kind | Reserve | What it does |
|---|---|---|---|---|
| Wraith of Fury | aura.wraith_of_fury | self | cheap | aspd +12% |
| Clarity | aura.clarity | self | cheap | mana regen +25% |
| Haste | aura.haste | self | extreme | global speed ×1.15 — cooldowns tick 15% faster and final attack speed ×1.15 |
| Vitality | aura.vitality | self | mid | hp regen +30% |
| Herald of Ash | aura.herald_of_ash | fire | heavy | fire damage flat +50 · Alignment +6 |
| Herald of Frost | aura.herald_of_frost | cold | heavy | cold damage flat +50 · Alignment +6 |
| Herald of Lightning | aura.herald_of_lightning | lightning | heavy | lightning damage flat +50 · Alignment +6 |
| Rimbo Form | aura.rimbo_form | debuff | mid | nearby mob aspd −15% (stacks with chill · total may reach −35%) |
| Elemental Fury | aura.elemental_fury | debuff | mid | target Elemental res −12% |
| Trinity Form | aura.trinity_form | defense | mid | Elemental res +15% on fire / cold / lightning |
| Grace | aura.grace | defense | cheap | Evasion flat +24 |
| Iron Guard | aura.iron_guard | defense | mid | Armour flat +32 |
| Energy Guard | aura.energy_guard | defense | mid | Energy Shield flat +48 |

# Effect rules

The first three bullets govern the **new elemental rows** (fire · cold · lightning · poison · chaos). The
physical block is carried from the live roster and is the deliberate exception (last bullet).

- **Status is written explicitly per skill** as a stack count, and the press applies it to every target it
  hits. The stack count is what makes two skills of the same Element differ; a skill with no rider is
  still left with its Element's baseline status.
- **Pure damage.** No new elemental skill carries a self-buff, leech or crit rider. Magic cannot crit at
  all, so no Elemental skill has a crit rider.
- **Lightning's control is shock, and shock is enough.** Shock already carries the 1 sec interrupt
  (`elements.md` §5), so no skill adds a second stop: `Thunder Strike` and `Storm Call` only land shock.
- **Resistance pierce stays on `Nether Orb` alone** — chaos's identity, copied from the live `Void Lance`
  rule. No other skill pierces res.
- **One rider, not two.** `Frostbite` (chilled bonus) and `Nether Orb` (res pierce) are the only two new
  rows that do more than damage + their Element's status.
- **The physical block keeps its live effects**, except `Puncture` (feed switched from poison to bleed).
  So leech, the crit rider, the flat stop, the res strip, the bleed feed and multi-hit all stay. They are
  the exception to the bullets above, on purpose.

# Notes for the pick

- **Coverage:** 6 fire · 6 cold · 6 lightning · 5 poison · 4 chaos · 11 physical = 38 attacks, plus 7 buff
  and 13 aura carried unchanged (one new buff, `Flame Guard`). Every Element gets a cheap bolt (cd 4-6), a
  mid press and at least one AoE; poison and chaos also carry a stack press.
- **Physical = 11 carried live rows** (Cleave · Elemental Break · Whirlwind · Shield Bash · Puncture ·
  Reap · Bloodletting · Piercing Shot · Arrow Shower · Headshot · Pierce the Veil). The other 9 live
  physical attacks (Riposte · Execute · Retribution · Volley · Momentum · Volley of Blades · Impale ·
  Echo Strike · Widow Strike) are not carried — add them later if wanted.
- **Cheap-bolt tier** (Spark · Flame Bolt · Frost Bolt · Lightning Bolt · Poison Bolt · Chaos Bolt ·
  Quick Shot) is the new no-thought filler a rotation sits on; each is single-target, cd 4-6, 9-13%.
- **AoE press** all carry the live `(AoE ×1.5)` mana rule and hit 3 targets — no new targeting model.
- **Copy-shadow check:** the 31 live attack skills are retired with this swap, so their names free up. The
  only rule left is that ids stay unique inside the new roster and do not collide with a kept
  `buff.*` / `aura.*` / `curse.*` / `heal.*` id.
- **Termination:** every skill is damage + the Element's own status, per the Effect rules above. No new
  system, stat or Cap is introduced; `Frostbite` and `Nether Orb` reuse the live `Widow Strike` and
  `Void Lance` rules verbatim.


## A. Fits the live model (no new system)

| Move | Skill | id | Group | Element | cd | mana | Basis · final_pct | Targets | What it does |
|---|---|---|---|---|---|---|---|---|---|
| Hex | Hex | attack.hex | magic | chaos | 8 sec | 14% | magic · 103.19% | 1/1 | +30% damage if the target carries any status |
| Venoshock | Venoshock | attack.venoshock | magic | poison | 8 sec | 14% | magic · 105.81% | 1/1 | +30% damage if the target is poisoned |
| Leech Seed | Leech Seed | attack.leech_seed | magic | poison | 10 sec | 15% | magic · 105.81% | 1/1 | Plants a DoT on the target and heals us that share (leech) |
| Giga Drain | Giga Drain | attack.giga_drain | magic | poison | 9 sec | 15% | magic · 105.81% | 1/1 | Damage + heal a share of it back |
| Drain Punch | Drain Punch | attack.drain_punch | melee | physical | 8 sec | 14% | phys · 142.84% | 1/1 | Physical hit + heal a share of it back |
| Will-O-Wisp | Will-O-Wisp | attack.will_o_wisp | magic | fire | 9 sec | 14% | magic · 104.06% | 1/1 | Guaranteed burn (skips the proc roll) |
| Thunder Wave | Thunder Wave | attack.thunder_wave | magic | lightning | 10 sec | 14% | magic · 104.06% | 1/1 | Guaranteed shock on one target (shock carries the 1 sec interrupt) |
| Icy Wind | Icy Wind | attack.icy_wind | magic | cold | 8 sec | 14% | magic · 104.06% | 3/1 | AoE chill that also cuts attack speed |

- `guaranteed_status` and `leech` are live effect words/stats, so these rows add **no** new mechanic.
- The two punishers (`Hex` · `Venoshock`) reuse the live `Widow Strike` conditional-damage shape.

## B. Needs a new mechanic (owner must rule before it can land)

| Move | Skill | Type | Element | What it does | What is needed |
|---|---|---|---|---|---|
| Toxic | Toxic | attack | poison | A poison stack that keeps climbing while it lives | a ramp rule (stacks grow over time) — not in the live status model |
| Counter | Counter | buff | physical | Retaliates a share of the physical hit we take | the new `retaliate_flat` mechanic (same as `Flame Guard`) |
| Mirror Coat | Mirror Coat | buff | — | Retaliates a share of the Elemental hit we take | the same `retaliate_flat` mechanic |
| Substitute | Substitute | buff | — | Spends HP to raise a temporary pool | the temporary-pool shape (`Flame Guard`'s `energy_shield` add) |
| Rollout | Rollout | attack | physical | Damage grows on each consecutive press | a ramp rule (a self-stack that grows per cast) |
| Fury Cutter | Fury Cutter | attack | physical | Same ramp, physical cut | the same ramp rule |
| Echoed Voice | Echoed Voice | attack | — | Same ramp, magic | the same ramp rule |

- `Rollout` · `Fury Cutter` · `Echoed Voice` are **one mechanic** (a self-stack that grows per consecutive
  cast) with a different element/group — keep all three or collapse to one; owner call.
- `Counter` · `Mirror Coat` · `Substitute` are **new buffs**, added beside the kept buffs (like `Flame
  Guard`), not edits to them.

# To land the swap (later, outside `owner/`)

1. In `tools/data/skills.json`, delete the `attack.*` rows this file does not carry, keep the 11 carried
   physical rows (they are already live, so their values may need no edit), and add the new elemental
   rows. **`buff` and `aura` are carried unchanged** — listed in this file, not edited in the data; `curse`
   and `heal` stay too. The only buff edit is adding `buff.flame_guard`.
2. If any doc still cites a retired attack name, add a `"renames"` entry (`harness/HARNESS.md` procedure);
   the writer updates the docs that name it.
3. Run `node tools/skills.ts --write` — regenerates `skill-pool-attack.md` and its `# N attack skills`
   heading (the count moves from 31 to 38).
4. Run `node tools/verify.ts` (skill cage `--checks` · checks.md D18 · lint L5), then `node tools/build.ts`.
   `curse.lacerate` (bleed) and `curse.venom_bind` (poison hold) are curse rows and stay, so a future
   physical row that feeds bleed/poison should be checked against what those two curses expect.
