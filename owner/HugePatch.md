# Level-up redesign — plan

Written 2026-10-05. Not implemented yet. This file is the owner's parking slot for the idea; the
numbers below are proposals until the data edit lands in `tools/data/engine.json`, after which the
docs own them.

## 1. What the owner decided

| Decision | Answer |
|---|---|
| Level reward | no automatic stat growth — the level grants points the player spends |
| Stat points | 5 per level, 1 point = 1 Flat stat (ratio 1:1), bankable, any stat, no per-stat limit |
| Spending points | **allowed any time, including mid-combat** — the sheet is always open |
| Tree points | 1 passive-tree point per level, banked; the tree has no content yet |
| Paragon | levels 101-190 (the existing `stat.level_cap`), 2 stat points + 1 tree point per level |
| Respec | **free, at an NPC in a settlement only** — never in the field, never mid-combat |
| Reference build | **points split evenly over the 7 stats** — this is the build the published numbers and `mob_HP` are priced against |
| Reference gear | **the 13 items follow the allocation** (option B): the reference character's items sit where its points sit, roughly two to a stat, not thirteen on one |
| `mob_HP` | untouched |
| Timeline | **re-stated — the game gets longer.** The published 1.00 s TTK and the 40 h funnel are written from the reference build and are expected to land several times longer; that is accepted rather than prevented |
| Mob stat line | **flat — no level term at all.** A mob's stat block comes from its species vector and body class only. Level stays as the *estimator* of how strong a mob is (HP · PS · XP), and the fact that a mob cannot wear gear is compensated inside `mob_HP` / `mob_PS`, not in its stat block |
| Mob balance lever | **per species, Ragnarok-style.** A mob that feels weak is fixed by raising that one species' stat vector, never by moving a global curve. The offensive / defensive layers stay separate, and a mob's level is a readout only — two mobs of the same level can be nothing alike |

## 2. The point economy

```
points earned at level L = 5 × (min(L, 100) − 1) + 2 × max(0, min(L, 190) − 100)
tree points at level L   = L − 1
```

| Level | stat points | tree points | reference stat (even split) | focused stat (all points in one) | today |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 12 | 12 | 12 |
| 100 | 495 | 99 | 82.7 | 507 | 210 |
| 190 | 675 | 189 | 108.4 | 687 | 390 |

`stat` of a stat = `stat.base` + (points put into it) × `stat.point_value`.

## 3. What the reference build prices

`mob_HP(L)` and every zone price stay frozen. The curve was priced against a character whose **every**
stat reached the same number from levels alone and whose 13 items all rolled one stat, and allocation
makes that character impossible. The reference build is now **even-split points with gear following
the allocation**, and it is far weaker than the character the curve was priced against:

| At the cap | measured stat | Agi → aspd | finished DPS vs today |
|---|---|---|---|
| old character: every stat 390, 13 items on the measured one | 715 | 2.21 /s | 100% · TTK 1.00 s |
| **reference: points ÷ 7, items ÷ 7** | ~158 | 1.49 /s | **~17% · TTK several seconds** |
| focused: all points and all items in one stat | 1012 | 1.49 /s | ~100%+ · TTK ~1.00 s |

Two consequences, both accepted:

- **The published TTK, kill rates and the 40 h funnel are written again from the reference build.**
  The game gets materially longer. Nothing about `mob_HP` moves; the *time* the player spends does.
- **The focused build is now the one that lands on the old numbers**, and it is a published row
  beside the reference, not a secret. A player who dumps 675 points into one stat kills at the pace
  the game was originally balanced to; a player who spreads pays for the freedom.

The point budget is the reason the reference drops so far: 5 points × 189 levels = 945 stat units
spread over 7 stats, against the old line's `2 × 189 = 378` **per** stat. `Agi` falls with it, so the
attack rate falls too — the shortfall is roughly 6x, not 3x.

**The one lever left for pacing is the XP curve.** `xp.kills_anchors` is neither `mob_HP` nor a stat,
and shortening the kills each level asks for restores a playable game length without touching the
price of a mob or the 1:1 ratio. Whether the pass moves it is the owner's call at the end, once the
re-derived TTK is a real number.

## 4. Data — `tools/data/engine.json`

`stat` block: drop `per_level` (it becomes a mob-side number only), add

```
points_per_level: 5 · point_value: 1 · paragon_from: 101 · paragon_points_per_level: 2
tree_points_per_level: 1 · reference_build: "split" · respec_cost: 0
```

