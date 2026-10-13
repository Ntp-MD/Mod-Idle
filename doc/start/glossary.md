# Glossary

The shared language of the design: every file uses these words with exactly these meanings, and when two systems disagree it is usually because one of them used a word loosely.

This file fixes what a word **means**. Every constraint, cap and rule that rides on one lives in `DECISIONS.md`; the figures live in `tools/data/`. Values are never typed here.

# The 2 Layers of an Item

| Term | Meaning |
|---|---|
| **Item level** | The level a piece dropped at — the one axis its Mod values ride. |
| **Band** | low · mid · high — the label the drop source's zone already carries. |
| **Tier** | Which third of a Mod's value window the roll landed in. One item carries one Tier set, shared by all its Mods. |

# Attack and Defend Layers

A **layer** is one step of the calculation, in a fixed order. A layer either **removes** the hit, **reduces** the damage, **scales** it, or **receives** it.

Two words that are constantly confused:

- **Offensive / Defensive** are **Mod pools** — which Mods may roll on which slot.
- **Attack layer / Defend layer** is the **runtime order** — what happens to one number, in sequence.

The order itself is a rule: see `DECISIONS.md`.

# Item and Mod Vocabulary

| Term | Meaning |
|---|---|
| **Mod** | One rolled stat line on an item, read as `name value (Tier)`. |
| **Flat** | A value added straight into the stat, before any % modifier runs. |
| **%** | A multiplier applied to the finished stat. |
| **Stat Mod** | A Mod that is neither Offensive nor Defensive. It rolls any of the seven Core stats, and it rolls on every item. |
| **Frame Mod** | The first line of a dropped item — the frame's own line, rolled from the slot's Frame-Mod pool. |
| **Bound Mod** | The pair of lines after the Frame Mod, fixed at drop. |
| **Unbound Mod** | Every line past the Bound pair — the set the value stones, Add and Remove work on. |
| **Gear Mod** | A piece's own inherent defence value — Armour, Evasion or Energy Shield, decided by its Base school. It is shown on its own top line, inside no Mod list. |
| **Base** | The frame of one slot (`Ring Mail` / `Plate Vest` / `Vestment`). It decides **weight** and which Mods are Primary or Secondary. |
| **Weight** | What an item carries, from its Base, multiplied by quality. Not a rolled value. |
| **Capacity** | How much weight a build can carry, set by Str. |
| **Level floor** | The first level of a band — what an away window (offline) is limited to; the window above it is the band's own ceiling. |

# Stats and Formulas

| Term | Meaning |
|---|---|
| **Core stat** | The seven attributes: str · vit · dex · agi · wis · int · lck. |
| **K value** | The hidden constant that converts a stat into a game value — `K_STR` is physical power a point of Str. |
| **Cap** | The ceiling on a stat, where one exists. Critical chance and Accuracy deliberately have none. |
| **Alignment** | Dex spent twice: the gate **every rolled status** passes — an Element status, bleed, and a stun — **and** the multiplier on an Element status's damage. |
| **Physical power / Magic power** | The damage derived from the character. There is no weapon Base power. |
| **Elemental power** | The third damage path, derived from Int and named by the weapon's own Element. |
| **Current HP cost** | A flat HP amount paid by a skill from the caster's current pool; a press cannot spend its final HP point. |
| **Caster Max HP damage** | The optional `max_hp_pct` term added to a skill's damage basis, read from the caster's Max HP. |
| **hit_chance** | Whether a hit connects at all — the accuracy-versus-evasion ratio. |
| **crit overflow** | Chance past a whole chance becomes crit damage, so stacking more crit is never wasted. |
| **damage taken** | A multiplier on the incoming hit that runs after every mitigation layer and before any pool. |
| **global damage / global defend / global speed** | The three reserved umbrella multipliers (`engine.json` `global`). |

# Combat

| Term | Meaning |
|---|---|
| **Push** | HP reaching zero is **not death**: the fighter is pushed out of combat, rests, then walks back in alone. Time is the only thing this game charges. |
| **Camp** | Short for Field Camp: a player-set safe hex that receives a Push and enables field gathering and cooking. |
| **No death** | The standing rule: defensive value comes from time not lost, not from survival. |
| **DoT** | Damage over time, ticking once a second. |
| **Leech** | HP returned as a percentage of damage just dealt. |
| **Perfect dodge** | Removes the hit outright, and it is not contested. |
| **Reach** | How far a build can act **in a fight**: near and far are a queue, not a range band. |
| **Foe** | The **Field of Enemies** — every mob the character is fighting at once. |
| **Elite** | A flag on a Large body, never a size of its own. |

# Elements and Statuses

| Term | Meaning |
|---|---|
| **Element** | fire · cold · lightning · poison · chaos · earth. One item holds exactly one, and it decides which status the item can inflict. |
| **Innate element** | The Element a mob's race owns (`mob.species[].element`). |
| **burn** (fire) | Damage over time. |
| **chill** (cold) | A cut to the target's attack speed and accuracy. |
| **shock** (lightning) | Stops the target's clock and cuts its attack speed. |
| **poison** (poison) | Stacking damage over time. |
| **mark** (chaos) | A growing multiplier on the hit it rides, plus leech. |
| **bleed** | Physical damage over time. **Not an Element** — no Element tag and no resistance line. |

# Crafting

