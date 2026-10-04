# Formulas — Offense

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 1. Physical power

```
phys = (str * K_STR + phys_flat) * (1 + phys_pct/100) * weapon_mult
```

- `K_STR` = 5 · Str 816 (level 100 ceiling) gives 4,080
- `phys_flat` = total Physical power Flat from all items (main hand only under the Offensive/Defensive rule) · max 80
- `phys_pct` = total Physical power % from all items · max 16 because it can only roll on main hand
- `weapon_mult` = multiplier by weapon type · decided below

```
phys = (816 × 5 + 80) × 1.16 × weapon_mult = 4,826 × weapon_mult
```

## weapon_mult — No Weapon Base Power

**All weapons draw power from the character only.** There is no Base power per weapon type. Weapons differ in attack rate (`weapon_aspd`) and whether the Mod pool is phys or magic.

`weapon_mult` is set so **DPS is equal for all weapon types at equal stats** = `1.2 / weapon_aspd`, leaving weapon difference in attack rhythm, not in aggregate numbers.

<!-- BEGIN GENERATED:weapon-mult -->
| Weapon | weapon_aspd | weapon_mult |
|---|---|---|
| dagger | 1.5 | 0.80 |
| one-handed sword / axe | 1.2 | 1.00 (baseline) |
| bow / crossbow | 1.1 | 1.09 |
| mace / wand / rod | 1 | 1.20 |
| staff / spear | 0.85 | 1.41 |
| two-handed sword / axe | 0.7 | 1.71 |
<!-- END GENERATED:weapon-mult -->

- Intended side effect: fast weapons never reach the aspd Cap · at Agi 816 dagger reaches 383 raw aspd while the Cap is 500, and the slowest weapon stays far below it, so the Cap is a clock rule rather than a build target.
  Late game heavy weapons therefore hit slightly harder in exchange for fewer procs per second (Sonic Blow · Flurry · chill · burn trigger per hit count).
- **glossary.md previously stated Base power "is used as the crit damage base"** — that value no longer exists. Crit damage is set from a 100% Base + Mod only.

> Flat power is only ~2% of phys because only main hand can roll power.
> The main path of Str is Core stat multiplied by `K_STR`, not Flat power.
> To make Flat matter more, add a power Flat slot on off hand (dual wield) instead of changing K_STR.

# 2. Magic power

```
magic = (int * K_INT + magic_flat) * (1 + magic_pct/100) * weapon_mult
```

- `K_INT` = 5 · Int 816 gives 4,080 · same structure as physical but does not touch Str.
- Magic builds use the same numbers as the table in section 0, replacing Str→Int and phys→magic · every row in that table applies directly to magic.

# 3. Critical

```
crit_pool   = lck * K_LCK_CRIT + crit_chance_pct
crit_chance = min(crit_pool, 100)
crit_overflow = (crit_pool - crit_chance) * K_CRIT_OVERFLOW

crit_dmg = 100 + crit_dmg_pct + crit_overflow
```

- `K_LCK_CRIT` = 0.05 · Lck 816 gives 40.8% + 8% Mod from main hand = 48.8% at the extreme ceiling.
- **Crit chance has no Cap — the 100 line became a spill point.** Chance stops at 100 because a crit that always lands is the most a chance stat can do, and everything above it converts into crit damage instead of being thrown away. `K_CRIT_OVERFLOW` = 1.0, so 1% of excess chance is worth 1% of crit damage.
- Because stats alone reach 48.8%, overflow is 0 until buffs and skills push the pool past 100 — the payoff belongs to crit-stacking builds, not to the Lck ceiling.
- Crit damage may exceed 100. No Cap needed.
- **Crit does not apply to Element damage** (see elements.md)
- **Crit is physical only.** Magic damage does not crit and neither do the 5 Elements, so `Critical damage %` is a single line with no magic counterpart. Reason: crit is the physical build's payoff, and giving magic the same multiplier would make the physical/magic weapon choice (equipment-weapon.md) cosmetic — every weapon would want the same crit gear (D-017).
- `Critical chance %` has no Flat counterpart, on Mods or from Lck — the stat is a percentage end to end (mod-pool.md).

