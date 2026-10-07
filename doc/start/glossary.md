# Glossary

The shared language of the design. Every spec file uses these words with exactly these meanings — when two systems disagree, it is usually because one of them used a word loosely.

**How to read a row:** what the term *is* · what it *decides* · what it is *not*, or what it is most often confused with. Values are not typed here; the number lives in `tools/data/` and the doc that prints it owns the figure.

# The 3 Layers of an Item

One item answers two separate questions. They are separate on purpose: collapsing them makes an item unreadable.

| Layer | Answers | Decided by | Not decided by |
|---|---|---|---|
| **Item level** | which value range every Mod on it rolls in | the drop source's level | Mod count, which is fixed |
| **Tier** | which third of that window the roll landed in | the roll alone — one item has one Tier set, shared by all its Mods | the individual Mod |

```
mid band · level 45
  ├── T3  Physical power flat  37-43
  ├── T2  Str flat             15-16
  └── T1  Evasion %            10-11
```

- **The line count never touches a rolled value.** Every drop carries the same lines, so two pieces at one level differ only by where their rolls landed.
- **The window is one window for the whole item.** Every line reads the same level and band — a Mod cannot borrow another Mod's level.
- **Tier is a property of the item, not of a Mod.** Two Mods on one item are always inside the same sub-range set.

# Attack and Defend Layers

A **layer** is one step of the calculation, in a fixed order. Two words that are constantly confused:

- **Offensive / Defensive** are **Mod pools** — which Mods may roll on which slot (`equipment-slot.md`).
- **Attack layer / Defend layer** are the **runtime order** — what happens to one number, in sequence (`combat.md` §2).

A layer either **removes** the hit, **reduces** the damage, **scales** it, or **receives** it. Knowing which kind a layer is tells you what it can and cannot answer.

## Attack layers (we hit a mob)

| # | Layer | Kind | What it decides | What it cannot do |
|---|---|---|---|---|
| 1 | **hit_chance** | removes | `accuracy ÷ (accuracy + mob evasion)` — whether the hit exists at all | never reaches 100% by design |
| 2 | **crit** | scales | physical hits only, ×(1 + crit_damage/100 − 1) · excess chance becomes crit damage | magic and the 5 Elements never crit |
| 3 | **Weak** | scales | ×1.5 when our Element matches the mob's Innate element | not the same thing as the Element counter table |
| 4 | **Element counter** | scales | the Element-versus-Element multiplier | does not apply to physical |
| 5 | **bleed** | adds over time | physical DoT from a physical hit, no Element tag | does not stack, armour ignores it, cannot crit |
| 6 | **mob HP** | receives | what is left after layers 1-5 | — |

The three damage paths — physical, magic, Element — are added together **before** layers 2-4 scale them, so a Weak Element hit and a crit are two different multiplications on one number.

## Defend layers (a mob hits us)

| # | Layer | Kind | What it decides | What it cannot do |
|---|---|---|---|---|
| 1 | **perfect dodge** | removes | not contested — deletes the hit outright | cannot be opposed, so accuracy does not touch it |
| 2 | **evasion** | removes | mob accuracy vs our evasion rating, and Capped | cannot block a DoT tick or an unconditional effect |
| 3 | **split** | divides | 50% physical + 50% the mob's Innate Element | the two halves then meet different layers |
| 4 | **armour** | reduces | the **physical half only**, by PoE's ratio | never touches the Element half, never touches DoT |
| 5 | **Elemental resistance** | reduces | the **Element half only**, per Element | never touches the physical half, never stops a debuff |
| 6 | **damage taken** | scales | the one multiplier that runs after every reduction | cannot make a hit miss |
| 7 | **Energy Shield** | receives | takes the mitigated number before HP | chaos bypasses it |
| 8 | **status** | adds | the mob's Element status, gated by its Alignment | res does not block this |
| 9 | **HP** | receives | the remainder | HP is a receiver, never a reducer |

Three consequences worth remembering, because most defensive confusion comes from them:
- **The order is the rule.** Layers 1-2 decide whether the hit exists, so nothing later can be wasted on a miss; layers 4-6 shrink what survived them; layers 7 and 9 are the only pools.
- **Armour and resistance never overlap.** They meet different halves of the split, which is why a build cannot max one and ignore the other.
- **Every Element debuff bypasses resistance.** Layers 4-5 shrink damage; layer 8 hands you burn, chill, shock, poison or mark regardless. `Holy veil` exists to answer exactly that.

