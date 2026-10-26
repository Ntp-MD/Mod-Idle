import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/core/player';
import { playerSwing } from '../src/sim/combat/combat';
import { newSkillState, castOnce, effectsActive, type CastEnv } from '../src/sim/combat/skills';
import { lineValue } from '../src/sim/combat/curse';
import { newMobStatusStore, stepMob, CONDITION_OF } from '../src/sim/combat/mobStatus';
import { newGame, tick, setLevel, huntZone } from '../src/sim/core/game';
import type { Character } from '../src/sim/core/player';
import type { Mob } from '../src/sim/core/types';
import { mobFixture } from './mobFixture';

/**
 * The rows turned from prose into numbers: each must move the fight by the amount its own
 * sentence states. Nothing here types a magnitude — every expected figure is read out of
 * `skills.json`, so a spend that drifts from its text fails this file and a text that drifts from
 * its data fails cage gate S11.
 */

const row = (id: string) => sm.byId[id]!;
const valueOf = (id: string, stat: string) => row(id)!.effects!.find((e: any) => e.stat === stat)!.value;
const foldOf = (...ids: string[]) => sm.aggregateEffects(ids.map(row));
const S = E.status as any;

  const mob = (over: Partial<Mob> = {}): Mob => mobFixture(over);

/** Cast one slotted skill once against one mob and report how much HP it took. */
function castDamage(id: string, c: Character, target: Mob, env: CastEnv = {}): number {
  const s = newSkillState();
  s.list[0] = id; s.owned[id] ??= 0;
  s.xp[id] = 0;
  const before = target.hp;
  const cast = castOnce(s, c, c.maxMana, [target], {}, mulberry32(7), env);
  expect(cast).not.toBeNull();
  return before - target.hp;
}

describe('the Heralds feed the Element they name', () => {
  const fold = foldOf('aura.herald_of_ash');
  const flat = valueOf('aura.herald_of_ash', 'elemental_power');

  it('lifts that one pool by its flat and adds to the total, not into it', () => {
    const plain = buildCharacter(40, emptyGear());
    const herald = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(herald.elemByElement.fire - (plain.elemByElement.fire || 0)).toBeCloseTo(flat, 6);
    const sum = (c: Character) => Object.values(c.elemByElement).reduce((t, v) => t + v, 0);
    const untouched = (c: Character) => sum(c) - (c.elemByElement.fire || 0);
    expect(untouched(herald)).toBeCloseTo(untouched(plain), 6);
    expect(herald.elem - plain.elem).toBeCloseTo(flat, 6);
    expect(sum(herald)).toBeCloseTo(herald.elem, 6); // the pools are a partition of the total
  });

  it('lifts Alignment by the same row’s other number', () => {
    const plain = buildCharacter(40, emptyGear());
    const herald = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(herald.alignment - plain.alignment).toBe(valueOf('aura.herald_of_ash', 'elemental_alignment'));
  });

  it('lifts the same Elemental share on any mob — no Element is countered', () => {
    const plain = buildCharacter(90, emptyGear());
    const herald = buildCharacter(90, emptyGear(), {}, 0, fold);
    const fireMob = mob({ innate: ['fire'] });
    const coldMob = mob({ id: 'm2', innate: ['cold'] });
    const gainOn = (target: Mob) =>
      playerSwing(mulberry32(1), herald, target, null).damage -
      playerSwing(mulberry32(1), { ...plain, alignment: herald.alignment }, target, null).damage;
    expect(gainOn(fireMob)).toBeGreaterThan(0);
    // the Alignment lift rides no matchup multiplier, so its gain is identical against every Species
    expect(gainOn(fireMob)).toBeCloseTo(gainOn(coldMob), 6);
  });
});

describe('Berserker pays for its own speed', () => {
  const fold = foldOf('buff.berserker');

  it('swings faster, takes more, and carries the leech its row states', () => {
    const plain = buildCharacter(40, emptyGear());
    const rage = buildCharacter(40, emptyGear(), {}, 0, fold);
    expect(rage.aspd).toBeCloseTo(plain.aspd * valueOf('buff.berserker', 'attack_speed'), 6);
    expect(rage.damageTaken).toBeCloseTo(valueOf('buff.berserker', 'damage_taken'), 6);
    expect(rage.leechPct).toBe(valueOf('buff.berserker', 'leech'));
  });

  it('leeches that share of the damage just dealt', () => {
    const rage = buildCharacter(90, emptyGear(), {}, 0, fold);
    const target = mob();
    let seed = 1;
    while (playerSwing(mulberry32(seed), rage, target, null).damage === 0) seed++;
    const hit = playerSwing(mulberry32(seed), rage, target, null);
    expect(hit.leech).toBeCloseTo((hit.damage * rage.leechPct) / 100, 6);
  });

  it('counts only while its own clock is running', () => {
    const s = newSkillState();
    s.owned['buff.berserker'] = 0;
    s.buffs['buff.berserker'] = true;
    expect(effectsActive(s).mult.attack_speed).toBeUndefined();
    s.buffUp['buff.berserker'] = 4;
    expect(effectsActive(s).mult.attack_speed).toBe(valueOf('buff.berserker', 'attack_speed'));
  });
});

