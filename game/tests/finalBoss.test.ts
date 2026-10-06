import { describe, it, expect } from 'vitest';
import { eng, loot, sm } from '../src/engine/client';
import { newGame, tick, setLevel } from '../src/sim/game';
import { target } from '../src/sim/goal';
import { ACTIVE_SLOTS } from '../src/sim/skills';
import type { GameState, Item } from '../src/sim/types';
import { ceilingGear } from './sheetFixture';

/**
 * The win condition fought through the loop that ships (`concept.md` · `combat.md` §7 · G5).
 *
 * `goal.test.ts` proves the gate arms, records and survives a save round-trip — on a shaped mob,
 * with HP pinned to 1e9, because a low-level sword cannot out-sustain a top zone. So the gate has
 * never been checked against a real fight: nothing yet shows that the boss is a *heal* gate rather
 * than a damage one, which is the promise SV6 states and the one the design sells. This runs the
 * boss for real — the character's own gear, the real spawn clock, the real Push.
 *
 * Every number is read back off the data or measured off the run: the zone, the level, the boss's HP
 * and the character's gear all come from the curve the fight itself reads. The character is dressed
 * to the **zone ceiling** (`sheetFixture.ts`), which is a *state*: no hunt and no hour count stands
 * between the premise and the fight, because play-length is not a design constraint (owner ruling ·
 * `AGENT.md`). The clock cap below is a hang guard, never a balance claim.
 */
const HOUR = 3600;
const FIGHT_CAP_SEC = 2 * HOUR;

/** The attack rows one build holds; `heal.heal` is the row that makes the boss a heal gate. */
const ATTACKS = ['attack.cleave', 'attack.headshot', 'attack.piercing_shot', 'attack.pierce_the_veil', 'attack.shield_bash'];

function withBar(s: GameState, bar: string[]) {
  for (const id of bar) {
    if (!(id in sm.byId)) throw new Error(`the roster no longer has ${id}`);
    s.skills.owned[id] = s.skills.owned[id] ?? 0;
    s.skills.xp[id] = Number.MAX_SAFE_INTEGER;
  }
  s.skills.list = new Array(ACTIVE_SLOTS).fill(null);
  bar.slice(0, ACTIVE_SLOTS).forEach((id, i) => { s.skills.list[i] = id; });
  return s;
}

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;

/**
 * One boss spawn, from a full pool. The clock is the character's own, so the spawn is the one the
 * live loop would hand out; only the group is cleared first, to get the reading on demand.
 */
function fightBoss(s: GameState) {
  s.phase = 'hunt';
  s.player.hp = 1e9;
  tick(s, {}); // the pool, read off the sheet rather than typed
  const pool = s.player.hp;
  s.group = [];
  s.spawnIn = 0;
  s.bossDueAt = s.clockSec + 1;
  let boss: (GameState['group'][number]) | null = null;
  let guard = 0;
  while (!boss && guard++ < 60) {
    tick(s, {});
    boss = s.group.find((m) => m.kind.startsWith('Boss')) ?? null;
  }
  if (!boss) throw new Error('the boss clock never came round');
  const hpMax = boss.hpMax;
  const hpBefore = s.player.hp;
  const pushesBefore = s.counters.pushes;
  const t0 = s.clockSec;
  for (let i = 0; i < FIGHT_CAP_SEC && s.group.length && boss.hp > 0 && s.phase !== 'camp'; i++) tick(s, {});
  const secs = s.clockSec - t0;
  return {
    killed: boss.hp <= 0,
    secs,
    hpMax,
    pool,
    takenPerSec: secs > 0 ? (hpBefore - s.player.hp) / secs : 0,
    pushed: s.counters.pushes - pushesBefore,
    ps: boss.ps,
    rawPerSec: boss.ps * boss.hitsPerSec,
  };
}

/** The character the gate is fought with: dressed to the zone ceiling, no hunt and no clock. */
function dressed() {
  const s = newGame(20261006);
  setLevel(s, target().level);
  s.zone = target().zone;
  s.gear = ceilingGear();
  return s;
}

describe('the win gate fought for real', () => {
  const base = dressed();
  const afk = clone(base);
  afk.skills.list = afk.skills.list.map(() => null);
  const healer = withBar(clone(base), [...ATTACKS, 'heal.heal']);

  const afkFight = fightBoss(clone(afk));
  const healFight = fightBoss(clone(healer));

  it('hands out the boss the win condition names, at the HP the spawn curve gives it', () => {
    // eslint-disable-next-line no-console
    console.log(`\nfinal boss · ${eng.zoneById(base.zone).name} · L${base.player.level} · `
      + `${base.gear.filter(Boolean).length}/${base.gear.length} slots worn, each line at its ceiling\n`
      + `  ${target().name} · ${Math.round(afkFight.hpMax)} hp · ${afkFight.rawPerSec.toFixed(0)}/sec raw\n`
      + `  AFK  · killed ${afkFight.killed ? 'YES' : 'no '} in ${afkFight.secs}s · Pushed ${afkFight.pushed} · `
      + `took ${afkFight.takenPerSec.toFixed(0)}/sec net against a ${Math.round(afkFight.pool)} pool\n`
      + `  heal · killed ${healFight.killed ? 'YES' : 'no '} in ${healFight.secs}s · Pushed ${healFight.pushed} · `
      + `took ${healFight.takenPerSec.toFixed(0)}/sec net`);

    expect(Math.round(afkFight.hpMax)).toBe(Math.round(target().hp)); // the spawn carries the curve's HP
  });

  it('is a heal gate: the spawn Pushes a character that does not heal, and one heal round cuts what it takes', () => {
    // combat.md §7 / G5, read as the shape the client loop can own. Whether a heal round *closes* the
    // gate is a claim about the curve's gear and belongs to the survival cage (SV6 prices the four
    // Core-stat builds against idealised T1 Mods, and passes); what this test owns is that the real
    // loop reaches the gate — a bar-less character is Pushed by the real spawn clock — and that
    // casting heal measurably reduces the damage it takes per second at exactly the same gear.
    // Neither half depends on how long the character farmed, so no assertion here is a time claim.
    expect(afkFight.pushed, `AFK closed the gate in ${afkFight.secs}s with no Push`).toBeGreaterThan(0);
    expect(afkFight.killed).toBe(false);
    expect(healFight.takenPerSec).toBeLessThan(afkFight.takenPerSec);
  }, 60000);
});