# Item and Mod Vocabulary

| Term | Meaning |
|---|---|
| **Item level** | The level a piece dropped at — the one axis its values ride. **Not** a Mod count: every drop carries the same lines. |
| **Band** | low / mid / high — the label the drop source's zone already carries. It still decides weight and the task and town bands; the values come from the item level. |
| **Tier** | The third of the window a roll landed in. T1 is the best and the rarest. **Not** the item level, **not** per-Mod. |
| **Mod** | One rolled stat line on an item, read as `name value (Tier)` — e.g. `Physical power flat 45 (T2)`. |
| **Flat** | A value added straight into the stat before any % modifier runs. `Str flat 24` adds 24 to Str. |
| **%** | A multiplier applied to the finished stat. `Str % 5` makes the whole Str total 5% larger. Flat lands first, then % multiplies it. |
| **Stat Mod** | The Mods that are neither Offensive nor Defensive — `Stat Mod flat`, rolling any of the 7 Core stats. It rolls on **every** item and no slot blocks it; the `Stat Mod %` sibling is retired. |
| **Offensive** | Attack-side Mods. Roll on weapon slots only. |
| **Defensive** | Defence-side Mods. Roll on the 10 non-weapon slots only. |
| **Base Mod** | The first line of a dropped item — the frame's own line, rolled from the slot's Base-Mod pool. Unremovable: the craft verbs never touch it (item-base.md). |
| **Legacy mod** | Lines 2-3 of a dropped item, fixed at drop. The Remove mod stone can never target them, and a Random line (lines 4-7) is never legacy. |
| **Gear Mod** | A piece's own inherent defence value — Armour, Evasion or Energy Shield, decided by its Base school. Raised only by a Quality Stone. **Never** a Mod: Reroll, Refine, Remove and Add cannot touch it, and it is always shown on its own top line, never inside the Mod list. |
| **Base** | The frame of one slot (`Ring Mail` / `Plate Vest` / `Vestment`). Decides **weight** and **which Mods are Primary or Secondary**. Decides nothing else — not Mod count (that is Rarity), not rolled values (that is quality + Tier). |
| **Level floor** | The first level of a band — which is what an away window (offline) is limited to. The window above it is the band's own ceiling. |
| **Weight** | Carried by the item from its Base, multiplied by quality. **Not a rolled value.** |
| **Capacity** | How much weight a build can carry, set by Str. Going over does not lock slots — it cuts Attack speed, up to a limit (`formula.md` section 11). |

# Stats and Formulas

| Term | Meaning |
|---|---|
| **Core stat** | The 7 attributes: str / vit / dex / agi / wis / int / lck. Every item can raise all of them through Stat Mods. |
| **K value** | A hidden constant that converts a stat into a game value — `K_STR` is physical power per point of Str. Set by design, invisible to the player, and never retyped into prose. |
| **Cap** | The ceiling on a stat. **Every Cap must be proven reachable from the real Mod tables** — an unreachable Cap is not a limit, it is a number that lies to the player (`formula.md` reachability table). Not every stat has one: Critical chance and Accuracy deliberately have none. |
| **Alignment** | Dex, spent twice: it is the gate that lets a status land, **and** the multiplier on that status's damage. One value, both jobs. |
| **Physical power / Magic power** | Damage derived from the character (`formula.md` sections 1-2). **There is no "weapon Base power"** — every weapon draws its damage from the character alone. |
| **Elemental power** | The third damage path, derived from Int and gated by nothing but the weapon's own Element (`elements.md`). |
| **hit_chance** | `accuracy ÷ (accuracy + evasion)` — the chance a hit connects at all. Never 100% by design: the ratio caps itself. |
| **crit overflow** | Critical chance has no Cap. Chance stops at 100% and **everything above it becomes crit damage**, so stacking more crit is never wasted. |
| **damage taken** | A multiplier that runs **after** every mitigation layer and before any pool. Armour and resistance each shrink something; evasion and Perfect dodge remove the hit before this ever sees it; this scales what survived them (`combat.md` section 2). |
| **global damage / global defend / global speed** | The three reserved umbrella multipliers (`engine.json` `global`). `global damage` scales outgoing damage once, after weak / Element counter / crit; `global defend` is the incoming step-6 `damage_taken` bucket; `global speed` scales the whole clock (the `Haste` aura) and is **player-only** — no mob carries Haste. All start at ×1.00 — a future source feeds one bucket, so they never stack as separate multipliers. |

