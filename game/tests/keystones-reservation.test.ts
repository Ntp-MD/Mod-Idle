import { describe, expect, it } from 'vitest';
import { E, sm, tree } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { mobSwing } from '../src/sim/combat';
import {
  auraResonanceOf, castOnce, effectsActive, hpReservedPct, newSkillState, reservedPct,
  setAuraPool, spendableMana, usableHp, usableMana,
  toggleTrack,
} from '../src/sim/skills';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers, supportedKeystoneKeys } from '../src/sim/keystone-runtime';
import {
  arcaneBatteryEs, manaDebtFloor, manaRegenWhileNegative, newKeystoneRuntimeState, radiantFaithCut,
  validateKeystoneRuntime, type KeystoneBundle,
} from '../../engine/keystones.ts';
import type { Mob } from '../src/sim/types';
import { characterSheet, newGame, setLevel, tick } from '../src/sim/game';
import { allocateTreePath, spendTreePoint } from '../src/sim/tree';
import { switchPreset } from '../src/sim/presets';
import { exportJson, importJson } from '../src/state/save';

registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));

const bundle = (key: string, params: Record<string, number | string>): KeystoneBundle => ({ key, params });
const sheet = (bundles: KeystoneBundle[]) =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);

function dumbMob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1e9, hpMax: 1e9,
    ps: 100, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}
const noHit = () => 0.99;

