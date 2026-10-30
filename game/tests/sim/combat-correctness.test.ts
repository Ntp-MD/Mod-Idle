import { describe, expect, it } from 'vitest';
import { E, eng, sm, tree } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import type { Character } from '@sim/core/player';
import { applyStatus, decayStatusStack, dotDamageParts, playerSwing, mobSwing, rollStatus, type Statuses } from '@sim/combat/combat';
import { applyCurse, newCurses, NO_CURSE } from '@sim/combat/curse';
import { newMobStatusStore, placeStatus, stepMob } from '@sim/combat/mobStatus';
import { newSkillState, resolvePreparedCast, type PreparedSkillCast } from '@sim/combat/skills';
import { huntZone, newGame, tick } from '@sim/core/game';
import type { KeystoneBundle } from '@engine/keystones.ts';
import type { Mob } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';

/**
 * P7 — damage and status correctness. Each fixture runs the live function the game calls, with the
 * same shape without the rule as its control: curse `damage_taken` on a press, Headsman on a press,
 * the DoT ladder on the mob side, Block's place in the mitigation order, Anvil's raw ratio, and the
 * fractional Shock clock.
 */

const S = E.status as any;
const bundles = (keys: string[]): KeystoneBundle[] =>
  keys.flatMap((key) => tree.keystoneBundles({ [`keystone.${key}`]: 1 }).slice(0, 1));
const sheet = (keystones: KeystoneBundle[] = []): Character =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, keystones);

const mob = (over: Partial<Mob> = {}): Mob => mobFixture({
  hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, armour: 0, res: 0, innate: [], ...over,
});

const prepared = (id: string, targets: Mob[]): PreparedSkillCast =>
  ({ id, manaCost: 0, hpCost: 0, level: 1, cooldownSec: 10, spatial: false, targets });
const press = (c: Character, id: string, target: Mob, env: Parameters<typeof resolvePreparedCast>[5] = {}) =>
  resolvePreparedCast(newSkillState(), c, prepared(id, [target]), {}, () => 0, env);

describe('a press and a swing price the same target', () => {
  it('applies the curse damage_taken multiplier on the skill path', () => {
    const c = { ...sheet(), accuracy: 1e9 };
    const plainTarget = mob();
    const cursedTarget = mob();
    const curses = newCurses();
    applyCurse(curses, cursedTarget.id, sm.byId['curse.expose'], [], 1);

    const plain = press(c, 'attack.frostbite', plainTarget, { curses: newCurses() });
    const cursed = press(c, 'attack.frostbite', cursedTarget, { curses });
    const taken = 1 + (sm.byId['curse.expose'] as any).effects.find((e: any) => e.stat === 'damage_taken').value / 100;

    const plainDealt = plain.dealt ?? 0;
    expect(plainDealt).toBeGreaterThan(0);
    expect(cursed.dealt ?? 0).toBeCloseTo(plainDealt * taken, 6);
    // the swing's own path reads the same multiplier, so the two halves cannot drift
    const swing = playerSwing(() => 0, { ...c, phys: 100, magic: 0, elem: 0, elemByElement: {} }, mob(), null, NO_CURSE);
    const swung = playerSwing(() => 0, { ...c, phys: 100, magic: 0, elem: 0, elemByElement: {} }, mob(), null,
      { ...NO_CURSE, damageTaken: 20 });
    expect(swung.damage ?? 0).toBeCloseTo((swing.damage ?? 0) * 1.2, 6);
  });

  it('executes a surviving target below the threshold on the skill path, exactly like a swing', () => {
    const headsman = bundles(['headsman']);
    const c = { ...sheet(headsman), accuracy: 1e9 };
    const probe = mob();
    const hit = press(c, 'attack.frostbite', probe);
    const damage = hit.dealt ?? 0;
    expect(damage).toBeGreaterThan(0);

    // after the press the body stands at 1% of its pool, under the 15% normal threshold
    const target = mob({ hp: damage * 1.1, hpMax: damage * 10 });
    press(c, 'attack.frostbite', target);
    expect(target.hp).toBe(0);

    const control = mob({ hp: damage * 1.1, hpMax: damage * 10 });
    press({ ...c, keystones: [] }, 'attack.frostbite', control);
    expect(control.hp).toBeGreaterThan(0);
  });
});

