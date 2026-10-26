import { describe, expect, it } from 'vitest';
import { E, farm, sm } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/core/player';
import { respecTree } from '../src/sim/core/tree';
import { mobSwing, playerSwing } from '../src/sim/combat/combat';
import { applyCurse, lineValue, newCurses } from '../src/sim/combat/curse';
import {
  applyWeaponRiders, carriesTransferable, newMobStatusStore, placeKeystoneDoT, setStacks, stepMobParts, transferStatus,
} from '../src/sim/combat/mobStatus';
import { drink } from '../src/sim/world/farm';
import { applyEquilibrium, dominantElement, huntZone, newGame, revertEquilibrium, setLevel, tick } from '../src/sim/core/game';
import { painforgedBank, type KeystoneBundle } from '../../engine/keystones.ts';
import type { GameState, Mob } from '../src/sim/core/types';

/**
 * The ten bundles whose arithmetic `engine/keystones.ts` owns and the sim has to actually spend. Each
 * one runs through the live combat, status, curse and potion functions the game calls, with the same
 * fixture without the keystone as its control. A formula only its own handler can reach is not a
 * keystone — it is a node that costs an attainment point and does nothing.
 */

const bundle = (key: string, params: Record<string, number | string> = {}): KeystoneBundle => ({ key, params });
const sheet = (bundles: KeystoneBundle[] = []) =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);
const always = () => 0;
const never = () => 0.99;

function mob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1e9, hpMax: 1e9,
    ps: 100, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}
/** A physical-only build with a known pool, so a share of the Hit is a share of the number. */
const physOnly = (bundles: KeystoneBundle[] = [], critChance = 0) =>
  ({ ...sheet(bundles), phys: 100, magic: 0, elem: 0, elemByElement: {}, critChance, critDmg: 200, accuracy: 1e9 });

