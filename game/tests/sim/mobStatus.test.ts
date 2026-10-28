import { describe, it, expect } from 'vitest';
import { E, eng } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import {
  newMobStatusStore, applyElement, applyBleed, stepMob, stepMobParts, modsOn, targetMods, forgetDead,
  consumeStatus, setStacks, stunMob, placeStatus,
} from '@sim/combat/mobStatus';
import { combineMods } from '@sim/combat/curse';
import { playerSwing, mobSwing, rollStatus, dotDamageParts, type Statuses } from '@sim/combat/combat';
import { mulberry32 } from '../../src/engine/client-helpers';
import { sm } from '../../src/engine/client';
import { newGame, tick, setLevel, huntZone } from '@sim/core/game';
import type { Character } from '@sim/core/player';
import type { Item, Mob } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';

const S = E.status as any;
const K = E.K as any;

const charWith = (element: string | null, alignment: number): Character => {
  const gear = emptyGear();
  gear[10] = {
    slot: 'main hand', base: 'one-handed sword', ilvl: 61, quality: 'high', tier: 'T1',
    weaponAspd: 1.2, q: 2,
    lines: element ? [{ id: 'elemental_power_flat', value: 400, slice: 0, element }] : [],
  } as unknown as Item;
  const c = buildCharacter(90, gear, {}, 0);
  // alignment is what gates and scales a status, so the test needs to set it directly
  return { ...c, alignment };
};

  const mob = (over: Partial<Mob> = {}): Mob => mobFixture(over);

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
      // an Element declared ahead of its content carries no status yet (earth)
      if (!name) continue;
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
    // full burn alone pays its own 1.0 × aligned line, under the shared 1.5 cap
    expect(stepMob(store, 'm1')).toBeCloseTo(S.burn.stack_max * S.burn.k_dps * aligned, 6);
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

  it('splits a tick by the status that dealt it, and the split sums to what the cap pays', () => {
    // the same infliction sequence twice, because the clock moves on every read
    const build = () => {
      const store = newMobStatusStore();
      // one generator per store, advanced by every call: the proc is a roll, so a fresh stream per
      // attempt would draw the same first number twenty times and land nothing
      const fire = mulberry32(7), poison = mulberry32(11);
      for (let i = 0; i < 40; i++) applyElement(fire, store, 'm1', 'fire', charWith('fire', 100), 100);
      for (let i = 0; i < 40; i++) applyElement(poison, store, 'm1', 'poison', charWith('poison', 100), 100);
      return store;
    };
    const parts = stepMobParts(build(), 'm1');
    expect(parts.burn).toBeGreaterThan(0);
    expect(parts.poison).toBeGreaterThan(0);
    expect(parts.bleed).toBe(0);
    expect(parts.burn + parts.poison + parts.bleed).toBeCloseTo(parts.total, 10);
    // the total is the number `stepMob` has always published — the split is for the screen, not a new budget
    expect(parts.total).toBeCloseTo(stepMob(build(), 'm1'), 10);
  });
});

describe('damage spends Energy Shield before Health', () => {
  it('routes a chaos hit through the live shield, then sends only overflow to Health', () => {
    const c = { ...buildCharacter(90, emptyGear()), perfectDodge: 0, evasion: 0, block: 0, es: 1000 };
    const attacker = mob({ damage: 'magic', innate: ['chaos'], ps: 100, acc: 1e9 });
    const full = mobSwing(() => 0.99, c, attacker, {}, undefined, c.es);
    expect(full.toEs).toBeGreaterThan(0);
    expect(full.toHp).toBe(0);
    const poisonHit = mobSwing(() => 0.99, c, mob({ damage: 'magic', innate: ['poison'], ps: 100, acc: 1e9 }), {}, undefined, c.es);
    expect(poisonHit.toHp).toBe(0); // the poison status tick, not its inflicting hit, bypasses ES
    const low = mobSwing(() => 0.99, c, attacker, {}, undefined, 10);
    expect(low.toEs).toBe(10);
    expect(low.toHp).toBeCloseTo(full.toEs - 10);
  });

  it('spends Energy Absorb shield gain on the same hit before Health takes overflow', () => {
    const c = { ...buildCharacter(90, emptyGear()), perfectDodge: 0, evasion: 0, block: 0, armour: 0, es: 80 };
    const attacker = mob({ damage: 'physical', innate: [], ps: 1000, acc: 1e9 });
    const liveEs = 20;
    const hit = mobSwing(() => 0.99, c, attacker, {}, undefined, liveEs, 20);
    const afterEs = Math.min(c.es, liveEs + hit.absorbed) - hit.toEs;
    expect(hit.absorbed).toBeGreaterThan(0);
    expect(hit.toHp).toBeGreaterThan(0);
    expect(afterEs).toBeCloseTo(0);
  });

  it('keeps poison and bleed on Health while burn drains the shield', () => {
    const s = newGame(91);
    s.hunting = false;
    s.player.esIdleSec = 0;
    const c = buildCharacter(s.player.level, s.gear, {}, 0, undefined, s.player.points, s.player.treeRanks);
    s.player.hp = c.maxHp / 2;
    s.player.es = c.es;
    const statuses: Statuses = {
      burn: { stacks: 1, secLeft: 5, perSec: 4 },
      poison: { stacks: 1, secLeft: 5, perSec: 3 },
      bleed: { stacks: 1, secLeft: 5, perSec: 2 },
    };
    const parts = dotDamageParts(c, statuses);
    const hp = s.player.hp;
    const es = s.player.es;
    expect(es).toBeGreaterThan(0);
    expect(parts.burn).toBeGreaterThan(0);
    expect(parts.poison).toBeGreaterThan(0);
    expect(parts.bleed).toBeGreaterThan(0);
    s.playerStatuses = statuses;
    tick(s, { autoSkills: false });
    const toEs = Math.min(parts.burn, es);
    const burnCut = Math.min(S.burn.regen_cut_max, S.burn.regen_cut_per_stack);
    expect(s.player.es).toBeCloseTo(es - toEs);
    expect(s.player.hp).toBeCloseTo(hp - parts.poison - parts.bleed - parts.burn + toEs + c.hpRegen * (1 - burnCut));
    expect(s.player.esIdleSec).toBe(1);
  });
});

