import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { newSkillState, castOnce, effectsActive, type CastEnv } from '../src/sim/skills';
import { newCurses, applyCurse, modsOn, lineValue } from '../src/sim/curse';
import { newMobStatusStore, stepMob, holdsCondition, CONDITION_OF, applyBleed } from '../src/sim/mobStatus';
import { newGame, tick } from '../src/sim/game';
import type { Character } from '../src/sim/player';
import type { Mob } from '../src/sim/types';

/**
 * The rows D-096 turned from prose into numbers: each must move the fight by the amount its own
 * sentence states. Nothing here types a magnitude — every expected figure is read out of
 * `skills.json`, so a spend that drifts from its text fails this file and a text that drifts from
 * its data fails cage gate S11.
 */

const row = (id: string) => sm.byId[id];
const valueOf = (id: string, stat: string) => row(id).effects.find((e: any) => e.stat === stat).value;
const foldOf = (...ids: string[]) => sm.aggregateEffects(ids.map(row));
const S = E.status as any;

const mob = (over: Partial<Mob> = {}): Mob => ({
  id: 'm1', species: 'Rat', kind: 'Small', zone: 1, level: 20,
  hp: 1e9, hpMax: 1e9, ps: 200, acc: 400, evasion: 0, dodgeRate: 0, armour: 0, res: 0,
  damage: 'mixed', innate: ['fire'], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  ...over,
} as Mob);

/** Cast one slotted skill once against one mob and report how much HP it took. */
function castDamage(id: string, c: Character, target: Mob, env: CastEnv = {}): number {
  const s = newSkillState();
  s.list[0] = id;
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

  it('is worth more on a mob of its own Element, because only the Element half is countered', () => {
    const plain = buildCharacter(90, emptyGear());
    const herald = buildCharacter(90, emptyGear(), {}, 0, fold);
    const weak = mob({ innate: ['fire'] });
    const other = mob({ id: 'm2', innate: ['cold'] });
    const gainOn = (target: Mob) =>
      playerSwing(mulberry32(1), herald, target, null).damage -
      playerSwing(mulberry32(1), { ...plain, alignment: herald.alignment }, target, null).damage;
    const weakGain = gainOn(weak);
    const otherGain = gainOn(other);
    expect(weakGain).toBeGreaterThan(0);
    // the flat rides the ×1.5 weak line on its own Element and the counter table everywhere else
    const table = E.elements.counter as Record<string, Record<string, number>>;
    expect(weakGain / otherGain)
      .toBeCloseTo((E.elements.weak_mult * table.fire.fire) / table.fire.cold, 6);
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
    s.buffs['buff.berserker'] = true;
    expect(effectsActive(s).mult.attack_speed).toBeUndefined();
    s.buffUp['buff.berserker'] = 4;
    expect(effectsActive(s).mult.attack_speed).toBe(valueOf('buff.berserker', 'attack_speed'));
  });
});

describe('Riposte and Execute spend their own sentences', () => {
  it('Riposte adds 3% per 1% of our dodge and stops at the Cap the row states', () => {
    const per = row('attack.riposte').effects.find((e: any) => e.stat === 'damage_per_dodge_pct');
    const caster = (dodge: number) => ({ ...buildCharacter(90, emptyGear()), dodgeRate: dodge } as Character);
    const dmg = (dodge: number) => castDamage('attack.riposte', caster(dodge), mob({ id: `d${dodge}` }));
    expect(dmg(20) / dmg(5)).toBeCloseTo((100 + 20 * per.value) / (100 + 5 * per.value), 6);
    // 80% dodge would be +240%, but the row caps the bonus at +120%
    expect(dmg(80) / dmg(20)).toBeCloseTo((100 + per.cap) / (100 + 20 * per.value), 6);
  });

  it('Execute doubles under its threshold and not above it', () => {
    const threshold = valueOf('attack.execute', 'execute_threshold_pct');
    const times = valueOf('attack.execute', 'execute_damage');
    const c = buildCharacter(90, emptyGear());
    const above = castDamage('attack.execute', c, mob({ hp: 1000, hpMax: 1000 })); // 100% left
    const justAbove = castDamage('attack.execute', c, mob({ id: 'm2', hp: 1000 * (threshold + 1) / 100, hpMax: 1000 }));
    const below = castDamage('attack.execute', c, mob({ id: 'm3', hp: 1000 * (threshold - 1) / 100, hpMax: 1000 }));
    expect(justAbove).toBeCloseTo(above, 6);
    expect(below / above).toBeCloseTo(times, 6);
  });

  it('Mark of the Executioner moves the threshold on the mob it landed on', () => {
    const threshold = valueOf('attack.execute', 'execute_threshold_pct');
    const shifted = valueOf('curse.mark_of_the_executioner', 'execute_threshold_pct');
    const c = buildCharacter(90, emptyGear());
    // a target between the two numbers: a finisher only once the curse has spoken
    const hp = 1000 * (threshold + shifted) / 2 / 100;
    const plain = castDamage('attack.execute', c, mob({ id: 'a', hp, hpMax: 1000 }));
    const store = newCurses();
    applyCurse(store, 'b', row('curse.mark_of_the_executioner'));
    const marked = castDamage('attack.execute', c, mob({ id: 'b', hp, hpMax: 1000 }), { curses: store });
    expect(shifted).toBeGreaterThan(threshold);
    expect(marked / plain).toBeCloseTo(valueOf('attack.execute', 'execute_damage'), 6);
    expect(lineValue(store, 'b', 'execute_threshold_pct')).toBe(shifted);
  });
});

