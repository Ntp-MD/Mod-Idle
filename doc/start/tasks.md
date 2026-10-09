# Tasks

Task board: the daily direction layer. It answers the opening question `concept.md` raises — nothing is
visible except loot — without adding power outside the funnel the loot cage already measures.

**Every figure on this page lives in `tools/data/town.json` `task_sizing` and `engine.json`; this file
names the key and never the value.** The board's sizing is marked provisional and owner-veto-able there.

- **Where it lives** — the Guild counter in each Capital (`town.json` `settlements` · `npcs`). Doors there
  are chosen; the payout rules below do not change either way.
- **Payouts stay in stones** — a task reward never pays gold, because the filter-sold piece is gold's only
  mint (`engine.json` `junk` · the Counterhand). Purchases at the counter (skip tokens) are paid in gold.

# Board

- The slot count, the refill clock and the free skip are `task_sizing.slots`, `task_sizing.refill_sec` and
  `task_sizing.free_skip_per_day`. An empty slot offers a new task immediately; a finished or skipped slot
  refills when its clock runs out.
- Further skips are bought at the Guild counter in **gold** — the `town.json` `skip_token` line owns its
  minute price and its per-day ceiling — never in stones.
- The task pool is level-gated: only zones at or below the zone the player is fighting.

# Task types

| Type | Objective | Progress while AFK | Reward |
|---|---|---|---|
| Elite hunt | Kill `task_sizing.elite_n` elites | Yes | Tier stones, sized at `task_sizing.reward_minutes_of_band_income` of that band's own stone income |
| Boss | Kill the zone's boss within one spawn | No — online only | `task_sizing.boss_reward`: a Remove stone, or the Reroll tier count it names, winner's choice |

- The board offers the two kinds against each other at `task_sizing.offer_weight_elite`.
- **The plain Hunt task — "kill N mobs in zone Z" — is gone.** It carried the majority of the roll, so the
  board now offers the Elite hunt and the Boss hunt only. Its removal is what the minute-one instruction in
  `concept.md` rode: the opening task is the board's own Elite hunt (`engine.json` `opening`).

# Income bound (hard rule)

- All task rewards combined stay inside `task_sizing.income_bound_pct` of the day's loot flows. Rewards are
  bonus stones inside the same funnel, never new income on top; the rebalance pass sizes the elite count and
  the reward counts against the loot cage (`tools/loot.ts`). Retiring the plain Hunt task took the board's
  Reroll **value** stone drip out of that budget, so what the bound now covers is the Elite hunt's Reroll
  **tier** stones and the Boss hunt's own Remove stone.
- Task XP counts toward the bonus curve (`engine.json` `xp.elite_mult` · `xp.boss_mult`); the bound above
  covers it.

(End of file)