describe('control is bounded, never a lockout', () => {
  it('Stun Recovery shortens the player shock and removes it completely at 100%', () => {
    const lightning = mob({ innate: ['lightning'] });
    const half = {} as Statuses;
    expect(rollStatus(() => 0, lightning, 0, half, 0, 50)).toBe('shock');
    expect(half.shock?.secLeft).toBeCloseTo(S.shock.stop_sec * 0.5, 10);

    const full = {} as Statuses;
    expect(rollStatus(() => 0, lightning, 0, full, 0, 100)).toBeNull();
    expect(full.shock).toBeUndefined();
  });

  it('advances player clocks through the fraction left after shock recovery', () => {
    const swingsAt = (shockSec: number) => {
      const s = newGame(71);
      huntZone(s, s.zone);
      const target = mob({ id: 'dummy', hp: 1e9, hpMax: 1e9, ps: 0, hitsPerSec: 0, innate: [], evasion: 0, dodgeRate: 0 });
      s.group = [target];
      const c = buildCharacter(s.player.level, s.gear);
      s.player.atkTimer = Math.max(0, 1 - c.hitsPerSec * 0.5 + 0.01);
      s.playerStatuses = { shock: { stacks: 1, secLeft: shockSec, perSec: 0 } };
      tick(s);
      return target.hp;
    };

    expect(swingsAt(1)).toBe(1e9); // the full second is stopped
    expect(swingsAt(0.5)).toBeLessThan(1e9); // the remaining half-second advances the attack clock
  });

  it('keeps a newly inflicted player shock through the tick that applied it', () => {
    let appliedSec = 0;
    let expectedSec = 0;
    for (let seed = 1; seed <= 100 && !appliedSec; seed++) {
      const s = newGame(seed);
      huntZone(s, s.zone);
      s.gear = emptyGear();
      const striker = mob({ id: 'stunner', ps: 100, acc: 1e9, damage: 'physical', innate: ['lightning'], hitsPerSec: 1 });
      s.group = [striker];
      const c = buildCharacter(s.player.level, s.gear);
      tick(s);
      if (s.playerStatuses.shock) {
        appliedSec = s.playerStatuses.shock.secLeft;
        expectedSec = eng.stunStopSec(c.core.vit, S.shock.stop_sec);
      }
    }
    expect(appliedSec).toBeGreaterThan(0);
    expect(appliedSec).toBeCloseTo(expectedSec, 10);
  });

  it('chill cuts the swing rate to its cap and Armour, with no accuracy cut', () => {
    const c = charWith('cold', 100);
    const mods = modsOn(inflict('cold', c), 'm1');
    const t = targetMods(mods);
    expect(t.attackSpeed).toBe(-S.chill.aspd_cap); // the whole cut sits at the chill Cap the data publishes
    expect(t.accuracy).toBe(0);
    expect(mods.armourCut).toBe(S.chill.armour_cut);
  });

  it('shock stops the clock but cannot hold it stopped', () => {
    const c = charWith('lightning', 100);
    // one mob over a long fight: shock may hold, but only within the sim's own control bound
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
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0, stopped: true,
      armourCut: 0, resistCut: 0, elemTakenPct: 0,
    }, {}));
    expect(r.blocked).toBe('shocked');
    expect(r.toHp).toBe(0);
  });

  it('a shocked mob swings slower in the sim clock, not never', () => {
    const c = charWith('cold', 100);
    const store = inflict('cold', c);
    const tm = combineMods({ damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0, stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: 0 }, targetMods(modsOn(store, 'm1')));
    expect(tm.attackSpeed).toBe(-S.chill.aspd_cap);
    expect(Math.max(0, 1 + tm.attackSpeed / 100)).toBeCloseTo(1 - S.chill.aspd_cap / 100, 10);
  });
});

