import { describe, expect, it } from 'vitest';
import { E, eng, sm, tree } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import { newMobStatusStore, stepMobParts } from '@sim/combat/mobStatus';
import { prepareSkillCast, resolvePreparedCast, reservedMana, spendableMana, toggleTrack, tickSkills } from '@sim/combat/skills';
import { createCastTrigger } from '@sim/core/tick/cast-trigger';
import { mobFixture } from '../fixtures/mobFixture';
import { liveId } from '../fixtures/liveSkill';

const target = (id: string) => mobFixture({ id, hp: 1e9, hpMax: 1e9,
  evasion: 0, dodgeRate: 0, armour: 0, res: 0, innate: [], skillIds: [] });

function rotation() {
  const state = newGame(73);
  setLevel(state, 90);
  const statuses = newMobStatusStore();
  const skills = state.skills;
  const press = (id: string, group: ReturnType<typeof target>[], rng = mulberry32(7)) => {
    skills.owned[id] ??= 0;
    const c = characterSheet(state);
    const prepared = prepareSkillCast(skills, c, id, spendableMana(c, skills, state.player.mana), group,
      state.playerStatuses, { spatialTargets: false, currentHp: state.player.hp });
    expect(prepared, id).not.toBeNull();
    const report = resolvePreparedCast(skills, c, prepared!, {}, rng, { mobStatus: statuses });
    const { payCast } = createCastTrigger({ s: state, c } as Parameters<typeof createCastTrigger>[0]);
    payCast(report);
    return report;
  };
  state.player.hp = characterSheet(state).maxHp;
  state.player.mana = characterSheet(state).maxMana;
  return { state, skills, statuses, press };
}