`mob.stat` loses `per_level` and becomes one flat base the species vector multiplies. It is the one
number in this plan that cannot be typed from a formula: it has to be set so the mob-anchored bands
(X20 · X22 · X24 · X25) still hold against a player whose stat line just changed. Nothing in the
data derives it, so this pass derives it from those bands rather than picking it.

Two knobs, and only two:

| Knob | Where | What it decides |
|---|---|---|
| flat base | `mob.stat` | what one ordinary mob's stat block is worth, before species and body |
| species vector | `mob.species[].stats` | what *this* species is — the Rat's 1.46 Agi against its 0.63 Int is the whole reason it plays differently from a Slime |

Body class still carries its own multipliers on top, and the two layers a mob fights with stay
separate: **offensive** is `mob_PS` + accuracy + the crit pool, **defensive** is `mob_HP` + armour +
Elemental resistance + evasion. Raising a species vector raises both sides of that one species, and
raising nothing moves every mob at once. This is the Ragnarok shape — a monster is a stat block, not
a point on a curve — and it is why the level is only a readout: a level-90 Rat and a level-90 Slime
carry completely different numbers, and the shared level says nothing about which one is harder.

What a mob level still drives after this change: `mob_HP(L)`, `mob_PS(L)`, XP per kill, the spawn
clamp into the zone band, and the level printed on the sheet. Difficulty moves entirely onto HP and
damage — a zone-9 Slime and a zone-1 Slime have identical accuracy, evasion, armour, resistance,
alignment, crit and dodge, and differ only in how much damage they take and give.

## 5. Engine — `engine/index.ts`

- `pointsAt(level)`, `treePointsAt(level)`, `statOf(points)` replace `statAt(level)` for the player.
- `statAt(level)` survives as the reference (even-split) line, so every cage and doc that reads it
  keeps one meaning: "the reference build".
- `CEIL` / `SPLIT` / `FORCED_SPLIT` / `DERIVED` stay on the reference line; a new focused ceiling is
  printed beside them rather than replacing them.
- `mobStatAt(level)` is deleted. `mobStat()` returns one flat number, so `mobRoster()` (which today
  reads the **player** line at `engine/index.ts:481`), `mobEvasion`, `mobAcc`, `spawnAt` and the
  mob's own armour/res/align/dodge all read that flat value multiplied by the species vector. Every
  mob stat column in `mob-roster.md` then repeats the same number for every zone, and the only thing
  that separates two zones is HP and PS.
- `refAttackerAcc(Lv)` is a *player* line, so it keeps taking a level — it reads the reference
  build's Dex.
- `engine/skills.ts:38` builds the mana reference line from `E.stat.base + E.stat.per_level` and
  needs the same treatment.

## 6. Client — `game/src`

| File | Change |
|---|---|
| `sim/types.ts` | `Player` gains `points: Record<StatKey, number>`, `statPoints: number` (unspent), `treePoints: number` |
| `sim/game.ts` | the level-up loop grants 5/2 stat points + 1 tree point instead of printing the new stat line |
| `sim/player.ts` | `buildCharacter` reads `core[k] = statOf(points[k]) + gear flat` |
| `state/save.ts` | the new fields land with fresh-character defaults — the game is unreleased, so there is **no v7 → v8 conversion and no migration to write** |
| `App.svelte` | allocation row per stat (+ / − / Max), an unspent counter and the tree-point counter — live during combat, on the character sheet |

Spending a point is an allocation, not a purchase: it takes effect on the next tick, so the sheet
works mid-combat and the fight sees the new stat line immediately. Respec is the opposite — it hands
every allocated point back at once, which is a town service and not a field action.

- **Survival is the player's own lever, not a gap.** The HP pool falls because the Vit term falls, and
  under allocation Vit is a choice: a player who is getting pushed dumps points into it. The one
  thing that must still hold is that the *reference* build survives its own zone, and that is a
  number the pass checks rather than a rule it adds.
- **A mob that reads weak is fixed on the mob side** — raise that species' vector or the flat base.
  Both are level-independent now, so that lever no longer touches the player's numbers.

## 7. Docs

- `core-stats.md` — the stat line becomes points; "all 7 stats use the same formula" now describes
  the reference build, not the player's only option.
- `formula.md` §0 — the numeric targets table re-derives on the reference line; the new focused and
  split rows sit beside the old single line.