describe('mark is the one status that multiplies the hit it rides on', () => {
  it('stacks to its Cap and pays damage plus leech, with no damage term of its own', () => {
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
    store.m1 = { statuses: { mark: { stacks: S.mark.stack_max, secLeft: 5, perSec: 0 } }, alignedPerSec: 1, stoppedSec: 0, elapsedSec: 1 };
    const tm = targetMods(modsOn(store, 'm1'));
    const hit = playerSwing(mulberry32(3), plain, target, null, combineMods({
      damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0, clockPct: 0, stopped: false,
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
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.zone = 3; // a fire zone: our own fire Element is not countered there
    s.gear = emptyGear();
    s.gear[10] = {
      slot: 'main hand', base: 'one-handed sword', ilvl: 61, quality: 'high', tier: 'T1',
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
    expect(sm.byId['attack.flame_wisp'].effect).toMatch(/burn/);
  });
});

describe('status alignment redesign acceptance', () => {
  it('burn 5 stacks pays 1.0 aligned dps and poison 10 pays 1.0, capped together at 1.5', () => {
    const c = charWith('fire', 100);
    const aligned = 200;
    const burnStore = newMobStatusStore();
    for (let i = 0; i < 60; i++) applyElement(mulberry32(i), burnStore, 'm1', 'fire', c, aligned);
    expect(burnStore.m1.statuses.burn!.stacks).toBe(S.burn.stack_max);
    expect(S.burn.stack_max * S.burn.k_dps).toBeCloseTo(1.0, 10);
    expect(S.poison.stack_max * S.poison.k_dps).toBeCloseTo(1.0, 10);
    // full burn alone pays its own 1.0 × aligned line, under the shared 1.5 cap
    expect(stepMob(burnStore, 'm1')).toBeCloseTo(aligned, 6);
    // burn + poison + erosion share one budget
    const both = newMobStatusStore();
    both.m1 = {
      statuses: {
        burn: { stacks: 5, secLeft: 5, perSec: aligned * S.burn.k_dps },
        poison: { stacks: 10, secLeft: 8, perSec: aligned * S.poison.k_dps },
        erosion: { stacks: 1, secLeft: 8, perSec: aligned * 0.5 },
      },
      alignedPerSec: aligned, stoppedSec: 0, elapsedSec: 1,
    };
    expect(stepMob(both, 'm1')).toBeCloseTo(S.dot_cap * aligned, 6);
  });

  it('mark stacks to 10 and Ruin consumes 10, with no overflow', () => {
    const store = newMobStatusStore();
    const c = charWith('chaos', 100);
    setStacks(store, 'm1', 'mark', 4, 100);
    setStacks(store, 'm1', 'mark', 9, 100);
    expect(store.m1.statuses.mark!.stacks).toBe(S.mark.stack_max);
    expect(consumeStatus(store, 'm1', 'mark', 10)).toBe(10);
    expect(store.m1.statuses.mark).toBeUndefined();
  });

  it('chill has no accuracy, caps attack speed at 30% and cuts Armour 25%', () => {
    expect(S.chill.aspd_pct * 2).toBe(S.chill.aspd_cap);
    expect(S.chill.armour_cut).toBeCloseTo(0.25, 10);
    const store = newMobStatusStore();
    const c = charWith('cold', 100);
    placeStatus(store, 'm1', 'chill', c, 10);
    placeStatus(store, 'm1', 'chill', c, 10);
    placeStatus(store, 'm1', 'chill', c, 10);
    expect(store.m1.statuses.chill!.stacks).toBe(2);
    const t = targetMods(modsOn(store, 'm1'));
    expect(t.accuracy).toBe(0);
    expect(t.attackSpeed).toBe(-30);
  });

  it('shock cuts accuracy 20% and stops 0.5s; stun reuses the same stop', () => {
    expect(S.shock.acc_pct).toBe(20);
    expect(S.shock.stop_sec).toBeCloseTo(0.5, 10);
    expect((S as any).shock.aspd_pct).toBeUndefined();
    expect((S as any).shock.align_cut).toBeUndefined();
    const store = newMobStatusStore();
    const c = charWith('lightning', 100);
    placeStatus(store, 'm1', 'shock', c, 10);
    const t = targetMods(modsOn(store, 'm1'));
    expect(t.accuracy).toBe(-20);
    const stunned = stunMob(mulberry32(1), newMobStatusStore(), 'm1', 100);
    expect(stunned).toBe(true);
  });

  it('crippled cuts outgoing direct damage 20% with no clock or cooldown term', () => {
    expect(S.crippled.outgoing_damage_pct).toBe(-20);
    expect((S.crippled as any).clock_pct).toBeUndefined();
    expect((S.crippled as any).cd_pct).toBeUndefined();
    const store = newMobStatusStore();
    const c = charWith('earth', 100);
    placeStatus(store, 'm1', 'crippled', c, 10);
    expect(store.m1.statuses.crippled!.stacks).toBe(1);
    expect(targetMods(modsOn(store, 'm1')).damageDealt).toBe(-20);
  });
});