```
dmg_per_hit = phys + magic + elem * elem_align/100
dmg_per_hit = dmg_per_hit * (crit ? crit_dmg : 1)

dps_expected = dmg_per_hit × times/sec × hit_chance × (1 + crit_chance × (crit_dmg/100 − 1))
```

- One weapon rolls one path only, phys **or** magic, by weapon type · `elem` is a third path layered over every weapon.
  (Elemental power slot is secondary on every main hand type, see equipment-slot.md)
- **The reference DPS is expected value, not every-hit crit** — at 18.5% crit + 120% crit damage the average multiplier = 1.22, not 2.2.
  The old numbers in section 0 used 1.62, which matches no component of this formula (crit chance never reaches 100%), so it is treated as wrong and replaced by the new table.

# 4. Bleeding — physical damage over time

Bleeding is copied from Path of Exile. **It is not one of the 5 Elements** — it carries no Element tag, needs no Elemental resistance and has no counter row in the counter-pair table (elements.md). It is physical damage that arrives over time.

```
bleed_total = physical_hit × K_BLEED                K_BLEED = 0.70
bleed_dps   = bleed_total / bleed_time_sec          bleed_time_sec = 5
```

- `physical_hit` = the **physical part only** of a landed hit, and **the non-crit part** — bleed cannot crit (PoE rule).
- **Bleed does not stack.** A target carries one bleed; a new application refreshes its duration and, if the new hit was stronger, replaces the stored damage with the higher value. There is no stack count anywhere in this file.
- **Armour does not reduce bleed** (PoE rule, same rule that keeps armour away from burn and poison in combat.md §2). Armour still helps indirectly, because it lowers the physical hit that inflicts the bleed.
- **Bleed is not a hit**, so nothing that works on hits touches it: not dodge, not perfect dodge, not accuracy.
- **Nothing in the game mitigates bleed.** PoE answers it with immunity flasks, % physical mitigation that covers degeneration, ailment damage reduction, faster ailment damage and reduced duration — none of those five exist here. There is no Elemental resistance against it and no status resistance. The only answers are **heal and Energy Shield**, which shorten the time bleed has to run (D-015).
- `bleed_dps` **does not scale with attack speed.** It is a fixed fraction of one hit's physical damage spread over 5 sec, so a fast build only procs it more reliably while a slow build has larger bites. **Slow heavy hits are the bleed build** — the opposite of the poison build, which wants to sit at 10 stacks.

## Where bleed comes from

`Lacerate` (curse, Str scale, 14 sec cd, 10 sec duration) — our physical hits have a **40% chance to inflict bleeding** while it is up. This is PoE's `Vulnerability` in the slot we already have for "make the target worse": curses attach with the normal accuracy roll and add no new Mod line.

- Curse uptime = 10 ÷ 14 = **71%**, so bleed is a partial-uptime damage source, not a constant.
- At 1.2 hits/sec and 40% per hit, the expected gap between applications is ~2.1 sec against a 5 sec bleed — continuous while the curse is up, and it drains away during the 4 sec it is down.
- **Mob side is ruled (D-067).** Bleed is a DoT, so it lands on mobs in full from our `Lacerate`; in the other direction the high-Str physical lineages (Orc · Golem · Troll · Drake) inflict it as their signature skill — a DoT slice of their already-priced `mob_PS`, not extra power (`combat.md` §5b).

## Folding into mob_HP

Bleed is new power, so per `AGENT.md` §5 it must be folded into `mob_HP` (checks.md H1) before the timeline can be trusted. The uplift to fold is the expected value of the table above across the uptime and hit-rate band, and it is **deferred to the balance audit** (D-012): the policy is that an overpowered player is answered by stronger mobs, not by nerfing player stats.