# Combat

| Term | Meaning |
|---|---|
| **Push** | HP reaching zero is **not death**. The fighter is pushed out of combat, rests for `Max HP ÷ (hp_regen × 8)` seconds, then walks back in alone. Losing time is the only thing this game charges. |
| **No death** | Standing rule. Defensive value comes from time not lost, not from survival. Reinstating death would mean rewriting the whole defensive half. |
| **Camp** | The Push rest location, and nothing else — the settlement that owns the current zone. Never a general word for a base. |
| **DoT** | Damage over time, ticking once a second. All Element DoT shares one budget (`elements.md` section 6). |
| **Leech** | HP returned as a percentage of damage just dealt. |
| **Perfect dodge** | Removes the hit outright and is **not** contested — the only answer to things Evasion cannot block, such as DoT ticks and unconditional effects. Chance comes from Lck as a ratio, with a Cap just under the top that ratio reaches (the generated Cap table in `formula.md` prints both). |
| **Reach** | How far a build can act. There is no map, no tiles and no movement: near and far are a queue (`combat.md` section 2b). |
| **Elite** | A rarity flag, **not** a size — an Elite is a Large body carrying its own stronger numbers, so two multipliers never stack. |
| **Attack layer / Defend layer** | One step of the damage calculation in its fixed order (`combat.md` §2). **Not** the same thing as an Offensive or Defensive Mod, which is a Mod pool. A layer removes the hit, reduces the damage, scales it, or receives it. |

# Elements and Statuses

| Term | Meaning |
|---|---|
| **Element** | fire / cold / lightning / poison / chaos. One item holds exactly one Element, and that Element decides which status the item can inflict. |
| **Innate element** | A mob's home Element. It takes ×1.5 damage from that Element **and** attacks us with that Element, so one preparation answers both halves. |
| **Weak** | The ×1.5 bonus when our Element matches a mob's Innate element. A relationship between two things — **not** the same thing as the Element counter table. |
| **Counter element** | The multiplier one Element deals to another (0.60 resisted, 1.20 strongest). Table in `elements.md`. |
| **burn** (fire) | Damage over time that also cuts the target's HP regen, 10% of it per stack, to a limit set by the stack Cap. |
| **chill** (cold) | Cuts the target's attack speed and accuracy, and cuts its Armour. |
| **shock** (lightning) | Stops the target's clock, cuts its attack speed, and **cuts our own Alignment against that target** — the one status that fights our own. |
| **poison** (poison) | Stacking damage over time that decays slowly and survives a weapon swap. |
| **mark** (chaos) | A growing multiplier on the hit it rides, plus leech. The only status with no damage term of its own. |
| **bleed** | Physical damage over time, copied from Path of Exile. **Not an Element**: no Element tag, no resistance, no counter row. Does not stack, a new application refreshes it, armour does not reduce it, and it cannot crit. |

# Crafting

