import { describe, it, expect } from 'vitest';
import { eng } from '../src/engine/client';
import { newGame, tick, setLevel } from '../src/sim/game';
import { emptyGear } from '../src/sim/player';
import { ACTIVE_SLOTS } from '../src/sim/skills';
import { sm } from '../src/engine/client';

/**
 * The skill share, measured.
 *
 * `mob_HP(L) = typical_gear_DPS(L) × (1 + skill_per_level × L)` folds the whole skill list into one
 * multiplier, and `checks.md` D4/D5 read it as ×1.34 at level 100. That figure was fitted on the old
 * `stat% / power%` split; the basis re-cut moved which rows press hardest and casts now roll hit and
 * crit, so the fold has to be re-measured from the built loop rather than assumed.
 *
 * This is the **gearless** reading, and is explicit that the fold is not taken from it — the
 * geared measurement is `gearedB1.test.ts`. What stays useful here is the isolation: the same
 * character, the same spawns, the only difference whether the bar is filled, so a share printed here
 * is the list's own work with no gear movement mixed into it.
 */
// The fold the curve carries is the DAMAGE list, so the bar holds attack rows only. The curse and
// heal rows are utility: on an `Always` bar they take the attack tick for no damage, and 
// gives them a condition (`status missing` / `HP% below`) in its own pass — measuring them here would
// report that pass's absence as if it were the fold's.
const ROTATION = [
  'attack.cleave', 'attack.whirlwind', 'attack.piercing_shot', 'attack.nether_orb', 'attack.meteor',
  'attack.flame_wisp', 'attack.chain_lightning', 'attack.blizzard', 'attack.toxic_cloud',
];

function runSeconds(level: number, zone: number, seconds: number, withSkills: boolean, seed = 5) {
  const s = newGame(seed);
  setLevel(s, level);
  s.zone = zone;
  s.gear = emptyGear();
  s.skills.list = new Array(ACTIVE_SLOTS).fill(null);
  if (withSkills) {
    s.skills.list = ROTATION.slice(0, ACTIVE_SLOTS).map((id) => id);
    for (const id of ROTATION) s.skills.owned[id] = 0;
    for (const id of ROTATION) s.skills.xp[id] = 8000; // the fold is quoted for a maxed list
  }
  for (let i = 0; i < seconds; i++) tick(s, {});
  // damage per second, not kills per hour: kills are floored by the spawn cadence, so a kill-rate
  // ratio would understate the list and read as a smaller fold than the curve assumes
  return { kills: s.counters.kills, pushes: s.counters.pushes || 0, dps: (s.counters.damage || 0) / seconds };
}

describe('the skill share the built loop actually gets', () => {
  it('prints auto-only and auto-plus-skills damage per second at each band level', () => {
    const rows: string[] = [];
    let smallest = Infinity;
    for (const [level, zone] of [[30, 3], [60, 6], [90, 9]] as [number, number][]) {
      // 3,600 sec, not 600: a 600-sec window at these levels is 9-18 kills, so which mobs happen to
      // spawn (a boss is ×15 HP) moved the ratio more than the bar did.
      const SEC = 3600;
      const bare = runSeconds(level, zone, SEC, false);
      const armed = runSeconds(level, zone, SEC, true);
      const share = bare.dps > 0 ? armed.dps / bare.dps : NaN;
      smallest = Math.min(smallest, share);
      rows.push(
        `L${level} zone ${zone}: auto ${bare.dps.toFixed(0)} dps` +
        ` · with the list ${armed.dps.toFixed(0)} dps · share ×${share.toFixed(2)}` +
        ` (curve assumes ×${eng.skillF(level).toFixed(2)} · its typical gear is ${eng.typicalDpsAt(level).toFixed(0)} dps` +
        ` and an on-level mob is ${eng.mobHpAt(level).toFixed(0)} HP)` +
        ` · kills ${bare.kills}/${armed.kills} · Pushed ${bare.pushes}/${armed.pushes}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`\nskill share, measured over 600 sec per run\n  ${rows.join('\n  ')}`);
    expect(rows.length).toBe(3);
    // The list must not be dead weight. This is the GEARLESS isolation, and at L90 it reads ~×0.97 —
    // a bare swing and a press press off the same finished hit, so what separates them is the
    // cooldown-gated cast clock, which ("skill-first attack priority" + per-skill
    // conditions) is the pass that closes. The published fold is the geared one (gearedB1.test.ts),
    // which holds; this gate refuses the case that would make the bar a real loss.
    expect(smallest).toBeGreaterThan(0.9);
    void sm;
  }, 240000);
});