- `character-sheet.md` — the level-up panel and the display rule at §139.
- `skill-tree.md` — the "no passive tree" ruling is amended: points are banked, the tree is still
  empty, and a point grants nothing until the content lands (owner override of D-046).
- `save.md` — the "no stat points are stored" line is replaced by the allocation fields.
- `world.md` — the Monsters section and the `mob-roster.md` caption both quote the mob stat block as
  a level formula; both become "species vector × body class", with level described as the estimator.
- `checks.md` — the TTK anchors become two rows (reference 1.00 s, focused ≈0.43 s) and the stat-line
  anchors A1-A5 are re-stated on the point economy.
- `harness/decisions.md` — one ruling with its guard.

## 8. Cage risk list

| Risk | Handling |
|---|---|
| H1 (`mob_HP` fold) | the stat line changed and the price did not — this must be an explicit named exception in the ruling, or H1 fails |
| X37 / D1-D5 | TTK anchors re-stated as two rows |
| loot bands | `lckOf(band)` reads the stat line, so drop rate, junk/hr, gold and the stone funnel all re-derive from the split line |
| `ttk_per_mob_sec` | must stay the reference build's TTK or `killsDerived` disagrees with the published kill rates |
| `tools/bases.ts`, `tools/survival.ts`, `tools/lib/numbers.ts` | read the stat line directly and follow it |
| mob stat is now flat | every mob-anchored band re-derives at once: X20 (accuracy vs evasion), X22 (armour vs the zone-9 boss), X24 (mob dodge), X25 (Energy Shield share), plus `MOB_EVASION_REF` — a flat mob line makes the opposed roll the same in every zone |
| `mob-roster.md` | its per-zone stat columns stop varying by zone; the writer prints the same value down the column |
| Caps fall out of reach | CDR · Alignment · Elem res · crit are all stat × K, and the stat line drops ~72%, so the Cap the docs promise as reachable may not be. The fix is the **Mod value ranges in `mods.json`**, not the K values — shift the Mod so the Cap is reachable again on the new stat line |
| tree points banked with an empty tree | `tools/tree.ts` accepts a non-zero banked counter and the fold point stays declared; nothing in the docs quotes a tree multiplier while the tree is empty |
| the ceiling sentence | "every K value is set on CEIL" no longer names one number. The **focused** max (all points + all items in one stat) is the ceiling; the reference split row is printed beside it, and `formula.md` §0 carries both |
| game length | the re-derived TTK makes the published timeline several times longer. `xp.kills_anchors` is the only pacing lever that touches neither a mob price nor the 1:1 ratio, so it is the owner's call once the number is real |

## 9. Paragon (levels 101-190)

Levels 101-190 exist already as the flat-gear extension past zone 9. Under this plan they give 2
stat points and 1 tree point instead of 5 and 1, so the treadmill slows exactly where the gear
factor is held flat — and the banked tree points are the drain for whatever replaces the tree.

## 10. Respec — who holds it

- Free, and it only exists inside a settlement. No gold line, no stone cost, no timer: the game has
  no death, so a locked build is a worse punishment than a lost fight would be.
- **Counterhand** is the host — the `information` stall that already sits in every settlement and
  already acts as the town's service desk. No new NPC, no new stall kind, and nothing added to the
  price tables.
- The client gate is the settlement screen itself: the Respec control lives on the town panel, not on
  the character sheet, so it cannot be pressed from the field.
- Alternative if the owner prefers a different desk: Waypoint keeper (`time`, also every settlement)
  reads as "the clerk charges you an hour", which would make a *paid* respec possible later without
  a new NPC.

## 11. Field mob labels — a separate pass

Not part of the level-up work; it ships on its own and touches none of the numbers above.

The label is the **species name**, and the tier is a suffix on it. No tier vocabulary is invented:

| Spawn | Field label | Colour | Mark |
|---|---|---|---|
| normal | `wolf` | white | — |
| Elite | `wolf(Elite)` | purple | — |
| boss | `wolf(Boss)` | red | skull icon (`024-lorc-dread-skull`, already in the icon set) |

- The species word renders lowercase so the label reads `rat`, `wolf(Boss)`; the suffix keeps its
  own capital. It is a rendering rule, so no species name in the data is retyped and no doc moves.
- A **named boss reads its own name**, not its species: `The Bloated Shepherd(Boss)`, because the
  nine named bosses already carry a name the species would throw away.
- The body class leaves the field label — `Grunt · Small` is gone. Small / Medium / Large stay in
  the roster table and in `mob-roster.md`, where they are structural, and they stay what the weapon
  table in section 12 reads.
