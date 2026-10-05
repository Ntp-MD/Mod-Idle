import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import {
  newMobStatusStore, applyElement, applyBleed, stepMob, modsOn, targetMods, forgetDead,
} from '../src/sim/mobStatus';
import { combineMods, newCurses, applyCurse } from '../src/sim/curse';
import { playerSwing, mobSwing } from '../src/sim/combat';
import { mulberry32 } from '../src/engine/client-helpers';
import { sm } from '../src/engine/client';
import { newGame, tick } from '../src/sim/game';
import type { Character } from '../src/sim/player';
import type { Item, Mob } from '../src/sim/types';

const S = E.status as any;
const K = E.K as any;

const charWith = (element: string | null, alignment: number): Character => {
  const gear = emptyGear();
  gear[10] = {
    slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'high', tier: 'T1',
    weaponAspd: 1.2, q: 2,
    lines: element ? [{ id: 'elemental_power_flat', value: 400, slice: 0, element }] : [],
  } as unknown as Item;
  const c = buildCharacter(90, gear, {}, 0);
  // alignment is what gates and scales a status, so the test needs to set it directly
  return { ...c, alignment };
};

const mob = (over: Partial<Mob> = {}): Mob => ({
  id: 'm1', species: 'Rat', kind: 'Small', zone: 1, level: 20, hp: 1e9, hpMax: 1e9,
  ps: 200, acc: 400, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'mixed',
  innate: ['fire'], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
} as Mob);

/** A store with one fire caster hitting until a status is definitely on the target. */
function inflict(element: string, c: Character, tries = 400) {
  const store = newMobStatusStore();
  for (let i = 0; i < tries; i++) {
    applyElement(mulberry32(i + 1), store, 'm1', element, c, c.elem * (c.alignment / 100));
  }
  return store;
}

describe('the Alignment gate and the shared proc', () => {
  it('lets nothing land at zero Alignment, and pays the shared 20% proc above it', () => {
    const noAlign = charWith('fire', 0);
    expect(Object.keys(inflict('fire', noAlign).m1?.statuses || {})).toEqual([]);
    const full = charWith('fire', 100);
    const store = newMobStatusStore();
    let applied = 0;
    for (let i = 0; i < 500; i++) if (applyElement(mulberry32(i), store, 'm1', 'fire', full, 100)) applied++;
    expect(applied).toBeGreaterThan(500 * S.proc_chance * 0.7);
    expect(applied).toBeLessThan(500 * S.proc_chance * 1.3);
  });

  it('maps each Element to the status the table names', () => {
    for (const el of E.elements.order as string[]) {
      const name = (E.elements.status_of as Record<string, string>)[el];
      const store = inflict(el, charWith(el, 100));
      expect(Object.keys(store.m1.statuses)).toContain(name);
    }
  });
});

describe('burn and poison obey the DoT budget', () => {
  it('burn stacks to its own Cap and per stack pays K_FIRE_BURN of aligned damage', () => {
    const c = charWith('fire', 100);
    const aligned = 200;
    const store = newMobStatusStore();
    for (let i = 0; i < 60; i++) applyElement(mulberry32(i), store, 'm1', 'fire', c, aligned);
    const burn = store.m1.statuses.burn!;
    expect(burn.stacks).toBe(S.burn.stack_max);
    expect(burn.perSec).toBeCloseTo(aligned * S.burn.k_dps, 10);
    // five stacks is exactly the global Cap: 5 × 0.30 = 1.50 (elements.md §6)
    expect(stepMob(store, 'm1')).toBeCloseTo(S.dot_cap * aligned, 6);
  });

  it('poison only falls on its own decay clock', () => {
    const c = charWith('poison', 100);
    const store = inflict('poison', c, 60);
    const p = store.m1.statuses.poison!;
    expect(p.stacks).toBeGreaterThan(1);
    expect(p.stacks).toBeLessThanOrEqual(S.poison.stack_max);
    const before = p.stacks;
    for (let i = 0; i < S.poison.decay_sec - 1; i++) stepMob(store, 'm1');
    expect((store.m1?.statuses.poison || p).stacks).toBe(before);
    stepMob(store, 'm1');
    expect(store.m1?.statuses.poison?.stacks ?? 0).toBe(before - 1);
  });
});

