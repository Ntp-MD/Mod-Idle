# Skill Tree — Impact branch

import glossary.md
import skill-pool.md

Part of skill-tree.md — Impact branch detail · Power budget and point rules live in skill-tree.md sections 3-4.

### Impact branch — 41 minor in 5 limbs

**Hit Counting limb** (10 nodes · Tier 1 = at hub, Tier 10 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Second Contact | First hit on a target does not count as a stack for Brute | Brute |
| 2 | Even Hand | Every 4 hits on the same target = 1 double-counted hit (counted procs gain 2) | Sonic Blow |
| 3 | Open Wound | Full-HP targets join the same hit-count queue as others | Brute |
| 4 | Chain of Blows | First skill instance of a round counts as the closing hit of the previous round | Sonic Blow |
| 5 | Steady Tempo | If hits are no more than 1 sec apart, count as short hits (feeds counter faster) | Flurry |
| 6 | Rebound Count | 1 dodged hit counts as 2 hits for counters not yet reset | Counter |
| 7 | Debt Paid | When the counter completes 5, reset only half instead of all | Sonic Blow |
| 8 | Twin Mark | Simultaneous hits on 2 targets count together as one block | Whirlwind |
| 9 | Cold Reading | If a target fails to dodge twice in a row, the proc counter advances one step faster | Sonic Blow |
| 10 | Last Word | Final hit before a target dies counts as 2 | Overkill |

**Crit Conditions limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Read the Guard | Crits against any cursed target can exceed the normal crit-chance Cap by 5% | Jinx |
| 2 | Cold Blooded | Chilled targets count as below-half-HP targets | Shatter |
| 3 | Patient Hunter | If 3 hits in a row do not crit, the next one counts double crit chance | Headshot |
| 4 | Heavy Entry | First hit after entering a new group is guaranteed to crit | Execute |
| 5 | Split Attention | Crits on a target with multiple units in range count as double crits for counters | Sonic Blow |
| 6 | Fool Errant | If the target successfully dodges, the player next crit is one step stronger | Counter |
| 7 | Clean Kill | A crit that kills a target instantly does not reset build counters | Brute |
| 8 | Second Sight | Crit chance of the first skill instance per round gains extra from Alignment | Focus |
| 9 | Margin Call | If crit chance exceeds 45%, move half the excess to crit damage instead | Reaver's Edge |

**Single Target limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Duelist Poise | If only one target is in range, held weight ignores half its tax | Ancestral Pace |
| 2 | Narrow Focus | Skills marked 1/1 in the targets/hits column gain 1 extra instance | Headshot |
| 3 | Settled Stance | After standing still over 3 sec, player-side dodges do not affect our hit chance | Piercing Shot |
| 4 | Weight of One | First-hit damage against a new target rises one step per purchased Tier | Weighted Edge |
| 5 | No Waste | Excess (overkill) damage on single-target hits is not lost but converts to mark stacks | Overkill |
| 6 | Locked In | While attacking the same target over 5 sec, chill effects on us are halved | Iron Will |
| 7 | One Cut Deep | Each time a target breaks immobilise, the next hit counts as 2 instances | Riposte |

**Finish Thresholds limb** (8 nodes · Tier 1 = at hub, Tier 8 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Low Tide | "Low HP" threshold of all rules moves from 20% to 25% | Execute |
| 2 | Counting Coup | If a target dies to a non-final skill hit, the Brute counter does not reset | Brute |
| 3 | Gravedancer | Below-threshold targets also count as cursed targets | Mark of the Executioner |
| 4 | Clean Finish | A one-shot kill (without passing the low-HP threshold) grants the same bonus as using a Finisher | Finishing Blow |
| 5 | Borrowed Time | If we are pushed in a fight where target HP is below threshold, that skill cd drops 25% | Deep Pockets |
| 6 | Second Last Chance | Last Stand triggers at 40% HP instead of 30% | Last Stand |
| 7 | Final Word | Final instance of a multi-hit skill uses the target HP threshold from before the press, not after | Arrow Shower |
| 8 | Reserve Stroke | If a skill is blocked for lack of mana, the next auto hit counts as 1 instance of that skill | Execute |

**Retaliation limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Thorn Mail | Noble Phantasm reflection counts as a hit for per-hit procs | Noble Phantasm |
| 2 | Read and Reply | If hit twice in a row without dodging, the next dodge is guaranteed | Guardian's Veil |
| 3 | Hard Shell | Cut weight tax converts to half damage reflection instead | Anchor |
| 4 | Provoking Stance | A target that first hits us counts as afflicted with an "interested in us" curse (feeds Jinx) | Jinx |
| 5 | Even Score | A successful dodge reduces next incoming damage one step instead of having no effect | Counter |
| 6 | Blood Price | While HP is below threshold, Blood Pact effects move to reflected hits | Blood Pact |
| 7 | Still Standing | If never pushed for the whole fight, Anchor EHP gains +50% of itself | Anchor |

> This table is the *output of the data in* `tools/tree.js` · Edit there and run `node tools/tree.js --checks` before re-laying. Never hand-type
