# Private Ideas - Attack Skill Scaling, the PoE Basis (D-070)

OWNER ONLY. Agents must not read, list, quote, or import this folder
unless the owner assigns the exact file path in chat.

Status: raw idea parking. Nothing here is decided, priced, or folded
into mob_HP. Moved here from the harness draft slot by owner approval
so the numbers can never become system truth on their own. A line
becomes design only when the owner moves it into the data plus its
writer and records it in harness/decisions.md.

**Do not use the numbers in this file unless the owner asks for the
write. Note only.**

# Attack skill scaling - the PoE basis (D-070)

## Patch status - not live

**This is the B5 target, not what `skills.json` computes today.** D-070 is an applied owner ruling; `harness/todo.md` **B5** carries the re-cut and says *do not flip in isolation*. `skills.json` attack rows still hold the old `scale` string and the per-press numbers below are derived from it, so this file is the reference the re-cut will be written against, not a readout of the running calculator.

## The change

An attack-skill press becomes `skill% x final_hit(basis)` - a multiplier on the build's own already-balanced auto hit, instead of a second dip into the stats. Two bases only; Element folds into the magic basis rather than becoming a third.

```
final_hit     = (phys + magic + elem x elem_align/100) x (crit ? crit_dmg : 1)

basis phys    = phys
basis magic   = magic + elem x elem_align/100

skill press   = final_pct(lvl) x final_hit(basis) x (crit roll, basis follows: phys-basis crits, magic-basis does not)
```

## Added

- Crit rolls separately on the **pre-crit** final hit (D-070 pin 1).
- A named basis per press: phys-basis crits, magic-basis does not.
- Element damage as a visible line inside `basis magic`, at `Int x K_ELEM` 4 through `elem_align` (Dex, Cap 50) - under the old split a fire skill's `elem` contribution never appeared in `scale`.

## Changed

- Skill level scales `final_pct`, not a `K_SKILL` multiplier, on the agreed L1 -> 40%-of-L20 ramp.
- Because the press reads the finished hit, the skill inherits stat, gear, `weapon_mult`, globals and Element for free. Nothing scales off Str twice any more.

## Removed

- `K_SKILL` 1.5.
- The `stat x K_STAT x stat% + power x power%` split.

## Unchanged

- Auto swing for scale: **9,847 expected DPS** at level 100 (4,826 x 2.09 times/sec x 80% hit x 1.22 average crit). It is the comparison every press below is read against.

## Reference basis at level 100

| basis | value | source |
|---|---|---|
| `basis phys` | **4,826** | `formula.md` section 0 - `(816x5 + 80) x 1.16`, sword `weapon_mult` 1.00 |
| `basis magic` | **~6,515** | `m.atk` 4,826 + `elem x elem_align/100` ~1,690 |

The phys basis is a published number. **The magic basis is not** - it is built from the `elements.md` note that Element damage sits at ~35% of physical damage, which is a gate observation and not a pinned reference. A caster `basis magic` has to be published next to the phys row before the magic percentages below can be called exact.

## `final_pct` at skill level 1, derived to hold today's per-press

| Skill | basis | dmg/press L1 | `final_pct` L1 | L20 on the ramp |
|---|---|---|---|---|
| Whirlwind | phys | 7,007 | **145.2%** | 203.3% |
| Piercing Shot | phys | 7,007 | **145.2%** | 203.3% |
| Cleave | phys | 6,893 | **142.8%** | 199.9% |
| Puncture | phys | 6,893 | **142.8%** | 199.9% |
| Volley | phys | 6,893 | **142.8%** | 199.9% |
| Shield Bash | phys | 6,780 | **140.5%** | 196.7% |
| Execute | phys | 6,780 | **140.5%** | 196.7% |
| Retribution | phys | 6,780 | **140.5%** | 196.7% |
| Arrow Shower | phys | 6,780 | **140.5%** | 196.7% |
| Riposte | phys | 6,666 | **138.1%** | 193.3% |
| Headshot | phys | 6,666 | **138.1%** | 193.3% |
| Elemental Break | phys | 6,553 | **135.8%** | 190.1% |
| Toxic Spray | magic | 6,893 | **105.8%** | 148.1% |
| Flame Lash | magic | 6,780 | **104.1%** | 145.7% |
| Chain Spark | magic | 6,780 | **104.1%** | 145.7% |
| Frost Nova | magic | 6,780 | **104.1%** | 145.7% |
| Void Lance | magic | 6,723 | **103.2%** | 144.5% |
| Arcane Bolt | magic | 6,666 | **102.3%** | 143.2% |

Read as: **one press is about 1.4x an auto hit on the phys basis and about 1.03x on the magic basis.**

## What the re-cut has to settle

**The magic basis lands 37% cheaper than the phys basis.** The old `stat% / power%` split was authored per skill and never knew the basis sizes differ; folding Element into the magic basis inflates that basis by ~1,690, so holding `final_pct` flat would quietly pay every magic skill a 1.37x cut. Either the magic percentages are re-cut up toward the phys band, or the Element line is priced down. B5 calls this "the attack % re-cut" and it is the reason B5 cannot land without B1.

**AoE multiplies on top and the percentages do not see it.** Whirlwind, Volley, Toxic Spray, Chain Spark, Frost Nova carry `AoE x1.5` on 3 targets, so one press is ~4.2 auto hits of total damage while the row still reads ~1.4. The per-target number is the fair comparison for mob_HP; the row total is what a pack actually eats.

**Retribution and Riposte stop being different from Execute.** All three read 140.5% / 138.1% of the same basis. Under the old model their `Vit` and `Agi` halves were the only thing telling them apart, and both were dead - `core-stats.md` gives Vit HP / regen / resistance and Agi attack speed / dodge, neither feeds power. On a basis model the distinguishing has to move into the effect (`Retribution` x2 at 50% HP, `Riposte` +3% per 1% dodge, Cap +120%), which is where it already is.

**Elemental damage stops being a hidden third line.** It is inside `basis magic` now, which is the whole point of D-070 pinning Element into the magic basis instead of adding a third.

**Arcane Bolt still splits.** `element: follow` means it reads `basis magic` from whichever weapon it inherits, so its percentage is not a fixed number in the way the other five are.

## Numbers in this patch that are not pinned

- `basis magic` ~6,515 - derived from the ~35% Element note, not published
- every `final_pct` - derived here to hold the current per-press, which is the D-004 damage table's job, not this file's
- the L20 ramp column - the agreed L1 -> 40%-of-L20 shape, arithmetic applied to the L1 column only