describe('the stack rows and the status curses reach the status store', () => {
  it('Puncture and Flame Lash write the stacks their rows name onto the mob they hit', () => {
    const c = buildCharacter(90, emptyGear());
    const aligned = c.elem * (c.alignment / 100) * c.hitsPerSec;
    const store = newMobStatusStore();
    const target = mob();
    castDamage('attack.puncture', c, target, { mobStatus: store });
    const poison = store[target.id].statuses.poison!;
    expect(poison.stacks).toBe(valueOf('attack.puncture', 'poison_stacks'));
    expect(poison.perSec).toBeCloseTo(aligned * S.poison.k_dps, 6);

    const fireStore = newMobStatusStore();
    const burned = mob({ id: 'm2' });
    castDamage('attack.flame_lash', c, burned, { mobStatus: fireStore });
    const burn = fireStore.m2.statuses.burn!;
    expect(burn.stacks).toBe(Math.min(S.burn.stack_max, valueOf('attack.flame_lash', 'burn_stacks')));
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

  it('Shatter counts only while the target is chilled', () => {
    const curses = newCurses();
    applyCurse(curses, 'm1', row('curse.shatter'));
    const value = valueOf('curse.shatter', 'damage_taken');
    const status = newMobStatusStore();
    const whileChilled = (cond: string) => holdsCondition(status, 'm1', cond);
    expect(modsOn(curses, 'm1', whileChilled).damageTaken).toBe(0);
    status.m1 = { statuses: { chill: { stacks: 1, secLeft: 3, perSec: 0 } }, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 };
    expect(modsOn(curses, 'm1', whileChilled).damageTaken).toBe(value);
    status.m1.statuses.chill!.secLeft = 0;
    expect(modsOn(curses, 'm1', whileChilled).damageTaken).toBe(0);
  });

  it('Lacerate is the gate the sim reads, and the chance stays in the K table', () => {
    const curses = newCurses();
    applyCurse(curses, 'm1', row('curse.lacerate'));
    expect(lineValue(curses, 'm1', 'bleed_chance')).toBe(valueOf('curse.lacerate', 'bleed_chance'));
    // the row's 40% and engine.json's K_BLEED_CHANCE are the same number stated in one home
    expect((E.K as any).K_BLEED_CHANCE * 100).toBe(valueOf('curse.lacerate', 'bleed_chance'));
    const store = newMobStatusStore();
    let applied = 0;
    for (let i = 0; i < 50; i++) if (applyBleed(mulberry32(i), store, 'm1', 1000)) applied++;
    expect(store.m1.statuses.bleed!.perSec).toBeCloseTo((1000 * (E.K as any).K_BLEED) / (E.K as any).bleed_time_sec, 6);
    // a weaker hit cannot shorten the bleed a stronger one already started
    applyBleed(() => 0, store, 'm1', 10);
    expect(store.m1.statuses.bleed!.perSec).toBeCloseTo((1000 * (E.K as any).K_BLEED) / (E.K as any).bleed_time_sec, 6);
    expect(applied).toBeGreaterThan(0);
  });

  it('every condition a row may name has a reader in the status store', () => {
    for (const cond of sm.EFFECT_CONDITIONS) expect(CONDITION_OF[cond]).toBeTruthy();
  });

  it('the sim spends a landed curse on the status store, not only on the curse store', () => {
    const s = newGame(96);
    s.player.level = 50;
    s.zone = 4;
    s.skills.owned['curse.venom_bind'] = 1;
    s.skills.list[0] = 'curse.venom_bind';
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    guard = 0;
    while (!Object.keys(s.curses).length && guard++ < 60) {
      s.player.mana = c.maxMana;
      tick(s, {});
    }
    const mobId = Object.keys(s.curses)[0];
    expect(mobId).toBeTruthy();
    expect(lineValue(s.curses, mobId, 'poison_hold_sec')).toBe(valueOf('curse.venom_bind', 'poison_hold_sec'));
    expect(s.mobStatus[mobId].poisonHeldUntil).toBeGreaterThan(s.mobStatus[mobId].elapsedSec);
  });
});
