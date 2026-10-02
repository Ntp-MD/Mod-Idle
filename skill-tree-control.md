# Skill Tree — Control branch

import glossary.md
import skill-pool.md

Part of skill-tree.md — Control branch detail · Power budget and point rules live in skill-tree.md sections 3-4.

### Control branch — 40 minor in 5 limbs

**Time of Others limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Deep Frost | Chill reduces player aspd only 5% (from 10%) | Herald of Frost |
| 2 | Slow Hands | Chilled targets join our attack queue one slot slower | Frost Nova |
| 3 | Static Leash | Shock from 3 consecutive hits lasts 2 sec instead of 1 | Chain Spark |
| 4 | Cold Debts | If a boss is chilled 3 times, skills with 1 sec cd left drop 1 sec | Deep Pockets |
| 5 | Turn Aside | A successful dodge makes the target lose 1 attack beat | Guardian's Veil |
| 6 | Stalled | Unstunnable targets (bosses) instead count as "heavily chilled" | Focus |
| 7 | Hourglass | Every 30 sec of the same fight, all skill cds drop 1 sec once | Battle Orders |
| 8 | Second Breath | Buffs pressed while pushed count as presses that do not consume that round cd | Greater Heal |
| 9 | Borrowed Second | If a target dies before hitting us, that attack converts to +0.5 sec for remaining buffs | War Cry |

**Stun and Alignment limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Stagger Train | Alignment stuns count as hits (feed procs) even without damage | Focus |
| 2 | Heavy Ledger | Targets stunned within the last 10 sec count as one-step cursed | Jinx |
| 3 | Clean Line | If Alignment reaches 45%, the next stun lasts 2x (stun still under Cap) | Elemental Break |
| 4 | Off Balance | Targets carrying any curse count our dodge chance lower for themselves | Riposte |
| 5 | Chain of Slows | A second stun on the same target within 8 sec reduces its aspd instead (does not reset time) | Cripple |
| 6 | Guard Breaker | One pierced Elemental res makes the next Alignment count full | Void Lance |
| 7 | Patient Pressure | Each time a target breaks stun, add 1 mark stack | Mark of the Executioner |

**Aura Economy limb** (7 nodes · Tier 1 = at hub, Tier 7 = limb end)

> **Broken by reservation + the 6→12 aura redesign** — 4 of these 7 nodes describe a drain mechanic that no longer exists, and the old 6 auras were replaced by the new 12 (`skill-pool-aura-heal.md` · Decision 1). `checks.md` D19 requires every node to name a real skill, so this limb must be rewritten before the tree is consistent. Rows marked **no subject** have nothing left to act on; rows marked **dead name** point at an aura that no longer exists. Replacement nodes are content work and are not drafted here.

| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Lean Field | First aura in the list reserves 2 points less | Clarity |
| 2 | Priority Line | **No subject** — auras cannot drop, so nothing needs protecting | — (limb pending rewrite) |
| 3 | Shared Load | **Dead name** — "two auras of the same weapon group" has no subject, because the new 12 auras have no weapon group | — (limb pending rewrite) |
| 4 | Frost Reservoir | Herald of Frost chill persists 2 sec after the aura ends | Herald of Frost |
| 5 | Dread Radius | **Dead name** — Aura of Dread does not exist in the new 12 | — (limb pending rewrite) |
| 6 | Second Wind of Mana | **No subject** — auras no longer drop at low mana | — (limb pending rewrite) |
| 7 | Clear Head | **No subject** — "closed manually vs dropped from mana" no longer distinguishes anything | Clarity |

**Buff Economy limb** (8 nodes · Tier 1 = at hub, Tier 8 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Kept Warm | Buffs expiring while pushed restart counting instead of disappearing | Stone Skin |
| 2 | Effort Saved | Re-pressing an unexpired buff costs no mana (counts as a 3-sec extension) | Deep Pockets |
| 3 | Stacked Orders | Battle Orders and Flurry can run together with combined effect under the CDR Cap | Battle Orders |
| 4 | Slow Ticking Patience | All buffs in the list gain +2 sec per buff with under 4 sec remaining | War Cry |
| 5 | One for the Road | If a buff expires mid-hit, its effect persists 1 more instance | Blood Pact |
| 6 | Second Helpings | Buffs re-pressed within 4 sec before expiry count as presses that do not consume cd | Stone Skin |
| 7 | Lean Rotation | If the list holds over 3 buffs, the 4th onward cost half mana | Deep Breath |
| 8 | Held Line | Iron Will counts cursed targets as "already guarded", no re-press needed | Iron Will |

**Mana and Queue limb** (9 nodes · Tier 1 = at hub, Tier 9 = limb end)
| Tier | Node | Changed rule | Enables |
|---|---|---|---|
| 1 | Deep Well | Mana pool also counts Vit x 1 as mana (giving Vit work beyond HP) | Stone Skin |
| 2 | Charging Order | Skills with cd ready but insufficient mana charge mana ahead of others in the list | Clarity |
| 3 | Cheap Shots | Piercing Shot and all 1/1 skills cost 15% less mana | Cheap Casting |
| 4 | Queue of Two | Allows two skills to hold ready cd without pressing yet (prevents cd waste) | Flurry |
| 5 | Cast Reserve | Always reserve at least 12% mana for heal; the rest can be fully spent | Heal |
| 6 | Spent Wisely | If a pressed skill is fully dodged, refund half its mana | Cunning |
| 7 | Idle Hands | Non-crit auto hits refund 0.3% of pool as mana | Deep Breath |
| 8 | Short Fuse | Cunning triggers at 30% mana instead of 25% but bonus drops to 20% | Cunning |
| 9 | Open Queue | If the top skill in the list is on cd, the second may fire early without counting as queue-skipping | Flurry |

> This table is the *output of the data in* `tools/tree.js` · Edit there and run `node tools/tree.js --checks` before re-laying. Never hand-type