- One new table `mob.field_labels` (label · suffix per tier) in the data, so the roster doc and the
  client read the same three rows. **Colour is a client concern, not a data one** — the JSON never
  carries a hex value. `Glossary` gains Elite and Boss as fixed field words.

## 12. Weapon × body class — the missing size mechanic

Its own pass. Body class stops being three HP multipliers and becomes the shape of the fight.

| Body class | HP | PS | Evasion | Group | What it is |
|---|---|---|---|---|---|
| Small | 0.7 | 0.7 | 1.1 | up to 5 | many, evasive, unarmoured |
| Medium | 1 | 1 | 1 | up to 5 | the baseline every row is measured against |
| Large | 1.7 | 1.35 | 0.9 | alone | armoured, slow, one at a time |
| Boss | Large + the named bar | | | alone | the fight itself |

The model already owns both halves and they are opposites: the entropy roll punishes Small
(accuracy vs evasion), the armour ratio punishes Large. The missing piece was never a stat — it is
that **no weapon answered either**. One new table answers it:

```
engine.json weapons[].size_mult = { small, medium, large }
```

Three columns, not four. The **Boss body class declares which of the three it reads as**, because a
boss is not a size — it is a species that happens to be huge. The Bloated Shepherd is a bloated
slime and reads Large; a rat chieftain is a very large rat and can read Medium. One label per boss,
not one number per weapon per boss, so the table stays 12 rows instead of 108. Body class keeps its
structural job (HP · PS · group rule) and the matchup reads the declared label.

**Where the multiplier sits:** the hit is already split into a non-Element part and an Element part
(`mitigateMobHit`, `engine/index.ts:150`). The rule is **physical damage, wherever it comes from**:

- **the normal attack of every weapon carries the row** — a staff's own swing is included, so all 12
  weapons have one;
- **physical skill damage carries the row** too, because the swing does;
- **magic-damage skills are exempt.** A caster's spells are not the weapon arguing with a body, so the
  ladder never touches them.

Putting the multiplier *before* the armour ratio would make a Large hit 0.75 × the armour cut and
collapse the dagger to about a third, so it applies **after mitigation**.

**The dagger row is the owner's, and it is the first one to land:**

| Weapon | Small | Medium | Large | reads as |
|---|---|---|---|---|
| sword | 1.00 | 1.00 | 1.00 | the reference weapon — nothing moves |
| dagger | **1.25** | **0.90** | **0.75** | fast and accurate against vermin, out-scaled by armour and bulk |

- The ladder is monotone and legible on the sheet, and its 1.67x spread is the same order as the
  build spread the project already prints.
- **The one tension to know about:** the dagger is reach 1 and Small mobs arrive five to a group, so
  a reach-1 swing only ever lands on the front one. The 1.25 is a multiplier **per hit that actually
  connects**, and the sheet says so — it does not buy the dagger extra throughput.
- The remaining weapons follow the same rule: **one favoured size, one disfavoured, and flat where
  the weapon has no opinion.** Direction per family comes from the rules that already exist — the
  wide reach and the AoE press favour Small and Medium (a reach-1 swing against five Smalls spends
  its whole turn on the front one, and a solo Large gives an AoE nothing extra to hit); heavy
  single-target press favours Large (one body, armoured, so a big hit and armour pierce answer it);
  magic favours Large because the Elemental half already bypasses armour. Magnitudes for those rows
  are derived in the pass from the published armour and evasion ratios, never typed here.
- It is one multiplier on the outgoing physical hit, and nothing else: no DoT, no status proc, no new
  stat, no new Cap. It is a weapon rule, not a Mastery bonus, so `AGENT.md` §5's per-weapon DPS ban is
  not touched.
- The fold is the reference row. Because the sword stays at 1.00, no zone price moves; every other
  weapon publishes its own TTK row instead, which becomes a **spread across weapons** beside the
  spread across builds the project already prints.
- The payoff the player feels: main hand and off hand are two of the 13 slots and there are 6
  loadout presets, so a Small-heavy zone is fought with a dagger and a Large zone with an axe, and a
  Road trip swaps at the next settlement.

## 13. The mage fantasy — a skill-design job, not a system change

The owner solves this at the roster level: a magic build that wants no basic attack and a seamless
rotation gets it from **how the skills are designed**, not from touching the attack clock.

