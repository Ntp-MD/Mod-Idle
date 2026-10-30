# Glossary

Short definitions of game terms. Read only the terms needed for the task. Document ownership and update policy: [AGENTS.md](../AGENTS.md#document-map).

## The 2 Layers of an Item

| Term | Meaning |
|---|---|
| **Item level** | The level a piece dropped at — the one axis its Mod values ride. |
| **Band** | low · mid · high — the label the drop source's zone already carries. |
| **Tier** | Which third of a Mod's value window the roll landed in. One item carries one Tier set, shared by all its Mods. |

## Attack and Defend Layers

A **layer** is one step of the calculation, in a fixed order. A layer either **removes** the hit, **reduces** the damage, **scales** it, or **receives** it.

Two words that are constantly confused:

- **Offensive / Defensive** are **Mod pools** — which Mods may roll on which slot.
- **Attack layer / Defend layer** is the **runtime order** — what happens to one number, in sequence.

## Item and Mod Vocabulary

| Term | Meaning |
|---|---|
| **Stat** | A numeric value that measures or affects a character's or mob's capabilities; includes Core attributes and derived stats. |
| **Mod** | One rolled stat line on an item, read as `name value (Tier)`. |
| **Flat** | A value added straight into the stat, before any % modifier runs. |
| **%** | A multiplier applied to the finished stat. |
| **Stat Mod** | A Mod that is neither Offensive nor Defensive. It rolls one or all of the seven Core attributes, and it rolls on every item. |
| **Frame Mod** | The first line of a dropped item — the frame's own line, rolled from the slot's Frame-Mod pool. |
| **Weapon type** | The held weapon family that sets its attack tempo, damage multiplier, skill pool and bound skills. |
| **Weapon frame** | A named variant inside a weapon type. It fixes that drop's Frame Mod identity and carries its own drop weight and value bias. |
| **Bound Mod** | The pair of lines after the Frame Mod, fixed at drop. |
| **Unbound Mod** | Every line past the Bound pair — the set the value stones, Add and Remove work on. |
| **Gear Mod** | A piece's own inherent defence value — Armour, Evasion or Energy Shield, decided by its Base school. It is shown on its own top line, inside no Mod list. |
| **Base** | The frame of one slot (`Ring Mail` / `Plate Vest` / `Vestment`). It decides **weight** and which Mods are Primary or Secondary. |
| **Weight** | What an item carries, from its Base, multiplied by quality. Not a rolled value. |
| **Capacity** | How much weight a build can carry, set by Str. |
| **Level floor** | The first level of a band — what an away window (offline) is limited to; the window above it is the band's own ceiling. |

## Stats and Formulas

| Term | Meaning |
|---|---|
| **Core attribute** | One of the seven foundational values: Str · Agi · Vit · Dex · Int · Wis · Lck. |
| **Derived stat** | A combat value calculated from Core attributes and other inputs such as level, gear or effects. |
| **K value** | The hidden constant that converts a Core attribute into a game value — `K_STR` is physical power a point of Str. |
| **Cap** | An upper limit applied to a value. |
| **Alignment** | Dex spent twice: the gate **every rolled status** passes — an Element status, bleed, and a stun — **and** the multiplier on an Element status's damage. |
| **Physical power / Magic power** | The damage derived from the character. There is no weapon Base power. |
| **Elemental power** | The third damage path, derived from Int and named by the weapon's own Element. |
| **Current HP cost** | A flat HP amount paid by a skill from the caster's current pool; a press cannot spend its final HP point. |
| **Caster Max HP damage** | The optional `max_hp_pct` term added to a skill's damage basis, read from the caster's Max HP. |
| **hit_chance** | Whether a hit connects at all — the accuracy-versus-evasion ratio. |
| **crit overflow** | Chance past a whole chance becomes crit damage, so stacking more crit is never wasted. |
| **damage taken** | A multiplier on the incoming hit that runs after every mitigation layer and before any pool. |
| **global damage / global defend / global speed** | The three reserved umbrella multipliers (`engine.json` `global`). |

## Combat

| Term | Meaning |
|---|---|
| **Push** | HP reaching zero is **not death**: the fighter is pushed out of combat, rests, then walks back in alone. Time is the only thing this game charges. |
| **Camp** | Alias for **Field Camp**. |
| **No death** | The standing rule: defensive value comes from time not lost, not from survival. |
| **DoT** | Damage over time, ticking once a second. |
| **Leech** | HP returned as a percentage of damage just dealt. |
| **Setup / payoff** | A setup row applies a status; a payoff row reads or spends that same status for its own effect. |
| **Status present** | An auto-cast leg that holds a payoff row until the target carries the status the row exploits; `statusStacksAtLeast` adds a stack floor. |
| **Consume** | Spending a status's stacks for extra damage. The press removes only the stacks it spends, after the hit. |
| **Spread** | Copying a live status line to another target. The copy keeps its stacks and remaining life and starts no new clock. |
| **Retired skill** | A legacy row kept resolvable for old saves but excluded from drops, named rewards and the live roster. |
| **Perfect dodge** | Removes the hit outright, and it is not contested. |
| **Reach** | How far a build can act **in a fight**: near and far are a queue, not a range band. |
| **Foe** | The **Field of Enemies** — every mob the character is fighting at once. |
| **Elite** | A flag on a Large body, never a size of its own: a rank over the rolled variant, keeping its name. |

## Skills

One skill sheet row is one canonical [tools/data/skills.json](../tools/data/skills.json) entry. [engine/skills.ts](../engine/skills.ts) is the only calculator, shared by the client and the cages; each column's owner is that file plus [engine/types.ts](../engine/types.ts), and the player-facing explanation is generated from [game/src/wiki/pages.ts](../game/src/wiki/pages.ts).

| Term | Meaning |
|---|---|
| **Skill** | The row's canonical key (`id`) and name. A retired key stays resolvable for old saves. |
| **Type** | What a press does: attack · buff · curse · heal · aura. |
| **attack** | Joins the order list and pays cooldown + Mana. |
| **buff** | A timed self-buff with `duration`; it ends between fights. |
| **curse** | A status attached to the target; it uses the same `hit_chance` as an attack. |
| **heal** | Uses the order list but lands on the player, never on a mob. |
| **aura** | Reserves a share of Max Mana instead of paying a cooldown. |
| **Shape** | Impact-area form: circle (default) · cone (`angle_deg`) · line (`length_m` × `width_m`). |
| **Delivery** | How the hit arrives: instant · melee · projectile · ground. It selects the default cast time, recovery, impact delay, projectile speed and hit radius from `meta.action_profiles`; a row may override. |
| **Target** | The roster label the player sees (`Single Enemy` / `Enemies in Area` / `All Enemies Around Me` / `Self`). It approximates the offline queue, not the live impact area. |
| **Anchor** | Impact-area anchor: caster (around self; a body entering `radius_m` trips the cast) or target (acquire within `cast.range_m`, then resolve around the committed centre). |
| **Range** | Targeting reach in meters. A line row uses `length_m`; a caster-anchor row uses `radius_m`. |
| **Area of effect** | Circle radius — or the chain range on a `chain-strike` row. A positive radius hits every living centre with no count cap; zero radius with a line still hits every body on the line; zero radius with no shape is the primary only. |
| **Cooldown** | Base cooldown in seconds: `cd × (1 − cdr%) × (1 − ladder%)`, where ladder is the duplicate-ladder cut. It ticks on the cooldown haste lever. |
| **Mana** | Flat per-press price (or `hp_cost`, never both) after the canonical level cost step. One price covers any number of targets; a cancelled cast pays nothing. |
| **Hits** | How many times one press lands, set by `action` + `effects` (`hits` / `hit_pct` / damage over time) and rendered by `hitLineOf`; never hand-written. |
| **Duration** | How long a buff or field lasts, from the row's own duration. Haste scales effect strength, never duration. |
| **Cast time** | The time from press to release (`cast.windup_sec`): `fixed + variable`. Only the variable part compresses under haste. |
| **Fixed** | The cast-time floor (`cast.fixed_windup_sec`): no bonus from any source reduces the total cast time below it. |
| **Recovery** | Post-release delay on its own haste lever. It blocks the next primary cast but never re-prices it. |
| **Targeting range** | Which primary a cast may pick up: `cast.range_m`, line `length_m`, or caster `radius_m`. |
| **Impact area** | The committed shape + centre + direction that decides which bodies an impact tests. It is fixed at release from live positions. |
| **Chain range** | Chain rows only: how far the next contact may jump (`area.radius_m`); nearest unused living body, one cost and cooldown. |
| **Chain continuation** | A `chain-strike` press continues after each resolved attempt, even a miss, under one per-tick trigger guard. |
| **Cluster** | A `cluster-burst` press: after the parent impact, children leave at ±`spread_deg` with the parent's travel and delay. Children may overlap and roll independently; kill credit stays once. Implemented, but no live row uses it. |
| **Homing** | A `targeted-burst` payload that tracks the body bound at release within its pursuit bounds; a dead or returned target fizzles the rest. Straight payloads keep the release aim instead. |
| **Staged impact** | An action that spawns its impacts instead of resolving one hit — projectile/ground bursts, channels, lingering fields, chains or targeted bursts — under one cost and cooldown, sharing one roll/effect cache unless the row opts into independent rolls. |
| **hit class** | The dodge tax on an incoming hit: attack (Evasion) · spell (Spell Dodge) · none. Authored per row — never inferred from type, basis, Element or delivery. |
| **Spell Dodge** | The tree-only roll for `spell` hit-class hits; base zero, capped in `engine.json`. Perfect Dodge and Ghost Dance apply; `ignores_dodge` bypasses it. Player casts still use the mob's authored dodge. |
| **Release-aimed** | A mob projectile or ground cast reads its source and destination at release, so it can follow the target's current position. |
| **Cast-time-locked** | A mob charge travels to the point frozen during the cast time, never to the player's new feet. |

## Field and HUD

| Term | Meaning |
|---|---|
| **Player Vital Card** | The player identity, vitals and combat-feedback component. |
| **Commands dock** | The HUD group for game speed and pause/resume controls. |
| **Menu hub** | The HUD group for navigation and field controls. |
| **Objectives** | The HUD feed for the run target and tracked Delivery wants. |

## Elements and Statuses

| Term | Meaning |
|---|---|
| **Element** | fire · cold · lightning · poison · chaos · earth. One item holds exactly one, and it decides which status the item can inflict. |
| **Innate element** | The Element a normal or Elite mob inherits from its Species (`mob.species[].element`); a zone Boss may declare its own (`mob.bosses[].element`). |
| **burn** (fire) | Damage over time. |
| **chill** (cold) | A cut to the target's attack speed and Armour. No accuracy cut. |
| **shock** (lightning) | Cuts accuracy and stops the clock for 0.5 sec, under the control budget. |
| **crippled** (earth) | Cuts outgoing direct damage by 20%. No attack clock or cooldown cut. |
| **stun** | Not a status: a stop proc that reuses the shock stop. |
| **poison** (poison) | Stacking damage over time. |
| **mark** (chaos) | A growing multiplier on the hit it rides, plus leech. |
| **bleed** | Physical damage over time. **Not an Element** — no Element tag and no resistance line. |

## The passive tree

| Term | Meaning |
|---|---|
| **Region** | One of the tree's seven attribute areas — Str, Agi, Dex, Int, Wis, Vit, Lck. Each opens from Start and connects to neighbouring regions through the shared network. |
| **Node** | One thing the tree grants: a Core attribute, a Notable profile, or a Keystone mechanic. Every node has one rank. |
| **Rank** | One step of a node; a rank is bought at the node's own cost and the tree's current nodes each hold one. |
| **Normal** | A node that grants exactly +1 of its region's Core attribute, for 1 tree point. |
| **Notable** | A node that grants a profile of two or three flat / percent lines, for 3 tree points. |
| **Junction** | A Notable that bridges two neighbouring regions. |
| **Keystone** | A node that changes a mechanic, for 1 attainment point. It is grantless unless its effect adds a stat, and it may be incompatible with another Keystone. |
| **Incompatibility** | A listed pair of Keystones that may not be held together. Exclusivity is pairwise only; there are no groups. |
| **Attainment point** | The tree's second currency. A completed Delivery contract pays one; keystones are bought with them. |
| **Tree point** | The ordinary tree currency: a base plus the level curve, plus Town/Delivery quest bonuses, less what the ranks spent. |
| **Quest tree bonus** | An extra tree point stored in a Town task or Delivery offer at generation; it is paid once, when the reward is actually claimed. |
| **Low Life** | Current HP at or below half of **Full Max HP**. A reservation that lowers usable HP does not cause it; Chaos Inoculation is never Low Life. |
| **Full Max / usable** | Full Max is the pool before reservation; usable is what healing and spending may reach. Reservations lower usable only. |

## Crafting

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
| **Value stone** | A stone spent on rerolling Mod values. |
| **Polish stone** | Buys Polish the piece. |
| **Reforge stone** | Buys Reforge the piece: the Tier redrawn across the whole piece. |
| **Rebirth stone** | Buys Rebirth the Unbound lines — the set the piece holds, Add lines included. |
| **Corrupt stone / Repair stone** | Stones spent on the Corrupt and Repair presses. |
| **Upgrade** | Adds Gear Mod points to a piece, one step at a time, with rising failure odds. |
| **Corrupt** | One gamble per piece: a roll that can take the piece somewhere better or ruin it. |
| **Salvage** | Dismantling gear into base ore and Scrap; it does not directly mint a Value stone. |
| **Scrap** | The material produced by Salvage and consumed by Alchemy to make Value stones. |
| **Alchemy** | A settlement recipe that immediately converts Scrap into Value stones and advances Alchemy-based Tier milestones. |
| **Bag filter** | What makes every drop a decision: **keep** it, **dissolve** it, or **sell** it. |
| **bag** | What the character carries: kept gear (one piece a slot) and carried consumable, field-material and junk stacks, all counted against one slot pool. |
| **stash** | Settlement storage, organisation only. |
| **herb** | A gathered or farmed plant used for brewing/cooking or sold as a trade good. |
| **field material** | A carried stack produced by Mine, Rare Grove, Smithing or hunting activity. |
| **Fishing** | A timed gathering activity at a Field Camp in a zone with an authored fishing source. |
| **Smithing** | Settlement recipes that process ore and timber into metal or components; it does not craft gear. |
| **Forge** | A settlement service that turns one material into a chosen weapon or armour piece. The material's family picks the Base or weapon Frame; its grade sets the item band. |
| **Pattern** | One Forge output shape: an armour slot or a weapon type. Its material family and count come from `engine.json` `forge`. |
| **Material grade** | The 1–3 tier of a Forge material. It selects the item band and the character/smithing gates; higher grades need higher levels. |
| **Material family** | The Forge grouping that selects a Base school or weapon frame set: metal, wood, organic or essence. |
| **meal** | A cooked food item; eating one replaces the active timed combat buff. |
| **Hunger** | The character's food/provision meter. |
| **Auto Eat** | Automatic consumption of carried provisions to restore Hunger. |
| **provision** | Carried food or cooking ingredients. |
| **trail event** | An independent travel-block event that finds the current zone's regional food or restores Hunger; it never fields a mob group. |
| **trail site** | An authored optional map stop offering a one-time regional provision bundle or Hunger restoration. |
| **scouted block** | A block whose landmark and encounter details have been learned by approaching it or through a Camp encounter's survey. |
| **explored block** | A block the character has stood on; the map journal remembers it across saves. |
| **junk** | A flavoured drop from a **variant**, sold to the settlement Counterhand for gold. |
| **trade good** | Carried junk, material, provision or farm herb that a town Counterhand buys; ingredients can instead be kept for their recipes and field uses. |
| **Demand** | A town's unfilled appetite for one goods category. Supplying it lowers that category's premium until demand recovers over game time. |
| **Supply** | The saved base value already delivered into a town's category demand pool; it is shared across items in that category. |
| **Workshop** | A settlement service that consumes gathered materials to make finished trade goods and grants the recipe's field skill XP. |
| **variant** | One named form of a Species (`mob.variants`): it owns a level band, authored Core allocation, may override the Species' default damage type, and selects its junk row. A Species may author any number of Variants. |
| **unique** | A named wild boss belonging to a Species (`mob.uniques`): an optional rare upgrade of a normal spawn. A Species can have none or several. |
| **mob kit** | The optional list of mob skills one spawn resolves from `tools/data/mob-skills.json`, capped at 4. Resolution is an override, never a merge: Unique > Boss > Variant > Species. A Species without a kit keeps its basic swing. |
| **aura scope** | Where a mob aura applies: `engaged` affects the front three bodies of the group; `line` affects only bodies on the source's own formation line. Strongest wins and copies do not stack. |

## Town and Economy

| Term | Meaning |
|---|---|
| **Settlement** | A named place holding services and NPCs, and the state the player is in while there. |
| **Adventure** | The other state: in a zone, fighting and looting. |
| **Capital** | A settlement serving one band with the full service set. |
| **Zone** | The combat area attached to a settlement. |
| **Block** | One hex of the world lattice; a walk is counted in blocks. |
| **Walk** | Crossing blocks from the cell the feet are on to the cell clicked. |
| **Waypoint** | A settlement opened by arriving on foot: after that a warp there is instant. |
| **Forward** | Auto-walk to the next already-open settlement when the current zone's level band is behind; new settlements still need a first walk. |
| **Patrol** | An optional walk-and-hunt circuit through named subzones in one visited zone. |
| **Expedition** | A Guild task targeting one Species' Elites in one subzone. |
| **Auto-Return** | Optional Patrol help that walks to town once the bag nears full, stashes unlocked pieces, and resumes the saved route when space was freed. It never sells or discards gear. |
| **Hunt** | Leaving safe ground to fight from the cell the feet stand on; sub-zones pick a cast, bare ground hunts the whole zone. |
| **Field Camp** | One player-set safe hex. It enables field gathering and cooking, and receives a Push in its zone. |
| **Mine** | A wild-side fieldwork hex that yields ore while gathering at a Camp. |
| **Rare Grove** | A wild-side fieldwork hex that yields timber and can yield rarewood while gathering at a Camp. |
| **Dungeon run** | A **mode**, not a place: one dungeon per zone, entered at its wild-side index 0. |
| **Retreat** | Leaving a dungeon run with a subset of its escrow loot. |
| **Escrow** | What a dungeon run holds while it runs: the per-kill rolls banked instead of paid. |
| **Wild side** | The untamed cells on a settlement's own land. |
| **Standing** | A per-settlement tier earned from kills in that settlement's zone; it unlocks listed town services and Collector set turn-ins. |
| **Gold** | The town-spending medium earned by selling trade goods and completing delivery wants. |
| **Haggling** | Town trading progression, separate from combat skills, Standing and life-skill Mastery. |
| **Delivery want / Delivery Contract** | A timed town request for a named good and quantity, with a completion reward. |
| **Track** | An informational reminder for an open Delivery want. |
| **Delivery clock** | The simulation clock used for Delivery deadlines. |
| **Delivery recap** | The saved outcome and proceeds of a Delivery want. |
| **Black Market** | The town stall selling rare goods and named Skill XP Levels for Gold. |
| **Skill XP Level** | A combat skill's own XP-based level, distinct from the Duplicate Ladder and life-skill Mastery. |
| **Collector set** | A named bundle of gear pieces a settlement wants handed in. |
| **Reservation** | An aura holding back a share of Max Mana. |
| **reserve tier** | The share of the pool one aura holds back. |

## Mobs

| Term | Meaning |
|---|---|
| **Race** | The broad fantasy grouping above Species (`mob.races`, assigned by `mob.species[].race`), such as Humanoid, Undead or Beast. Race membership is taxonomy and does not grant mechanics by itself. It is the single word used in data, code, cages and player text. |
| **Species** | One individual creature lineage, such as Goblin, Orc or Golem (`mob.species`). A Species belongs to one Race and owns its gameplay data. |
| **body class** | The four mob sizes — Small · Medium · Large · Boss (`mob.sizes`). |
| **Base school** | The three armour families a Base belongs to: light (Evasion), heavy (Armour), cloth (Energy Shield). |
| **weapon group** | The three families a weapon belongs to: melee, ranged, magic. |
| **mob accuracy** | Derived from the mob's own stats through the same K values the player uses, scaled by the Species accuracy tier. |

## Abbreviations

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