| Term | Meaning |
|---|---|
| **Reroll** | Re-rolls the value inside a Mod, staying in the same Tier. A tool for fixing a bad line, not for climbing power. |
| **Refine** | Raises a Mod one Tier. |
| **Ascend** | Raises Item quality one step for the whole item. |
| **Remove mod stone** | Deletes one random non-legacy Mod. |
| **Add mod stone** | Fills one empty slot by drawing from the item's own Base pool. Always random — the stone draws, the player does not choose. |
| **Quality Stone** | The only source of Gear Mod points. |
| **Tier stone** | Feeds Reroll tier and Refine. |
| **Reroll value stone** | The cheapest stone, minted by dissolving junk. |
| **Corrupt stone / Repair stone** | Boss-only and elite/boss-only, one use per piece. The rarest stones in the game. |
| **Upgrade** | Adds Gear Mod points to a piece, one step at a time, with rising failure odds. Low steps are safe; the top steps can **Break** a piece — unequippable, stats zero, kept at its level. Protection absorbs a break before it happens. Online only. |
| **Corrupt** | One gamble per piece, in the Vaal style: a roll that can take the piece somewhere better or ruin it. A corrupted piece accepts no further stones, so it is a one-way door. |
| **Salvage** | Bulk disposal of gear below the filter line, with a bounded milestone payout. It creates no new income type. |
| **Bag filter** | What makes every drop a decision: **Keep** it (it beats the equipped piece in the same slot on at least one axis), **Dissolve** it for a Reroll value stone, or **Sell** it for gold. One piece pays one medium, never both. |
| **adventure bag** | The 100-slot bag of **kept gear** carried while adventuring (1 piece per slot, weight counted). Full = pickups pause; nothing auto-converts. Deposit is town-only (`loot.md` section 4). |
| **character bag** | The 50-slot bag of carried consumables: stones stack 999/slot and are **weightless**, herbs and potions stack 100/slot and weigh 0.1/unit, gold takes no slot. |
| **stash** | Town storage, organisation only, bought with gold (`towns.md`). Never grants power and never auto-converts. |
| **herb** | A plant drop, consumed rather than equipped or sold. Always kept by the filter — it never dissolves. Its rate feeds the herbalist's demand and the pouch ladder. |
| **junk** | A flavoured drop from each **variant** (a Goblin pays an Ear at Sneak, Bile at Raider, a Cog at Tinker, a Charm at Shaman and a Crown at the King), always kept, stacks 999/slot and is **weightless**, and is sold to the Settlement Counterhand for gold — gold's primary mint (Ragnarok-style). Has three rarities (common · uncommon · rare): rarer junk is dearer and drops less often, so expected gold per kill is flat and rarity buys frequency, not income. Not gear, not a stone. |
| **variant** | One rung of a species' named ladder (`mob.variants`): the three normal rungs plus Elite and Boss. A variant owns its own junk item and the collectible stream it **leans**, so the name is a drop identity. Each zone is three **sub-zones** — a race pair plus an Element — and a spawn rolls inside one of them, so the cast fought is the zone's own. |

# Town and Economy

| Term | Meaning |
|---|---|
| **Settlement** | A named place holding services and NPCs. Never holds combat. Also the name of the **state** the player is in while there — the counterpart to **Adventure** (below). |
| **Adventure / Settlement** | The two states. **Adventure** = in a zone: combat, loot, the adventure bag fills; no crafting and no deposit. **Settlement** = in a settlement: deposit, stash, craft, restock; no combat. Neither is the same as AFK/active — a character can be AFK in either state. |
| **Capital** | A settlement serving one quality band with the full service set. Three in total. |
| **Zone** | The combat area attached to a settlement, always the `world.md` zone 1-9. A settlement never replaces a zone. |
| **Block** | One hex of the world lattice. Walking is counted in blocks, and the blocks between two settlements are their hex distance. |
| **Walk** | Crossing blocks to reach a settlement. Every block costs seconds and rolls one chance of an ambush. |
| **Waypoint** | A settlement opened by arriving on foot: after that a warp there is free and instant. |
| **Standing** | A per-settlement unlock counter earned from the flows that already exist. **Never spendable, never a currency, never grants a stat.** |
| **Gold** | The quality-of-life medium, minted by **one** thing: selling a filter-rejected piece. Buys space, time, information and appearance — never power. |
| **Collector set** | A named bundle of gear pieces a settlement wants handed in, one per Base school. The reward is a convenience — a banner, a stash tab, a title — never power, and some sets are paid for in gold. |
| **Reservation** | An aura holding back a share of Max Mana. Nothing drains per second; the player opens the set, and total reservation may not reach the whole pool. |
| **reserve tier** | The share of the pool one aura holds back (`skill-pool-aura-heal.md`). Only auras reserve — no other skill does. |

# Mobs

| Term | Meaning |
|---|---|
| **species** | A creature lineage (Goblin · Golem · Elf). Decides a stat multiplier vector, an accuracy tier and a damage type. **Not** a class, and not zone-locked: the same species at a higher level is the same species. |
| **body class** | The four mob sizes — Small · Medium · Large · Boss (`engine.json` `mob.sizes`). Decides HP, damage-taking and evasion multipliers and whether it can appear in a group: only Small and Medium form groups, Large and Boss appear alone. It is also the axis a weapon's size ladder reads: each weapon type carries a Small/Medium/Large multiplier on the physical share of its hit, and a Boss declares which of the three columns it reads. **Elite is not a body class** — it is a rarity flag forced onto a Large body. |
| **Base school** | The three armour families a Base can belong to - light (Evasion), heavy (Armour), cloth (Energy Shield). It decides the Gear Mod a piece carries, and it is what a Collector set is built from. |
| **weapon group** | The three families a weapon belongs to - melee, ranged, magic. It decides which attack skills can use the weapon and which stat the weapon scales. A dagger is melee, not ranged. |
| **Elite** | A rarity flag on a Large body, not a fifth size. Spawns as its own event and drops its own stone. |
| **mob accuracy** | Derived from the mob's own stats through the same K values the player uses, scaled by the species accuracy tier. This is why Evasion works against some species and is nearly worthless against others. |

