# Proposals — ideas still being argued

> ⚠️ **Nothing on this page is decided.** Do not cite it from anywhere else. When one of these gets
> settled it moves into the wiki proper and disappears from here.
>
> [index](../index.md)

B1 · B2 · B3 · B4 · B5 · B7 · B8 · B9 · B10 · B11 · B12 have all moved into [04-items](../04-items/items-and-slots.md) — the hand system, eleven weapons, ten affix kinds, six accessory slots, rarity and the no-auto-equip rule.

---

## B6 — three loose ends in the zone spec

| # | What | Where |
|---|---|---|
| 1 | the ten-zone table has **no window-kind column**, so a reader has to guess which axis each zone is for — and guesses wrong, which is exactly the bug that gave one axis 7 of 8 zones | [zones](../01-world/regions/zones-and-monsters.md) |
| 2 | the **pack layer belongs to CADENCE or MASTERY** — flagged as a MISMATCH in the old measurement and never resolved | same file |
| 3 | **`MAG-CAP` had no threshold.** The old rule said 1.5× maxHit, which gives about 23% DR, not the 50% it was trying to prevent. A derivation now exists at ~20× maxHit | [balance notes §2](../10-design/balance-notes.md) |

Number 3 has been resolved and is no longer a loose end.

---

## B13 — drop rate scales with clear rate

*(decided as a direction, the numbers are not)*

**The idea:** if you keep failing to clear a zone, your drop rate falls. Better gear restores it. Defensive stats therefore become an upgrade requirement instead of decoration.

### The shape

```
clear rate = your kph ÷ the zone's threshold

   clear rate >= 1.0   ->  full drop rate
   clear rate <  1.0   ->  drop rate falls in proportion

drop multiplier = clear rate ^ k        (k unknown)
```

### Why this works where a straight death penalty does not

```
easy zone  ->  you do not fail  ->  full drops  ->  but low-tier loot
hard zone  ->  you fail a lot   ->  fewer drops ->  but high-tier loot
```

Both cannot be had at once, so the player is **choosing where to take losses** rather than avoiding loss. That is a real decision, and it escapes the loop where "stay in the safe zone forever" is optimal.

### "Losing" must not mean dying

D3 says there is no death offline. If the penalty hangs on death then:
- it can never trigger offline, because death cannot happen offline
- defensive stats become relevant only while awake, which is the smallest slice of an idle game

→ **A loss is defined as failing to clear the zone in time, not as dying.** The player can already read it off the kph figure the UI shows.

### It fits `CONTENT-TWOTIER` instead of fighting it

`CONTENT-TWOTIER` keeps every loadout inside ~20% of optimum in idle-safe zones. So `clear rate` sits around 0.8-1.0 there, and at k=1 the worst case is a 20% drop penalty.

**One number, two uses:** the −20% budget that already bounds rate loss now also bounds drop loss. Idle-safe goes from *no penalty* to *at most 20%*, which is inside the budget it already had.

### What it fixes

1. **The defensive affix half stops being worthless.** `hp` / `def` / `eva%` raise your clear rate, which raises your drops. See [affixes.md](../04-items/affixes.md), where this was the single largest open question.
2. **It is a second axis of variety that needs no affix.** The affix measurement found only 3 kinds out of 18 actually separated builds. This does not depend on affixes at all:

```
defensive build  ->  higher clear rate  ->  more drops
offensive build ->  lower clear rate   ->  has to manage the risk
```

### What it costs

**1. A second currency.** The whole game is currently measured by one number, kph. Drop rate becomes a second thing the player manages, so the UI needs a second readout — see [controls-ui](../00-getting-started/controls-ui.md).

**2. It must not create a permanent spiral.** It does not, because progression unlocks on a kph threshold rather than on survival: a player who falls behind can always drop back to an easier zone and recover.

### Open

| | |
|---|---|
| **k** | the exponent. k=1 is linear and forgiving; higher is punishing. Unmeasured |
| the threshold | is it the same 80%-of-optimum number progression already uses? That would make one number do two jobs |
| contracts | they already carry a cliff. Does drop rate also fall there, or is opt-in consent to both? |
| idle-safe | confirm the worst case really is −20% and not worse with a build that is 2 zones off |

**kill criterion:** if players never enter a harder zone — measured as drop rate staying pinned at 1.0 — then k is too steep or the tier gap is too small to be worth the risk.