describe('the live keystone wiring', () => {
  it('09 Crimson Pact pays half the Physical now and owes the whole of it as Bleed', () => {
    const control = playerSwing(never, physOnly(), mob(), null, undefined, 0);
    const pact = playerSwing(never, physOnly([bundle('crimson-pact', { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 })]), mob(), null, undefined, 0);
    expect(control.bleed).toBeUndefined();
    expect(pact.bleed).toEqual({ perSec: 25, sec: 4 });
    expect(pact.damage).toBeCloseTo(control.damage / 2, 6);
  });

  it('20 Toxic Execution moves the crit bonus out of the Hit and into Poison', () => {
    const flat = playerSwing(never, physOnly([], 0), mob(), null, undefined, 0);
    const crits = playerSwing(always, physOnly([], 200), mob(), null, undefined, 0);
    expect(crits.crit).toBe(true);
    const toxic = playerSwing(always, physOnly([bundle('toxic-execution', { durationSec: 4 })], 200), mob(), null, undefined, 0);
    // the crit still happens; what it added arrives as four seconds of Poison instead (§7.2.6)
    expect(toxic.crit).toBe(true);
    expect(toxic.damage).toBeCloseTo(flat.damage, 6);
    expect(crits.damage).toBeCloseTo(flat.damage * 2, 6);
    expect(toxic.poison?.perSec).toBe(25);
    expect(toxic.poison?.sec).toBe(4);
  });

  it('10 Painforged banks a real Block cut and spends it as flat Physical on the next Hit', () => {
    const c = { ...sheet([bundle('painforged', { bankCapHpPct: 20, nextHitBonusPct: 100 })]), armour: 100, block: 100, resistance: 0, resByElement: {}, maxHp: 1000 };
    const blocked = mobSwing(never, c, mob({ ps: 200 }), {}, undefined, 0);
    expect(blocked.blocked).toBe('block');
    expect(blocked.blockCut ?? 0).toBeCloseTo(Math.min(100 / E.caps.block_divisor, 200), 6);
    // Turtle Doctrine's expected cut is not a Block event, so it feeds the bank nothing
    const turtle = mobSwing(never, { ...c, keystones: [bundle('turtle-doctrine', {})] }, mob({ ps: 200 }), {}, undefined, 0);
    expect(turtle.blocked).toBeNull();
    expect(turtle.blockCut ?? 0).toBe(0);
    expect(painforgedBank(0, 60, 1000, { bankCapHpPct: 20 })).toBe(60);
    expect(painforgedBank(180, 60, 1000, { bankCapHpPct: 20 })).toBe(200);
    const forged = [bundle('painforged', { bankCapHpPct: 20, nextHitBonusPct: 100 })];
    const plain = mob();
    const spentTarget = mob();
    playerSwing(never, physOnly(forged), plain, null, undefined, 0);
    playerSwing(never, physOnly(forged), spentTarget, null, undefined, 0, 1, 100);
    // the bank joins the Physical pool before the crit roll, so the Hit that spends it is twice the
    // Hit that did not — 100 banked on a 100-physical build
    expect(1e9 - spentTarget.hp).toBeCloseTo((1e9 - plain.hp) * 2, 6);
  });

  it('66 Elemental Conduit gives the extra lane one separate status attempt per Element', () => {
    const c = { ...sheet(), alignment: 100, elem: 10, elemByElement: {}, hitsPerSec: 1, phys: 0 } as any;
    // every roll passes: the Alignment gate, the proc, the bleed chance and the stun
    const store = newMobStatusStore();
    applyWeaponRiders(always, c, store, 'm1', false, 0, 0, [], { fire: 10 });
    expect(store.m1.statuses.burn?.stacks).toBe(1);
    const untouched = newMobStatusStore();
    applyWeaponRiders(always, c, untouched, 'm1', false, 0, 0, [], {});
    expect(untouched.m1?.statuses.burn).toBeUndefined();
    const immune = newMobStatusStore();
    applyWeaponRiders(always, c, immune, 'm1', false, 0, 0, ['burn'], { fire: 10 });
    expect(immune.m1?.statuses.burn).toBeUndefined();
  });

  it('30 Elemental Equilibrium lifts the Element that hit and strips the rest, then lapses', () => {
    const target = mob({ res: 0, resByElement: { fire: 30, cold: 20 } });
    expect(dominantElement({ nativeElement: { cold: 5 }, convertedElement: {}, extraElement: { fire: 60 } })).toBe('fire');
    expect(dominantElement({ nativeElement: {}, convertedElement: {}, extraElement: {} })).toBeNull();
    applyEquilibrium(target, 'fire', { durationSec: 4, ownResPlus: 10, otherResMinus: 20 }, 10);
    expect(target.resByElement?.fire).toBe(40);
    expect(target.resByElement?.cold).toBe(0);
    // a second application replaces the first: the line never walks past its own shift twice
    applyEquilibrium(target, 'fire', { durationSec: 4, ownResPlus: 10, otherResMinus: 20 }, 12);
    expect(target.resByElement?.fire).toBe(40);
    revertEquilibrium(target, 13);
    expect(target.resByElement?.fire).toBe(40);
    revertEquilibrium(target, 16);
    expect(target.resByElement?.fire).toBe(30);
    expect(target.resByElement?.cold).toBe(20);
    expect(target.resShift).toBeUndefined();
  });

  it('60 Plague Courier moves one Burn, Poison or Bleed whole onto the critted body', () => {
    const store = newMobStatusStore();
    placeKeystoneDoT(store, 'm1', 'bleed', 20, 4, 0);
    expect(carriesTransferable(store, 'm1')).toBe(true);
    expect(transferStatus(store, 'm1', 'm2', [])).toBe('bleed');
    expect(store.m1.statuses.bleed).toBeUndefined();
    expect(store.m2.statuses.bleed).toMatchObject({ perSec: 20, secLeft: 4 });
    // a body that cannot answer the family keeps what it had, and nothing moved
    const refused = newMobStatusStore();
    placeKeystoneDoT(refused, 'a', 'bleed', 20, 4, 0);
    expect(transferStatus(refused, 'a', 'b', ['bleed'])).toBeNull();
    expect(refused.a.statuses.bleed?.perSec).toBe(20);
    expect(refused.b).toBeUndefined();
  });

  it('a Keystoned-owned DoT line pays its own seconds and obeys immunity', () => {
    const store = newMobStatusStore();
    expect(placeKeystoneDoT(store, 'm1', 'poison', 25, 4, 100, ['poison'])).toBe(false);
    expect(placeKeystoneDoT(store, 'm1', 'poison', 25, 4, 100, [])).toBe(true);
    expect(stepMobParts(store, 'm1').poison).toBeCloseTo(25, 9);
    for (let i = 0; i < 2; i++) stepMobParts(store, 'm1');
    expect(store.m1.statuses.poison).toBeDefined();
    expect(stepMobParts(store, 'm1').poison).toBeCloseTo(25, 9);
    expect(store.m1.statuses.poison).toBeUndefined();
    // a poison the build already proc'd keeps its stack clock; the Keystone rides it, never converts it
    const stacked = newMobStatusStore();
    setStacks(stacked, 'm1', 'poison', 3, 10);
    placeKeystoneDoT(stacked, 'm1', 'poison', 40, 4, 100, []);
    expect(stacked.m1.statuses.poison?.fixedSec).toBeUndefined();
    expect(stacked.m1.statuses.poison).toMatchObject({ stacks: 3, perSec: 40 });
  });

  it('28 Malediction keeps one curse type per victim and stretches its numbers', () => {
    const weaken = { id: 'curse.weaken', duration: '10 sec', effects: [{ subject: 'target', stat: 'damage_dealt', op: 'add_pct', value: -25 }] };
    const expose = { id: 'curse.expose', duration: '10 sec', effects: [{ subject: 'target', stat: 'damage_taken', op: 'add_pct', value: 20 }] };
    const both = newCurses();
    applyCurse(both, 'm1', weaken);
    applyCurse(both, 'm1', expose);
    expect(lineValue(both, 'm1', 'damage_dealt')).toBe(-25);
    expect(lineValue(both, 'm1', 'damage_taken')).toBe(20);

    const single = newCurses();
    const malediction = [bundle('malediction', { curseLimit: 1, effectMult: 1.75 })];
    applyCurse(single, 'm1', weaken, malediction);
    expect(lineValue(single, 'm1', 'damage_dealt')).toBeCloseTo(-43.75, 9);
    applyCurse(single, 'm1', expose, malediction);
    expect(lineValue(single, 'm1', 'damage_dealt')).toBe(0);
    expect(lineValue(single, 'm1', 'damage_taken')).toBeCloseTo(35, 9);
  });

  it('17 Master Surgeon turns the Health half of a draught into a four-second stream', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0, undefined, undefined, undefined, undefined,
      [bundle('master-surgeon', { healMult: 1.5, durationSec: 4 })]);
    s.player.hp = 1;
    s.farm.potions['Red Draught'] = 3;
    const before = s.player.hp;
    expect(drink(s, c, 'Red Draught', false).ok).toBe(true);
    // nothing lands at once: the stream is four entries, and the bottle is the only thing spent
    expect(s.player.hp).toBe(before);
    expect(s.keystoneRuntime.queues.potion).toHaveLength(4);
    expect(s.farm.potions['Red Draught']).toBe(2);
    expect(drink(s, c, 'Red Draught', false).ok).toBe(false);
    expect(s.farm.potions['Red Draught']).toBe(2);
    expect(s.farm.usesThisFight).toBe(1);
    // a Mana draught is not this stream's business
    s.clockSec += farm.P.shared_cooldown_sec;
    s.player.mana = 1;
    expect(drink(s, c, 'Sky Draught', false).ok).toBe(true);
    expect(s.player.mana).toBeGreaterThan(1);
  });

  it('22 Demolition Sequence detonates on the fifth Hit that took Health, in the live fight', () => {
    const s = fightWith(['keystone.demolition-sequence']);
    for (const m of s.group) { m.hp = m.hpMax = 1e9; m.ps = 0; }
    for (let i = 0; i < 12; i++) {
      tick(s, {});
      if (s.log.some((l) => l.text.startsWith('Demolition Sequence'))) break;
    }
    expect(s.log.some((l) => l.text.startsWith('Demolition Sequence'))).toBe(true);
    expect(s.group[0].hp).toBeLessThan(1e9);
  });

  it('27 Profane Bloom bursts a cursed body through the live fight', () => {
    const s = fightWith(['keystone.profane-bloom']);
    const victim = s.group[0];
    victim.ps = 0;
    victim.hpMax = 1000;
    victim.hp = 1;
    for (const m of s.group.slice(1)) m.ps = 0;
    const witness = mob({ id: 'witness', hp: 1e9, hpMax: 1e9, ps: 0 });
    s.group.push(witness);
    applyCurse(s.curses, victim.id, { id: 'curse.expose', duration: '20 sec', effects: [{ subject: 'target', stat: 'damage_taken', op: 'add_pct', value: 20 }] });
    tick(s, {});
    expect(s.counters.kills).toBeGreaterThan(0);
    expect(s.log.some((l) => l.text.startsWith('Profane Bloom'))).toBe(true);
    // the burst is 15% of the victim's Max HP, answered once by the bystander's Chaos resistance
    expect(witness.hp).toBeLessThanOrEqual(1e9 - 150 * (1 - 0));
    const control = fightWith([]);
    for (const m of control.group) { m.ps = 0; }
    const innocent = mob({ id: 'witness', hp: 1e9, hpMax: 1e9, ps: 0 });
    control.group.push(innocent);
    control.group[0].hp = 1;
    applyCurse(control.curses, control.group[0].id, { id: 'curse.expose', duration: '20 sec', effects: [{ subject: 'target', stat: 'damage_taken', op: 'add_pct', value: 20 }] });
    tick(control, {});
    expect(innocent.hp).toBe(1e9);
    expect(control.log.some((l) => l.text.startsWith('Profane Bloom'))).toBe(false);
  });

  it('a Push ends the fight’s own Keystone state', () => {
    const s = fightWith(['keystone.staggering-resolve']);
    s.keystoneRuntime.queues.hpDebt.push({ dueAtUs: 10 * 1_000_000, amount: 5, sourceId: 'm', targetId: 'player' });
    s.keystoneRuntime.queues.deferred.push({ dueAtUs: 10 * 1_000_000, amount: 7, sourceId: 'player', targetId: 'm' });
    s.keystoneRuntime.counters['ds:hits:m'] = 3;
    s.player.hp = 0;
    tick(s, {});
    expect(s.phase).toBe('camp');
    expect(s.keystoneRuntime.queues.hpDebt).toEqual([]);
    expect(s.keystoneRuntime.queues.deferred).toEqual([]);
    expect(s.keystoneRuntime.counters).toEqual({});
  });

  it('a full respec takes the combat state and the HP pool choices with the keystones', () => {
    const s = fightWith(['keystone.blood-covenant']);
    const aura = (sm.of('aura') as any[]).find((k) => k.reserve)?.id;
    expect(aura).toBeTruthy();
    s.skills.owned[aura] ??= 0;
    s.skills.auras[aura] = true;
    s.skills.auraPool = { ...(s.skills.auraPool || {}), [aura]: 'hp' };
    s.keystoneRuntime.stacks.redline = 4;
    expect(respecTree(s).ok).toBe(true);
    expect(s.player.treeRanks).toEqual({});
    expect(s.skills.auras[aura]).toBe(false);
    expect(s.skills.auraPool).toEqual({});
    expect(s.keystoneRuntime.stacks).toEqual({});
    // the respec sells the tree, never the collection
    expect(Object.hasOwn(s.skills.owned, aura)).toBe(true);
  });

  it('09 and 20 compose: the crit bonus goes to Poison, then the rest of the Physical is halved into Bleed', () => {
    const flat = playerSwing(never, physOnly([], 0), mob(), null, undefined, 0);
    const both = playerSwing(always, physOnly([
      bundle('toxic-execution', { durationSec: 4 }),
      bundle('crimson-pact', { directPhysicalPct: 50, bleedTotalPct: 100, durationSec: 4 }),
    ], 200), mob(), null, undefined, 0);
    expect(both.damage).toBeCloseTo(flat.damage / 2, 6);
    expect(both.bleed).toEqual({ perSec: 25, sec: 4 });
    expect(both.poison?.perSec).toBe(25);
  });

  it('60 Plague Courier carries a neighbour’s Poison onto the critted body in the live fight', () => {
    const s = fightWith(['keystone.plague-courier']);
    for (const m of s.group) { m.hp = m.hpMax = 1e9; m.ps = 0; }
    const carrier = mob({ id: 'carrier', hp: 1e9, hpMax: 1e9, ps: 0 });
    s.group.push(carrier);
    s.player.points.lck = 100_000; // the crit pool is Lck, and crit has no Cap
    setStacks(s.mobStatus, carrier.id, 'poison', 3, 20);
    for (let i = 0; i < 10 && !s.mobStatus[s.group[0].id]?.statuses?.poison; i++) tick(s, {});
    expect(s.mobStatus[carrier.id]?.statuses.poison).toBeUndefined();
    expect(s.mobStatus[s.group[0].id]?.statuses.poison?.stacks).toBeGreaterThan(0);

    const control = fightWith([]);
    for (const m of control.group) { m.hp = m.hpMax = 1e9; m.ps = 0; }
    const kept = mob({ id: 'carrier', hp: 1e9, hpMax: 1e9, ps: 0 });
    control.group.push(kept);
    control.player.points.lck = 100_000;
    setStacks(control.mobStatus, kept.id, 'poison', 3, 20);
    for (let i = 0; i < 10; i++) tick(control, {});
    expect(control.mobStatus[kept.id]?.statuses.poison?.stacks).toBeGreaterThan(0);
  });

  it('53 Thornbound answers the body that took Health off us', () => {
    const s = fightWith(['keystone.thornbound', 'notable.str.01']);
    hitBox(s);
    for (let i = 0; i < 10 && !s.log.some((l) => l.text.startsWith('Thornbound answers')); i++) tick(s, {});
    expect(s.log.some((l) => l.text.startsWith('Thornbound answers'))).toBe(true);

    const control = fightWith(['notable.str.01']);
    hitBox(control);
    for (let i = 0; i < 10; i++) tick(control, {});
    expect(control.log.some((l) => l.text.startsWith('Thornbound answers'))).toBe(false);
  });
});

/** A body that will definitely land a blow, and a character alive enough to answer it. */
function hitBox(s: GameState) {
  const attacker = s.group[0];
  attacker.hp = attacker.hpMax = 1e9;
  attacker.ps = 4000;
  attacker.acc = 1e9;
  attacker.evasion = 0;
  attacker.dodgeRate = 0;
  for (const m of s.group.slice(1)) m.ps = 0;
  s.player.hp = 1e6;
  s.player.es = 0;
  return attacker;
}

/** A real fight with the named tree nodes bought — the sim reads its keystones off the allocation. */
function fightWith(nodes: string[]) {
  const s = newGame();
  setLevel(s, 60);
  expect(huntZone(s, s.zone).ok).toBe(true);
  s.player.treeRanks ||= {};
  for (const id of nodes) s.player.treeRanks[id] = 1;
  let guard = 0;
  while (!s.group.length && guard++ < 2000) tick(s, {});
  expect(s.group.length).toBeGreaterThan(0);
  return s;
}