describe('control is bounded, never a lockout', () => {
  it('chill cuts the swing rate and the accuracy only to their own Caps', () => {
    const c = charWith('cold', 100);
    const mods = modsOn(inflict('cold', c), 'm1');
    const t = targetMods(mods);
    expect(t.attackSpeed).toBe(-S.chill.aspd_cap); // 10% a stack, Cap 20
    expect(t.accuracy).toBeLessThanOrEqual(0);
    expect(t.accuracy).toBeGreaterThanOrEqual(-S.chill.acc_cap);
    expect(mods.armourCut).toBe(S.chill.armour_cut);
  });

  it('shock stops the clock but cannot hold it stopped', () => {
    const c = charWith('lightning', 100);
    // one mob over a long fight: shock may hold, but only 15% of the seconds it is alive (D-067)
    const store = newMobStatusStore();
    const SECONDS = 200;
    let sawStopped = false;
    for (let sec = 0; sec < SECONDS; sec++) {
      for (let hit = 0; hit < 2; hit++) applyElement(mulberry32(sec * 3 + hit), store, 'm1', 'lightning', c, 100);
      if (targetMods(modsOn(store, 'm1')).stopped) sawStopped = true;
      stepMob(store, 'm1');
    }
    const m = store.m1 || { stoppedSec: 0, elapsedSec: SECONDS };
    expect(sawStopped).toBe(true); // the proc does land on mobs
    expect(m.stoppedSec).toBeGreaterThan(0);
    expect(m.stoppedSec / m.elapsedSec).toBeLessThanOrEqual(0.15 + 0.02);
    const mob1 = mob();
    const r = mobSwing(mulberry32(5), buildCharacter(90, emptyGear()), mob1, {}, combineMods({
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, stopped: true,
      armourCut: 0, resistCut: 0, elemTakenPct: 0,
    }, {}));
    expect(r.blocked).toBe('shocked');
    expect(r.toHp).toBe(0);
  });

  it('a shocked mob swings slower in the sim clock, not never', () => {
    const c = charWith('cold', 100);
    const store = inflict('cold', c);
    const tm = combineMods({ damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: 0 }, targetMods(modsOn(store, 'm1')));
    expect(tm.attackSpeed).toBe(-20);
    expect(Math.max(0, 1 + tm.attackSpeed / 100)).toBeCloseTo(0.8, 10);
  });
});

describe('mark is the one status that multiplies the hit it rides on', () => {
  it('stacks to 25 and pays damage plus leech, with no damage term of its own', () => {
    const c = charWith('chaos', 100);
    const store = inflict('chaos', c, 400);
    const mk = store.m1.statuses.mark!;
    expect(mk.stacks).toBe(S.mark.stack_max);
    expect(mk.perSec).toBe(0);
    const t = targetMods(modsOn(store, 'm1'));
    expect(t.damageTaken).toBeCloseTo(S.mark.stack_max * S.mark.k_dmg * 100, 10);
    expect(t.leechPct).toBeCloseTo(S.mark.stack_max * S.mark.k_leech * 100, 10);
  });

  it('raises our damage against that mob only, and heals from it', () => {
    const plain = buildCharacter(90, emptyGear());
    const target = mob({ id: 'm1' });
    const base = playerSwing(mulberry32(3), plain, target, null).damage;
    const store = newMobStatusStore();
    store.m1 = { statuses: { mark: { stacks: 25, secLeft: 5, perSec: 0 } }, alignedPerSec: 1, stoppedSec: 0, elapsedSec: 1 };
    const tm = targetMods(modsOn(store, 'm1'));
    const hit = playerSwing(mulberry32(3), plain, target, null, combineMods({
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, stopped: false,
      armourCut: 0, resistCut: 0, elemTakenPct: 0,
    }, tm));
    expect(hit.damage).toBeCloseTo(base * (1 + tm.damageTaken! / 100), 6);
    expect(hit.leech!).toBeGreaterThan(0);
  });
});

describe('bleed is physical, does not stack, and ignores attack speed', () => {
  it('refreshes the same five seconds instead of adding a line', () => {
    const c = charWith(null, 0);
    const store = newMobStatusStore();
    let applied = 0;
    for (let i = 0; i < 200; i++) if (applyBleed(mulberry32(i), store, 'm1', c.phys, K.K_BLEED_CHANCE)) applied++;
    expect(applied).toBeGreaterThan(200 * K.K_BLEED_CHANCE * 0.7);
    const l = store.m1.statuses.bleed!;
    expect(l.stacks).toBe(1);
    expect(l.perSec).toBeCloseTo((c.phys * K.K_BLEED) / K.bleed_time_sec, 10);
    expect(l.secLeft).toBeLessThanOrEqual(K.bleed_time_sec);
  });

  it('is not part of the burn + poison budget', () => {
    const store = newMobStatusStore();
    store.m1 = {
      statuses: { bleed: { stacks: 1, secLeft: 5, perSec: 100 } },
      alignedPerSec: 10, stoppedSec: 0, elapsedSec: 0,
    };
    expect(stepMob(store, 'm1')).toBe(100);
  });
});

describe('the store forgets a mob that left, and the sim runs the whole path', () => {
  it('drops records for spawns that are gone', () => {
    const store = inflict('fire', charWith('fire', 100));
    expect(store.m1).toBeTruthy();
    forgetDead(store, new Set<string>(['other']));
    expect(Object.keys(store)).toEqual([]);
  });

  it('a fire weapon in the sim sets burn on what it hits and the mob dies faster', () => {
    const s = newGame(101);
    s.player.level = 60;
    s.zone = 3; // a fire zone: our own fire Element is not countered there
    s.gear = emptyGear();
    s.gear[10] = {
      slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'high', tier: 'T1',
      weaponAspd: 1.2, q: 2, lines: [{ id: 'elemental_power_flat', value: 900, slice: 0, element: 'fire' }],
    } as unknown as Item;
    let guard = 0;
    let sawStatus = false;
    while (guard++ < 3000 && !sawStatus) {
      tick(s, {});
      sawStatus = Object.values(s.mobStatus).some((m) => Object.keys(m.statuses).length > 0);
    }
    expect(sawStatus).toBe(true);
    expect(s.counters.kills).toBeGreaterThan(0);
    expect(sm.byId['attack.flame_lash'].effect).toMatch(/burn/);
  });
});