describe('the stack rows and the status curses reach the status store', () => {
  it('Puncture guarantees the bleed its row names, and Flame Wisp writes its stacks', () => {
    // the gate passes on every rolled status (owner ruling), so this case reads the row's certainty on a
    // build that clears it — Alignment 100 — and the bleed is what is left to assert
    const c = { ...buildCharacter(90, emptyGear()), alignment: 100, weaponName: 'one-handed sword' };
    const store = newMobStatusStore();
    const target = mob();
    castDamage('attack.puncture', c, target, { mobStatus: store });
    // the row states a certainty (+100% bleed chance), so the rider lands on the one press
    expect(valueOf('attack.puncture', 'bleed_chance')).toBeGreaterThanOrEqual(100);
    expect(store[target.id].statuses.bleed!.perSec).toBeGreaterThan(0);

    const fireStore = newMobStatusStore();
    const burned = mob({ id: 'm2' });
    castDamage('attack.flame_wisp', c, burned, { mobStatus: fireStore });
    const burn = fireStore.m2.statuses.burn!;
    expect(burn.stacks).toBe(Math.min(S.burn.stack_max, valueOf('attack.flame_wisp', 'burn_stacks')));
    expect(burn.secLeft).toBe(S.burn.time_sec);
  });

  it('Venom Bind skips the decay its window covers', () => {
    const hold = valueOf('curse.venom_bind', 'poison_hold_sec');
    // start three seconds before a decay is due, so the hold is what decides that one
    const start = S.poison.decay_sec - 3;
    const seeded = (held: boolean) => {
      const store = newMobStatusStore();
      store.m1 = {
        statuses: { poison: { stacks: S.poison.stack_max, secLeft: 999, perSec: 0 } },
        alignedPerSec: 0, stoppedSec: 0, elapsedSec: start,
        poisonHeldUntil: held ? start + hold : undefined,
      };
      return store;
    };
    const run = (store: ReturnType<typeof newMobStatusStore>, secs: number) => {
      for (let i = 0; i < secs; i++) stepMob(store, 'm1');
      return store.m1!.statuses.poison!.stacks;
    };
    expect(run(seeded(false), S.poison.decay_sec)).toBe(S.poison.stack_max - 1); // the decay lands
    expect(run(seeded(true), S.poison.decay_sec)).toBe(S.poison.stack_max); // and the hold ate it
  });

  it('a storm holds its control status for the storm window without being a DOT', () => {
    const c = { ...buildCharacter(90, emptyGear()), alignment: 100, weaponName: 'one-handed sword' };
    const store = newMobStatusStore();
    const target = mob();
    castDamage('attack.blizzard', c, target, { mobStatus: store });
    // 20 strikes land at once (burst, not erosion); the chill default is 3s but the 8s storm
    // holds it for its own duration window — and no erosion line is written anywhere
    expect(store[target.id].statuses.chill!.secLeft).toBe(8);
    expect(store[target.id].statuses.erosion).toBeUndefined();
    const sandy = newMobStatusStore();
    const sandyTarget = mob({ id: 'm2' });
    castDamage('attack.sand_storm', c, sandyTarget, { mobStatus: sandy });
    expect(sandy[sandyTarget.id].statuses.erosion!.secLeft).toBe(10);
    expect(sandy[sandyTarget.id].statuses.chill).toBeUndefined();
  });

  it('every condition a row may name has a reader in the status store', () => {
    for (const cond of sm.EFFECT_CONDITIONS) expect(CONDITION_OF[cond]).toBeTruthy();
  });

  it('the sim spends a landed curse on the status store, not only on the curse store', () => {
    const s = newGame(96);
    huntZone(s, s.zone);
    setLevel(s, 50);
    s.zone = 4;
    s.skills.owned['curse.venom_bind'] = 1;
    s.skills.list[0] = 'curse.venom_bind'; s.skills.owned['curse.venom_bind'] ??= 0;
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    guard = 0;
    while (!Object.keys(s.curses).length && guard++ < 60) {
      s.player.mana = c.maxMana;
      s.player.hp = c.maxHp;   // the test owns the curse landing, not the fight: keep the caster up
      tick(s, {});
    }
    const mobId = Object.keys(s.curses)[0];
    expect(mobId).toBeTruthy();
    expect(lineValue(s.curses, mobId, 'poison_hold_sec')).toBe(valueOf('curse.venom_bind', 'poison_hold_sec'));
    expect(s.mobStatus[mobId].poisonHeldUntil).toBeGreaterThan(s.mobStatus[mobId].elapsedSec);
  });
});
