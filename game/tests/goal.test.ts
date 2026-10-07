import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, setLevel } from '../src/sim/game';
import { newGoal, target, describe as describeGoal, onSpawn, onKill, watch } from '../src/sim/goal';
import { migrate, SCHEMA_VERSION } from '../src/state/save';
import type { Mob } from '../src/sim/types';

/** A mob shaped enough for the gate, which reads only kind / zone / id / hpMax. */
const mobOf = (over: Partial<Mob>): Mob =>
  ({ id: 'm1', kind: 'Medium', zone: 1, hpMax: 100, ...over } as unknown as Mob);

describe('the win gate is read off the data, not typed', () => {
  it('points at the last zone, its level cap and the HP the spawn curve gives that boss', () => {
    const last = E.mob.zones[E.mob.zones.length - 1];
    const t = target();
    expect(t.zone).toBe(last.id);
    expect(t.level).toBe(last.levels[1]);
    // the same curve the spawn reads, so the number the player reads is the number the fight rolls
    expect(eng.mobHpAt(t.level) * eng.sizeById('boss').hp).toBeCloseTo(t.hp, 6);
    expect(describeGoal()).toContain(t.name);
  });

  it('names the boss the mob table actually carries for that zone', () => {
    const boss = E.mob.bosses.find((b: any) => b.zone === target().zone);
    expect(target().name).toBe(boss!.name);
  });
});

describe('the gate arms on the right spawn', () => {
  it('ignores everything that is not the final zone boss', () => {
    const s = newGame(31);
    onSpawn(s, mobOf({ kind: 'Elite', zone: target().zone }));
    expect(s.goal.spawnId).toBe(null);
    onSpawn(s, mobOf({ kind: `Boss · ${target().name}`, zone: 1 }));
    expect(s.goal.spawnId).toBe(null);
    onSpawn(s, mobOf({ kind: `Boss · ${target().name}`, zone: target().zone, id: 'b1' }));
    expect(s.goal.spawnId).toBe('b1');
    expect(s.goal.attempts).toBe(1);
  });

  it('counts a Push inside the spawn as a failed attempt', () => {
    const s = newGame(32);
    const boss = mobOf({ kind: `Boss · ${target().name}`, zone: target().zone, id: 'b2' });
    onSpawn(s, boss);
    s.counters.pushes++; // the walk-back happened while this boss was alive
    expect(onKill(s, boss)).toBe(false);
    expect(s.goal.done).toBe(null);
    expect(s.goal.spawnId).toBe(null);
  });

  it('lets the spawn go when the boss leaves without dying', () => {
    const s = newGame(33);
    onSpawn(s, mobOf({ kind: `Boss · ${target().name}`, zone: target().zone, id: 'b3' }));
    s.group = [];
    watch(s);
    expect(s.goal.spawnId).toBe(null);
    s.group = [mobOf({ id: 'b4' })];
    watch(s);
    expect(s.goal.spawnId).toBe(null);
  });

  it('records only the first completion', () => {
    const s = newGame(34);
    const boss = mobOf({ kind: `Boss · ${target().name}`, zone: target().zone, id: 'b5', hpMax: 4242 });
    onSpawn(s, boss);
    s.clockSec = 900;
    expect(onKill(s, boss)).toBe(true);
    expect(s.goal.done).toEqual({ clockSec: 900, level: 1, hp: 4242 });
    onSpawn(s, boss);
    expect(onKill(s, boss)).toBe(false); // a second clean kill does not move the record
    expect(s.goal.done!.clockSec).toBe(900);
  });
});

describe('the gate closes in the live loop', () => {
  it('arms on a real boss spawn and logs the completion when it dies to the player', () => {
    const s = newGame(35);
    setLevel(s, target().level);
    s.zone = target().zone;
    s.bossDueAt = s.clockSec + 1; // 0 reads as "no clock stored yet", so the due time is explicit
    let guard = 0;
    while (!s.goal.spawnId && guard++ < 40) {
      s.player.hp = 1e9; // a level-1 sword cannot out-sustain a level-90 zone; the gate is the subject here
      s.player.mana = 1e9;
      tick(s, {});
    }
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(true);
    const armed = s.goal.spawnId!;
    expect(armed.startsWith(`${target().zone}_`)).toBe(true); // armed by the real spawn path, on zone 9
    expect(s.counters.pushes).toBe(s.goal.pushesAtSpawn); // and the attempt is still clean
    const boss = mobOf({ id: armed, kind: `Boss · ${target().name}`, zone: target().zone, hpMax: Math.round(target().hp) });
    expect(onKill(s, boss)).toBe(true);
    expect(s.goal.done!.hp).toBe(Math.round(target().hp));
  });

  it('survives a save round-trip and backfills on an older record', () => {
    const s = newGame(36);
    s.goal.attempts = 3;
    const bare = JSON.parse(JSON.stringify({ ...s, goal: undefined }));
    expect(migrate(bare).goal).toEqual(newGoal());
    expect(SCHEMA_VERSION).toBe(10);
    const kept = migrate(JSON.parse(JSON.stringify(s)));
    expect(kept.goal.attempts).toBe(3);
  });
});
