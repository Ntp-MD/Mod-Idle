# Skill Tree — Stream branch

import glossary.md
import skill-pool.md
import elements.md

Part of skill-tree.md — Stream branch detail · Power budget and point rules live in skill-tree.md sections 3-4.

### Stream branch — 41 minor in 5 limbs

**Stack Caps limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Ember Hold | Maximum burn stacks 4 instead of 3 | Flame Lash |
| 2 | Deep Rot | Maximum poison stacks 12 instead of 10 | Toxic Spray |
| 3 | Label Ledger | Target mark stacks count together with attached curses | Pandemonium |
| 4 | Kindling Layer | Targets already burning gain the first stack of another Element one step faster | Elemental Crossfeed |
| 5 | Full Book | If any Element stack is full, the excess converts to half chaos stacks | Void Lance |
| 6 | Overstuffed | Every 3 stacks beyond Cap compress 1 stack down to 2 instead of disappearing | Burning Focus |
| 7 | Slow Ledger | Non-full stacks expire one-third slower | Venom Bind |
| 8 | Ledger of Ash | Burns expiring naturally on a dead target count as 1 stack on the nearest unit | Spreading Burn |
| 9 | Twin Brands | Burn and poison on the same target immediately count as "two Elements" | Elemental Crossfeed |

**Duration limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Long Fuse | Burn duration on immobilised targets does not tick down | Burning Focus |
| 2 | Spreading Warmth | Targets dying to DoT pass 25% of remaining time to neighbors | Spreading Burn |
| 3 | Cold Keeps | Chill on bosses expires at half the normal rate | Frost Nova |
| 4 | Slow Burn Debt | Each DoT tick of one stack refunds 0.2 sec duration | Bloodletting |
| 5 | Preserve Rot | Poison does not expire while the player is pushed | Venom Bind |
| 6 | Marked Forever | Curses from Mark of the Executioner persist even after the target dies (counts as 1 zone mark stack) | Pandemonium |
| 7 | Ember Bank | Remaining burn time on a dead target is banked for the next target within 4 sec | Flame Lash |
| 8 | Standing Chill | Chill is not removed when the target is shattered but drops to 1 step | Shatter |
| 9 | Late Reckoning | Over-Cap DoT instances extend duration instead of being discarded | Burning Focus |

**Spread limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Carry the Torch | Hitting a burning target sends 1 stack to the farthest unit in the group | Spreading Burn |
| 2 | Even Spread | AoE missing all 3 targets sends the difference to already-afflicted units instead | Volley |
| 3 | Second Hand | Curses on corpses still count as "alive" for spread rules | Pandemonium |
| 4 | Ring of Marks | Targets next to a DoT-ticking unit also gain stacks (1 stack only) | Chain Spark |
| 5 | Shared Fate | If 2 targets in a group share the same Element, their stacks share a combined Cap | Elemental Crossfeed |
| 6 | Leaky Chains | Shock from consecutive hits sends 1 instance to neighbors | Chain Spark |
| 7 | Crowd Control | Groups larger than 3 count as 3 for AoE (enabling other rules) | Whirlwind |

**Elemental Gating limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Tuned Rod | An already-confirmed Element counts double Dex Alignment for that Element only | Elemental Attunement |
| 2 | Two Tongues | With two Elements in the set, the secondary Element gate is one step stronger | Elemental Crossfeed |
| 3 | Untethered | Void Lance skips hit_chance rolls when the target carries another Element curse | Void Lance |
| 4 | Cold Reception | Res pierced by Sunder counts as an "open slot" status (feeds Shatter) | Sunder |
| 5 | Spark Conductor | Shocked targets count as wet for other Element rules | Chain Spark |
| 6 | Rot Contract | Poison at 6 stacks lowers target res one step until it expires | Toxic Spray |
| 7 | Ash Sign | Burns expiring naturally (not dispelled) leave 1 mark stack | Flame Lash |
| 8 | Balance Keeper | If one Element res exceeds 60%, move the excess to the lowest Element in the group | Herald of Frost |
| 9 | Two Key Turn | If a target carries two curses at once, the secondary Element gate counts a full step | Elemental Crossfeed |

**Tick Rules limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Tick Counter | Every 8 DoT ticks count as 1 hit for count-based procs (small but clear) | Bloodletting |
| 2 | Early Harvest | Bloodletting fires 2 times per press instead of 1 | Bloodletting |
| 3 | Tick Debt | Pressing a new DoT on a Cap-full target doubles the next tick | Toxic Spray |
| 4 | Slow Release | DoT of targets dying before expiry spreads to others per remaining time | Spreading Burn |
| 5 | Double Dip | If a target has two-Element DoT, the next tick of each fires together | Elemental Crossfeed |
| 6 | Idle Burn | DoT keeps running 1 sec after target death (counts as stacks for the next unit) | Burning Focus |
| 7 | Quiet Rot | DoT does not break the "first unit" stealth rule in a group | Puncture |

> This table is the *output of the data in* `tools/tree.js` · Edit there and run `node tools/tree.js --checks` before re-laying. Never hand-type