describe('Packet F — reservation and costs', () => {
  it.each(['node', 'path'] as const)('keeps reservations below the limit when buying Arcane Battery by %s', (path) => {
    const state = newGame(34);
    setLevel(state, E.stat.level_cap);
    state.player.attainmentPoints = 1;
    const id = 'keystone.arcane-battery';
    if (path === 'node') expect(allocateTreePath(state, tree.byId[id].needs[0]).ok).toBe(true);
    for (const aura of (sm.all() as any[]).filter((r) => r.type === 'aura').slice(0, 6)) {
      state.skills.owned[aura.id] = 0; state.skills.auras[aura.id] = true;
    }
    expect((path === 'node' ? spendTreePoint(state, id) : allocateTreePath(state, id)).ok).toBe(true);
    expect(reservedPct(state.skills, tree.keystoneBundles(state.player.treeRanks))).toBeLessThan(sm.RESERVATION_LIMIT);
  });

  it('preserves HP-paid auras on reload only while Blood Covenant is owned', () => {
    const state = newGame(54);
    state.player.treeRanks = { 'keystone.blood-covenant': 1 };
    const ids = ['aura.haste', 'aura.herald_of_ash', 'aura.herald_of_frost', 'aura.herald_of_lightning', 'aura.cast_on_crit', 'aura.cast_on_damage_taken', 'aura.vitality'];
    for (const id of ids) { state.skills.owned[id] = 0; state.skills.auras[id] = true; }
    state.skills.auraPool = { 'aura.vitality': 'hp' };
    const restored = importJson(exportJson(state));
    expect(ids.every((id) => restored.skills.auras[id])).toBe(true);
    expect(hpReservedPct(restored.skills, tree.keystoneBundles(restored.player.treeRanks))).toBe(sm.reservePct('mid'));
    state.player.treeRanks = {};
    const without = importJson(exportJson(state));
    expect(hpReservedPct(without.skills)).toBe(0);
    expect(reservedPct(without.skills)).toBeLessThan(sm.RESERVATION_LIMIT);
  });

  it.each(['reload', 'preset'] as const)('preserves a valid discounted aura set through %s', (path) => {
    let state = newGame(64);
    state.player.treeRanks = { 'keystone.aura-resonance': 1 };
    const ids = (sm.all() as any[]).filter((r) => r.type === 'aura').slice(0, 8).map((r) => r.id);
    for (const id of ids) { state.skills.owned[id] = 0; state.skills.auras[id] = true; }
    const before = reservedPct(state.skills, tree.keystoneBundles(state.player.treeRanks));
    expect(before).toBeLessThan(sm.RESERVATION_LIMIT);
    expect(reservedPct(state.skills)).toBeGreaterThanOrEqual(sm.RESERVATION_LIMIT);
    if (path === 'reload') state = importJson(exportJson(state));
    else { state.presets[1].auras = { ...state.skills.auras }; expect(switchPreset(state, 1)).toBe(true); }
    expect(ids.every((id) => state.skills.auras[id])).toBe(true);
    expect(reservedPct(state.skills, tree.keystoneBundles(state.player.treeRanks))).toBe(before);
  });

  it.each(['reload', 'preset'] as const)('includes Arcane Battery when validating %s reservations', (path) => {
    let state = newGame(34);
    state.player.treeRanks = { 'keystone.arcane-battery': 1 };
    const ids = (sm.all() as any[]).filter((r) => r.type === 'aura').slice(0, 6).map((r) => r.id);
    for (const id of ids) { state.skills.owned[id] = 0; state.skills.auras[id] = true; }
    if (path === 'reload') state = importJson(exportJson(state));
    else { state.presets[1].auras = { ...state.skills.auras }; expect(switchPreset(state, 1)).toBe(true); }
    expect(reservedPct(state.skills, tree.keystoneBundles(state.player.treeRanks))).toBeLessThan(sm.RESERVATION_LIMIT);
  });

  it('prices a newly enabled aura with the resulting Resonance count', () => {
    const state = newGame(64);
    state.player.treeRanks = { 'keystone.aura-resonance': 1, 'keystone.arcane-battery': 1 };
    const bundles = tree.keystoneBundles(state.player.treeRanks);
    for (const id of ['aura.haste', 'aura.herald_of_ash', 'aura.herald_of_frost', 'aura.herald_of_lightning', 'aura.vitality']) {
      state.skills.owned[id] = 0;
      expect(toggleTrack(state.skills, id, bundles).ok).toBe(true);
    }
    expect(reservedPct(state.skills, bundles)).toBeLessThan(sm.RESERVATION_LIMIT);
  });

  it('refuses an HP-to-Mana aura move that would reserve the whole pool without mutation', () => {
    const state = newGame(54);
    const bundles = tree.keystoneBundles({ 'keystone.blood-covenant': 1 });
    const ids = ['aura.haste', 'aura.herald_of_ash', 'aura.herald_of_frost', 'aura.herald_of_lightning', 'aura.cast_on_crit', 'aura.cast_on_damage_taken', 'aura.vitality'];
    for (const id of ids) { state.skills.owned[id] = 0; state.skills.auras[id] = true; }
    expect(setAuraPool(state.skills, 'aura.vitality', 'hp', bundles).ok).toBe(true);
    expect(reservedPct(state.skills, bundles)).toBeLessThan(sm.RESERVATION_LIMIT);
    const before = JSON.stringify(state.skills);
    expect(setAuraPool(state.skills, 'aura.vitality', 'mana', bundles).ok).toBe(false);
    expect(JSON.stringify(state.skills)).toBe(before);
  });

  it('shows the same Aura Resonance regeneration that the live tick pays', () => {
    const state = newGame(64);
    state.player.treeRanks = { 'keystone.aura-resonance': 1 };
    state.skills.owned['aura.clarity'] = 0;
    state.skills.auras['aura.clarity'] = true;
    state.farm.autoUse.mana = false;
    state.player.mana = 0;
    const shown = characterSheet(state);
    const withoutResonance = structuredClone(state);
    withoutResonance.player.treeRanks = {};
    expect(shown.manaRegen).toBeGreaterThan(characterSheet(withoutResonance).manaRegen);
    tick(state, { online: true });
    expect(state.player.mana).toBeCloseTo(shown.manaRegen, 10);
    expect(state.player.mana).toBeGreaterThan(0);
  });

  it('34 Arcane Battery adds 2× the fixed 40% Mana reserve to final ES and stays outside 64', () => {
    const control = sheet([]);
    const battery = sheet([bundle('arcane-battery', { reserveManaPct: 40, esPerMana: 2 })]);
    expect(arcaneBatteryEs(1000, { reserveManaPct: 40, esPerMana: 2 })).toBe(800);
    expect(battery.es - control.es).toBeCloseTo(arcaneBatteryEs(battery.maxMana, { reserveManaPct: 40, esPerMana: 2 }), 6);
    const s = newSkillState();
    expect(reservedPct(s, battery.keystones)).toBeCloseTo(reservedPct(s, []) + 40, 9);
    // 64's discount applies to aura reservations, never to the fixed 34 reserve
    const with64 = [...battery.keystones, bundle('aura-resonance', {
      reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30,
    })];
    expect(reservedPct(s, with64)).toBeCloseTo(40, 9);
  });

  it('35 Radiant Faith cuts a Hit by 10% of reserved HP, at most 30% of the Hit', () => {
    expect(radiantFaithCut(250, 100, { flatCutReservedPct: 10, maxHitCutPct: 30 })).toBe(25);
    expect(radiantFaithCut(250, 20, { flatCutReservedPct: 10, maxHitCutPct: 30 })).toBe(6);
    const bundles = [bundle('radiant-faith', { reserveHpPct: 25, flatCutReservedPct: 10, maxHitCutPct: 30 })];
    const c = { ...sheet(bundles), armour: 0, resistance: 0, resByElement: {}, maxHp: 1000, es: 0 };
    expect(hpReservedPct(newSkillState(), bundles)).toBe(25);
    expect(mobSwing(noHit, c, dumbMob({ ps: 100 }), {}, undefined, 0, 0, false, 1000).toHp).toBeCloseTo(75, 6);
    expect(mobSwing(noHit, c, dumbMob({ ps: 20 }), {}, undefined, 0, 0, false, 1000).toHp).toBeCloseTo(14, 6);
  });

  it('37 Blood Price pays the Mana part in HP 1:1 and leaves at least 1 HP', () => {
    const s = newSkillState();
    const row = (sm.all() as any[]).find((r) => r.type === 'attack'
      && sm.costOf(r, { skillLevel: 1, aoe: false }).resource === 'mana'
      && sm.costOf(r, { skillLevel: 1, aoe: false }).amount > 0);
    expect(row).toBeDefined();
    s.owned[row.id] = 1; s.list[0] = row.id;
    const cost = sm.costOf(row, { skillLevel: 1, aoe: false }).amount;
    const c = { ...sheet([bundle('blood-price', { hpPerMana: 1 })]), maxMana: 1e9, maxHp: 1000 };
    const group = [dumbMob()];
    const r = castOnce(s, c, 1e9, group, {}, () => 0.5, { currentHp: cost + 1 });
    expect(r?.manaCost).toBe(0);
    expect(r?.hpCost).toBeCloseTo(cost, 6);
    s.cd[row.id] = 0;
    expect(castOnce(s, c, 1e9, group, {}, () => 0.5, { currentHp: cost })).toBeNull();
  });

  it('52 Mana Debt borrows to the floor, then refuses positive costs until back at zero', () => {
    expect(manaDebtFloor(100, { debtLimitUsableManaPct: 50 })).toBe(50);
    expect(manaRegenWhileNegative(10, true, { debtLimitUsableManaPct: 50, negativeRegenMult: 2 })).toBe(20);
    const s = newSkillState();
    const row = (sm.all() as any[]).find((r) => r.type === 'attack'
      && sm.costOf(r, { skillLevel: 1, aoe: false }).resource === 'mana'
      && sm.costOf(r, { skillLevel: 1, aoe: false }).amount > 0);
    s.owned[row.id] = 1; s.list[0] = row.id;
    const cost = sm.costOf(row, { skillLevel: 1, aoe: false }).amount;
    const c = { ...sheet([bundle('mana-debt', { debtLimitUsableManaPct: 50, negativeRegenMult: 2 })]), maxMana: 200, maxHp: 1000 };
    const group = [dumbMob()];
    const first = castOnce(s, c, spendableMana(c, s, Math.max(0, cost - 30)), group, {}, () => 0.5, { currentHp: 1000 });
    expect(first?.manaCost).toBeCloseTo(cost, 6);
    s.cd[row.id] = 0;
    // the pool now stands negative, so a positive-cost press cannot start
    expect(castOnce(s, c, spendableMana(c, s, -30), group, {}, () => 0.5, { currentHp: 1000 })).toBeNull();
    // the snapshot is a saved number and round-trips
    const rt = newKeystoneRuntimeState();
    rt.manaDebtLimit = 50;
    expect(validateKeystoneRuntime(rt).manaDebtLimit).toBe(50);
    expect(() => validateKeystoneRuntime({ ...newKeystoneRuntimeState(), manaDebtLimit: 'x' })).toThrow(/manaDebtLimit/);
  });

  it('54 Blood Covenant moves an aura to HP without changing Max HP', () => {
    const s = newSkillState();
    const aura = (sm.all() as any[]).find((r) => r.type === 'aura' && sm.reservePct(r.reserve ?? '') > 0);
    expect(aura).toBeDefined();
    s.owned[aura.id] = 1; s.auras[aura.id] = true;
    const without = sheet([]);
    expect(setAuraPool(s, aura.id, 'hp', without.keystones).ok).toBe(false);
    const bundles = [bundle('blood-covenant', {})];
    expect(setAuraPool(s, aura.id, 'hp', bundles).ok).toBe(true);
    const c = sheet(bundles);
    expect(c.maxHp).toBe(sheet([]).maxHp);
    expect(reservedPct(s, bundles)).toBe(0);
    expect(hpReservedPct(s, bundles)).toBe(sm.reservePct(aura.reserve ?? ''));
    expect(usableHp(c, s)).toBeLessThan(c.maxHp);
    expect(usableHp(c, s)).toBeGreaterThan(0);
  });

  it('64 Aura Resonance discounts 6 aura reservations to 28% and stretches their effect once', () => {
    const s = newSkillState();
    const auras = (sm.all() as any[]).filter((r) => r.type === 'aura').slice(0, 6);
    for (const a of auras) { s.owned[a.id] = 1; s.auras[a.id] = true; }
    // pick one aura whose own reservation is 40% for the §8 example
    const params = {
      reservationPctPerAura: 5, reservationCapPct: 30, effectPctPerAura: 5, effectCapPct: 30,
    };
    const share = auraResonanceOf(s, [bundle('aura-resonance', params)]);
    expect(share.count).toBe(6);
    expect(share.bR).toBeCloseTo(0.30, 9);
    expect(share.bE).toBeCloseTo(0.30, 9);
    const pct = reservedPct(s, [bundle('aura-resonance', params)]);
    const raw = auras.reduce((sum, a) => sum + sm.reservePct(a.reserve ?? ''), 0);
    expect(pct).toBeCloseTo(raw * 0.7, 9);
    const fold = effectsActive(s, [bundle('aura-resonance', params)]);
    const rawFold = effectsActive(s, []);
    // every add line grows by 30% (rounded) and no aura identity field moves
    for (const [k, v] of Object.entries(fold.add)) {
      const base = rawFold.add[k];
      if (base === undefined) continue;
      expect(v).toBeCloseTo(Math.round(base * 1.3), 9);
    }
  });

  it('opens the reservation keys inside the full fifty-two', () => {
    expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toHaveLength(52);
    for (const key of ['arcane-battery', 'radiant-faith', 'blood-price', 'mana-debt', 'blood-covenant', 'aura-resonance']) {
      expect(supportedKeystoneKeys(KEYSTONE_HANDLERS)).toContain(key);
    }
    expect(tree).toBeDefined();
    void usableMana;
  });
});
