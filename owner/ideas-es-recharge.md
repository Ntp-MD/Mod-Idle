# Private Ideas - Energy Shield Recharge

OWNER ONLY. Agents must not read, list, quote, or import this folder
unless the owner assigns the exact file path in chat.

Status: raw idea parking. Nothing here is decided, priced, or folded
into mob_HP. A line becomes design only when the owner moves it into
the data plus its writer and records it in harness/decisions.md.

## Problem

Current rule: recharge starts after 5 sec with no landed hit. Landed
damage resets the idle timer; missed, dodged, evaded and perfect-dodged
hits do not; DoT ticks do not either.

**Root cause: the quiet window is 4 sec, not 5.** `spawnIn` counts down
only while the group is empty (`game.ts:426`) and `group_spawn_sec` is 4.
Mobs only swing while a group exists, so the clock reads: fight ~1.2 sec,
then 4 sec of nothing. A 5 sec delay can never complete in trash.

Measured inputs: reference mob accuracy 393.75 at level 100, K_EVASION
0.5, K_AGI_DODGE 0.15. Avoid% (1 - land%) for a caster: 26.9 at Dex/Agi
210, 44.6 at Dex 468, 52.3 at Dex+Agi 468. Roll rate 3.0/sec in trash
(3 engaging x 1 hit/sec), 0.8/sec vs a boss.

| trigger | recharge uptime | ES recovered | full pool back in |
|---|---|---|---|
| timer 5 sec (today) | **0%** | 0 | never |
| timer 4 sec | **0%** | 0 | never |
| timer 3 sec | 19.2% | 15.7/sec | 3.5 min |
| run-of-3 avoided hits | 0.3% | 0.2/sec | 222 min |
| timer 3 sec + DoT resets | 2.1% | — | — |

Pool 3,264 · regen 81.6/sec · full pool 40.0 sec.

## Idea parking

1. Cut the delay to 3 sec. The smallest change that works: uptime goes
   0% to 19.2%. Touches `energy_shield.delay_sec` only, and the cage
   already accepts 3-8 sec (`check.js` line 329).

2. Redefine the resetting hit.
   Chip damage below 5 percent of max ES still drains the shield but
   does not reset the timer. Independent of idea 1 and stacks with it.

3. Kill restarts the shield.
   On kill, mark the timer satisfied or restore 10-15 percent at once.
   Pays off between groups, nothing against a single-target boss.

4. Two-stage regen.
   30 percent regen always, 100 percent after the delay.

5. Expand Magia Drive instead of the global delay.
   It already ignores the delay and keeps recharge running through hits.
   Add minus-delay, uninterrupted-recharge-seconds, plus-regen-percent.

## Measured and rejected

- **Counting avoided hits instead of a timer.** Two problems. The quiet
  window has no mobs in it, so no rolls happen there and a dodge tally
  can only build during a ~1.2 sec fight with 3 rolls. And the burst of
  3 attackers attacking together is not one clean streak of 3 - the
  timers run independently, so a run of 3 never completes. P(3 clean in
  a shared burst) is 1.9% / 8.9% / 14.3% by build. Uptime 0.3%.
- **DoT ticks resetting the timer.** Burn alone is up 88.8% of the clock
  (proc 0.20 per landed hit x 2.19 landed hits/sec, 5 sec duration;
  97% pooled with poison). A 1/sec tick then resets the timer every
  second and uptime falls to 2.1%. It also double-punishes: burn already
  cuts HP regen up to -50%.
- **DoT draining ES before HP.** Currently `dotDamage` subtracts HP
  directly and skips the ES step. Routing it through ES order step 8
  would make DoT matter without touching the timer. Unmeasured.

## Do not touch

- Do not change K_INT_ESREGEN, the 40 sec full-pool span, or the X25
  share band (30-45 percent) from this folder. Those move only through
  tools/data plus writer plus cage.
- Boss gate is safe either way: boss damage x16 lands ~1,100/sec after
  mitigation against 81.6/sec regen, so ES is 7% of the boss clock.