| Term | Meaning |
|---|---|
| **Reroll** | Re-rolls the value inside a Mod, staying in the same Tier. |
| **Roll new Mod** | Re-rolls a line's **identity**: the Mod is redrawn from the piece's own Base pool. |
| **Polish** | One press over every line of a piece: each value re-rolls inside its own Tier. |
| **Refine** | Raises a Mod one Tier. |
| **Ascend** | Raises Item quality one step for the whole item. |
| **Remove stone** | Deletes one Unbound Mod. |
| **Add stone** | Fills one empty Unbound slot from the piece's own Base pool. |
| **Replace stone** | The chosen swap: the player names the Mod that comes in, drawn from the piece's own pool. |
| **Imprint stone** | Rewrites one Unbound line as the stone's own Mod, with a fresh roll from that Mod's window. |
| **Quality stone** | The only source of Gear Mod points. |
| **Tier stone** | Buys the tier presses. |
| **Value stone** | The cheapest stone, minted by dissolving junk. |
| **Polish stone** | Buys Polish the piece. |
| **Reforge stone** | Buys Reforge the piece: the Tier redrawn across the whole piece. |
| **Rebirth stone** | Buys Rebirth the Unbound lines — the set the piece holds, Add lines included. |
| **Corrupt stone / Repair stone** | The rarest stones in the game. |
| **Upgrade** | Adds Gear Mod points to a piece, one step at a time, with rising failure odds. |
| **Corrupt** | One gamble per piece: a roll that can take the piece somewhere better or ruin it. |
| **Salvage** | Disposal of gear below the filter line, with a milestone payout. |
| **Bag filter** | What makes every drop a decision: **keep** it, **dissolve** it, or **sell** it. |
| **adventure bag** | The bag of kept gear carried while adventuring. |
| **character bag** | The bag of carried consumables, field materials and provisions. |
| **stash** | Settlement storage, organisation only. |
| **herb** | A plant drop, consumed rather than equipped or sold. |
| **field material** | A stack from Mine, Rare Grove or hunting activity, carried in the character bag. |
| **meal** | A cooked food item; eating one replaces the active timed combat buff. |
| **Hunger** | A saved field provision meter. Travel, hunting and gathering spend it; at zero, HP regeneration is reduced, while Energy Shield recharge is unchanged. |
| **Auto Eat** | A saved per-character setting that consumes eligible carried cooked food, then fruit, then edible field herbs at the chosen Hunger threshold. Ingredients are never edible; raw food is opt-in before Hunger is empty and may be used as an empty-Hunger emergency. |
| **provision** | A carried raw food, fruit, edible field herb, cooking ingredient or cooked meal. Their effects and sources are defined in `engine.json` `fieldwork.foods`, `fieldwork.hunt` and `fieldwork.recipes`. |
| **trail event** | An independent travel-block event that can provide food or restore Hunger without replacing the block's ambush roll. |
| **junk** | A flavoured drop from a **variant**, sold to the settlement Counterhand for gold. |
| **variant** | One rung of a species' named ladder (`mob.variants`). |

# Town and Economy

| Term | Meaning |
|---|---|
| **Settlement** | A named place holding services and NPCs, and the state the player is in while there. |
| **Adventure** | The other state: in a zone, fighting and looting. |
| **Capital** | A settlement serving one band with the full service set. |
| **Zone** | The combat area attached to a settlement. |
| **Block** | One hex of the world lattice; a walk is counted in blocks. |
| **Walk** | Crossing blocks from the cell the feet are on to the cell clicked. |
| **Waypoint** | A settlement opened by arriving on foot: after that a warp there is instant. |
| **Hunt** | Leaving safe ground to fight from the cell the feet stand on; sub-zones pick a cast, bare ground hunts the whole zone. |
| **Field Camp** | One player-set safe hex. It enables field gathering and cooking, and receives a Push in its zone. |
| **Mine** | A wild-side fieldwork hex that yields ore while gathering at a Camp. |
| **Rare Grove** | A wild-side fieldwork hex that yields timber and can yield rarewood while gathering at a Camp. |
| **Dungeon run** | A **mode**, not a place: one dungeon per zone, entered at its wild-side index 0. |
| **Escrow** | What a dungeon run holds while it runs: the per-kill rolls banked instead of paid. |
| **Wild side** | The untamed cells on a settlement's own land. |
| **Standing** | A per-settlement unlock counter earned from the flows that already exist. |
| **Gold** | The quality-of-life medium, minted by selling junk. |
| **Collector set** | A named bundle of gear pieces a settlement wants handed in. |
| **Reservation** | An aura holding back a share of Max Mana. |
| **reserve tier** | The share of the pool one aura holds back. |

# Mobs

| Term | Meaning |
|---|---|
| **species** | A creature lineage (Goblin · Golem · Elf). Decides a stat multiplier vector, an accuracy tier and a damage type. |
| **body class** | The four mob sizes — Small · Medium · Large · Boss (`mob.sizes`). |
| **Base school** | The three armour families a Base belongs to: light (Evasion), heavy (Armour), cloth (Energy Shield). |
| **weapon group** | The three families a weapon belongs to: melee, ranged, magic. |
| **mob accuracy** | Derived from the mob's own stats through the same K values the player uses, scaled by the species accuracy tier. |

# Abbreviations

| Term | Abbreviation |
|---|---|
| Attack speed | `aspd` |
| Cooldown reduction | `cdr` |
| Critical chance | `crit` |
| Physical power | `phys` |
| Elemental power | `elem` |
| Damage per second | `DPS` |
| Elemental resistance | `res` |
| Elemental alignment | `align` |
| Accuracy | `acc` |
| Evasion | `ev` |
| Energy Shield | `ES` |
| Max HP | `HP` |
| Max Mana | `mp` |
| Damage over time | `DoT` |
| Experience | `XP` |