describe('mob DoT stacks on the player ladder', () => {
  it('pays the sum of every application instead of the newest overwrite', () => {
    const c = { ...sheet(), alignment: 100 };
    const playerBurn: Statuses = {};
    const store = newMobStatusStore();
    const fire = mob({ innate: ['fire'] });
    for (const aligned of [150, 50, 200]) {
      expect(rollStatus(() => 0, fire, aligned, playerBurn)).toBe('burn');
      placeStatus(store, 'm1', 'burn', c, aligned);
    }
    const line = store.m1.statuses.burn!;
    expect(line.stacks).toBe(3);
    expect(line.perSec).toBeCloseTo(playerBurn.burn!.perSec, 10);
    // the ladder is [30, 10, 40] per stack, so the line pays 80 a second, not 3 × the last 40
    expect(line.stackPerSec).toHaveLength(3);
    (line.stackPerSec ?? []).forEach((rate, i) => expect(rate).toBeCloseTo([30, 10, 40][i], 10));
    expect(stepMob(store, 'm1')).toBeCloseTo(dotDamageParts(sheet(), playerBurn).burn, 10);
    expect(stepMob(store, 'm1')).toBeCloseTo(80, 10);
  });

  it('drops one stack through the same ladder on the poison decay beat', () => {
    const c = { ...sheet(), alignment: 100 };
    const player: Statuses = {};
    const store = newMobStatusStore();
    for (const aligned of [300, 100]) {
      applyStatus(player, 'poison', aligned);
      placeStatus(store, 'm1', 'poison', c, aligned);
    }
    expect(player.poison!.perSec).toBeCloseTo(store.m1.statuses.poison!.perSec, 10);
    decayStatusStack(player.poison!);
    for (let sec = 0; sec < S.poison.decay_sec; sec++) stepMob(store, 'm1');
    expect(store.m1.statuses.poison!.stacks).toBe(player.poison!.stacks);
    expect(store.m1.statuses.poison!.perSec).toBeCloseTo(player.poison!.perSec, 10);
    expect(store.m1.statuses.poison!.perSec).toBeCloseTo(10, 10);
  });
});

describe('incoming mitigation order', () => {
  it('lands Block before the damage_taken bucket, as the order comment says', () => {
    const brawler = bundles(['brawler']);
    const c: Character = {
      ...sheet(brawler), armour: 100, block: 100, resistance: 0, resByElement: {},
      maxHp: 1000, es: 0, perfectDodge: 0, evasion: 0, damageTaken: 1,
    };
    const hit = mobSwing(() => 0, c, mob({ ps: 200, damage: 'physical' }), {});
    const rawHit = 200;
    const physical = rawHit * (1 - eng.armourReduce(100, rawHit));
    const block = Math.min(100 / E.caps.block_divisor, physical);
    const takenScale = 0.85; // Brawler above 50% Life
    expect(hit.blocked).toBe('block');
    expect(hit.blockCut).toBeCloseTo(block, 10);
    // (physical − block) × damage_taken, not (physical × damage_taken) − block
    expect(hit.toHp).toBeCloseTo((physical - block) * takenScale * E.global.defend_mult, 6);
  });

  it('prices Anvil off the pre-mitigation Elemental hit', () => {
    const anvil = bundles(['anvil']);
    const c: Character = {
      ...sheet(anvil), armour: 100, block: 0, resistance: 50, resCap: 75, resByElement: { fire: 0 },
      maxHp: 1000, es: 0, perfectDodge: 0, evasion: 0, damageTaken: 1,
    };
    const hit = mobSwing(() => 0.99, c, mob({ ps: 200, damage: 'magic', innate: ['fire'] }), {});
    const elemental = 200 * (1 - 50 / 100);
    const cut = eng.armourReduce(100, 200) * (Number(anvil[0].params.elementalArmourPct) / 100);
    expect(hit.toHp).toBeCloseTo(elemental * (1 - cut), 6);
  });
});

describe('the Shock clock is fractional', () => {
  it('spends exactly the stopped slice on expiry and keeps a fractional remainder', () => {
    const s = newGame(4242);
    huntZone(s, s.zone);
    s.group = [mob({ id: 'dummy', ps: 0, hitsPerSec: 0 })];
    s.playerStatuses.shock = { stacks: 1, secLeft: 1.5, perSec: 0 };

    tick(s);
    expect(s.playerStatuses.shock?.secLeft).toBeCloseTo(0.5, 10);
    tick(s);
    expect(s.playerStatuses.shock).toBeUndefined();

    // a 0.5 s shock is fully spent by the tick that stops half of it — never overdrawn by a whole second
    s.playerStatuses.shock = { stacks: 1, secLeft: S.shock.stop_sec, perSec: 0 };
    tick(s);
    expect(s.playerStatuses.shock).toBeUndefined();
  });
});