The only system consequence worth writing down: a **no-cooldown skill sits outside the CDR formula**
entirely (`cd 0` is not a reduced CD, it is an absent timer), so the `caps.cdr` row that
`formula-defense.md` documents as reachable must say that a zero-CD skill is not a CDR build — it
is a different kind of skill. Mana, not the clock, is what gates that rotation, which is what the
caster already lives on (`int` × `K_INT_MP` for the pool, `K_INT_MREGEN` for the recover).

Nothing in `combat.md` §1, the aspd Cap, or the reach queue moves. The weapon keeps its swing; the
mage simply has better things to press.

## 14. Skill-first attack priority

One rule on the attack clock, and no new system:

```
the attack timer casts a ready skill first · a swing is what happens when nothing is ready
```

- **A cast the character cannot pay for is skipped, and the swing happens.** That is a boundary
  condition, not a risk to manage: a skill with an unaffordable cost is simply not castable.
- **Running out of mana is the player's own build work, not a rule.** The answer already ships: the
  potion auto-use in `farm.autoUse` / `farm.threshold`, which drinks when a pool drops under its
  threshold (the defaults live in `engine.json` `potions.auto_use_default`). Nothing new is needed
  here — the section below only adds the same idea to skills.
- **The potions bound it, and that is worth publishing rather than hiding:** they share a 30 sec
  cooldown, are capped at 3 uses per fight, and are suppressed on bosses. So a trash rotation can be
  topped up on a setting, and a **boss rotation must be mana-sufficient by itself** — no potion is
  coming. That is a build constraint on the caster, exactly like the weight tax is a constraint on
  the carrier.
- **The default is already what the owner asked for, and it costs nothing.** The rotation runs beside
  the swing, not inside it: `castOnce` fires the first ready, affordable slot top-down on every tick,
  and the swing runs on its own clock. A slotted skill therefore fires before anything else is
  considered, and a character with an empty bar simply swings. No published number moves, because
  nothing is traded.
- **Buffs are already instant and off-clock.** A buff re-presses itself the moment it lapses, on
  `buffUp`, and takes no bar slot — so "the buff goes off with the attack" is current behaviour and
  needs no change.
- **A press out-values a swing, so the swap is a gain and not a tax.** Every attack row's `final_pct`
  sits at 135-145% of the caster's finished hit, where a swing is 100% — so trading the tick for a
  press is worth roughly 40% per press, gated only by the cooldown. The rule stays, and the sheet
  says what it costs: *this press replaces your swing*.
- **The riders move onto the press.** A swing carries three things with it — the weapon's Elemental
  status proc, bleed chance, and the mace's stun chance. When a press takes the tick, all three fire
  on the press hit instead, or the caster silently stops applying status the moment the rotation
  starts.
- **The real gap is cadence, not power.** With 6-14 sec cooldowns the rotation fires about a tenth of
  a second, so a caster still swings the rest of the time and reads as a melee build in a coat. Two
  ways to close it, both cheap:
  - the owner's low or zero cooldown core spell (section 13) — the roster decides how far this gets;
  - **`weapon.basic_attack: swing | bolt`** — a magic weapon has no swing, it has a bolt: a press
    with no mana cost, no cooldown and low value (the ladder's floor) running on the same attack
    clock. A staff flicks a spark instead of swinging, the character never idles on an empty bar, and
    the rotation gets real cooldowns to spend.
- **Per skill the player picks `Always` · `Conditional` (only vs bosses · only while a status is
  missing · only while HP% is under X) · `Never`, stored with the loadout presets.** `Always` is the
  default for anything on the bar — that is what "cast when ready" already means — and `Never` is
  the player silencing a skill they do not want in the rotation. The presets are where the switch
  earns its keep: six builds, six rotations.
- No ratio slider: a condition is legible and checkable, "use skills 40% of the time" is neither.
- The condition list is **one shared list, not per skill**: `boss`, `status missing` (one flag per
  Element / curse the skill applies) and `HP% below` with a player-set threshold — the same shape as
  the potion threshold. Every Conditional skill draws from that same list, so the save schema is
  bounded and a new condition is a new entry in one place, never free text.
- The caveat from section 13 stands: with the published 6-14 sec cooldowns, skill-first only reads as
  a rotation because the roster carries a low or zero cooldown core spell. That is the skill-design
  job, and it is the owner's.

## 15. Not in this pass

- Passive-tree content, branches, keystones — the point is banked and nothing spends it.
- Any change to `mob_HP`, zone prices, or the timeline.
- K-value re-tuning for build balance beyond what the re-derivation forces.