# Abbreviations

A **closed set**. An abbreviation is the *same term shortened*, never a second name for it — so a term with no row here has no abbreviation, and inventing one is a synonym, which `AGENT.md` section 2 forbids. A new row is added only when the abbreviation is actually used in a doc or a tool, and a rejected spelling is recorded in `aliases.json` (guarded by lint **L4**). Every row must survive lint **L8**: one abbreviation per term, one term per abbreviation, and each abbreviation used somewhere in the repo.

| Term | Abbreviation | Canonical in |
|---|---|---|
| Attack speed | `aspd` | `engine.json` `caps.aspd` · docs |
| Cooldown reduction | `cdr` | `engine.json` `caps.cdr` · docs |
| Critical chance | `crit` | `formula-offense.md` · `engine.js` |
| Physical power | `phys` | `engine.json` `K_STR` · docs |
| Elemental power | `elem` | `engine.json` `K_ELEM` · docs |
| Damage per second | `DPS` | `formula.md` section 0 · docs |
| Elemental resistance | `res` | `core-stats.md` · docs |
| Elemental alignment | `align` | `core-stats.md` · docs |
| Accuracy | `acc` | `formula-utility.md` section 8 · `engine.js` |
| Evasion | `ev` | `world.md` mob sheet · `engine.js` |
| Energy Shield | `ES` | `formula-defense.md` section 5 · `engine.js` |
| Max HP | `HP` | `formula-defense.md` section 5 · docs |
| Max Mana | `mp` | `engine.json` `K_INT_MP` · `engine.js` |
| Damage over time | `DoT` | `elements.md` section 6 · docs |
| Experience | `XP` | `world.md` XP table · `engine.json` `xp` |

# Terms That Must Not Be Interchanged

| Do not write | Write instead |
|---|---|
| item Tier | Item quality |
| Rarity · quality | item level |
| status resistance | elemental resistance |
| status alignment | elemental alignment |
| Attack speed (times/sec) | Attack speed (%) — aspd is a percentage and its Cap lives in `engine.json` |
| flat res | nothing — res is % only |
| flat crit chance | nothing — crit chance is % only, has no Cap, and its excess becomes crit damage |
| Core stat Mod | **Stat Mod** — the Mods that are neither Offensive nor Defensive. "Core stat" on its own still names the 7 attributes. |
| SP / SP pool / SP regen | **mana** / Max Mana / mana regen — this game says mana, never SP |
| the two pre-Mod names for an item stat line | **Mod** — `aliases.json` holds the deprecated spellings |

# Rules That Must Not Be Broken

1. **Never say Tier means Item quality** — Tier is the sub-range, quality is the large range.
2. **Never tie a value range to the line count** — the count is fixed, so one level's pieces are decided by where their rolls landed.
3. **Never let Mods on one item pull from different range sets** — one item, one level, one Tier set.
4. **Never swap the item level and the band.**
5. **Tier is not required on every Mod** — when a window is too narrow to split readably, drop the Tier and keep the window's own range.
6. **One source pays one medium** — a piece yields a Reroll value stone *or* gold, never both, and no gold↔stone exchange exists anywhere.
7. **Gold never buys power** — space, time, information and appearance only. Gear, Mods, potions and stones are not for sale at any NPC.
8. **Never type a derived number into a second document** — it lives in `tools/data/`, a writer prints it, and `tools/anchors.ts` fails when a copy multiplies.

# Value Reading Examples

| Mod | Reads as |
|---|---|
| `Physical power flat 45 (T2)` | Mid quality, middle sub-range — decent, not rare. |
| `Physical power flat 78 (T1)` | High quality, best sub-range — an item to push immediately. |
| `Str flat 8 (T3)` | Low quality, lowest sub-range — a temporary unlock piece. |