describe('release: live interactions, paid through the game payment owner', () => {
  it('live penetration answers high resistance in a rotation with conversion active', () => {
    const r = rotation();
    r.skills.owned['aura.ember_conversion'] = 0;
    expect(toggleTrack(r.skills, 'aura.ember_conversion').ok).toBe(true);
    const results = ['attack.impale', 'attack.fireball'].map(id => {
      const clear = r.press(id, [target(`${id}-clear`)]).dealt!;
      tickSkills(r.skills, 100);
      const resistant = r.press(id, [{ ...target(`${id}-resistant`), res: 75 }]).dealt!;
      return { id, clear, resistant };
    });
    expect(results[0].resistant).toBeCloseTo(results[0].clear, 8);
    expect(results[1].resistant).toBeLessThan(results[1].clear);
    console.log(JSON.stringify({ scenario: 'live-penetration-and-conversion', results }));
  });

  it('a live poison hold preserves the shared stacks for exactly its authored window', () => {
    const r = rotation();
    const id = liveId(row => row.type === 'attack' && row.effects?.some((e: any) => e.stat === 'poison_hold_sec'), 'poison hold');
    const mob = target('held-poison');
    r.press(id, [mob]);
    const held = r.statuses[mob.id].statuses.poison!.stacks;
    const until = r.statuses[mob.id].poisonHeldUntil!;
    expect(until).toBeGreaterThan(0);
    for (let sec = 0; sec < until; sec++) {
      stepMobParts(r.statuses, mob.id);
      expect(r.statuses[mob.id].statuses.poison!.stacks).toBe(held);
    }
    for (let sec = 0; sec < E.status.poison.decay_sec; sec++) stepMobParts(r.statuses, mob.id);
    expect(r.statuses[mob.id].statuses.poison!.stacks).toBeLessThan(held);
    console.log(JSON.stringify({ scenario: 'poison-hold', id, held, until,
      after: r.statuses[mob.id].statuses.poison!.stacks }));
  });

  it('live poison, burn and bleed share the elemental DoT budget while bleed refreshes without stacking', () => {
    const r = rotation();
    const ids = ['attack.poison_cloud', 'attack.ignite', 'attack.puncture'];
    const mob = target('dot-mixture');
    for (const id of ids) r.press(id, [mob], () => 0);
    expect(r.statuses[mob.id].statuses.bleed).toBeDefined();
    const duration = r.statuses[mob.id].statuses.bleed!.secLeft;
    const first = stepMobParts(r.statuses, mob.id);
    expect(first.burn + first.poison + first.erosion)
      .toBeLessThanOrEqual(E.status.dot_cap * r.statuses[mob.id].alignedPerSec + 1e-8);
    expect(first.total).toBeCloseTo(first.burn + first.poison + first.erosion + first.bleed, 8);
    expect(first.bleed).toBeGreaterThan(0);
    tickSkills(r.skills, 100);
    r.press('attack.puncture', [mob], () => 0);
    const refreshed = r.statuses[mob.id].statuses.bleed!;
    expect(refreshed.stacks).toBe(1);
    expect(refreshed.secLeft).toBe(duration);
    const next = stepMobParts(r.statuses, mob.id);
    expect(next.bleed).toBeCloseTo(first.bleed, 8);
    const bleedPayoffs = sm.all().filter(row => !row.retired && sm.exploitedStatusOf(row) === 'bleed');
    expect(bleedPayoffs).toHaveLength(0);
    console.log(JSON.stringify({ scenario: 'dot-mixture-and-bleed-refresh', ids, first, next,
      duration, bleedPayoff: 'none in live catalogue' }));
  });

  it('live conversion auras and a conversion buff obey one hit budget and reserve the spendable pool', () => {
    const r = rotation();
    const auras = ['aura.ember_conversion', 'aura.rime_conversion'];
    for (const id of auras) {
      r.skills.owned[id] = 0;
      expect(toggleTrack(r.skills, id).ok, id).toBe(true);
    }
    r.press('buff.enchant_poison', [target('conversion')]);
    const c = characterSheet(r.state);
    const converted = eng.convertDamageOf(c.phys, c.conversion);
    const sum = converted.physical + Object.values(converted.byElement).reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(c.phys + 1e-8);
    for (const element of ['fire', 'cold', 'poison']) expect(c.conversion[element]).toBeGreaterThan(0);
    const reserved = reservedMana(c, r.skills);
    expect(reserved).toBeGreaterThan(0);
    r.state.player.mana = reserved;
    expect(spendableMana(c, r.skills, r.state.player.mana)).toBe(0);
    r.skills.owned['attack.fireball'] = 0;
    expect(prepareSkillCast(r.skills, c, 'attack.fireball', spendableMana(c, r.skills, r.state.player.mana),
      [target('unfunded')], {})).toBeNull();
    console.log(JSON.stringify({ scenario: 'conversion-buff-reservation', auras,
      buff: 'buff.enchant_poison', shares: c.conversion, converted, reserved }));
  });

  it('Blood Price substitutes the live price and the payment owner debits HP once with auras active', () => {
    const r = rotation();
    r.state.player.treeRanks = { 'keystone.blood-price': 1 };
    expect(tree.keystoneBundles(r.state.player.treeRanks).some(k => k.key === 'blood-price')).toBe(true);
    r.skills.owned['aura.ember_conversion'] = 0;
    expect(toggleTrack(r.skills, 'aura.ember_conversion').ok).toBe(true);
    const before = { hp: r.state.player.hp, mana: r.state.player.mana };
    const id = 'attack.fireball';
    const report = r.press(id, [target('blood-price')]);
    expect(report.hpCost).toBeGreaterThan(0);
    expect(report.manaCost).toBe(0);
    expect(r.state.player.hp).toBeCloseTo(before.hp - report.hpCost, 8);
    expect(r.state.player.mana).toBe(before.mana);
    console.log(JSON.stringify({ scenario: 'blood-price-payment', id, before,
      hp: r.state.player.hp, mana: r.state.player.mana, hpCost: report.hpCost, manaCost: report.manaCost }));
  });
});
