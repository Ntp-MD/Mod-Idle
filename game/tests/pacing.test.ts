import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, spendReference } from '../src/sim/game';
import { setRule } from '../src/sim/filter';

/**
 * The client's own pacing, measured against the hours `engine.json` publishes.
 *
 * This is not the balance audit (`harness/decisions.md` D-103) and it changes no number. It gates the one
 * promise `loot.md` §4 makes of an AFK run: a piece the filter rejects converts on the spot, so the
 * Reroll value mint must keep paying **every hour**, including after the adventure bag fills and
 * pickups pause. That stall was `harness/todo.md` B17, and it cleared once a kept upgrade went
 * straight onto the character the way `tools/loot.ts` has always modelled a keep.
 *
 * The kill rate is printed, not gated tight: the band's published figure assumes the Lck investment
 * and the zone progression that a single-zone, no-travel, no-click run does neither.
 */
const HOURS = 6;
const SEC_PER_HR = 3600;

interface Hour { hour: number; level: number; kills: number; drops: number; minted: number; spilled: number }

describe('the built loop measured against the published hours', () => {
  it('keeps minting crafting stones every hour, and prints where it differs from the design', () => {
    const s = newGame(20260104);
    // the filter is OFF by default (D-122), so this test turns every slot on to gate the published
    // promise: once a slot filters, a rejected piece dissolves on the spot and the Reroll value mint
    // must keep paying every hour, including after the adventure bag fills and pickups pause
    setRule(s.filter, 'all', { enabled: true });
    const L = E.loot;
    const published = L.bands.low.kills_per_hr_published;
    const reached: Record<number, number> = {};
    const rows: Hour[] = [];
    let prev = { kills: 0, drops: 0, reroll: 0, overflow: 0 };
    let firstFullBagSec: number | null = null;

    for (let h = 1; h <= HOURS; h++) {
      for (let i = 0; i < SEC_PER_HR; i++) {
        tick(s, {});
        spendReference(s); // the reference build spends its level points evenly (D-141)
        for (const cap of [10, 30, 60, 90, 100]) {
          if (s.player.level >= cap && reached[cap] == null) reached[cap] = s.clockSec;
        }
        if (firstFullBagSec == null && s.bag.length >= E.inventory.adventure_slots) firstFullBagSec = s.clockSec;
      }
      const rerollNow = s.counters.stones.reroll_value || 0;
      rows.push({
        hour: h,
        level: s.player.level,
        kills: s.counters.kills - prev.kills,
        drops: s.counters.drops - prev.drops,
        minted: rerollNow - prev.reroll,
        spilled: (s.counters.overflow || 0) - prev.overflow,
      });
      prev = { kills: s.counters.kills, drops: s.counters.drops, reroll: rerollNow, overflow: s.counters.overflow || 0 };
    }

    const killRate = s.counters.kills / HOURS;
    const table = rows.map((r) =>
      `  h${r.hour} L${String(r.level).padStart(3)} kills ${String(r.kills).padStart(4)}` +
      ` drops ${String(r.drops).padStart(3)} → Reroll value +${String(r.minted).padStart(3)}` +
      ` (kept pieces left on the ground ${r.spilled})`).join('\n');
    const reachedIn = [10, 30, 60, 90, 100].map((lv) => {
      const hr = reached[lv] != null ? (reached[lv] / SEC_PER_HR).toFixed(1) : '—';
      return `L${lv} ${hr} hr vs published ${L.timeline_checkpoints_hr['level_' + lv]}`;
    }).join(' · ');
    // eslint-disable-next-line no-console
    console.log(`\nAFK in ${eng.zoneById(s.zone).name} · ${HOURS} hr · one zone, no travel, no clicks\n${table}\n  ${reachedIn}\n` +
      `  kill rate ${killRate.toFixed(0)}/hr = ${(killRate / published).toFixed(2)}× the band's published figure, measured for B1\n` +
      `  bag first full at ${firstFullBagSec == null ? 'never' : `${(firstFullBagSec / 60).toFixed(0)} min`}` +
      ` · pieces dissolved across the run ${s.counters.salvaged || 0}`);

    expect(rows.every((r) => r.kills > 0)).toBe(true); // the fight never stops paying XP
    expect(rows.every((r) => r.drops > 0)).toBe(true); // and never stops rolling drops
    expect(rows.every((r) => r.minted > 0)).toBe(true); // B17: the stone mint runs in every hour
    expect(reached[10]).not.toBeUndefined(); // hour one of the timeline is reachable at all
    // No wall-clock target: this game has no time limit (owner ruling 2026-10-05, D-141), so the run is
    // NOT gated against the published kill rate or a bag-fill pace. The loop only has to keep paying.
  }, 180000);
});
